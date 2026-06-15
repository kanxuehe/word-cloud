const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Essay = require('../models/Essay');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'validation_failed', details: errors.array() });
    return false;
  }
  return true;
}

// 调用 DeepSeek 翻译文本
async function translateText(text) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY');
  }

  const hasChinese = /[一-鿿]/.test(text);
  const direction = hasChinese ? '英文' : '中文';

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `请将以下文本翻译成${direction}，只输出译文，不要添加任何解释或额外内容：\n\n${text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('[translate] API error:', response.status, errBody);
    throw new Error('翻译服务请求失败');
  }

  const data = await response.json();
  const translationText = data.choices?.[0]?.message?.content?.trim() || '';
  if (!translationText) {
    throw new Error('翻译结果为空');
  }
  return translationText;
}

// 列表（分页）
router.get(
  '/',
  [
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('pageNum').optional().isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const filter = { userId: req.userId };
      const pageSize = parseInt(req.query.pageSize, 10) || 10;
      const pageNum = parseInt(req.query.pageNum, 10) || 1;
      const skip = (pageNum - 1) * pageSize;

      const [essays, total] = await Promise.all([
        Essay.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(pageSize),
        Essay.countDocuments(filter),
      ]);

      return res.json({
        items: essays,
        total,
        pageSize,
        pageNum,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (err) {
      return next(err);
    }
  }
);

// 详情
router.get(
  '/:id',
  [param('id').isMongoId()],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const essay = await Essay.findOne({ _id: req.params.id, userId: req.userId });
      if (!essay) return res.status(404).json({ error: 'not_found' });
      return res.json(essay);
    } catch (err) {
      return next(err);
    }
  }
);

// 创建
router.post(
  '/',
  [
    body('title').isString().trim().isLength({ min: 1, max: 256 }),
    body('originalText').isString().trim().isLength({ min: 1 }),
    body('translationText').optional().isString().trim(),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const payload = {
        userId: req.userId,
        title: req.body.title,
        originalText: req.body.originalText,
        translationText: req.body.translationText || '',
      };
      const created = await Essay.create(payload);
      return res.status(201).json(created);
    } catch (err) {
      return next(err);
    }
  }
);

// 更新
router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('title').optional().isString().trim().isLength({ min: 1, max: 256 }),
    body('originalText').optional().isString().trim().isLength({ min: 1 }),
    body('translationText').optional().isString().trim(),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const update = {};
      for (const k of ['title', 'originalText', 'translationText']) {
        if (req.body[k] !== undefined) update[k] = req.body[k];
      }
      const updated = await Essay.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        update,
        { new: true, runValidators: true }
      );
      if (!updated) return res.status(404).json({ error: 'not_found' });
      return res.json(updated);
    } catch (err) {
      return next(err);
    }
  }
);

// 删除
router.delete(
  '/:id',
  [param('id').isMongoId()],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const deleted = await Essay.findOneAndDelete({
        _id: req.params.id,
        userId: req.userId,
      });
      if (!deleted) return res.status(404).json({ error: 'not_found' });
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  }
);

// 纯文本翻译（不保存，供表单使用）
router.post(
  '/translate-text',
  [body('text').isString().trim().isLength({ min: 1 })],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const translationText = await translateText(req.body.text);
      return res.json({ translationText });
    } catch (err) {
      if (err.message === '未配置 DEEPSEEK_API_KEY') {
        return res.status(500).json({ error: 'no_api_key', message: err.message });
      }
      return res.status(502).json({ error: 'translate_failed', message: err.message });
    }
  }
);

// AI 翻译（保存到数据库）
router.post(
  '/:id/translate',
  [param('id').isMongoId()],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const essay = await Essay.findOne({ _id: req.params.id, userId: req.userId });
      if (!essay) return res.status(404).json({ error: 'not_found' });
      if (!essay.originalText.trim()) {
        return res.status(400).json({ error: 'no_original_text', message: '原文为空，无法翻译' });
      }

      const translationText = await translateText(essay.originalText);

      // 存回数据库
      essay.translationText = translationText;
      await essay.save();

      return res.json(essay);
    } catch (err) {
      if (err.message === '未配置 DEEPSEEK_API_KEY') {
        return res.status(500).json({ error: 'no_api_key', message: err.message });
      }
      return res.status(502).json({ error: 'translate_failed', message: err.message });
    }
  }
);

module.exports = router;
