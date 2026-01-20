import { AuditLog } from '../models/AuditLog.js';
import logger from '../infrastructure/logger.js';

class AuditService {
  async log(workflowId, eventType, details, level = 'INFO') {
    try {
      await AuditLog.create({
        workflowId,
        eventType,
        details,
        level
      });
    } catch (error) {
      // Don't throw to avoid disrupting the main flow, but log strictly
      logger.error('Failed to create audit log', error);
    }
  }
}

export const auditService = new AuditService();
