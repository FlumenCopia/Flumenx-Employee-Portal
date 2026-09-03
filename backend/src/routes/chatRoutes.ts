import { Router } from 'express';
import {
  getConversations,
  createConversation,
  getOrCreateDirectConversation,
  createGroupConversation,
  getConversationMessages,
  sendMessage,
  uploadChatAttachment,
  addConversationMembers,
  removeConversationMember,
  togglePinMessage,
  getQuickStandupData,
  getChatUsersList,
  initiateCallApi,
  deleteMessage,
  forwardMessage,
} from '../controllers/chatController.js';
import { authenticateToken } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.use(authenticateToken);

// Call initiation API fallback
router.post('/call/initiate/?', initiateCallApi);

// Conversation management
router.get('/conversations/?', getConversations);
router.post('/conversations/?', createConversation);
router.post('/conversations/direct/?', getOrCreateDirectConversation);
router.post('/conversations/group/?', createGroupConversation);
router.get('/conversations/:id/messages/?', getConversationMessages);
router.post('/conversations/:id/messages/?', sendMessage);
router.post('/conversations/:id/members/?', addConversationMembers);
router.delete('/conversations/:id/members/:userId/?', removeConversationMember);
router.post('/conversations/:id/pin/:messageId/?', togglePinMessage);

// Message Actions (Delete & Forward)
router.delete('/messages/:messageId/?', deleteMessage);
router.delete('/conversations/:id/messages/:messageId/?', deleteMessage);
router.post('/messages/:messageId/forward/?', forwardMessage);

// Media Upload
router.post('/upload/?', upload.single('file'), uploadChatAttachment);

// Work Utilities
router.get('/quick-standup/?', getQuickStandupData);
router.get('/users/?', getChatUsersList);

export default router;
