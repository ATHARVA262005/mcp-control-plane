import { defineJob } from '../infrastructure/scheduler.js';
import { Task } from '../models/Task.js';
import { Workflow } from '../models/Workflow.js'; // Imported for potential status updates
import { mcpClient } from '../core/mcpClient.js';
import { auditService } from '../services/auditService.js';
import logger from '../infrastructure/logger.js';

async function reconcileWorkflow(workflowId) {
  const tasks = await Task.find({ workflowId });
  const workflow = await Workflow.findById(workflowId);
  
  if (!workflow || ['COMPLETED', 'FAILED'].includes(workflow.status)) return;

  const hasFailed = tasks.some(t => t.status === 'FAILED');
  if (hasFailed) {
    workflow.status = 'FAILED';
    workflow.error = { message: 'Workflow failed due to one or more task failures (Reconciled)' };
    await workflow.save();
    await auditService.log(workflowId, 'WORKFLOW_FAILED', { reason: 'Reconciliation found failed tasks' });
    return;
  }

  const allCompleted = tasks.every(t => t.status === 'COMPLETED');
  if (allCompleted) {
    workflow.status = 'COMPLETED';
    workflow.result = { message: 'All tasks completed successfully (Reconciled)' };
    await workflow.save();
    await auditService.log(workflowId, 'WORKFLOW_COMPLETED', { reason: 'Reconciliation confirmed completion' });
  }
}


export const registerJobs = () => {
  defineJob('execute-task', async (job) => {
    const { taskId, executionId } = job.attrs.data;
    const task = await Task.findById(taskId);

    if (!task) {
      logger.error(`[ExecID: ${executionId}] Task not found: ${taskId}`);
      return;
    }

    try {
      // 1. Idempotency & Crash Guard
      // If task is already COMPLETED or has output, skip execution but proceed to completion check.
      let result;
      
      if (task.status === 'COMPLETED') {
        logger.warn(`[CrashGuard] [ExecID: ${executionId}] Task ${taskId} is already COMPLETED. Skipping execution, checking workflow completion.`);
        result = task.output;
      } else if (task.status === 'FAILED') {
        logger.warn(`[CrashGuard] [ExecID: ${executionId}] Task ${taskId} is already FAILED. Skipping execution.`);
        // Reconciliation: Ensure workflow reflects this failure
        await reconcileWorkflow(task.workflowId);
        return; 
      } else if (task.output) {
        logger.warn(`[IdempotencyGuard] [ExecID: ${executionId}] Task ${taskId} has output but status=${task.status}. Marking COMPLETED.`);
        result = task.output;
        task.status = 'COMPLETED';
        task.completedAt = new Date();
        await task.save();
      } else {
        // 2. Normal Execution
        task.status = 'RUNNING';
        task.startedAt = new Date();
        await task.save();
        
        await auditService.log(task.workflowId, 'TASK_STARTED', { taskId, tool: task.name });

        // Execute Tool
        result = await mcpClient.executeTool(task.name, task.input);

        task.output = result;
        task.status = 'COMPLETED';
        task.completedAt = new Date();
        await task.save();

        await auditService.log(task.workflowId, 'TASK_COMPLETED', { taskId, result });
      }

      // 3. Workflow Completion Check (Always run this, even if we skipped execution)
      await reconcileWorkflow(task.workflowId);


    } catch (error) {
      logger.error(`Task execution failed: ${task.name}`, error);
      
      task.retryCount += 1;
      task.error = { message: error.message, stack: error.stack };
      
      if (task.retryCount < task.maxRetries) {
        task.status = 'PENDING';
        await task.save();
        logger.info(`[ExecID: ${executionId}] Task ${taskId} failed. Retrying... (${task.retryCount}/${task.maxRetries})`);
        throw error; // Trigger Agenda retry
      } 
      
      // 4. Failure Propagation
      task.status = 'FAILED';
      await task.save();
      await auditService.log(task.workflowId, 'TASK_FAILED', { taskId, error: error.message });
      
      // Mark Workflow as FAILED
      await Workflow.findByIdAndUpdate(task.workflowId, { 
        status: 'FAILED',
        error: { message: `Task ${task.name} failed: ${error.message}` } 
      });
      await auditService.log(task.workflowId, 'WORKFLOW_FAILED', { workflowId: task.workflowId, error: error.message });
      
      throw error;
    }
  });
};
