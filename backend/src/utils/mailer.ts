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

function getSmtpTransporter() {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    return null;
  }
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
}

export interface LeaveMailContext {
  employeeName: string;
  employeeCode: string;
  employeeEmail?: string;
  department?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod?: string | null;
  daysCount: number;
  reason: string;
  adminNote?: string;
  status?: string;
  reviewerName?: string;
}

export async function sendLeaveApplicationEmail(ctx: LeaveMailContext): Promise<boolean> {
  const transporter = getSmtpTransporter();
  const durationText = ctx.isHalfDay
    ? `Half Day (${ctx.halfDayPeriod || 'First Half'})`
    : `${ctx.daysCount} Day${ctx.daysCount > 1 ? 's' : ''}`;

  const toList: string[] = [config.hrEmail].filter(Boolean);
  const ccCandidates: string[] = [config.ceoEmail, ...config.leaveCcEmails, ctx.employeeEmail].filter(
    (e): e is string => typeof e === 'string' && e.trim().length > 0
  );
  const ccList: string[] = ccCandidates.filter((e) => !toList.includes(e));

  const portalLeaveUrl = `${config.frontendUrl.replace(/\/$/, '')}/leaves`;

  if (!transporter) {
    console.log(`[Hostinger Mailer Dev Warning] SMTP not configured. Leave applied by ${ctx.employeeName} (${durationText} on ${ctx.startDate}).`);
    return false;
  }

  try {
    const mailOptions = {
      from: config.smtpFrom,
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      subject: `[Leave Application] ${ctx.employeeName} (${ctx.employeeCode}) — ${durationText} ${ctx.leaveType} Leave`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #087A5B; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #087A5B; margin: 0; font-size: 22px;">FLUMENX Technologies</h2>
            <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Employee Portal • Leave Notification System</p>
          </div>
          <h3 style="color: #1e293b; margin-top: 0;">New Leave Application Submitted</h3>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">
            An employee has submitted a new leave request. Please review the details below:
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13.5px;">
            <tr style="background-color: #f8fafc;">
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: bold; width: 35%; color: #334155;">Employee Name</td>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #0f172a;">${ctx.employeeName} (${ctx.employeeCode})</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">Department</td>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #0f172a;">${ctx.department || 'N/A'}</td>
            </tr>
            <tr style="background-color: #f8fafc;">
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">Leave Type</td>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #0f172a;"><strong style="color: #087A5B;">${ctx.leaveType} Leave</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">Duration / Type</td>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #0f172a;">${durationText}</td>
            </tr>
            <tr style="background-color: #f8fafc;">
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">Dates</td>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #0f172a;">${ctx.startDate}${ctx.startDate !== ctx.endDate ? ` to ${ctx.endDate}` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">Reason</td>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #0f172a;">${ctx.reason}</td>
            </tr>
          </table>
          <div style="text-align: center; margin: 26px 0;">
            <a href="${portalLeaveUrl}" style="background-color: #087A5B; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">Review Leave in Portal</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">This is an automated communication sent to HR, CEO, and CC recipients via FLUMENX Portal.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Hostinger Mailer] Leave application email sent for ${ctx.employeeName}`);
    return true;
  } catch (err: any) {
    console.error(`[Hostinger Mailer Error] Failed to send leave application email:`, err.message);
    return false;
  }
}

export async function sendLeaveDecisionEmail(ctx: LeaveMailContext): Promise<boolean> {
  const transporter = getSmtpTransporter();
  const isApproved = ctx.status === 'Approved';
  const durationText = ctx.isHalfDay
    ? `Half Day (${ctx.halfDayPeriod || 'First Half'})`
    : `${ctx.daysCount} Day${ctx.daysCount > 1 ? 's' : ''}`;

  const toList: string[] = [ctx.employeeEmail || config.hrEmail].filter((e): e is string => Boolean(e));
  const ccCandidates: string[] = [config.hrEmail, config.ceoEmail, ...config.leaveCcEmails].filter(
    (e): e is string => typeof e === 'string' && e.trim().length > 0
  );
  const ccList: string[] = ccCandidates.filter((e) => !toList.includes(e));

  const statusColor = isApproved ? '#10b981' : '#ef4444';
  const portalLeaveUrl = `${config.frontendUrl.replace(/\/$/, '')}/leaves`;

  if (!transporter) {
    console.log(`[Hostinger Mailer Dev Warning] SMTP not configured. Leave decision for ${ctx.employeeName}: ${ctx.status}`);
    return false;
  }

  try {
    const mailOptions = {
      from: config.smtpFrom,
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      subject: `[Leave ${ctx.status}] ${ctx.employeeName} — ${durationText} ${ctx.leaveType} Leave`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid ${statusColor}; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #087A5B; margin: 0; font-size: 22px;">FLUMENX Technologies</h2>
            <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Employee Portal • Leave Notification System</p>
          </div>
          <div style="background-color: ${isApproved ? '#ecfdf5' : '#fef2f2'}; border: 1px solid ${isApproved ? '#a7f3d0' : '#fecaca'}; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; text-align: center;">
            <span style="font-size: 18px; font-weight: bold; color: ${statusColor};">Leave Request ${ctx.status?.toUpperCase()}</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13.5px;">
            <tr style="background-color: #f8fafc;">
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: bold; width: 35%; color: #334155;">Employee Name</td>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #0f172a;">${ctx.employeeName} (${ctx.employeeCode})</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">Leave Type</td>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #0f172a;">${ctx.leaveType} Leave</td>
            </tr>
            <tr style="background-color: #f8fafc;">
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">Duration</td>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #0f172a;">${durationText} (${ctx.startDate}${ctx.startDate !== ctx.endDate ? ` to ${ctx.endDate}` : ''})</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">Reviewer Note</td>
              <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #0f172a;">${ctx.adminNote || 'No notes provided'}</td>
            </tr>
          </table>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${portalLeaveUrl}" style="background-color: #087A5B; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">Open Portal</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">FLUMENX Technologies • Reg. No: FLX-2024-99</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Hostinger Mailer] Leave decision (${ctx.status}) email sent for ${ctx.employeeName}`);
    return true;
  } catch (err: any) {
    console.error(`[Hostinger Mailer Error] Failed to send leave decision email:`, err.message);
    return false;
  }
}
