const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const ChatGroup = require('../models/ChatGroup');
const { requireAuth } = require('../middleware/auth');
const { translateMessage } = require('../services/translationService');

router.get('/all', requireAuth, async (req, res) => {
  try {
    // get all group message IDs to exclude them
    const groups = await ChatGroup.find({});
    const groupMessageIds = new Set();
    groups.forEach(group => {
      group.messageThreads.forEach(msgId => {
        groupMessageIds.add(msgId.toString());
      });
    });
    
    // get all messages
    const allMessages = await Message.find({})
      .sort({ timestamp: -1 })
      .limit(200);
    
    // filter out group messages
    const messages = allMessages.filter(msg => 
      !groupMessageIds.has(msg._id.toString())
    );
    
    res.json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching all messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// Get user's own messages only (excluding archived)
router.get('/', requireAuth, async (req, res) => {
  try {
    const messages = await Message.find({ 
      userId: req.user._id
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

// Get unread message threads where user is involved
router.get('/unread-threads', requireAuth, async (req, res) => {
  try {
    // Get all unread messages
    const allMessages = await Message.find({}).sort({ timestamp: -1 });
    
    // find threads where:
    // 1. user received a message (not author of parent)
    // 2. user replied to a message
    const userThreads = new Set();
    
    allMessages.forEach(msg => {
      // if user is not the author, add this thread
      if (msg.userId.toString() !== req.user._id.toString()) {
        if (msg.parentMessageId) {
          userThreads.add(msg.parentMessageId.toString());
        } else {
          userThreads.add(msg._id.toString());
        }
      }
      
      // if user replied to something, add that thread
      if (msg.userId.toString() === req.user._id.toString() && msg.parentMessageId) {
        userThreads.add(msg.parentMessageId.toString());
      }
    });
    
    // Get all messages from these threads
    const relevantMessages = allMessages.filter(msg => {
      const threadId = msg.parentMessageId ? msg.parentMessageId.toString() : msg._id.toString();
      return userThreads.has(threadId);
    });
    
    res.json({
      success: true,
      data: relevantMessages
    });
  } catch (error) {
    console.error('Error fetching unread threads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread threads'
    });
  }
});

// Get unread messages from other users (legacy endpoint)
router.get('/unread', requireAuth, async (req, res) => {
  try {
    const messages = await Message.find({
      userId: { $ne: req.user._id },
      isRead: false
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

// Get read messages from other users
router.get('/read', requireAuth, async (req, res) => {
  try {
    const messages = await Message.find({
      userId: { $ne: req.user._id },
      isRead: true
    })
      .sort({ timestamp: -1 })
      .limit(50);
    
    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch read messages'
    });
  }
});

// Get archived messages for current user only
router.get('/archived', requireAuth, async (req, res) => {
  try {
    // find all messages where current user has archived them
    const messages = await Message.find({})
      .sort({ timestamp: -1 });
    
    // filter messages where archivedBy contains current user
    const archivedMessages = messages.filter(msg => 
      msg.archivedBy && msg.archivedBy.get(req.user._id.toString()) === true
    );
    
    res.json({
      success: true,
      data: archivedMessages
    });
  } catch (error) {
    console.error('Error fetching archived messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch archived messages'
    });
  }
});

// Create new message
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
      parentMessageId,
      isRead: false // New replies are unread
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

// edit message (only own messages)
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
        error: 'Message not found or unauthorized'
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

// archive messages (only own messages) - DEPRECATED, use archive-thread instead
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

// archive entire thread (for current user only)
router.post('/archive-thread', requireAuth, async (req, res) => {
  try {
    const { messageIds } = req.body;

    if (!messageIds || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No message IDs provided'
      });
    }

    // archive all messages in the thread for this user
    const updatePromises = messageIds.map(messageId => 
      Message.findByIdAndUpdate(
        messageId,
        { $set: { [`archivedBy.${req.user._id}`]: true } },
        { new: true }
      )
    );

    await Promise.all(updatePromises);

    res.json({ 
      success: true,
      message: 'Messages archived successfully'
    });
  } catch (error) {
    console.error('Error archiving thread:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive thread'
    });
  }
});


router.post('/clear-archived', requireAuth, async (req, res) => {
  try {
    console.log(`User ${req.user._id} clearing their archived messages`);
    
    // find all messages archived by this user
    const allMessages = await Message.find({});
    
    const archivedMessageIds = allMessages
      .filter(msg => msg.archivedBy && msg.archivedBy.get(req.user._id.toString()) === true)
      .map(msg => msg._id);
    
    console.log(`Found ${archivedMessageIds.length} archived messages to unarchive`);
    
    if (archivedMessageIds.length === 0) {
      return res.json({
        success: true,
        clearedCount: 0,
        message: 'No archived messages to clear'
      });
    }
    
    const updatePromises = archivedMessageIds.map(messageId =>
      Message.findByIdAndUpdate(
        messageId,
        { $unset: { [`archivedBy.${req.user._id}`]: "" } },
        { new: true }
      )
    );
    
    const results = await Promise.allSettled(updatePromises);
    const clearedCount = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`✓ Cleared ${clearedCount} messages from archived view`);
    
    res.json({
      success: true,
      clearedCount: clearedCount,
      message: `Cleared ${clearedCount} archived message(s)`
    });
  } catch (error) {
    console.error('Error clearing archived messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear archived messages'
    });
  }
});

// delete message (only own messages) - IMPROVED with better 404 handling
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // first check if message exists
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      // message doesn't exist - return success for idempotent deletes
      console.log(`Message ${req.params.id} not found (already deleted)`);
      return res.status(404).json({
        success: true, // Changed to true for idempotent deletes
        message: 'Message not found (may have been already deleted)'
      });
    }
    
    // check ownership
    if (message.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to delete this message'
      });
    }
    
    // delete the message
    await Message.findByIdAndDelete(req.params.id);

    // also delete any replies to this message
    await Message.deleteMany({ parentMessageId: req.params.id });

    console.log(`✓ Message ${req.params.id} deleted successfully`);
    res.json({ 
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete message'
    });
  }
});

module.exports = router;