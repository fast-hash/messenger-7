const express = require('express');
const authMiddleware = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const messageService = require('../services/messageService');
const { getIo } = require('../sockets');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { chatId } = req.query;
    const { messages, lastReadAt } = await messageService.getMessagesForChat({
      chatId,
      viewerId: req.user.id,
    });
    res.json({ messages, lastReadAt });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { chatId, text, mentions } = req.body || {};
    const message = await messageService.sendMessage({
      chatId,
      senderId: req.user.id,
      senderRole: req.user.role,
      text,
      mentions,
    });
    res.status(201).json({ message });
  })
);

router.post(
  '/:messageId/reactions',
  asyncHandler(async (req, res) => {
    const { emoji } = req.body || {};
    const result = await messageService.toggleReaction({
      messageId: req.params.messageId,
      userId: req.user.id,
      emoji,
    });

    const io = getIo();
    if (io) {
      io.to(`chat:${result.chatId}`).emit('message:reactionsUpdated', {
        chatId: result.chatId,
        messageId: result.messageId,
        reactions: result.reactions,
      });
    }

    res.json({ reactions: result.reactions });
  })
);

router.post(
  '/:messageId/delete-for-me',
  asyncHandler(async (req, res) => {
    await messageService.deleteForMe({
      messageId: req.params.messageId,
      userId: req.user.id,
    });
    res.json({ ok: true });
  })
);

router.post(
  '/:messageId/delete-for-all',
  asyncHandler(async (req, res) => {
    const result = await messageService.deleteForAll({
      messageId: req.params.messageId,
      userId: req.user.id,
    });

    const io = getIo();
    if (io) {
      io.to(`chat:${result.chatId}`).emit('message:deleted', result);
    }

    res.json(result);
  })
);

module.exports = router;
