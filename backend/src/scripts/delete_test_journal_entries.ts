import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { JournalEntry } from '../models/accounting/JournalEntry.js';
import { Invoice } from '../models/accounting/Invoice.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_portal';

async function deleteTestEntries() {
  console.log('====================================================');
  console.log('FlumenX Accounting DB Cleanup Tool');
  console.log('Connecting to:', MONGODB_URI);
  console.log('====================================================');

  await mongoose.connect(MONGODB_URI);

  const targetJournals = ['ADJUSTMENT-2026-0001', 'SALES-2026-0001'];

  // 1. Inspect existing Journal Entries
  const existingJournals = await JournalEntry.find({
    journalNumber: { $in: targetJournals },
  });

  console.log(`Found ${existingJournals.length} target journal entries in database.`);
  for (const j of existingJournals) {
    console.log(` - ID: ${j._id} | Number: ${j.journalNumber} | Type: ${j.voucherType} | Amount: ₹${j.totalDebit} | Status: ${j.status}`);
  }

  if (existingJournals.length > 0) {
    const deleteRes = await JournalEntry.deleteMany({
      journalNumber: { $in: targetJournals },
    });
    console.log(`Successfully deleted ${deleteRes.deletedCount} journal entries from MongoDB.`);
  } else {
    console.log('No matching journal entries found (they may have already been deleted).');
  }

  // 2. Check and delete test invoice INV-2026-0001 if present
  const existingInvoice = await Invoice.findOne({ invoiceNumber: 'INV-2026-0001' });
  if (existingInvoice) {
    console.log(`Found linked test invoice: ${existingInvoice.invoiceNumber} (Client: ${existingInvoice.clientName}, Amount: ₹${existingInvoice.totalAmount})`);
    await Invoice.deleteOne({ _id: existingInvoice._id });
    console.log(`Successfully deleted invoice ${existingInvoice.invoiceNumber} from MongoDB.`);
  } else {
    console.log('No test invoice INV-2026-0001 found in database.');
  }

  console.log('====================================================');
  console.log('Cleanup completed successfully.');
  console.log('====================================================');

  await mongoose.disconnect();
}

deleteTestEntries().catch((err) => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
