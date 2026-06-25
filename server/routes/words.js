const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Word = require('../models/Word');
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

router.get(
  '/',
  [
    query('known').optional().isIn(['true', 'false']),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('pageNum').optional().isInt({ min: 1 }),
    query('word').optional().isString().trim().isLength({ min: 1, max: 128 }),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const filter = { userId: req.userId, word: { $regex: req.query.word || '', $options: 'i' } };
      if (req.query.known === 'true') filter.known = true;
      if (req.query.known === 'false') filter.known = false;

      const pageSize = parseInt(req.query.pageSize, 10) || 10;
      const pageNum = parseInt(req.query.pageNum, 10) || 1;
      const skip = (pageNum - 1) * pageSize;

      const [words, total] = await Promise.all([
        Word.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(pageSize),
        Word.countDocuments(filter),
      ]);

      return res.json({
        items: words,
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

router.post(
  '/',
  [
    body('word').isString().trim().isLength({ min: 1, max: 128 }),
    body('translation').optional().isString().trim().isLength({ max: 256 }),
    body('known').optional().isBoolean(),
    body('weight').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const payload = {
        userId: req.userId,
        word: req.body.word,
        translation: req.body.translation || '',
        known: !!req.body.known,
        weight: req.body.weight || 1,
      };
      const created = await Word.create(payload);
      return res.status(201).json(created);
    } catch (err) {
      if (err && err.code === 11000) {
        return res
          .status(409)
          .json({ error: 'duplicate_word', message: '该单词已存在' });
      }
      return next(err);
    }
  }
);

router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('word').optional().isString().trim().isLength({ min: 1, max: 128 }),
    body('translation').optional().isString().trim().isLength({ max: 256 }),
    body('known').optional().isBoolean(),
    body('weight').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const update = {};
      for (const k of ['word', 'translation', 'known', 'weight']) {
        if (req.body[k] !== undefined) update[k] = req.body[k];
      }
      const updated = await Word.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        update,
        { new: true, runValidators: true }
      );
      if (!updated) return res.status(404).json({ error: 'not_found' });
      return res.json(updated);
    } catch (err) {
      if (err && err.code === 11000) {
        return res
          .status(409)
          .json({ error: 'duplicate_word', message: '该单词已存在' });
      }
      return next(err);
    }
  }
);

router.patch(
  '/:id/known',
  [param('id').isMongoId(), body('known').isBoolean()],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const updated = await Word.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        { known: req.body.known },
        { new: true }
      );
      if (!updated) return res.status(404).json({ error: 'not_found' });
      return res.json(updated);
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/:id',
  [param('id').isMongoId()],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const deleted = await Word.findOneAndDelete({
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

module.exports = router;
