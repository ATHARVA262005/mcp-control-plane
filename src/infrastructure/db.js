import mongoose from 'mongoose';
import logger from './logger.js';
import { config } from '../config/index.js';

export const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB connected successfully');
    
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
};
