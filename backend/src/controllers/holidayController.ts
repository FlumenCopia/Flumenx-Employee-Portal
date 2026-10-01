import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CompanyHoliday } from '../models/CompanyHoliday.js';
import { AuditLog } from '../models/AuditLog.js';
import { getISTParts, getCompanyStartOfDay } from '../utils/tzUtils.js';

export async function getHolidays(req: Request, res: Response): Promise<void> {
  try {
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
  } catch (error: any) {
    console.error('[getHolidays Error]', error);
    res.status(500).json({ detail: error.message || 'Failed to fetch company holidays.' });
  }
}

export async function getHolidayById(req: Request, res: Response): Promise<void> {
  try {
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
  } catch (error: any) {
    console.error('[getHolidayById Error]', error);
    res.status(500).json({ detail: error.message || 'Failed to fetch holiday.' });
  }
}

export async function createHoliday(req: Request, res: Response): Promise<void> {
  try {
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

    // Look for any existing holiday record for this date (active or inactive)
    const existing = await CompanyHoliday.findOne({ dateStr });
    if (existing) {
      if (existing.isActive) {
        res.status(400).json({ detail: `Holiday already exists for date ${dateStr} (${existing.name}).` });
        return;
      }

      // If previously soft-deleted, reactivate and update it to prevent unique index duplicate errors
      existing.name = String(name).trim();
      existing.date = holidayDate;
      existing.holidayType = holiday_type || 'Company';
      existing.description = description ? String(description).trim() : '';
      existing.isPaid = is_paid !== undefined ? Boolean(is_paid) : true;
      existing.applicableToAll = applicable_to_all !== undefined ? Boolean(applicable_to_all) : true;
      existing.departments = Array.isArray(departments) ? departments : [];
      existing.employees = Array.isArray(employees) ? employees : [];
      existing.recurringAnnually = Boolean(recurring_annually);
      existing.year = ist.year;
      existing.isActive = true;
      existing.updatedBy = req.user?._id;
      await existing.save();

      try {
        await AuditLog.create({
          user: req.user?._id,
          action: 'CREATE_HOLIDAY',
          module: 'HOLIDAYS',
          details: `Reactivated company holiday: ${existing.name} on ${existing.dateStr} (${existing.holidayType})`,
        });
      } catch (err) {}

      res.status(201).json(existing);
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
  } catch (error: any) {
    console.error('[createHoliday Error]', error);
    if (error.code === 11000) {
      res.status(400).json({ detail: 'A holiday for this date already exists in the system.' });
      return;
    }
    res.status(500).json({ detail: error.message || 'Failed to create company holiday.' });
  }
}

export async function updateHoliday(req: Request, res: Response): Promise<void> {
  try {
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
  } catch (error: any) {
    console.error('[updateHoliday Error]', error);
    if (error.code === 11000) {
      res.status(400).json({ detail: 'A holiday with this date already exists.' });
      return;
    }
    res.status(500).json({ detail: error.message || 'Failed to update company holiday.' });
  }
}

export async function deleteHoliday(req: Request, res: Response): Promise<void> {
  try {
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
  } catch (error: any) {
    console.error('[deleteHoliday Error]', error);
    res.status(500).json({ detail: error.message || 'Failed to delete company holiday.' });
  }
}
