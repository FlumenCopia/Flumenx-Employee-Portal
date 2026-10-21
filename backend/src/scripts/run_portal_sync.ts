import { connectDB } from '../config/db.js';
import { syncDefaultPortalPages } from '../services/portalSync.js';
import mongoose from 'mongoose';

async function run() {
  try {
    await connectDB();
    await syncDefaultPortalPages();
    console.log('[PortalSync] Successfully synchronized pages and permissions.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[PortalSync] Error:', err);
    process.exit(1);
  }
}

run();
