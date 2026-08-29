import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { AuditLog } from '../models/AuditLog.js';
import { config } from '../config/env.js';

export async function login(req: Request, res: Response): Promise<void> {
  const usernameOrEmail = req.body.username || req.body.email;
  const password = req.body.password;

  if (!usernameOrEmail || !password || typeof usernameOrEmail !== 'string' || typeof password !== 'string') {
    res.status(400).json({ detail: 'Username and password are required.' });
    return;
  }

  const user = await User.findOne({
    $or: [
      { username: usernameOrEmail.trim() },
      { email: usernameOrEmail.trim().toLowerCase() },
    ],
  }).populate('dynamicRole');

  if (!user || !user.isActive) {
    res.status(400).json({ detail: 'No active account found with the given credentials.' });
    return;
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    res.status(400).json({ detail: 'No active account found with the given credentials.' });
    return;
  }

  const payload = {
    id: user._id.toString(),
    userId: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    isSuperuser: user.isSuperuser,
  };

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
  const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: '7d' });

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SEVEN_DAYS_MS,
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SEVEN_DAYS_MS,
  });

  // Log user authentication to AuditLog
  try {
    await AuditLog.create({
      actor: user._id,
      action: 'USER_LOGIN',
      entityType: 'UserSession',
      entityId: user._id.toString(),
      details: {
        username: user.username,
        email: user.email,
        role: user.role,
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to write login audit log:', err);
  }

  const employee = await Employee.findOne({
    $or: [{ user: user._id }, { email: user.email }],
  });

  res.json({
    access: accessToken,
    refresh: refreshToken,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      portal_role: user.role,
      is_staff: user.isStaff,
      is_superuser: user.isSuperuser,
      dynamic_role: user.dynamicRole,
    },
    role: user.role,
    employee_id: employee ? employee._id : null,
    employee_code: employee ? employee.employeeCode : null,
    department: employee ? employee.department : null,
    designation: employee ? employee.designation : null,
    avatar: employee ? employee.avatar : null,
    employee: employee
      ? {
          id: employee._id,
          employee_code: employee.employeeCode,
          name: employee.name,
          email: employee.email,
          phone: employee.phone,
          department: employee.department,
          designation: employee.designation,
          joining_date: employee.joiningDate,
          status: employee.status,
          location: employee.location,
        }
      : null,
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const username = req.body.username || req.body.email;
  const email = req.body.email;
  const password = req.body.password;
  const first_name = req.body.first_name;
  const last_name = req.body.last_name;
  const requestedRole = req.body.role;

  if (!username || !email || !password) {
    res.status(400).json({ detail: 'Username, email, and password are required.' });
    return;
  }

  // Security Check (DEF-001): Prevent privilege escalation via public registration.
  // Only an authenticated SUPER_ADMIN can assign privileged roles via registration.
  const isCallerSuperAdmin = req.user && (req.user.role === 'SUPER_ADMIN' || req.user.isSuperuser);
  let assignedRole = 'EMPLOYEE';

  if (requestedRole && requestedRole !== 'EMPLOYEE') {
    if (!isCallerSuperAdmin) {
      res.status(400).json({ detail: 'Privileged role assignment is not permitted via public registration.' });
      return;
    }
    assignedRole = requestedRole;
  }

  const existingUser = await User.findOne({
    $or: [{ username: username.trim() }, { email: email.trim().toLowerCase() }],
  });

  if (existingUser) {
    res.status(400).json({ detail: 'User with this username or email already exists.' });
    return;
  }

  const newUser = new User({
    username: username.trim(),
    email: email.trim().toLowerCase(),
    password,
    firstName: first_name || '',
    lastName: last_name || '',
    role: assignedRole,
  });

  await newUser.save();

  res.status(201).json({
    id: newUser._id,
    username: newUser.username,
    email: newUser.email,
    role: newUser.role,
    portal_role: newUser.role,
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie(config.accessCookieName, { path: '/' });
  res.clearCookie(config.refreshCookieName, { path: '/' });
  res.json({ detail: 'Successfully logged out.' });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.[config.refreshCookieName] || req.body?.refresh;

  if (!refreshToken) {
    res.status(401).json({ detail: 'Refresh token is required.' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as any;
    const targetId = decoded.userId || decoded.id || decoded.sub;
    const user = await User.findById(targetId);

    if (!user || !user.isActive) {
      res.status(401).json({ detail: 'User not found or inactive.' });
      return;
    }

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const newAccessToken = jwt.sign(
      { id: user._id.toString(), userId: user._id.toString(), role: user.role, username: user.username, email: user.email, isSuperuser: user.isSuperuser },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.cookie(config.accessCookieName, newAccessToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SEVEN_DAYS_MS,
    });

    res.json({ access: newAccessToken });
  } catch (err) {
    res.status(401).json({ detail: 'Invalid refresh token.' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ detail: 'Authentication credentials were not provided.' });
    return;
  }

  const employee = await Employee.findOne({ user: req.user._id });

  res.json({
    id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    first_name: req.user.firstName,
    last_name: req.user.lastName,
    role: req.user.role,
    portal_role: req.user.role,
    is_staff: req.user.isStaff,
    is_superuser: req.user.isSuperuser,
    employee_id: employee ? employee._id : null,
    employee_code: employee ? employee.employeeCode : null,
    department: employee ? employee.department : null,
    designation: employee ? employee.designation : null,
    avatar: employee ? employee.avatar : null,
    employee: employee
      ? {
          id: employee._id,
          employee_code: employee.employeeCode,
          name: employee.name,
          email: employee.email,
          phone: employee.phone,
          department: employee.department,
          designation: employee.designation,
          joining_date: employee.joiningDate,
          status: employee.status,
          location: employee.location,
        }
      : null,
  });
}

import { sendPasswordResetEmail } from '../utils/mailer.js';

export async function passwordResetRequest(req: Request, res: Response): Promise<void> {
  try {
    const { email, username } = req.body || {};
    const target = String(email || username || '').trim();

    if (target) {
      const user = await User.findOne({
        $or: [
          { email: target.toLowerCase() },
          { username: target },
        ],
      });

      if (user && user.isActive) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.resetPasswordTokenHash = tokenHash;
        user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour expiration
        await user.save();

        // Dispatch Hostinger SMTP reset link email
        await sendPasswordResetEmail(user.email, resetToken);
      }
    }

    // Protect against account enumeration attacks by returning identical response
    res.json({ detail: 'Password reset link has been sent if the email exists.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function passwordResetConfirm(req: Request, res: Response): Promise<void> {
  try {
    const token = req.body?.token || req.query?.token;
    const newPassword = req.body?.new_password || req.body?.newPassword || req.body?.password;

    if (!token || !newPassword) {
      res.status(400).json({ detail: 'Token and new password are required.' });
      return;
    }

    const trimmedPassword = String(newPassword).trim();
    if (trimmedPassword.length < 8) {
      res.status(400).json({ detail: 'Password must be at least 8 characters long.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');

    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
      isActive: true,
    });

    if (!user) {
      res.status(400).json({ detail: 'Invalid or expired password reset token.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(trimmedPassword, salt);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Revoke current session cookies to force re-authentication with new credentials
    res.clearCookie(config.accessCookieName || 'access_token', { path: '/' });
    res.clearCookie(config.refreshCookieName || 'refresh_token', { path: '/' });

    res.json({ detail: 'Password has been reset successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    const { current_password, new_password, confirm_password } = req.body || {};

    if (!current_password || !new_password) {
      res.status(400).json({ detail: 'Current password and new password are required.' });
      return;
    }

    if (confirm_password && new_password !== confirm_password) {
      res.status(400).json({ detail: 'New password and confirmation password do not match.' });
      return;
    }

    const trimmedPassword = String(new_password).trim();
    if (trimmedPassword.length < 6) {
      res.status(400).json({ detail: 'New password must be at least 6 characters long.' });
      return;
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404).json({ detail: 'User account not found.' });
      return;
    }

    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      res.status(400).json({ detail: 'Current password is incorrect.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(trimmedPassword, salt);
    await user.save();

    res.json({ detail: 'Your password has been changed successfully.' });
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to update password.' });
  }
}

