const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true,
    trim: true
  },
  sourceLang: {
    type: String,
    required: true,
    enum: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'nl', 'pl', 'ru', 'ko', 'tr']
  },
  targetLang: {
    type: String,
    required: true,
    enum: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'nl', 'pl', 'ru', 'ko', 'tr']
  },
  originalText: {
    type: String,
    required: true
  },
  translatedText: {
    type: String,
    required: true
  },
  aiNote: {
    type: String,
    default: ''
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  parentMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);