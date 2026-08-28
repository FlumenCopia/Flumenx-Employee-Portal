import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CompanyHoliday } from '../models/CompanyHoliday.js';
import { AuditLog } from '../models/AuditLog.js';
import { getISTParts, getCompanyStartOfDay } from '../utils/tzUtils.js';

export async function getHolidays(req: Request, res: Response): Promise<void> {
  const { year, month, start_date, end_date, department } = req.query;

  const filter: any = { isActive: true };
  if (year) {
    filter.year = parseInt(year as string, 10);
  }
  if (start_date && end_date) {
    filter.date = {
      $gte: getCompanyStartOfDay(start_date as string),
      $lte: getCompanyStartOfDay(end_date as string),
    };
  }

  const holidays = await CompanyHoliday.find(filter).sort({ date: 1 });

  res.json({
    count: holidays.length,
    results: holidays.map((h) => ({
      id: h._id,
      name: h.name,
      date: h.dateStr,
      holiday_type: h.holidayType,
      description: h.description,
      is_paid: h.isPaid,
      applicable_to_all: h.applicableToAll,
      departments: h.departments || [],
      employees: h.employees || [],
      recurring_annually: h.recurringAnnually,
      year: h.year,
    })),
  });
}

export async function getHolidayById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ detail: 'Invalid holiday ID.' });
    return;
  }

  const holiday = await CompanyHoliday.findById(id);
  if (!holiday || !holiday.isActive) {
    res.status(404).json({ detail: 'Holiday not found.' });
    return;
  }

  res.json({
    id: holiday._id,
    name: holiday.name,
    date: holiday.dateStr,
    holiday_type: holiday.holidayType,
    description: holiday.description,
    is_paid: holiday.isPaid,
    applicable_to_all: holiday.applicableToAll,
    departments: holiday.departments || [],
    employees: holiday.employees || [],
    recurring_annually: holiday.recurringAnnually,
    year: holiday.year,
  });
}

export async function createHoliday(req: Request, res: Response): Promise<void> {
  const {
    name,
    date,
    holiday_type,
    description,
    is_paid,
    applicable_to_all,
    departments,
    employees,
    recurring_annually,
  } = req.body;

  if (!name || !date) {
    res.status(400).json({ detail: 'Name and date (YYYY-MM-DD) are required.' });
    return;
  }

  const dateStr = String(date).split('T')[0];
  const holidayDate = getCompanyStartOfDay(dateStr);
  const ist = getISTParts(holidayDate);

  const existing = await CompanyHoliday.findOne({ dateStr, isActive: true });
  if (existing) {
    res.status(400).json({ detail: `Holiday already exists for date ${dateStr} (${existing.name}).` });
    return;
  }

  const holiday = new CompanyHoliday({
    name: String(name).trim(),
    date: holidayDate,
    dateStr,
    holidayType: holiday_type || 'Company',
    description: description ? String(description).trim() : '',
    isPaid: is_paid !== undefined ? Boolean(is_paid) : true,
    applicableToAll: applicable_to_all !== undefined ? Boolean(applicable_to_all) : true,
    departments: Array.isArray(departments) ? departments : [],
    employees: Array.isArray(employees) ? employees : [],
    recurringAnnually: Boolean(recurring_annually),
    year: ist.year,
    createdBy: req.user?._id,
  });

  await holiday.save();

  // Audit log
  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'CREATE_HOLIDAY',
      module: 'HOLIDAYS',
      details: `Created company holiday: ${holiday.name} on ${holiday.dateStr} (${holiday.holidayType})`,
    });
  } catch (err) {}

  res.status(201).json(holiday);
}

export async function updateHoliday(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ detail: 'Invalid holiday ID.' });
    return;
  }

  const holiday = await CompanyHoliday.findById(id);
  if (!holiday || !holiday.isActive) {
    res.status(404).json({ detail: 'Holiday not found.' });
    return;
  }

  const {
    name,
    date,
    holiday_type,
    description,
    is_paid,
    applicable_to_all,
    departments,
    employees,
    recurring_annually,
  } = req.body;

  if (name) holiday.name = String(name).trim();
  if (holiday_type) holiday.holidayType = holiday_type;
  if (description !== undefined) holiday.description = String(description).trim();
  if (is_paid !== undefined) holiday.isPaid = Boolean(is_paid);
  if (applicable_to_all !== undefined) holiday.applicableToAll = Boolean(applicable_to_all);
  if (Array.isArray(departments)) holiday.departments = departments;
  if (Array.isArray(employees)) holiday.employees = employees;
  if (recurring_annually !== undefined) holiday.recurringAnnually = Boolean(recurring_annually);

  if (date) {
    const dateStr = String(date).split('T')[0];
    holiday.dateStr = dateStr;
    holiday.date = getCompanyStartOfDay(dateStr);
    const ist = getISTParts(holiday.date);
    holiday.year = ist.year;
  }

  holiday.updatedBy = req.user?._id;
  await holiday.save();

  // Audit log
  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'UPDATE_HOLIDAY',
      module: 'HOLIDAYS',
      details: `Updated company holiday: ${holiday.name} (${holiday.dateStr})`,
    });
  } catch (err) {}

  res.json(holiday);
}

export async function deleteHoliday(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ detail: 'Invalid holiday ID.' });
    return;
  }

  const holiday = await CompanyHoliday.findById(id);
  if (!holiday || !holiday.isActive) {
    res.status(404).json({ detail: 'Holiday not found.' });
    return;
  }

  holiday.isActive = false;
  await holiday.save();

  // Audit log
  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'DELETE_HOLIDAY',
      module: 'HOLIDAYS',
      details: `Deleted company holiday: ${holiday.name} (${holiday.dateStr})`,
    });
  } catch (err) {}

  res.json({ detail: 'Holiday removed successfully.' });
}
