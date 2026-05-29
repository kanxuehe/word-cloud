const mongoose = require('mongoose');

const WordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    word: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
    translation: {
      type: String,
      default: '',
      trim: true,
      maxlength: 256,
    },
    known: {
      type: Boolean,
      default: false,
    },
    weight: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
    },
  },
  { timestamps: true }
);

// 同用户下原词唯一，避免重复录入
WordSchema.index({ userId: 1, word: 1 }, { unique: true });

WordSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject({ versionKey: false });
  obj.id = obj._id;
  delete obj._id;
  return obj;
};

module.exports = mongoose.model('Word', WordSchema);
