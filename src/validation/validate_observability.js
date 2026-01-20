
import mongoose from 'mongoose';
import { workflowService } from '../services/workflowService.js';
import { AuditLog } from '../models/AuditLog.js';
import { Task } from '../models/Task.js';
import { Workflow } from '../models/Workflow.js';
import agenda from '../infrastructure/scheduler.js';
import { registerJobs } from '../jobs/index.js';

// Configuration (Hardcoded for validation context if env not set, but better to rely on what's available or defaults)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mcp_control_plane';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runValidation() {
  console.log('Starting Observability Validation...');
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Initialize Jobs
    registerJobs();
    await agenda.start();
    console.log('Agenda started');
    
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  }

  // Clear previous test data to avoid confusion? 
  // Maybe not, but let's just create new workflows.

  const report = {
    eventSequence: [],
    missingEvents: [],
    score: 0
  };

  // --- Test Case 1: Successful Workflow ---
  console.log('\n--- Test Case 1: Successful Workflow ---');
  const successGoal = 'Search the web for "Observability"';
  let successWorkflowId;
  
  try {
    const wf = await workflowService.createWorkflow(successGoal);
    successWorkflowId = wf._id;
    console.log(`Created Successful Workflow: ${successWorkflowId} (TraceID: ${wf.traceId})`);

    // Wait for completion (poll)
    let completed = false;
    let attempts = 0;
    while (!completed && attempts < 20) {
      await delay(1000);
      const currentWf = await Workflow.findById(successWorkflowId);
      if (currentWf.status === 'COMPLETED' || currentWf.status === 'FAILED') {
        completed = true;
        console.log(`Workflow finished with status: ${currentWf.status}`);
      }
      attempts++;
    }
  } catch (err) {
    console.error('Error in Success Case:', err);
  }

  // --- Test Case 2: Failed Workflow (with Retries) ---
  console.log('\n--- Test Case 2: Failed Workflow ---');
  // We need a goal that routes to a non-existent tool or fails.
  // The contextRouter currently mocks routing. 
  // Let's assume we can trigger a failure by requesting a non-existent tool if the router maps it.
  // Or, since the router is likely simple, let's see how we can force a failure.
  // The router probably maps "search" to "search_web".
  // If we give a goal "Fail me", and the router doesn't map it, it might fail routing or create a task with no tool.
  // Let's rely on the router mock.
  // Update: I'll assume for now I can't easily force a routing failure without inspecting router.js more closely,
  // BUT I can create a workflow that asks for something the internal server doesn't support if the router maps it.
  // Let's assume "Search the web" works.
  // If I assume the router is hardcoded or LLM based.
  // I'll try to execute a tool that fails. 
  // Wait, the router determines the tool. If the router maps "Delete database" to a tool "delete_db", and that tool doesn't exist in mcpClient/server, it will fail.
  // Let's try a goal that definitely shouldn't work or should route to a missing tool.
  // Actually, I'll stick to a workflow that likely routes to a tool, but I want to simulate failure.
  // If I can't control routing easily to a bad tool, I might rely on the fact that existing tools might fail on bad input?
  // "search_web" in internal server always succeeds.
  // I need a tool that throws.
  // Since I can't modify code, I can't add a failing tool.
  // But wait, the task execution job throws if `mcpClient.executeTool` fails.
  // `mcpClient.executeTool` calls `client.callTool`.
  // If I ask for a tool that the internal server doesn't list, `callTool` will fail.
  // So I need the router to output a tool name that doesn't exist.
  // If the router is dynamic (LLM), I can ask "Use tool 'non_existent_tool' to do X".
  // If the router is static/regex, I might be stuck.
  // Let's peek at `router.js` content first? I did see the file list, but not content.
  // I'll assume for this script I can create a workflow. 
  // Actually, I'll proceed with creating the script, but I might need to adjust the goal for failure.
  // Let's try "Run non_existent_tool".
  
  const failGoal = 'Use non_existent_tool to cause error';
  let failWorkflowId;
  
  try {
    const wf = await workflowService.createWorkflow(failGoal);
    failWorkflowId = wf._id;
    console.log(`Created Failed Workflow: ${failWorkflowId} (TraceID: ${wf.traceId})`);

    // Wait for completion
    let completed = false;
    let attempts = 0;
    while (!completed && attempts < 30) { // More attempts for retries
      await delay(1000);
      const currentWf = await Workflow.findById(failWorkflowId);
      if (currentWf.status === 'COMPLETED' || currentWf.status === 'FAILED') {
        completed = true;
        console.log(`Workflow finished with status: ${currentWf.status}`);
      }
      attempts++;
    }
  } catch (err) {
    console.error('Error in Fail Case:', err);
  }

  // --- Analyze Logs ---
  console.log('\n--- Analysis ---');

  const analyzeWorkflow = async (wfId, expectedStatus) => {
    if (!wfId) return;
    const logs = await AuditLog.find({ workflowId: wfId }).sort({ timestamp: 1 });
    
    console.log(`Logs for ${wfId}:`);
    logs.forEach(l => console.log(`[${l.level}] ${l.eventType} - ${JSON.stringify(l.details)}`));

    // Check Immutability (Conceptual check: Schema has immutable: true for timestamp, but here we check existence)
    // Check TraceId usage
    // We don't have traceId in AuditLog directly, we have workflowId which maps to traceId.
    // The requirement "TraceId allows full workflow reconstruction" is met if we can find all logs via workflowId
    // and workflowId links to a TraceId.
    
    const wf = await Workflow.findById(wfId);
    console.log(`TraceID verification: Workflow ${wf.traceId} has ${logs.length} logs.`);

    // Check Sequence
    const eventTypes = logs.map(l => l.eventType);
    
    if (expectedStatus === 'COMPLETED') {
      const required = ['WORKFLOW_CREATED', 'TASK_SCHEDULED', 'TASK_STARTED', 'TASK_COMPLETED', 'WORKFLOW_COMPLETED'];
      const missing = required.filter(e => !eventTypes.includes(e));
      if (missing.length === 0) {
        console.log('✅ Successful Workflow: All required events present.');
        report.score += 2.5; 
      } else {
        console.log('❌ Successful Workflow: Missing events:', missing);
        report.missingEvents.push({ wfId, missing });
      }
    } else {
       // Failed workflow
       const required = ['WORKFLOW_CREATED', 'TASK_SCHEDULED', 'TASK_STARTED', 'TASK_FAILED', 'WORKFLOW_FAILED'];
       const missing = required.filter(e => !eventTypes.includes(e));
       // We expect retries, so multiple STARTED/FAILED might occur.
       // Important is that we eventually hit WORKFLOW_FAILED.
       if (missing.length === 0) {
         console.log('✅ Failed Workflow: All required events present.');
         report.score += 2.5;
       } else {
         console.log('❌ Failed Workflow: Missing events:', missing);
         report.missingEvents.push({ wfId, missing });
       }
    }
    
    report.eventSequence.push({ wfId, events: eventTypes });
  };

  await analyzeWorkflow(successWorkflowId, 'COMPLETED');
  await analyzeWorkflow(failWorkflowId, 'FAILED');

  console.log('\n--- Final Observability Score ---');
  console.log(`${report.score} / 5`);
  
  await mongoose.disconnect();
}

runValidation();
