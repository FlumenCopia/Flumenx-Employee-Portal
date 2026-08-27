import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, status: number = 400, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Handle Mongoose ObjectId CastError cleanly
  if (err.name === 'CastError' || err.kind === 'ObjectId') {
    res.status(404).json({ detail: 'Resource not found.' });
    return;
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error] ${req.method} ${req.path} -> ${status}: ${message}`);
  if (err.stack && status === 500) {
    console.error(err.stack);
  }

  res.status(status).json({
    detail: message,
    fields: err.fields || undefined,
  });
}
