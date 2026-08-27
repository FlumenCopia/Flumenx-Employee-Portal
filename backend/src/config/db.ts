import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDB() {
  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error: any) {
    console.error(`[MongoDB] Connection Warning: ${error.message}`);
    return null;
  }
}
