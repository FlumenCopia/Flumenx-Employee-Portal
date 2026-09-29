import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { CompanyHoliday } from '../models/CompanyHoliday.js';
import { getISTDateString, getCompanyStartOfDay } from '../utils/tzUtils.js';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/flumenx';
  await mongoose.connect(uri);

  console.log('[Fix] Connected to MongoDB.');

  const holidays = await CompanyHoliday.find({});
  for (const h of holidays) {
    const correctDateStr = getISTDateString(h.date);
    if (h.dateStr !== correctDateStr) {
      console.log(`[Fix] Correcting ${h.name}: "${h.dateStr}" -> "${correctDateStr}"`);
      h.dateStr = correctDateStr;
      await h.save();
    }
  }

  // Also ensure Kerala standard holidays in August/September are seeded properly
  const standardHolidays = [
    { name: 'Thiruvonam (Onam)', dateStr: '2026-08-27', holidayType: 'Company' },
    { name: 'Third Onam', dateStr: '2026-08-28', holidayType: 'Company' },
    { name: 'Milad-un-Nabi', dateStr: '2026-09-04', holidayType: 'Public' },
  ];

  for (const sh of standardHolidays) {
    const existing = await CompanyHoliday.findOne({ dateStr: sh.dateStr });
    if (!existing) {
      const hDate = getCompanyStartOfDay(sh.dateStr);
      await CompanyHoliday.create({
        name: sh.name,
        date: hDate,
        dateStr: sh.dateStr,
        holidayType: sh.holidayType,
        isPaid: true,
        applicableToAll: true,
        year: 2026,
        isActive: true,
      });
      console.log(`[Fix] Created missing holiday: ${sh.name} on ${sh.dateStr}`);
    } else {
      existing.isActive = true;
      await existing.save();
      console.log(`[Fix] Verified active holiday: ${existing.name} on ${existing.dateStr}`);
    }
  }

  const allHolidays = await CompanyHoliday.find({ isActive: true }).sort({ dateStr: 1 });
  console.log(`[Fix] Current Active Company Holidays (${allHolidays.length}):`);
  allHolidays.forEach((h) => console.log(`  - ${h.dateStr}: ${h.name} (${h.holidayType})`));

  await mongoose.disconnect();
}

main().catch(console.error);
