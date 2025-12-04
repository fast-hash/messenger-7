const express = require('express');
const authMiddleware = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const chatService = require('../services/chatService');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const chats = await chatService.getUserChats({ userId: req.user.id });
    res.json({ chats });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { otherUserId } = req.body || {};
    const chat = await chatService.getOrCreateDirectChat({
      userId: req.user.id,
      otherUserId,
    });
    res.status(201).json({ chat });
  })
);

router.post(
  '/group',
  asyncHandler(async (req, res) => {
    const { title, participantIds } = req.body || {};
    const result = await chatService.createGroupChat({
      title,
      creatorId: req.user.id,
      participantIds,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/groups',
  asyncHandler(async (req, res) => {
    const groups = await chatService.listGroupsForUser({ userId: req.user.id });
    res.json({ groups });
  })
);

router.get(
  '/:id/participants',
  asyncHandler(async (req, res) => {
    const { chat, canManage } = await chatService.getGroupDetails({
      chatId: req.params.id,
      userId: req.user.id,
    });
    res.json({ chat, canManage });
  })
);

router.post(
  '/:id/participants',
  asyncHandler(async (req, res) => {
    const { userId } = req.body || {};
    const result = await chatService.groupAddParticipant({
      chatId: req.params.id,
      adminId: req.user.id,
      userId,
    });
    res.json(result);
  })
);

router.delete(
  '/:id/participants/:userId',
  asyncHandler(async (req, res) => {
    const result = await chatService.groupRemoveParticipant({
      chatId: req.params.id,
      adminId: req.user.id,
      userId: req.params.userId,
    });
    res.json(result);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { title } = req.body || {};
    const result = await chatService.groupRename({
      chatId: req.params.id,
      adminId: req.user.id,
      title,
    });
    res.json(result);
  })
);

router.post(
  '/:id/join-request',
  asyncHandler(async (req, res) => {
    const result = await chatService.groupRequestJoin({
      chatId: req.params.id,
      userId: req.user.id,
    });
    res.json(result);
  })
);

router.post(
  '/:id/join-requests/:userId/approve',
  asyncHandler(async (req, res) => {
    const result = await chatService.groupApproveRequest({
      chatId: req.params.id,
      adminId: req.user.id,
      userId: req.params.userId,
    });
    res.json(result);
  })
);

router.post(
  '/:id/join-requests/:userId/reject',
  asyncHandler(async (req, res) => {
    const result = await chatService.groupRejectRequest({
      chatId: req.params.id,
      adminId: req.user.id,
      userId: req.params.userId,
    });
    res.json(result);
  })
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const result = await chatService.markChatRead({ chatId: req.params.id, userId: req.user.id });
    res.json(result);
  })
);

router.post(
  '/:id/block',
  asyncHandler(async (req, res) => {
    const chat = await chatService.blockUserInDirectChat(req.params.id, req.user.id);
    res.json({ chat });
  })
);

router.delete(
  '/:id/block',
  asyncHandler(async (req, res) => {
    const chat = await chatService.unblockUserInDirectChat(req.params.id, req.user.id);
    res.json({ chat });
  })
);

module.exports = router;
