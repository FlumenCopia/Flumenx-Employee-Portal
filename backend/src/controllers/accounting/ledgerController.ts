import { Request, Response } from 'express';
import { getGeneralLedger, getCustomerLedger, getVendorLedger } from '../../services/accounting/ledgerService.js';

export async function getGeneralLedgerHandler(req: Request, res: Response): Promise<void> {
  const accountId = (req.params.id || req.query.account_id || req.query.accountId) as string;
  const startDate = (req.query.start_date || req.query.startDate) as string | undefined;
  const endDate = (req.query.end_date || req.query.endDate) as string | undefined;

  if (!accountId) {
    res.status(400).json({ detail: 'Account ID is required.' });
    return;
  }

  try {
    const data = await getGeneralLedger(
      accountId,
      startDate,
      endDate
    );
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ detail: err.message || 'Failed to generate general ledger.' });
  }
}

export async function getCustomerLedgerHandler(req: Request, res: Response): Promise<void> {
  const { client_id, start_date, end_date } = req.query;

  if (!client_id) {
    res.status(400).json({ detail: 'client_id query parameter is required.' });
    return;
  }

  try {
    const data = await getCustomerLedger(
      client_id as string,
      start_date ? new Date(start_date as string) : undefined,
      end_date ? new Date(end_date as string) : undefined
    );
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ detail: err.message || 'Failed to generate customer ledger.' });
  }
}

export async function getVendorLedgerHandler(req: Request, res: Response): Promise<void> {
  const { vendor_id, start_date, end_date } = req.query;

  if (!vendor_id) {
    res.status(400).json({ detail: 'vendor_id query parameter is required.' });
    return;
  }

  try {
    const data = await getVendorLedger(
      vendor_id as string,
      start_date ? new Date(start_date as string) : undefined,
      end_date ? new Date(end_date as string) : undefined
    );
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ detail: err.message || 'Failed to generate vendor ledger.' });
  }
}
