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
    const { chatId, text } = req.body || {};
    const message = await messageService.sendMessage({
      chatId,
      senderId: req.user.id,
      text,
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

module.exports = router;
