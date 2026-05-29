const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: '尝试次数过多，请稍后再试' },
});

const credentialsValidator = [
  body('username')
    .isString()
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage('用户名长度需在 3-32 之间'),
  body('password')
    .isString()
    .isLength({ min: 6, max: 64 })
    .withMessage('密码长度需在 6-64 之间'),
];

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'validation_failed', details: errors.array() });
    return false;
  }
  return true;
}

function issueToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

router.post('/register', credentialsValidator, async (req, res, next) => {
  if (!handleValidation(req, res)) return;
  try {
    const { username, password } = req.body;
    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(409).json({ error: 'username_taken', message: '用户名已被注册' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });
    const token = issueToken(user);
    return res.status(201).json({ token, user });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', loginLimiter, credentialsValidator, async (req, res, next) => {
  if (!handleValidation(req, res)) return;
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'invalid_credentials', message: '用户名或密码错误' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'invalid_credentials', message: '用户名或密码错误' });
    }
    const token = issueToken(user);
    return res.json({ token, user });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
