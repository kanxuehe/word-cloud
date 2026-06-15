const mongoose = require('mongoose');

const EssaySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    originalText: {
      type: String,
      required: true,
      trim: true,
    },
    translationText: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

EssaySchema.methods.toJSON = function toJSON() {
  const obj = this.toObject({ versionKey: false });
  obj.id = obj._id;
  delete obj._id;
  return obj;
};

module.exports = mongoose.model('Essay', EssaySchema);
