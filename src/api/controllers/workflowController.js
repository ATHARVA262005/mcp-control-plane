import { workflowService } from '../../services/workflowService.js';
import { AuditLog } from '../../models/AuditLog.js'; // Direct access for simplicity or move to service
import logger from '../../infrastructure/logger.js';
import { z } from 'zod';

const createWorkflowSchema = z.object({
  goal: z.string().min(1),
  context: z.object({}).optional()
});

export const createWorkflow = async (req, res, next) => {
  try {
    const { goal, context } = createWorkflowSchema.parse(req.body);
    const workflow = await workflowService.createWorkflow(goal, context);
    res.status(201).json(workflow);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: error.errors });
    }
    next(error);
  }
};

export const getWorkflow = async (req, res, next) => {
  try {
    const workflow = await workflowService.getWorkflow(req.params.id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json(workflow);
  } catch (error) {
    next(error);
  }
};

export const getWorkflowLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ workflowId: req.params.id }).sort({ timestamp: -1 });
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

export const getWorkflowTasks = async (req, res, next) => {
  try {
    const tasks = await workflowService.getWorkflowTasks(req.params.id);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
};
