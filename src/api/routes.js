import express from 'express';
import * as workflowController from './controllers/workflowController.js';

const router = express.Router();

router.post('/workflows', workflowController.createWorkflow);
router.get('/workflows/:id', workflowController.getWorkflow);
router.get('/workflows/:id/tasks', workflowController.getWorkflowTasks);
router.get('/workflows/:id/logs', workflowController.getWorkflowLogs);

export default router;
