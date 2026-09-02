import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ChatConversation, IChatConversation } from '../models/ChatConversation.js';
import { ChatMessage, IChatMessage } from '../models/ChatMessage.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { Client } from '../models/Client.js';
import { Meeting } from '../models/Meeting.js';
import { broadcastChatMessage, getSocketServer } from '../services/chatSocket.js';

// Format conversation for client
function formatConversation(doc: any, currentUserId: string, employeeMap?: Map<string, any>) {
  const isDirect = doc.type === 'DIRECT';
  let displayName = doc.name;
  let displayAvatar = doc.avatar;
  let otherParticipant = null;

  if (isDirect) {
    const other = (doc.participants || []).find(
      (p: any) => String(p.user?._id || p.user) !== String(currentUserId)
    );
    if (other && (other.user || other.employee)) {
      const otherUserId = String(other.user?._id || other.user || '');
      const otherEmp = other.employee || (employeeMap ? employeeMap.get(otherUserId) : null);
      displayName = otherEmp?.name || (other.user?.firstName ? `${other.user.firstName} ${other.user.lastName || ''}`.trim() : other.user?.username) || 'Colleague';
      displayAvatar = other.user?.avatar || otherEmp?.avatar || '';
      otherParticipant = {
        id: other.user?._id || other.user,
        name: displayName,
        avatar: displayAvatar,
        role: other.user?.portalRole || other.user?.role || 'EMPLOYEE',
        department: otherEmp?.department || other.user?.department || '',
      };
    }
  }

  // Calculate unread count
  const myParticipant = (doc.participants || []).find(
    (p: any) => String(p.user?._id || p.user) === String(currentUserId)
  );
  const myLastRead = myParticipant?.lastReadAt ? new Date(myParticipant.lastReadAt).getTime() : 0;
  const lastMsgTime = doc.lastMessageAt ? new Date(doc.lastMessageAt).getTime() : 0;
  const hasUnread = lastMsgTime > myLastRead && String(doc.lastMessageSenderName) !== String(myParticipant?.employee?.name || myParticipant?.user?.username);

  return {
    id: doc._id,
    type: doc.type,
    name: displayName || 'Group Chat',
    description: doc.description || '',
    avatar: displayAvatar || '',
    department: doc.department || '',
    client_id: doc.client?._id || doc.client || null,
    client_name: doc.client?.name || '',
    created_by: doc.createdBy,
    participants: (doc.participants || []).map((p: any) => {
      const pUserId = String(p.user?._id || p.user || '');
      const pEmp = p.employee || (employeeMap ? employeeMap.get(pUserId) : null);
      return {
        user_id: p.user?._id || p.user,
        name: pEmp?.name || (p.user?.firstName ? `${p.user.firstName} ${p.user.lastName || ''}`.trim() : p.user?.username) || 'User',
        avatar: p.user?.avatar || pEmp?.avatar || '',
        role: p.role || 'MEMBER',
        portal_role: p.user?.portalRole || p.user?.role || 'EMPLOYEE',
        department: pEmp?.department || p.user?.department || '',
      };
    }),
    pinned_messages: doc.pinnedMessages || [],
    last_message_text: doc.lastMessageText || '',
    last_message_at: doc.lastMessageAt ? new Date(doc.lastMessageAt).toISOString() : new Date(doc.updatedAt).toISOString(),
    last_message_sender_name: doc.lastMessageSenderName || '',
    has_unread: hasUnread,
    is_admin: myParticipant?.role === 'ADMIN' || String(doc.createdBy) === String(currentUserId),
    other_participant: otherParticipant,
  };
}

// 1. List user's conversations
export async function getConversations(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user ? req.user._id.toString() : '';
  if (!currentUserId) {
    res.status(401).json({ detail: 'Unauthorized' });
    return;
  }

  const conversations = await ChatConversation.find({
    'participants.user': currentUserId,
    isArchived: false,
  })
    .populate('participants.user participants.employee client')
    .sort({ lastMessageAt: -1, updatedAt: -1 });

  // Gather all participant user IDs to batch fetch Employees
  const allUserIds = new Set<string>();
  for (const c of conversations) {
    for (const p of c.participants || []) {
      if (p.user) allUserIds.add(String((p.user as any)._id || p.user));
    }
  }

  const employees = await Employee.find({ user: { $in: Array.from(allUserIds) } });
  const employeeMap = new Map(employees.map((e) => [String(e.user), e]));

  res.json(conversations.map((c) => formatConversation(c, currentUserId, employeeMap)));
}

// 2. Get or Create 1-to-1 Direct Conversation
export async function getOrCreateDirectConversation(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user ? req.user._id.toString() : '';
  const { target_user_id, target_employee_id } = req.body;

  let targetUserId = target_user_id;
  let targetEmpId = target_employee_id;

  if (!targetUserId && targetEmpId) {
    const emp = await Employee.findById(targetEmpId);
    if (emp && emp.user) targetUserId = emp.user.toString();
  }

  if (!targetUserId) {
    res.status(400).json({ detail: 'Target user ID is required.' });
    return;
  }

  if (String(currentUserId) === String(targetUserId)) {
    res.status(400).json({ detail: 'Cannot start conversation with yourself.' });
    return;
  }

  // Check if direct conversation already exists
  let conversation = await ChatConversation.findOne({
    type: 'DIRECT',
    $and: [
      { participants: { $elemMatch: { user: currentUserId } } },
      { participants: { $elemMatch: { user: targetUserId } } },
    ],
  }).populate('participants.user participants.employee client');

  if (!conversation) {
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      res.status(404).json({ detail: 'Target user not found.' });
      return;
    }

    const currentEmp = await Employee.findOne({ user: currentUserId });
    const targetEmp = await Employee.findOne({ user: targetUserId });

    conversation = await ChatConversation.create({
      type: 'DIRECT',
      createdBy: currentUserId,
      participants: [
        {
          user: currentUserId,
          employee: currentEmp?._id || null,
          role: 'ADMIN',
          joinedAt: new Date(),
          lastReadAt: new Date(),
        },
        {
          user: targetUserId,
          employee: targetEmp?._id || null,
          role: 'ADMIN',
          joinedAt: new Date(),
          lastReadAt: new Date(),
        },
      ],
      lastMessageText: 'Conversation started',
      lastMessageAt: new Date(),
    });

    conversation = await ChatConversation.findById(conversation._id).populate('participants.user participants.employee client');
  }

  const allUserIds = [currentUserId, String(targetUserId)];
  const employees = await Employee.find({ user: { $in: allUserIds } });
  const employeeMap = new Map(employees.map((e) => [String(e.user), e]));

  res.status(200).json(formatConversation(conversation, currentUserId, employeeMap));
}

// 3. Create Group / Department / Client Channel
export async function createGroupConversation(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user ? req.user._id.toString() : '';
  const { name, type = 'GROUP', description, department, client_id, participant_user_ids = [] } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ detail: 'Group or Channel name is required.' });
    return;
  }

  const allUserIds = Array.from(new Set([currentUserId, ...participant_user_ids]));
  const participants = await Promise.all(
    allUserIds.map(async (uId) => {
      const emp = await Employee.findOne({ user: uId });
      return {
        user: uId,
        employee: emp?._id || null,
        role: String(uId) === String(currentUserId) ? ('ADMIN' as const) : ('MEMBER' as const),
        joinedAt: new Date(),
        lastReadAt: new Date(),
      };
    })
  );

  const senderName = (req.user as any)?.name || (req.user as any)?.firstName || req.user?.username || 'Admin';

  const newGroup = await ChatConversation.create({
    type: type || 'GROUP',
    name: name.trim(),
    description: description?.trim() || '',
    department: department || '',
    client: client_id || null,
    createdBy: currentUserId,
    participants,
    lastMessageText: `Group created by ${senderName}`,
    lastMessageAt: new Date(),
  });

  const populated = await ChatConversation.findById(newGroup._id).populate('participants.user participants.employee client');
  const employees = await Employee.find({ user: { $in: allUserIds } });
  const employeeMap = new Map(employees.map((e) => [String(e.user), e]));

  res.status(201).json(formatConversation(populated, currentUserId, employeeMap));
}

// 3b. Unified Create or Get Conversation (Handles POST /api/chat/conversations/)
export async function createConversation(req: Request, res: Response): Promise<void> {
  const { type = 'DIRECT', participant_ids = [], participant_user_ids = [], target_user_id, target_employee_id, name } = req.body;
  const userIds = participant_ids.length > 0 ? participant_ids : participant_user_ids;

  if (type === 'DIRECT' || (!name && userIds.length === 1)) {
    req.body.target_user_id = target_user_id || userIds[0];
    req.body.target_employee_id = target_employee_id;
    return getOrCreateDirectConversation(req, res);
  } else {
    req.body.name = name;
    req.body.type = type;
    req.body.participant_user_ids = userIds;
    return createGroupConversation(req, res);
  }
}

// 4. Get Conversation Messages
export async function getConversationMessages(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user ? req.user._id.toString() : '';
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404).json({ detail: 'Conversation not found.' });
    return;
  }

  const conversation = await ChatConversation.findById(id);
  if (!conversation) {
    res.status(404).json({ detail: 'Conversation not found.' });
    return;
  }

  // Security Check: Only explicit participants can access conversation messages
  const isParticipant = (conversation.participants || []).some(
    (p) => String((p.user as any)?._id || p.user) === String(currentUserId)
  );
  if (!isParticipant) {
    res.status(403).json({ detail: 'Access denied. You are not a participant in this conversation.' });
    return;
  }

  // Update current user's lastReadAt
  await ChatConversation.updateOne(
    { _id: id, 'participants.user': currentUserId },
    { $set: { 'participants.$.lastReadAt': new Date() } }
  );

  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 30, 1), 100);
  const before = req.query.before as string;

  const filter: any = {
    conversation: id,
    isDeleted: false,
  };

  if (before) {
    const beforeDate = new Date(before);
    if (!isNaN(beforeDate.getTime())) {
      filter.createdAt = { $lt: beforeDate };
    }
  }

  // Fetch messages in descending order (latest first) up to limit
  const messages = await ChatMessage.find(filter)
    .populate('sender')
    .sort({ createdAt: -1 })
    .limit(limit);

  // Check if there are older messages prior to this batch
  let hasMore = false;
  if (messages.length > 0) {
    const oldestInBatch = messages[messages.length - 1].createdAt;
    const countOlder = await ChatMessage.countDocuments({
      conversation: id,
      isDeleted: false,
      createdAt: { $lt: oldestInBatch },
    });
    hasMore = countOlder > 0;
  }

  // Reverse so the client receives them in chronological order (oldest to newest)
  const chronological = messages.reverse();

  const formatted = chronological.map((m) => ({
    id: m._id,
    conversation_id: m.conversation,
    sender_id: m.sender?._id || m.sender || null,
    sender_name: m.senderName,
    sender_role: m.senderRole,
    sender_avatar: m.senderAvatar,
    message_type: m.messageType,
    text: m.text,
    attachments: (m.attachments || []).map((a) => ({
      name: a.name,
      url: a.url,
      file_type: a.fileType,
      file_size: a.fileSize,
    })),
    task_embed: m.taskEmbed,
    client_embed: m.clientEmbed,
    standup_data: m.standupData,
    meeting_code: m.meetingCode,
    is_pinned: m.isPinned,
    pinned_at: m.pinnedAt ? m.pinnedAt.toISOString() : null,
    reactions: m.reactions || [],
    reply_to: m.replyTo,
    reply_to_snapshot: m.replyToSnapshot,
    created_at: m.createdAt.toISOString(),
    is_self: String(m.sender?._id || m.sender) === String(currentUserId),
  }));

  res.json({
    messages: formatted,
    has_more: hasMore,
    oldest_cursor: formatted.length > 0 ? formatted[0].created_at : null,
    total_in_batch: formatted.length,
  });
}

// 5. Send Message (Text, Media, Smart Task/Client Embed, Daily Standup)
export async function sendMessage(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user ? req.user._id.toString() : '';
  const { id } = req.params;
  const {
    text = '',
    message_type = 'TEXT',
    attachments = [],
    task_id,
    client_id,
    standup_data,
    meeting_code,
    reply_to,
  } = req.body;

  const conversation = await ChatConversation.findById(id);
  if (!conversation) {
    res.status(404).json({ detail: 'Conversation not found.' });
    return;
  }

  // Security Check: Only explicit participants can send messages
  const isParticipant = (conversation.participants || []).some(
    (p) => String((p.user as any)?._id || p.user) === String(currentUserId)
  );
  if (!isParticipant) {
    res.status(403).json({ detail: 'Access denied. You are not a participant in this conversation.' });
    return;
  }

  let taskEmbed = undefined;
  if (task_id) {
    const taskObj = await WorkAssignment.findById(task_id).populate('employee client');
    if (taskObj) {
      taskEmbed = {
        id: taskObj._id,
        title: taskObj.title,
        status: taskObj.status,
        priority: taskObj.priority,
        completedQuantity: taskObj.completedQuantity || 0,
        assignedQuantity: taskObj.assignedQuantity || 1,
        unit: taskObj.unit || 'tasks',
        employeeName: (taskObj.employee as any)?.name || 'Team Member',
        clientName: (taskObj.client as any)?.name || 'Client',
      };
    }
  }

  let clientEmbed = undefined;
  if (client_id) {
    const clientObj = await Client.findById(client_id);
    if (clientObj) {
      clientEmbed = {
        id: clientObj._id,
        name: clientObj.name,
        industry: clientObj.industry || 'General',
        contactPerson: clientObj.contactPerson?.name || '',
      };
    }
  }

  let replySnapshot = undefined;
  if (reply_to) {
    const original = await ChatMessage.findById(reply_to);
    if (original) {
      replySnapshot = {
        id: original._id.toString(),
        senderName: original.senderName,
        text: original.text ? original.text.slice(0, 80) : `[${original.messageType}]`,
      };
    }
  }

  const userEmp = await Employee.findOne({ user: currentUserId });
  const senderName = userEmp?.name || (req.user as any)?.name || (req.user as any)?.firstName || req.user?.username || 'Team Member';
  const senderRole = (req.user as any)?.portalRole || req.user?.role || 'EMPLOYEE';
  const senderAvatar = req.user?.avatar || userEmp?.avatar || '';

  const message = await ChatMessage.create({
    conversation: id,
    sender: currentUserId,
    senderName,
    senderRole,
    senderAvatar,
    messageType: message_type || (taskEmbed ? 'TASK_EMBED' : clientEmbed ? 'CLIENT_EMBED' : standup_data ? 'STANDUP_UPDATE' : meeting_code ? 'MEETING_LINK' : 'TEXT'),
    text: text?.trim() || (taskEmbed ? `📌 Linked Task: ${taskEmbed.title}` : clientEmbed ? `🏢 Linked Client: ${clientEmbed.name}` : standup_data ? `⚡ Daily Work Update (${standup_data.date || 'Today'})` : ''),
    attachments: attachments.map((a: any) => ({
      name: a.name,
      url: a.url,
      fileType: a.fileType || a.file_type || 'file',
      fileSize: a.fileSize || a.file_size || 0,
    })),
    taskEmbed,
    clientEmbed,
    standupData: standup_data,
    meetingCode: meeting_code,
    replyTo: reply_to || null,
    replyToSnapshot: replySnapshot,
    readBy: [{ user: currentUserId, readAt: new Date() }],
  });

  // Update conversation lastMessage
  let previewText = message.text;
  if (message.messageType === 'IMAGE') previewText = '📷 Photo';
  if (message.messageType === 'VIDEO') previewText = '🎥 Video';
  if (message.messageType === 'FILE') previewText = '📎 File attachment';
  if (message.messageType === 'STANDUP_UPDATE') previewText = '⚡ Daily Work Update';
  if (message.messageType === 'TASK_EMBED') previewText = `📌 Task: ${taskEmbed?.title || ''}`;

  conversation.lastMessage = message._id as any;
  conversation.lastMessageText = previewText;
  conversation.lastMessageAt = new Date();
  conversation.lastMessageSenderName = senderName;
  await conversation.save();

  const formattedMsg = {
    id: message._id,
    conversation_id: message.conversation,
    sender_id: currentUserId,
    sender_name: senderName,
    sender_role: senderRole,
    sender_avatar: senderAvatar,
    message_type: message.messageType,
    text: message.text,
    attachments: message.attachments,
    task_embed: message.taskEmbed,
    client_embed: message.clientEmbed,
    standup_data: message.standupData,
    meeting_code: message.meetingCode,
    is_pinned: message.isPinned,
    reply_to: message.replyTo,
    reply_to_snapshot: message.replyToSnapshot,
    created_at: message.createdAt.toISOString(),
  };

  const participantUserIds = (conversation.participants || []).map((p) => String(p.user));
  broadcastChatMessage(String(id), formattedMsg, participantUserIds);

  res.status(201).json({
    ...formattedMsg,
    is_self: true,
  });
}

// 6. Upload Chat Attachment
export async function uploadChatAttachment(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ detail: 'No file uploaded.' });
    return;
  }

  const file = req.file;
  const folder = file.destination?.replace(/\\/g, '/').split('/').pop() || 'chat';
  const fileUrl = `/media/${folder}/${file.filename}`;
  let fileType = 'file';
  if (file.mimetype.startsWith('image/')) fileType = 'image';
  else if (file.mimetype.startsWith('video/')) fileType = 'video';
  else if (file.mimetype.startsWith('audio/')) fileType = 'audio';
  else if (file.mimetype.includes('pdf')) fileType = 'pdf';

  res.json({
    name: file.originalname,
    url: fileUrl,
    file_type: fileType,
    file_size: file.size,
  });
}

// 7. Add Members to Group
export async function addConversationMembers(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user ? req.user._id.toString() : '';
  const { id } = req.params;
  const { user_ids = [] } = req.body;

  const conversation = await ChatConversation.findById(id);
  if (!conversation) {
    res.status(404).json({ detail: 'Conversation not found.' });
    return;
  }

  const isParticipant = (conversation.participants || []).some(
    (p) => String((p.user as any)?._id || p.user) === String(currentUserId)
  );
  if (!isParticipant) {
    res.status(403).json({ detail: 'Access denied. You are not a participant in this conversation.' });
    return;
  }

  const existingUserIds = new Set(conversation.participants.map((p) => String(p.user)));

  for (const uId of user_ids) {
    if (!existingUserIds.has(String(uId))) {
      const emp = await Employee.findOne({ user: uId });
      conversation.participants.push({
        user: uId,
        employee: (emp?._id as any) || null,
        role: 'MEMBER',
        joinedAt: new Date(),
        lastReadAt: new Date(),
      });
    }
  }

  await conversation.save();
  const populated = await ChatConversation.findById(id).populate('participants.user participants.employee client');
  res.json(formatConversation(populated, req.user?._id?.toString() || ''));
}

// 8. Remove / Kick Member from Group
export async function removeConversationMember(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user ? req.user._id.toString() : '';
  const { id, userId } = req.params;

  const conversation = await ChatConversation.findById(id);
  if (!conversation) {
    res.status(404).json({ detail: 'Conversation not found.' });
    return;
  }

  const isParticipant = (conversation.participants || []).some(
    (p) => String((p.user as any)?._id || p.user) === String(currentUserId)
  );
  if (!isParticipant) {
    res.status(403).json({ detail: 'Access denied. You are not a participant in this conversation.' });
    return;
  }

  conversation.participants = conversation.participants.filter(
    (p) => String(p.user) !== String(userId)
  );

  await conversation.save();
  const populated = await ChatConversation.findById(id).populate('participants.user participants.employee client');
  res.json(formatConversation(populated, req.user?._id?.toString() || ''));
}

// 9. Pin / Unpin Message
export async function togglePinMessage(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user ? req.user._id.toString() : '';
  const { id, messageId } = req.params;
  const message = await ChatMessage.findById(messageId);
  const conversation = await ChatConversation.findById(id);

  if (!message || !conversation) {
    res.status(404).json({ detail: 'Message or Conversation not found.' });
    return;
  }

  const isParticipant = (conversation.participants || []).some(
    (p) => String((p.user as any)?._id || p.user) === String(currentUserId)
  );
  if (!isParticipant) {
    res.status(403).json({ detail: 'Access denied. You are not a participant in this conversation.' });
    return;
  }

  message.isPinned = !message.isPinned;
  message.pinnedBy = message.isPinned && req.user ? (req.user._id as any) : undefined;
  message.pinnedAt = message.isPinned ? new Date() : undefined;
  await message.save();

  if (message.isPinned) {
    if (!conversation.pinnedMessages.includes(message._id as any)) {
      conversation.pinnedMessages.push(message._id as any);
    }
  } else {
    conversation.pinnedMessages = conversation.pinnedMessages.filter(
      (p) => String(p) !== String(message._id)
    );
  }
  await conversation.save();

  res.json({ is_pinned: message.isPinned });
}

// 10. 1-Click Smart Daily Standup Work Summary
export async function getQuickStandupData(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user ? req.user._id.toString() : '';
  const emp = await Employee.findOne({ user: currentUserId });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const empFilter = emp ? { employee: emp._id } : {};

  const allMyTasks = await WorkAssignment.find(empFilter).sort({ updatedAt: -1 });

  const completedToday = allMyTasks.filter(
    (t: any) => (t.status === 'Completed' || t.status === 'Published') && t.updatedAt && new Date(t.updatedAt) >= startOfToday
  ).map((t) => `${t.title} (${t.completedQuantity || 0}/${t.assignedQuantity || 1} ${t.unit})`);

  const inProgress = allMyTasks.filter(
    (t) => t.status === 'In Progress' || t.status === 'Assigned' || t.status === 'In Review'
  ).map((t) => `${t.title} [${t.status}] (${t.completedQuantity || 0}/${t.assignedQuantity || 1} ${t.unit})`);

  const blockers = allMyTasks.filter(
    (t) => t.status === 'Blocked' || t.status === 'Changes Requested'
  ).map((t) => `${t.title} (Reason: ${t.description || 'Action required'})`);

  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const employeeName = (req.user as any)?.name || (req.user as any)?.firstName || req.user?.username || 'Team Member';

  res.json({
    date: todayStr,
    employee_name: employeeName,
    completed_tasks: completedToday.length > 0 ? completedToday : ['All assigned deliverable items progressing'],
    in_progress_tasks: inProgress.slice(0, 8),
    blockers: blockers.length > 0 ? blockers : ['No active blockers'],
  });
}

// 11. Search / List Users for Direct Message & Group Adding
export async function getChatUsersList(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user ? req.user._id.toString() : '';
  const users = await User.find({ _id: { $ne: currentUserId }, isActive: true })
    .select('username email role avatar firstName lastName')
    .sort({ username: 1 });

  const employees = await Employee.find({ status: 'Active' }).select('user name email department designation avatar');
  const empMap = new Map(employees.map((e) => [String(e.user), e]));

  const result = users.map((u) => {
    const emp = empMap.get(String(u._id));
    const name = emp?.name || (u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.username);
    return {
      id: u._id,
      name,
      username: u.username,
      email: u.email,
      portal_role: u.role,
      department: emp?.department || 'General',
      designation: emp?.designation || 'Specialist',
      avatar: u.avatar || emp?.avatar || '',
    };
  });

  res.json(result);
}

// 12. Initiate Call REST API fallback & signaling endpoint
export async function initiateCallApi(req: Request, res: Response): Promise<void> {
  try {
    const { to_user_id, toUserId, call_type, callType, conversation_id, conversationId } = req.body || {};
    const targetUserId = to_user_id || toUserId;
    const type = call_type || callType || 'audio';
    const convId = conversation_id || conversationId;

    if (!targetUserId) {
      res.status(400).json({ detail: 'Recipient target user ID is required.' });
      return;
    }

    const callerId = req.user ? req.user._id.toString() : '';
    const emp = await Employee.findOne({ user: callerId });
    const callerName = emp?.name || ((req.user as any)?.firstName ? `${(req.user as any).firstName} ${(req.user as any).lastName || ''}`.trim() : req.user?.username || 'Colleague');
    const callerAvatar = req.user?.avatar || emp?.avatar || '';

    const io = getSocketServer();
    if (io) {
      io.to(`user:${targetUserId}`).emit('call:incoming', {
        fromUserId: callerId,
        fromSocketId: '',
        callerName,
        callerAvatar,
        callType: type,
        conversationId: convId,
      });
    }

    res.json({
      success: true,
      message: 'Call signal dispatched',
      targetUserId,
      callType: type,
    });
  } catch (err: any) {
    res.status(500).json({ detail: err?.message || 'Failed to initiate call' });
  }
}
