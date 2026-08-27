import { Request, Response } from 'express';
import { Meeting } from '../models/Meeting.js';
import { Announcement } from '../models/Announcement.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';

// --- Meetings ---
export async function getMeetings(req: Request, res: Response): Promise<void> {
  const { department } = req.query;
  const filter: any = {};
  if (department && department !== 'All') filter.department = department;

  const meetings = await Meeting.find(filter).populate('createdBy').sort({ date: 1, time: 1 });

  const formatted = meetings.map((m) => ({
    id: m._id,
    title: m.title,
    date: m.date ? m.date.toISOString().split('T')[0] : '',
    time: m.time || '10:00',
    description: m.description,
    department: m.department,
    location: m.location,
    created_by: m.createdBy ? (m.createdBy as any)._id : null,
  }));

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function createMeeting(req: Request, res: Response): Promise<void> {
  const { title, date, time, description, department, location } = req.body;
  const meeting = new Meeting({
    title: title.trim(),
    date: new Date(date),
    time,
    description: description || '',
    department: department || 'All Employees',
    location: location || '',
    createdBy: req.user ? req.user._id : null,
  });
  await meeting.save();
  res.status(201).json(meeting);
}

export async function deleteMeeting(req: Request, res: Response): Promise<void> {
  await Meeting.findByIdAndDelete(req.params.id);
  res.status(204).send();
}

// --- Announcements ---
export async function getAnnouncements(req: Request, res: Response): Promise<void> {
  const announcements = await Announcement.find().populate('createdBy').sort({ date: -1 });

  const formatted = announcements.map((a) => ({
    id: a._id,
    title: a.title,
    message: a.message,
    priority: a.priority,
    date: a.date ? a.date.toISOString().split('T')[0] : '',
    created_by: a.createdBy ? (a.createdBy as any)._id : null,
  }));

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function createAnnouncement(req: Request, res: Response): Promise<void> {
  const { title, message, priority } = req.body;
  const announcement = new Announcement({
    title: title.trim(),
    message: message.trim(),
    priority: priority || 'Normal',
    createdBy: req.user ? req.user._id : null,
  });
  await announcement.save();

  // Broadcast Notification to all active users for header bell 🔔
  try {
    const users = await User.find({ isActive: true });
    const notifications = users.map((u) => ({
      user: u._id,
      title: `📢 Announcement: ${announcement.title}`,
      message: announcement.message,
      category: 'announcement',
      isRead: false,
      link: '/admin/announcements',
    }));
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (err) {
    console.error('Failed to broadcast announcement notifications:', err);
  }

  res.status(201).json(announcement);
}

export async function deleteAnnouncement(req: Request, res: Response): Promise<void> {
  await Announcement.findByIdAndDelete(req.params.id);
  res.status(204).send();
}

// --- Notifications ---
export async function getNotifications(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ detail: 'Authentication required.' });
    return;
  }
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });

  const formatted = notifications.map((n) => ({
    id: n._id,
    user: n.user,
    title: n.title,
    message: n.message,
    category: n.category,
    is_read: n.isRead,
    created_at: n.createdAt,
  }));

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function markNotificationAsRead(req: Request, res: Response): Promise<void> {
  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    res.status(404).json({ detail: 'Notification not found.' });
    return;
  }
  notification.isRead = true;
  await notification.save();
  res.json({
    id: notification._id,
    user: notification.user,
    title: notification.title,
    message: notification.message,
    category: notification.category,
    is_read: notification.isRead,
    created_at: notification.createdAt,
  });
}

export async function getUnreadNotificationCount(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ detail: 'Authentication required.' });
    return;
  }
  const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
  res.json({ count });
}

export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ detail: 'Authentication required.' });
    return;
  }
  const result = await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  res.json({ updated: result.modifiedCount || 0 });
}

// --- Audit Logs ---
export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  const logs = await AuditLog.find().populate('actor').sort({ createdAt: -1 }).limit(100);

  const formatted = logs.map((l) => {
    const actorObj = l.actor as any;
    return {
      id: l._id,
      actor_name: actorObj ? actorObj.username || actorObj.email : 'System',
      action: l.action,
      entity_type: l.entityType,
      entity_id: l.entityId,
      details: l.details,
      created_at: l.createdAt,
    };
  });

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}
