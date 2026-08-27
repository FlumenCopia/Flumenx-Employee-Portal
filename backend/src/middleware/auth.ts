import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User, IUser } from '../models/User.js';

export interface JwtPayload {
  userId: string;
  role: string;
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const tokensToTry: string[] = [];

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const headerToken = authHeader.substring(7);
    if (headerToken && headerToken !== 'null' && headerToken !== 'undefined') {
      tokensToTry.push(headerToken);
    }
  }

  // 2. Check Cookie
  if (req.cookies) {
    const cookieToken =
      req.cookies[config.accessCookieName] ||
      req.cookies['access_token'] ||
      req.cookies['jwt'] ||
      req.cookies['sessionid'] ||
      req.cookies['flumenx_access'];
    if (cookieToken && !tokensToTry.includes(cookieToken)) {
      tokensToTry.push(cookieToken);
    }
  }

  if (tokensToTry.length === 0) {
    res.status(401).json({ detail: 'Authentication credentials were not provided.' });
    return;
  }

  for (const token of tokensToTry) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      const user = await User.findById(decoded.userId).populate('dynamicRole');

      if (user && user.isActive) {
        req.user = user;
        next();
        return;
      }
    } catch (error) {
      // Continue trying remaining tokens (e.g. cookie fallback)
    }
  }

  res.status(401).json({ detail: 'Given token not valid for any token type', code: 'token_not_valid' });
}


export function optionalAuthentication(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  authenticateToken(req, res, () => {
    next();
  }).catch(() => {
    next();
  });
}
