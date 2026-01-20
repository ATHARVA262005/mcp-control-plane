import { v4 as uuidv4 } from 'uuid';
import { Workflow } from '../models/Workflow.js';
import { Task } from '../models/Task.js';
import { auditService } from './auditService.js';
import { contextRouter } from '../core/router.js';
import logger from '../infrastructure/logger.js';
import { scheduleJob } from '../infrastructure/scheduler.js';

class WorkflowService {
  async createWorkflow(goal, context = {}) {
    const traceId = uuidv4();
    
    // 1. Create Workflow Record
    const workflow = await Workflow.create({
      traceId,
      goal,
      context,
      status: 'PENDING'
    });

    await auditService.log(workflow._id, 'WORKFLOW_CREATED', { goal, traceId });

    // 2. Perform Initial Routing
    try {
      const nextSteps = await contextRouter.route(goal, context);
      
      // 3. Update status to RUNNING efficiently
      // We set status to RUNNING *before* scheduling tasks to avoid a race condition
      // where a fast worker completes the workflow before we set it to RUNNING here.
      if (nextSteps.length > 0) {
        workflow.status = 'RUNNING';
        await workflow.save();
      }

      // 4. Create and Schedule Tasks
      for (const step of nextSteps) {
        const task = await Task.create({
          workflowId: workflow._id,
          type: step.type,
          name: step.name,
          input: step.input,
          status: 'PENDING'
        });
        
        // 5. Schedule Execution
        // We schedule the task execution job, passing a unique Execution ID for crash awareness.
        const executionId = uuidv4();
        await scheduleJob('now', 'execute-task', { taskId: task._id.toString(), executionId });
        
        await auditService.log(workflow._id, 'TASK_SCHEDULED', { taskId: task._id, taskName: task.name, executionId });
      }

    } catch (error) {
      logger.error('Routing failed', error);
      workflow.status = 'FAILED';
      workflow.error = { message: error.message, stack: error.stack };
      await workflow.save();
    }

    return workflow;
  }

  async getWorkflow(id) {
    return Workflow.findById(id);
  }

  async getWorkflowTasks(id) {
    return Task.find({ workflowId: id });
  }

  async getWorkflowLogs(id) {
    // Implement log retrieval
  }
}

export const workflowService = new WorkflowService();
