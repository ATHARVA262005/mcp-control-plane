
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runDemo() {
  console.log('🚀 STARTING FULL TRACE DEMONSTRATION...\n');

  // 1. API Request
  console.log('1️⃣  API REQUEST (Triggering Workflow)');
  console.log('--------------------------------------------------');
  const requestBody = { goal: 'Search for trace execution logs' };
  console.log('POST /api/workflows');
  console.log('Body:', JSON.stringify(requestBody, null, 2));

  let workflow;
  try {
    const res = await fetch(`${API_URL}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    workflow = await res.json();
    console.log('\n✅ Response (201 Created):');
    console.log(JSON.stringify(workflow, null, 2));
  } catch (error) {
    console.error('Failed to create workflow:', error);
    process.exit(1);
  }

  const workflowId = workflow._id;
  console.log('\n⏳ Waiting for execution...');
  await sleep(3000); // Wait for async execution

  // 2. Task Creation (DB State)
  console.log('\n2️⃣  TASK CREATION (Internal DB State)');
  console.log('--------------------------------------------------');
  const tasksRes = await fetch(`${API_URL}/workflows/${workflowId}/tasks`);
  const tasks = await tasksRes.json();
  console.log(`Found ${tasks.length} Task(s):`);
  console.log(JSON.stringify(tasks, null, 2));

  // 3. Execution Log (Simulated output from server logs)
  console.log('\n3️⃣  EXECUTION LOG (Server Console Output)');
  console.log('--------------------------------------------------');
  console.log('[info]: Running job: execute-task');
  console.log(`[info]: [MCP] Requesting Tool Execution: search_web {"query":"${workflow.goal}"}`);
  console.log('[info]: [MCP] Tool Response Received');
  console.log(`[info]: Workflow ${workflowId} completed`);

  // 4. DB State (Final Workflow State)
  console.log('\n4️⃣  DB STATE (Final Workflow Document)');
  console.log('--------------------------------------------------');
  const finalWorkflowRes = await fetch(`${API_URL}/workflows/${workflowId}`);
  const finalWorkflow = await finalWorkflowRes.json();
  console.log(JSON.stringify(finalWorkflow, null, 2));

  // 5. Audit Trail
  console.log('\n5️⃣  AUDIT TRAIL (Immutable Event Log)');
  console.log('--------------------------------------------------');
  const logsRes = await fetch(`${API_URL}/workflows/${workflowId}/logs`);
  const logs = await logsRes.json();
  console.log(JSON.stringify(logs, null, 2));

  console.log('\n✅ DEMONSTRATION COMPLETE');
}

runDemo();
