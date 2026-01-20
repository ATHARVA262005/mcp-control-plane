import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow',
    required: true,
    index: true
  },
  level: {
    type: String,
    enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'],
    default: 'INFO'
  },
  eventType: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  timestamps: false, // We use our own timestamp
  versionKey: false // Immutable logs don't need versioning usually
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
