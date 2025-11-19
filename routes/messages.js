const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');
const { translateMessage } = require('../services/translationService');

// get all messages for user (excluding archived)
router.get('/', requireAuth, async (req, res) => {
  try {
    const messages = await Message.find({ 
      userId: req.user._id,
      isArchived: false 
    })
      .sort({ timestamp: -1 })
      .limit(100);
    
    res.json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// get unread messages from other users
router.get('/unread', requireAuth, async (req, res) => {
  try {
    const messages = await Message.find({
      userId: { $ne: req.user._id },
      isRead: false,
      isArchived: false
    }).sort({ timestamp: -1 });
    
    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread messages'
    });
  }
});

// get archived messages
router.get('/archived', requireAuth, async (req, res) => {
  try {
    const messages = await Message.find({
      userId: req.user._id,
      isArchived: true
    }).sort({ timestamp: -1 });
    
    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch archived messages'
    });
  }
});

// create new message
router.post('/', requireAuth, async (req, res) => {
  try {
    const { sourceLang, targetLang, originalText } = req.body;

    if (!sourceLang || !targetLang || !originalText) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const translationResult = await translateMessage(
      originalText,
      sourceLang,
      targetLang
    );

    const message = new Message({
      userId: req.user._id,
      userName: req.user.userName,
      sourceLang,
      targetLang,
      originalText,
      translatedText: translationResult.translation,
      aiNote: translationResult.note
    });

    await message.save();

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create message'
    });
  }
});

// reply to a message
router.post('/reply', requireAuth, async (req, res) => {
  try {
    const { parentMessageId, originalText, sourceLang, targetLang } = req.body;

    if (!parentMessageId || !originalText) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const translationResult = await translateMessage(
      originalText,
      sourceLang,
      targetLang
    );

    const reply = new Message({
      userId: req.user._id,
      userName: req.user.userName,
      sourceLang,
      targetLang,
      originalText,
      translatedText: translationResult.translation,
      aiNote: translationResult.note,
      parentMessageId
    });

    await reply.save();

    // update parent message
    await Message.findByIdAndUpdate(parentMessageId, {
      $push: { replies: reply._id }
    });

    res.status(201).json({
      success: true,
      data: reply
    });
  } catch (error) {
    console.error('Error creating reply:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create reply'
    });
  }
});

// edit message
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { originalText } = req.body;
    
    const message = await Message.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    if (originalText) {
      const translationResult = await translateMessage(
        originalText,
        message.sourceLang,
        message.targetLang
      );
      
      message.originalText = originalText;
      message.translatedText = translationResult.translation;
      message.aiNote = translationResult.note;
      await message.save();
    }

    res.json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update message'
    });
  }
});

// mark message as read
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update message'
    });
  }
});

// archive messages
router.post('/archive', requireAuth, async (req, res) => {
  try {
    const { messageIds } = req.body;

    await Message.updateMany(
      {
        _id: { $in: messageIds },
        userId: req.user._id
      },
      { isArchived: true }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to archive messages'
    });
  }
});

// delete message
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const message = await Message.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete message'
    });
  }
});

module.exports = router;