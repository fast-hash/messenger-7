const bcrypt = require('bcryptjs');
const User = require('../models/User');

const SALT_ROUNDS = 10;

const ALLOWED_ROLES = ['doctor', 'nurse', 'admin', 'staff'];

const toUserDto = (userDoc) => ({
  id: userDoc._id.toString(),
  username: userDoc.username,
  email: userDoc.email,
  displayName: userDoc.displayName,
  role: userDoc.role,
  department: userDoc.department,
  jobTitle: userDoc.jobTitle,
  createdAt: userDoc.createdAt,
});

const registerUser = async ({
  username,
  email,
  password,
  displayName,
  role,
  department,
  jobTitle,
}) => {
  if (!username || !email || !password) {
    const error = new Error('Username, email, and password are required');
    error.status = 400;
    throw error;
  }

  const normalizedEmail = email.toLowerCase();

  const existingEmail = await User.findOne({ email: normalizedEmail });
  if (existingEmail) {
    const error = new Error('Email is already registered');
    error.status = 409;
    throw error;
  }

  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    const error = new Error('Username is already taken');
    error.status = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const normalizedRole = ALLOWED_ROLES.includes(role) ? role : 'staff';

  const user = await User.create({
    username,
    email: normalizedEmail,
    passwordHash,
    displayName: displayName || username,
    role: normalizedRole,
    department: department || null,
    jobTitle: jobTitle || null,
  });

  return toUserDto(user);
};

const authenticateUser = async ({ email, password }) => {
  if (!email || !password) {
    const error = new Error('Email and password are required');
    error.status = 400;
    throw error;
  }

  const normalizedEmail = email.toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const error = new Error('Invalid credentials');
    error.status = 401;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    const error = new Error('Invalid credentials');
    error.status = 401;
    throw error;
  }

  return toUserDto(user);
};

const searchUsers = async ({ query, excludeUserId }) => {
  const trimmed = (query || '').trim();

  if (!trimmed) {
    const users = await User.find({ _id: { $ne: excludeUserId } })
      .limit(50)
      .sort({ createdAt: -1 });
    return users.map(toUserDto);
  }

  // Экранируем спецсимволы, чтобы искать буквальный текст без падений RegExp
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');

  const users = await User.find({
    _id: { $ne: excludeUserId },
    $or: [{ username: regex }, { displayName: regex }, { email: regex }],
  })
    .limit(20)
    .sort({ createdAt: -1 });

  return users.map(toUserDto);
};

module.exports = {
  registerUser,
  authenticateUser,
  searchUsers,
};
