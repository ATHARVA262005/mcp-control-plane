import { Agenda } from 'agenda';
import { config } from '../config/index.js';
import logger from './logger.js';

const agenda = new Agenda({ 
  db: { address: config.mongoUri, collection: 'agendaJobs' },
  processEvery: '30 seconds'
});

agenda.on('ready', async () => {
  logger.info('Agenda scheduler ready');
  // Manual start in server.js to avoid race conditions
});

agenda.on('error', (err) => {
  logger.error('Agenda connection error:', err);
});

export const defineJob = (name, handler) => {
  agenda.define(name, async (job) => {
    logger.info(`Running job: ${name}`);
    try {
      await handler(job);
      logger.info(`Job completed: ${name}`);
    } catch (error) {
      logger.error(`Job failed: ${name}`, error);
      throw error;
    }
  });
};

export const scheduleJob = async (when, name, data) => {
  await agenda.schedule(when, name, data);
};

export const nowJob = async (name, data) => {
  await agenda.now(name, data);
};

export default agenda;
