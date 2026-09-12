import { Request, Response } from 'express';
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getARAgingReport,
  getAPAgingReport,
  getExecutiveFinancialSummary,
} from '../../services/accounting/financialReportService.js';

export async function getDashboardSummaryHandler(req: Request, res: Response): Promise<void> {
  try {
    const summary = await getExecutiveFinancialSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to generate financial dashboard summary.' });
  }
}

export async function getTrialBalanceHandler(req: Request, res: Response): Promise<void> {
  const asOf = (req.query.asOfDate || req.query.as_of_date) as string | undefined;
  try {
    const report = await getTrialBalance(asOf);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to generate trial balance.' });
  }
}

export async function getProfitAndLossHandler(req: Request, res: Response): Promise<void> {
  const start = (req.query.startDate || req.query.start_date) as string | undefined;
  const end = (req.query.endDate || req.query.end_date) as string | undefined;
  const costCenterId = (req.query.costCenterId || req.query.cost_center_id) as string | undefined;
  const projectId = (req.query.projectId || req.query.project_id) as string | undefined;
  const clientId = (req.query.clientId || req.query.client_id) as string | undefined;

  try {
    const report = await getProfitAndLoss(start, end, {
      costCenterId,
      projectId,
      clientId,
    });
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to generate Profit & Loss statement.' });
  }
}

export async function getBalanceSheetHandler(req: Request, res: Response): Promise<void> {
  const asOf = (req.query.asOfDate || req.query.as_of_date) as string | undefined;
  try {
    const report = await getBalanceSheet(asOf);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to generate Balance Sheet.' });
  }
}

export async function getARAgingHandler(req: Request, res: Response): Promise<void> {
  const asOf = (req.query.asOfDate || req.query.as_of_date) as string | undefined;
  try {
    const report = await getARAgingReport(asOf);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to generate AR aging report.' });
  }
}

export async function getAPAgingHandler(req: Request, res: Response): Promise<void> {
  const asOf = (req.query.asOfDate || req.query.as_of_date) as string | undefined;
  try {
    const report = await getAPAgingReport(asOf);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to generate AP aging report.' });
  }
}
