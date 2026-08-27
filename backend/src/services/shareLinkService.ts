import crypto from 'crypto';
import { ClientWorkShareLink, IClientWorkShareLink } from '../models/ClientWorkShareLink.js';

export function generateShareToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createShareLink(data: {
  clientId: string;
  assignmentId?: string | null;
  publicUpdate?: string;
  createdById?: string | null;
  expiresInDays?: number;
}): Promise<IClientWorkShareLink> {
  const token = generateShareToken();
  let expiresAt: Date | null = null;

  if (data.expiresInDays && data.expiresInDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + data.expiresInDays);
  }

  const shareLink = new ClientWorkShareLink({
    token,
    client: data.clientId,
    assignment: data.assignmentId || null,
    publicUpdate: data.publicUpdate || '',
    createdBy: data.createdById || null,
    expiresAt,
    isRevoked: false,
  });

  return await shareLink.save();
}

export async function getValidShareLink(token: string): Promise<IClientWorkShareLink | null> {
  const link = await ClientWorkShareLink.findOne({ token }).populate('client assignment');
  if (!link || !link.isValid()) {
    return null;
  }
  return link;
}
