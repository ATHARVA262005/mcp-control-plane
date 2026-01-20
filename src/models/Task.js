import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['TOOL_CALL', 'ROUTING', 'REASONING', 'SYSTEM'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  input: {
    type: mongoose.Schema.Types.Mixed
  },
  output: {
    type: mongoose.Schema.Types.Mixed
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  error: {
    message: String,
    stack: String
  },
  startedAt: Date,
  completedAt: Date
}, {
  timestamps: true
});

export const Task = mongoose.model('Task', taskSchema);
