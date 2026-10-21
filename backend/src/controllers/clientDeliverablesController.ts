import { Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { ClientDeliverableTracker } from '../models/ClientDeliverableTracker.js';
import { Client } from '../models/Client.js';
import path from 'path';
import fs from 'fs';
import openpyxlParser from './helpers/excelDeliverablesHelper.js';

// Month names helper for sorting
const MONTH_ORDER = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

function normalizeMonth(m: string): string {
  return (m || '').trim();
}

/**
 * GET /api/client-deliverables
 * List monthly deliverables with filters & KPI summary
 */
export async function getClientDeliverables(req: Request, res: Response): Promise<void> {
  try {
    const { year, month, search, status } = req.query;

    const query: any = {};
    if (year) query.year = parseInt(String(year), 10);
    if (month && String(month).toLowerCase() !== 'all') {
      query.month = { $regex: new RegExp(`^${String(month).trim()}$`, 'i') };
    }
    if (status && String(status).toLowerCase() !== 'all') {
      query.status = String(status).toUpperCase();
    }
    if (search) {
      query.clientName = { $regex: String(search).trim(), $options: 'i' };
    }

    const records = await ClientDeliverableTracker.find(query).sort({ clientName: 1 });

    // Distinct available months and years in DB
    const allDistinct = await ClientDeliverableTracker.find({}, { month: 1, year: 1 }).lean();
    const availableYears = Array.from(new Set(allDistinct.map((d) => d.year))).sort((a, b) => b - a);
    const availableMonths = Array.from(new Set(allDistinct.map((d) => d.month)));

    // Summary calculations for the filtered set
    let totalTargetPosters = 0;
    let totalDeliveredPosters = 0;
    let totalTargetVideos = 0;
    let totalDeliveredVideos = 0;
    let totalExtraWorksCount = 0;
    let totalReferenceLinksCount = 0;

    records.forEach((r) => {
      totalTargetPosters += r.posters?.target || 0;
      totalDeliveredPosters += r.posters?.delivered || 0;
      totalTargetVideos += r.videos?.target || 0;
      totalDeliveredVideos += r.videos?.delivered || 0;
      if (r.extraWorksNotes && r.extraWorksNotes.trim() !== '') {
        totalExtraWorksCount++;
      }
      totalReferenceLinksCount += (r.deliveredItems || []).filter((item) => item.postUrl && item.postUrl.trim() !== '').length;
    });

    const totalTargetAll = totalTargetPosters + totalTargetVideos;
    const totalDeliveredAll = totalDeliveredPosters + totalDeliveredVideos;
    const totalPendingAll = Math.max(0, totalTargetAll - totalDeliveredAll);
    const overallCompletionRate = totalTargetAll > 0 ? Math.round((totalDeliveredAll / totalTargetAll) * 100) : 0;

    res.json({
      records,
      summary: {
        totalClients: records.length,
        totalTargetPosters,
        totalDeliveredPosters,
        totalPendingPosters: Math.max(0, totalTargetPosters - totalDeliveredPosters),
        totalTargetVideos,
        totalDeliveredVideos,
        totalPendingVideos: Math.max(0, totalTargetVideos - totalDeliveredVideos),
        totalTargetAll,
        totalDeliveredAll,
        totalPendingAll,
        overallCompletionRate,
        totalExtraWorksCount,
        totalReferenceLinksCount,
      },
      availableYears: availableYears.length > 0 ? availableYears : [2026],
      availableMonths,
    });
  } catch (err: any) {
    console.error('[ClientDeliverables] Error fetching deliverables:', err);
    res.status(500).json({ detail: err.message || 'Failed to fetch client deliverables' });
  }
}

/**
 * GET /api/client-deliverables/yearly
 * Month-wise yearly matrix and client deep-dive report
 */
export async function getYearlyDeliverablesReport(req: Request, res: Response): Promise<void> {
  try {
    const targetYear = req.query.year ? parseInt(String(req.query.year), 10) : 2026;
    const clientNameFilter = req.query.clientName ? String(req.query.clientName).trim() : '';

    const query: any = { year: targetYear };
    if (clientNameFilter && clientNameFilter !== 'ALL') {
      query.clientName = { $regex: new RegExp(`^${clientNameFilter}$`, 'i') };
    }

    const records = await ClientDeliverableTracker.find(query).lean();

    // Group records by clientName
    const clientMap: Record<string, any> = {};

    records.forEach((rec) => {
      const cName = rec.clientName.trim();
      if (!clientMap[cName]) {
        clientMap[cName] = {
          clientName: cName,
          yearlyTargetPosters: rec.yearlyTargetPosters || 0,
          yearlyTargetVideos: rec.yearlyTargetVideos || 0,
          months: {},
          totals: {
            targetPosters: 0,
            deliveredPosters: 0,
            pendingPosters: 0,
            targetVideos: 0,
            deliveredVideos: 0,
            pendingVideos: 0,
            totalTarget: 0,
            totalDelivered: 0,
            totalPending: 0,
            totalExtraWorksCount: 0,
            totalLinksCount: 0,
            completionRate: 0,
          },
        };
      }

      const mKey = rec.month.toLowerCase();
      const pTarget = rec.posters?.target || 0;
      const pDelivered = rec.posters?.delivered || 0;
      const vTarget = rec.videos?.target || 0;
      const vDelivered = rec.videos?.delivered || 0;
      const linksCount = (rec.deliveredItems || []).filter((i: any) => i.postUrl && i.postUrl.trim() !== '').length;

      clientMap[cName].months[mKey] = {
        month: rec.month,
        cycleLabel: rec.cycleLabel || '',
        posters: { target: pTarget, delivered: pDelivered, pending: Math.max(0, pTarget - pDelivered) },
        videos: { target: vTarget, delivered: vDelivered, pending: Math.max(0, vTarget - vDelivered) },
        extraWorksNotes: rec.extraWorksNotes || '',
        deliveredItems: rec.deliveredItems || [],
        linksCount,
        status: rec.status,
      };

      // Accumulate totals
      clientMap[cName].totals.targetPosters += pTarget;
      clientMap[cName].totals.deliveredPosters += pDelivered;
      clientMap[cName].totals.targetVideos += vTarget;
      clientMap[cName].totals.deliveredVideos += vDelivered;
      if (rec.extraWorksNotes && rec.extraWorksNotes.trim() !== '') {
        clientMap[cName].totals.totalExtraWorksCount++;
      }
      clientMap[cName].totals.totalLinksCount += linksCount;
    });

    // Compute completion rate and pending for each client
    const clientRows = Object.values(clientMap).map((c: any) => {
      c.totals.pendingPosters = Math.max(0, c.totals.targetPosters - c.totals.deliveredPosters);
      c.totals.pendingVideos = Math.max(0, c.totals.targetVideos - c.totals.deliveredVideos);
      c.totals.totalTarget = c.totals.targetPosters + c.totals.targetVideos;
      c.totals.totalDelivered = c.totals.deliveredPosters + c.totals.deliveredVideos;
      c.totals.totalPending = Math.max(0, c.totals.totalTarget - c.totals.totalDelivered);
      c.totals.completionRate =
        c.totals.totalTarget > 0 ? Math.round((c.totals.totalDelivered / c.totals.totalTarget) * 100) : 0;
      return c;
    });

    // Agency Grand Totals
    const agencyGrandTotals = {
      targetPosters: 0,
      deliveredPosters: 0,
      pendingPosters: 0,
      targetVideos: 0,
      deliveredVideos: 0,
      pendingVideos: 0,
      totalTarget: 0,
      totalDelivered: 0,
      totalPending: 0,
      totalExtraWorksCount: 0,
      totalLinksCount: 0,
      overallCompletionRate: 0,
    };

    clientRows.forEach((c) => {
      agencyGrandTotals.targetPosters += c.totals.targetPosters;
      agencyGrandTotals.deliveredPosters += c.totals.deliveredPosters;
      agencyGrandTotals.targetVideos += c.totals.targetVideos;
      agencyGrandTotals.deliveredVideos += c.totals.deliveredVideos;
      agencyGrandTotals.totalExtraWorksCount += c.totals.totalExtraWorksCount;
      agencyGrandTotals.totalLinksCount += c.totals.totalLinksCount;
    });

    agencyGrandTotals.pendingPosters = Math.max(0, agencyGrandTotals.targetPosters - agencyGrandTotals.deliveredPosters);
    agencyGrandTotals.pendingVideos = Math.max(0, agencyGrandTotals.targetVideos - agencyGrandTotals.deliveredVideos);
    agencyGrandTotals.totalTarget = agencyGrandTotals.targetPosters + agencyGrandTotals.targetVideos;
    agencyGrandTotals.totalDelivered = agencyGrandTotals.deliveredPosters + agencyGrandTotals.deliveredVideos;
    agencyGrandTotals.totalPending = Math.max(0, agencyGrandTotals.totalTarget - agencyGrandTotals.totalDelivered);
    agencyGrandTotals.overallCompletionRate =
      agencyGrandTotals.totalTarget > 0 ? Math.round((agencyGrandTotals.totalDelivered / agencyGrandTotals.totalTarget) * 100) : 0;

    res.json({
      year: targetYear,
      clients: clientRows.sort((a, b) => a.clientName.localeCompare(b.clientName)),
      agencyGrandTotals,
    });
  } catch (err: any) {
    console.error('[ClientDeliverables] Error fetching yearly report:', err);
    res.status(500).json({ detail: err.message || 'Failed to fetch yearly deliverables report' });
  }
}

/**
 * POST /api/client-deliverables
 * Add a new client deliverable tracker record
 */
export async function createClientDeliverable(req: Request, res: Response): Promise<void> {
  try {
    const {
      clientName,
      year,
      month,
      cycleLabel,
      postersTarget,
      postersDelivered,
      videosTarget,
      videosDelivered,
      yearlyTargetPosters,
      yearlyTargetVideos,
      extraWorksNotes,
      status,
      notes,
    } = req.body;

    if (!clientName || !month) {
      res.status(400).json({ detail: 'Client Name and Month are required' });
      return;
    }

    const trimmedClientName = clientName.trim();
    const cleanMonth = month.trim();
    const cleanYear = year ? parseInt(String(year), 10) : 2026;

    // Check if duplicate already exists
    const existing = await ClientDeliverableTracker.findOne({
      clientName: { $regex: new RegExp(`^${trimmedClientName}$`, 'i') },
      month: { $regex: new RegExp(`^${cleanMonth}$`, 'i') },
      year: cleanYear,
    });

    if (existing) {
      res.status(409).json({ detail: `Deliverable tracker already exists for ${trimmedClientName} in ${cleanMonth} ${cleanYear}` });
      return;
    }

    // Try linking with actual Client entity if exists
    const clientDoc = await Client.findOne({ name: { $regex: new RegExp(`^${trimmedClientName}$`, 'i') } });
    const targetClientId = req.body.client && mongoose.Types.ObjectId.isValid(req.body.client) ? req.body.client : clientDoc?._id;

    const pTarget = Number(postersTarget) || 0;
    const pDelivered = Number(postersDelivered) || 0;
    const vTarget = Number(videosTarget) || 0;
    const vDelivered = Number(videosDelivered) || 0;

    const newRecord = await ClientDeliverableTracker.create({
      client: targetClientId,
      clientName: trimmedClientName,
      year: cleanYear,
      month: cleanMonth,
      cycleLabel: cycleLabel || '',
      posters: {
        target: pTarget,
        delivered: pDelivered,
        pending: Math.max(0, pTarget - pDelivered),
      },
      videos: {
        target: vTarget,
        delivered: vDelivered,
        pending: Math.max(0, vTarget - vDelivered),
      },
      yearlyTargetPosters: Number(yearlyTargetPosters) || pTarget * 12,
      yearlyTargetVideos: Number(yearlyTargetVideos) || vTarget * 12,
      extraWorksNotes: extraWorksNotes || '',
      deliveredItems: [],
      status: status || 'ACTIVE',
      notes: notes || '',
      updatedBy: req.user?._id,
    });

    res.status(201).json(newRecord);
  } catch (err: any) {
    console.error('[ClientDeliverables] Error creating deliverable tracker:', err);
    res.status(500).json({ detail: err.message || 'Failed to create deliverable tracker' });
  }
}

/**
 * PUT /api/client-deliverables/:id
 * Update targets, delivered counts, and cycle
 */
export async function updateClientDeliverable(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      clientName,
      year,
      month,
      cycleLabel,
      postersTarget,
      postersDelivered,
      videosTarget,
      videosDelivered,
      yearlyTargetPosters,
      yearlyTargetVideos,
      extraWorksNotes,
      status,
      notes,
    } = req.body;

    const record = await ClientDeliverableTracker.findById(id);
    if (!record) {
      res.status(404).json({ detail: 'Deliverable tracker record not found' });
      return;
    }

    if (clientName) record.clientName = clientName.trim();
    if (year) record.year = parseInt(String(year), 10);
    if (month) record.month = month.trim();
    if (cycleLabel !== undefined) record.cycleLabel = cycleLabel;

    if (postersTarget !== undefined) record.posters.target = Math.max(0, Number(postersTarget));
    if (postersDelivered !== undefined) record.posters.delivered = Math.max(0, Number(postersDelivered));
    record.posters.pending = Math.max(0, (record.posters.target || 0) - (record.posters.delivered || 0));

    if (videosTarget !== undefined) record.videos.target = Math.max(0, Number(videosTarget));
    if (videosDelivered !== undefined) record.videos.delivered = Math.max(0, Number(videosDelivered));
    record.videos.pending = Math.max(0, (record.videos.target || 0) - (record.videos.delivered || 0));

    if (yearlyTargetPosters !== undefined) record.yearlyTargetPosters = Number(yearlyTargetPosters);
    if (yearlyTargetVideos !== undefined) record.yearlyTargetVideos = Number(yearlyTargetVideos);
    if (extraWorksNotes !== undefined) record.extraWorksNotes = extraWorksNotes;
    if (status !== undefined) record.status = status;
    if (notes !== undefined) record.notes = notes;
    record.updatedBy = req.user?._id as any;

    await record.save();
    res.json(record);
  } catch (err: any) {
    console.error('[ClientDeliverables] Error updating deliverable:', err);
    res.status(500).json({ detail: err.message || 'Failed to update deliverable tracker' });
  }
}

/**
 * PATCH /api/client-deliverables/:id/log-item
 * Add a completed deliverable with optional reference post URL
 */
export async function logDeliveredItem(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { deliverableType, title, postUrl, publishedDate, notes, autoIncrement = true } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ detail: 'Deliverable title / description is required' });
      return;
    }

    const record = await ClientDeliverableTracker.findById(id);
    if (!record) {
      res.status(404).json({ detail: 'Deliverable tracker record not found' });
      return;
    }

    const type = (deliverableType || 'poster').toLowerCase();
    const newItem = {
      id: crypto.randomUUID(),
      deliverableType: type as any,
      title: title.trim(),
      postUrl: (postUrl || '').trim(),
      publishedDate: publishedDate ? new Date(publishedDate) : new Date(),
      notes: (notes || '').trim(),
      loggedBy: req.user?._id as any,
      createdAt: new Date(),
    };

    record.deliveredItems.push(newItem);

    // Auto-increment delivered count for this type if requested
    if (autoIncrement) {
      if (type === 'poster') {
        record.posters.delivered = (record.posters.delivered || 0) + 1;
        record.posters.pending = Math.max(0, record.posters.target - record.posters.delivered);
      } else if (type === 'video' || type === 'reel') {
        record.videos.delivered = (record.videos.delivered || 0) + 1;
        record.videos.pending = Math.max(0, record.videos.target - record.videos.delivered);
      }
    }

    record.updatedBy = req.user?._id as any;
    await record.save();

    res.status(201).json({ record, newItem });
  } catch (err: any) {
    console.error('[ClientDeliverables] Error logging delivered item:', err);
    res.status(500).json({ detail: err.message || 'Failed to log delivered item' });
  }
}

/**
 * DELETE /api/client-deliverables/:id/items/:itemId
 * Delete a specific logged deliverable item and decrement count
 */
export async function deleteDeliveredItem(req: Request, res: Response): Promise<void> {
  try {
    const { id, itemId } = req.params;
    const { decrement = true } = req.query;

    const record = await ClientDeliverableTracker.findById(id);
    if (!record) {
      res.status(404).json({ detail: 'Deliverable tracker record not found' });
      return;
    }

    const itemIdx = record.deliveredItems.findIndex((i) => i.id === itemId);
    if (itemIdx === -1) {
      res.status(404).json({ detail: 'Delivered item not found' });
      return;
    }

    const item = record.deliveredItems[itemIdx];
    record.deliveredItems.splice(itemIdx, 1);

    if (decrement === true || decrement === 'true') {
      if (item.deliverableType === 'poster' && record.posters.delivered > 0) {
        record.posters.delivered -= 1;
        record.posters.pending = Math.max(0, record.posters.target - record.posters.delivered);
      } else if ((item.deliverableType === 'video' || item.deliverableType === 'reel') && record.videos.delivered > 0) {
        record.videos.delivered -= 1;
        record.videos.pending = Math.max(0, record.videos.target - record.videos.delivered);
      }
    }

    record.updatedBy = req.user?._id as any;
    await record.save();

    res.json(record);
  } catch (err: any) {
    console.error('[ClientDeliverables] Error deleting delivered item:', err);
    res.status(500).json({ detail: err.message || 'Failed to delete delivered item' });
  }
}

/**
 * POST /api/client-deliverables/copy-month
 * Copy all client targets from one month to another with 1 click
 */
export async function copyMonthTargets(req: Request, res: Response): Promise<void> {
  try {
    const { fromMonth, fromYear, toMonth, toYear, cycleLabel } = req.body;

    if (!fromMonth || !toMonth) {
      res.status(400).json({ detail: 'Source month and destination month are required' });
      return;
    }

    const fYear = fromYear ? parseInt(String(fromYear), 10) : 2026;
    const tYear = toYear ? parseInt(String(toYear), 10) : 2026;

    const sourceRecords = await ClientDeliverableTracker.find({
      month: { $regex: new RegExp(`^${fromMonth.trim()}$`, 'i') },
      year: fYear,
    });

    if (sourceRecords.length === 0) {
      res.status(404).json({ detail: `No records found in source month ${fromMonth} ${fYear}` });
      return;
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const src of sourceRecords) {
      const existing = await ClientDeliverableTracker.findOne({
        clientName: src.clientName,
        month: toMonth.trim(),
        year: tYear,
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      await ClientDeliverableTracker.create({
        client: src.client,
        clientName: src.clientName,
        year: tYear,
        month: toMonth.trim(),
        cycleLabel: cycleLabel || src.cycleLabel || '',
        posters: {
          target: src.posters.target,
          delivered: 0,
          pending: src.posters.target,
        },
        videos: {
          target: src.videos.target,
          delivered: 0,
          pending: src.videos.target,
        },
        yearlyTargetPosters: src.yearlyTargetPosters,
        yearlyTargetVideos: src.yearlyTargetVideos,
        extraWorksNotes: '',
        deliveredItems: [],
        status: 'ACTIVE',
        updatedBy: req.user?._id,
      });
      createdCount++;
    }

    res.json({
      message: `Copied targets to ${toMonth} ${tYear}: ${createdCount} created, ${skippedCount} already existed.`,
      createdCount,
      skippedCount,
    });
  } catch (err: any) {
    console.error('[ClientDeliverables] Error copying month targets:', err);
    res.status(500).json({ detail: err.message || 'Failed to copy month targets' });
  }
}

/**
 * DELETE /api/client-deliverables/:id
 * Delete a specific client monthly tracker record
 */
export async function deleteClientDeliverable(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const deleted = await ClientDeliverableTracker.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ detail: 'Record not found' });
      return;
    }
    res.json({ message: 'Deliverable tracker record deleted successfully' });
  } catch (err: any) {
    console.error('[ClientDeliverables] Error deleting deliverable:', err);
    res.status(500).json({ detail: err.message || 'Failed to delete deliverable tracker' });
  }
}

/**
 * POST /api/client-deliverables/seed-from-excel
 * Seed data directly from Clients Monthly count.xlsx
 */
export async function seedFromExcelHandler(req: Request, res: Response): Promise<void> {
  try {
    const result = await openpyxlParser();
    res.json(result);
  } catch (err: any) {
    console.error('[ClientDeliverables] Error seeding from excel:', err);
    res.status(500).json({ detail: err.message || 'Failed to seed from Excel' });
  }
}
