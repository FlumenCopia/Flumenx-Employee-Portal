import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function handleCsrfEndpoint(req: Request, res: Response): void {
  let token = req.cookies?.csrftoken;
  if (!token) {
    token = generateCsrfToken();
    res.cookie('csrftoken', token, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
    });
  }
  res.json({ csrfToken: token });
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(req.method.toUpperCase())) {
    return next();
  }

  // Exempt auth endpoints from CSRF check matching Django @csrf_exempt
  const pathStr = req.path.toLowerCase();
  if (
    pathStr.includes('/auth/login') ||
    pathStr.includes('/auth/register') ||
    pathStr.includes('/auth/password-reset')
  ) {
    return next();
  }

  const cookieToken = req.cookies?.csrftoken;
  const headerToken = req.headers['x-csrftoken'] as string;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    res.status(403).json({ detail: 'CSRF Failed: CSRF token missing or incorrect.' });
    return;
  }

  next();
}
