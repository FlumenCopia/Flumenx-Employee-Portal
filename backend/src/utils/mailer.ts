import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

export async function sendPasswordResetEmail(toEmail: string, resetToken: string): Promise<boolean> {
  const resetUrl = `${config.frontendUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`;

  // If SMTP is not configured, return cleanly without throwing (account enumeration protection)
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    if (config.nodeEnv !== 'production') {
      console.log(`[Hostinger Mailer Dev Warning] SMTP not configured. Password reset URL for ${toEmail}: ${resetUrl}`);
    } else {
      console.warn(`[Hostinger Mailer Warning] SMTP credentials unconfigured. Reset link generated but omitted from mail dispatch.`);
    }
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465, // SSL for 465, TLS for 587
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    const mailOptions = {
      from: config.smtpFrom,
      to: toEmail,
      subject: 'FLUMENX Portal — Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px;">
            <h2 style="color: #087A5B; margin: 0;">FLUMENX Employee Portal</h2>
            <p style="color: #64748b; font-size: 14px;">Account Password Reset Request</p>
          </div>
          <p>Hello,</p>
          <p>We received a request to reset your password for your FLUMENX account. Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #087A5B; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">This reset link is valid for 1 hour. If you did not request a password reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">FLUMENX Technologies • Reg. No: FLX-2024-99</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Hostinger Mailer] Password reset email successfully sent to ${toEmail}`);
    return true;
  } catch (err: any) {
    console.error(`[Hostinger Mailer Error] Failed to send password reset email to ${toEmail}:`, err.message);
    return false;
  }
}
