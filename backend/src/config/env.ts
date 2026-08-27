import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  mongodbUri: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessCookieName: string;
  refreshCookieName: string;
  corsOrigins: string[];
  nodeEnv: string;
  frontendUrl: string;
  smtpHost?: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '8000', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_portal',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key-flumenx-2026',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key-flumenx-2026',
  accessCookieName: process.env.JWT_ACCESS_COOKIE_NAME || 'access_token',
  refreshCookieName: process.env.JWT_REFRESH_COOKIE_NAME || 'refresh_token',
  corsOrigins: process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '465', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'FLUMENX HR Portal <hr@flumenx.com>',
};
