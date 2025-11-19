const express = require('express');
const router = express.Router();
const multer = require('multer');
const Meeting = require('../models/Meeting');
const { requireAuth } = require('../middleware/auth');
const { summarizeText } = require('../services/summarizationService');
const { transcribeAudio } = require('../services/transcriptionService');
const { translateMessage } = require('../services/translationService');

// configure multer for audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for audio
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
    
    console.log('Transcribing audio, language:', language);
    console.log('Audio file size:', req.file.size);

    // transcribe the audio
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

    console.log('Translating text from', sourceLang, 'to', targetLang);

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

    console.log('Generating summary, text length:', text.length);

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

// get all meetings for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const meetings = await Meeting.find({ userId: req.user._id }).sort({ date: -1 });
    res.json({ success: true, meetings });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch meetings' });
  }
});

// get single meeting
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    res.json({ success: true, meeting });
  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch meeting' });
  }
});

// create new meeting
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, date, time, notes } = req.body;
    
    if (!title || !date) {
      return res.status(400).json({ success: false, error: 'Title and date are required' });
    }

    const newMeeting = new Meeting({
      userId: req.user._id,
      title: title.trim(),
      date: new Date(date),
      time: time || '',
      notes: notes || '',
      transcript: '',
      summary: ''
    });

    await newMeeting.save();
    
    res.json({ success: true, meeting: newMeeting });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ success: false, error: 'Failed to create meeting' });
  }
});

// update meeting
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { title, date, time, notes, transcript } = req.body;
    
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (date !== undefined) updateData.date = new Date(date);
    if (time !== undefined) updateData.time = time;
    if (notes !== undefined) updateData.notes = notes;
    if (transcript !== undefined) updateData.transcript = transcript;

    const meeting = await Meeting.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updateData,
      { new: true }
    );

    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    res.json({ success: true, meeting });
  } catch (error) {
    console.error('Error updating meeting:', error);
    res.status(500).json({ success: false, error: 'Failed to update meeting' });
  }
});

// generate summary from transcript
router.post('/:id/summarize', requireAuth, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    if (!meeting.transcript || meeting.transcript.trim() === '') {
      return res.status(400).json({ success: false, error: 'No transcript available to summarize' });
    }

    console.log('Generating summary for meeting:', meeting._id);
    console.log('Transcript length:', meeting.transcript.length);

    // detect language (default to English)
    const language = req.body.language || 'en';

    // generate summary using Deepgram
    const summary = await summarizeText(meeting.transcript, language);

    // save summary to meeting
    meeting.summary = summary;
    await meeting.save();

    res.json({ 
      success: true, 
      summary,
      message: 'Summary generated successfully' 
    });

  } catch (error) {
    console.error('Error summarizing:', error);
    
    // provide error message
    let errorMessage = 'Failed to generate summary';
    if (error.message.includes('API key')) {
      errorMessage = 'Invalid API configuration. Please contact support.';
    } else if (error.message.includes('Rate limit')) {
      errorMessage = 'Too many requests. Please try again in a few minutes.';
    } else if (error.message.includes('400')) {
      errorMessage = 'Invalid transcript format. Please check your text.';
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// delete meeting
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const meeting = await Meeting.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    res.json({ success: true, message: 'Meeting deleted successfully' });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    res.status(500).json({ success: false, error: 'Failed to delete meeting' });
  }
});

module.exports = router;