import { connectDB } from '../config/db.js';
import seedDeliverablesFromExcel from '../controllers/helpers/excelDeliverablesHelper.js';
import mongoose from 'mongoose';

async function run() {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await connectDB();
    console.log('[Seed] Seeding Client Deliverables from Excel data...');
    const result = await seedDeliverablesFromExcel();
    console.log('[Seed] Result:', result);
    await mongoose.disconnect();
    console.log('[Seed] Done.');
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error seeding deliverables:', err);
    process.exit(1);
  }
}

run();
