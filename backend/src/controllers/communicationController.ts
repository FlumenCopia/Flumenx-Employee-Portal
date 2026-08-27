import { Request, Response } from 'express';
import { Meeting } from '../models/Meeting.js';
import { MeetingMessage } from '../models/MeetingMessage.js';
import { Announcement } from '../models/Announcement.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';

function generateMeetingCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const seg1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const seg2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const seg3 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `fxm-${seg1}-${seg2}-${seg3}`;
}

// --- Meetings ---
export async function getMeetings(req: Request, res: Response): Promise<void> {
  const { department } = req.query;
  const filter: any = {};
  if (department && department !== 'All') filter.department = department;

  const meetings = await Meeting.find(filter).populate('createdBy').sort({ date: -1, time: -1 });

  // Ensure all meetings have a meetingCode
  for (const m of meetings) {
    if (!m.meetingCode) {
      m.meetingCode = generateMeetingCode();
      await m.save();
    }
  }

  const userId = req.user ? req.user._id.toString() : null;

  const formatted = meetings.map((m) => {
    const createdById = m.createdBy ? (m.createdBy as any)._id?.toString() || m.createdBy.toString() : null;
    const isHost =
      (userId && createdById === userId) ||
      req.user?.role === 'SUPER_ADMIN' ||
      Boolean((req.user as any)?.isSuperuser);

    return {
      id: m._id,
      meeting_code: m.meetingCode,
      title: m.title,
      date: m.date ? m.date.toISOString().split('T')[0] : '',
      time: m.time || '10:00',
      description: m.description,
      department: m.department,
      location: m.location,
      status: m.status || 'SCHEDULED',
      created_by: createdById,
      is_host: isHost,
      participants_count: m.participants?.length || 0,
      started_at: m.startedAt,
      ended_at: m.endedAt,
    };
  });

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function getMeetingByCode(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const meeting = await Meeting.findOne({ meetingCode: code }).populate('createdBy', 'username first_name last_name email role');

  if (!meeting) {
    res.status(404).json({ detail: 'Meeting not found or invalid meeting link.' });
    return;
  }

  const userId = req.user ? req.user._id.toString() : null;
  const createdById = meeting.createdBy ? (meeting.createdBy as any)._id?.toString() : null;
  const isHost =
    (userId && createdById === userId) ||
    req.user?.role === 'SUPER_ADMIN' ||
    Boolean((req.user as any)?.isSuperuser);

  res.json({
    id: meeting._id,
    meeting_code: meeting.meetingCode,
    title: meeting.title,
    description: meeting.description,
    department: meeting.department,
    date: meeting.date ? meeting.date.toISOString().split('T')[0] : '',
    time: meeting.time,
    status: meeting.status || 'SCHEDULED',
    settings: meeting.settings,
    is_host: isHost,
    host_name: (meeting.createdBy as any)?.first_name ? `${(meeting.createdBy as any).first_name} ${(meeting.createdBy as any).last_name || ''}`.trim() : 'Organizer',
    participants: meeting.participants,
    started_at: meeting.startedAt,
    ended_at: meeting.endedAt,
  });
}

export async function getMeetingChatHistory(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const messages = await MeetingMessage.find({ meetingCode: code }).sort({ timestamp: 1 });
  const userId = req.user ? req.user._id.toString() : null;

  const formatted = messages.map((msg) => ({
    id: msg._id,
    sender_name: msg.senderName,
    sender_role: msg.senderRole,
    text: msg.text,
    timestamp: msg.timestamp,
    is_self: userId && msg.sender ? msg.sender.toString() === userId : false,
  }));

  res.json(formatted);
}

export async function createMeeting(req: Request, res: Response): Promise<void> {
  const { title, date, time, description, department, location } = req.body;
  const meetingCode = generateMeetingCode();

  const meeting = new Meeting({
    meetingCode,
    title: title.trim(),
    date: new Date(date),
    time,
    description: description || '',
    department: department || 'All Employees',
    location: location || '',
    status: 'SCHEDULED',
    createdBy: req.user ? req.user._id : null,
    host: req.user ? req.user._id : null,
    settings: {
      isLocked: false,
      allowScreenShare: true,
      allowChat: true,
      muteOnEntry: false,
    },
  });
  await meeting.save();

  // Broadcast notification to active employees
  try {
    const users = await User.find({ isActive: true });
    const notifications = users.map((u) => ({
      user: u._id,
      title: `📅 New Meeting: ${meeting.title}`,
      message: `Scheduled for ${date} at ${time} (${meeting.department}). Click to join.`,
      category: 'meeting',
      isRead: false,
      link: `/meet/${meeting.meetingCode}`,
    }));
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (err) {
    console.error('Failed to broadcast meeting notifications:', err);
  }

  res.status(201).json({
    id: meeting._id,
    meeting_code: meeting.meetingCode,
    title: meeting.title,
    date: meeting.date.toISOString().split('T')[0],
    time: meeting.time,
    department: meeting.department,
    status: meeting.status,
  });
}

export async function endMeeting(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const meeting = await Meeting.findOne({ meetingCode: code });
  if (!meeting) {
    res.status(404).json({ detail: 'Meeting not found.' });
    return;
  }

  meeting.status = 'ENDED';
  meeting.endedAt = new Date();
  await meeting.save();

  res.json({ message: 'Meeting ended successfully.' });
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
