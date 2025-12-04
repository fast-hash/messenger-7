const express = require('express');
const authMiddleware = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const messageService = require('../services/messageService');

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

module.exports = router;
