import mongoose from 'mongoose';

const workflowSchema = new mongoose.Schema({
  traceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  goal: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  context: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  result: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    message: String,
    stack: String
  }
}, {
  timestamps: true
});

export const Workflow = mongoose.model('Workflow', workflowSchema);
