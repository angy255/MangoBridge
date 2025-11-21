const express = require('express');
const router = express.Router();
const multer = require('multer');
const Meeting = require('../models/Meeting');
const MeetingSummary = require('../models/MeetingSummary');
const { requireAuth } = require('../middleware/auth');
const { summarizeText } = require('../services/summarizationService');
const { transcribeAudio } = require('../services/transcriptionService');
const { translateMessage } = require('../services/translationService');

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// transcribe audio endpoint
router.post('/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No audio file provided' 
      });
    }

    const language = req.body.language || 'en';
    const transcript = await transcribeAudio(req.file.buffer, language);

    res.json({
      success: true,
      transcript: transcript
    });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe audio'
    });
  }
});

// translate text endpoint
router.post('/translate', requireAuth, async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;

    if (!text || !sourceLang || !targetLang) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: text, sourceLang, targetLang'
      });
    }

    const result = await translateMessage(text, sourceLang, targetLang);

    res.json({
      success: true,
      translation: result.translation
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to translate text'
    });
  }
});

// summarize text endpoint
router.post('/summarize', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'No text provided to summarize'
      });
    }

    const summary = await summarizeText(text, 'en');

    res.json({
      success: true,
      summary: summary
    });
  } catch (error) {
    console.error('Summarization error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate summary'
    });
  }
});

// Save meeting summary
router.post('/save-summary', requireAuth, async (req, res) => {
  try {
    const { title, meetingDate, transcript, translatedTranscript, summary, sourceLang, targetLang } = req.body;

    if (!title || !summary) {
      return res.status(400).json({
        success: false,
        error: 'Title and summary are required'
      });
    }

    const meetingSummary = new MeetingSummary({
      userId: req.user._id,
      title,
      meetingDate: meetingDate || new Date(),
      transcript: transcript || '',
      translatedTranscript: translatedTranscript || '',
      summary,
      sourceLang: sourceLang || 'en',
      targetLang: targetLang || 'en'
    });

    await meetingSummary.save();

    res.json({
      success: true,
      data: meetingSummary,
      message: 'Meeting summary saved successfully'
    });
  } catch (error) {
    console.error('Error saving summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save meeting summary'
    });
  }
});

// Get all meeting summaries for user
router.get('/summaries', requireAuth, async (req, res) => {
  try {
    const summaries = await MeetingSummary.find({ userId: req.user._id })
      .sort({ generatedAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: summaries
    });
  } catch (error) {
    console.error('Error fetching summaries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch meeting summaries'
    });
  }
});

// Delete meeting summary
router.delete('/summaries/:id', requireAuth, async (req, res) => {
  try {
    const summary = await MeetingSummary.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Summary not found'
      });
    }

    res.json({ 
      success: true,
      message: 'Summary deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete summary'
    });
  }
});

module.exports = router;