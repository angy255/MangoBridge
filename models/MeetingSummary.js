const mongoose = require('mongoose');

const meetingSummarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  meetingDate: {
    type: Date,
    required: true
  },
  transcript: {
    type: String,
    default: ''
  },
  translatedTranscript: {
    type: String,
    default: ''
  },
  summary: {
    type: String,
    required: true
  },
  sourceLang: {
    type: String,
    default: 'en'
  },
  targetLang: {
    type: String,
    default: 'en'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MeetingSummary', meetingSummarySchema);