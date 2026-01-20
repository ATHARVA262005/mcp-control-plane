import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mcp-control-plane',
  logLevel: process.env.LOG_LEVEL || 'info',
  env: process.env.NODE_ENV || 'development',
};
