const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const ChatGroup = require('../models/ChatGroup');
const { requireAuth } = require('../middleware/auth');
const { translateMessage } = require('../services/translationService');

// GET /all - Get all non-group messages, excluding archived ones for current user
router.get('/all', requireAuth, async (req, res) => {
  try {
    // Get all group message IDs to exclude them
    const groups = await ChatGroup.find({});
    const groupMessageIds = new Set();
    groups.forEach(group => {
      group.messageThreads.forEach(msgId => {
        groupMessageIds.add(msgId.toString());
      });
    });
    
    // Get all messages
    const allMessages = await Message.find({})
      .sort({ timestamp: -1 })
      .limit(200);
    
    // Filter out:
    // 1. Group messages
    // 2. Messages archived by current user
    // 3. Messages in deletedFor array for current user
    const messages = allMessages.filter(msg => {
      const isGroupMessage = groupMessageIds.has(msg._id.toString());
      const isArchivedByUser = msg.archivedBy && msg.archivedBy.get(req.user._id.toString()) === true;
      const isDeletedForUser = msg.deletedFor && msg.deletedFor.includes(req.user._id.toString());
      return !isGroupMessage && !isArchivedByUser && !isDeletedForUser;
    });
    
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

// GET / - Get user's own messages only (excluding archived)
router.get('/', requireAuth, async (req, res) => {
  try {
    const allMessages = await Message.find({ 
      userId: req.user._id
    })
      .sort({ timestamp: -1 })
      .limit(100);
    
    // Filter out messages archived by current user or deleted for user
    const messages = allMessages.filter(msg => {
      const isArchived = msg.archivedBy && msg.archivedBy.get(req.user._id.toString()) === true;
      const isDeleted = msg.deletedFor && msg.deletedFor.includes(req.user._id.toString());
      return !isArchived && !isDeleted;
    });
    
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

// GET /unread-threads - Get unread message threads where user is involved
router.get('/unread-threads', requireAuth, async (req, res) => {
  try {
    const allMessages = await Message.find({}).sort({ timestamp: -1 });
    
    const userThreads = new Set();
    
    allMessages.forEach(msg => {
      if (msg.userId.toString() !== req.user._id.toString()) {
        if (msg.parentMessageId) {
          userThreads.add(msg.parentMessageId.toString());
        } else {
          userThreads.add(msg._id.toString());
        }
      }
      
      if (msg.userId.toString() === req.user._id.toString() && msg.parentMessageId) {
        userThreads.add(msg.parentMessageId.toString());
      }
    });
    
    // filter out archived messages and deleted messages
    const relevantMessages = allMessages.filter(msg => {
      const threadId = msg.parentMessageId ? msg.parentMessageId.toString() : msg._id.toString();
      const isArchivedByUser = msg.archivedBy && msg.archivedBy.get(req.user._id.toString()) === true;
      const isDeletedForUser = msg.deletedFor && msg.deletedFor.includes(req.user._id.toString());
      return userThreads.has(threadId) && !isArchivedByUser && !isDeletedForUser;
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

// GET /archived - Get archived messages for current user only
router.get('/archived', requireAuth, async (req, res) => {
  try {
    const messages = await Message.find({})
      .sort({ timestamp: -1 });
    
    // filter messages where archivedBy contains current user AND not in deletedFor
    const archivedMessages = messages.filter(msg => {
      const isArchived = msg.archivedBy && msg.archivedBy.get(req.user._id.toString()) === true;
      const isDeleted = msg.deletedFor && msg.deletedFor.includes(req.user._id.toString());
      return isArchived && !isDeleted;
    });
    
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

// POST / - Create new message
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

// POST /reply - reply to a message
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
      isRead: false
    });

    await reply.save();

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

// PATCH /:id - edit message (only own messages)
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

// PATCH /:id/read - mark message as read
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

// POST /archive-thread - archive entire thread for current user
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

// POST /delete-archived - permanently delete archived messages for current user
router.post('/delete-archived', requireAuth, async (req, res) => {
  try {
    console.log(`User ${req.user._id} permanently deleting their archived messages`);
    
    // find all messages archived by this user
    const allMessages = await Message.find({});
    
    const archivedMessageIds = allMessages
      .filter(msg => msg.archivedBy && msg.archivedBy.get(req.user._id.toString()) === true)
      .map(msg => msg._id);
    
    console.log(`Found ${archivedMessageIds.length} archived messages to delete`);
    
    if (archivedMessageIds.length === 0) {
      return res.json({
        success: true,
        deletedCount: 0,
        message: 'No archived messages to delete'
      });
    }
    
    let deletedCount = 0;
    
    // add user to deletedFor array for all archived messages
    // this completely hides them from the user across the entire platform
    for (const messageId of archivedMessageIds) {
      await Message.findByIdAndUpdate(
        messageId,
        { 
          $addToSet: { deletedFor: req.user._id },
          $unset: { [`archivedBy.${req.user._id}`]: "" }
        }
      );
      deletedCount++;
    }
    
    console.log(`✓ Permanently deleted ${deletedCount} archived messages for user`);
    
    res.json({
      success: true,
      deletedCount: deletedCount,
      message: `Permanently deleted ${deletedCount} archived message(s)`
    });
  } catch (error) {
    console.error('Error deleting archived messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete archived messages'
    });
  }
});

// POST /clear-archived 
router.post('/clear-archived', requireAuth, async (req, res) => {
  try {
    console.log(`User ${req.user._id} clearing their archived messages (legacy endpoint)`);
    
    const allMessages = await Message.find({});
    
    const archivedMessageIds = allMessages
      .filter(msg => msg.archivedBy && msg.archivedBy.get(req.user._id.toString()) === true)
      .map(msg => msg._id);
    
    if (archivedMessageIds.length === 0) {
      return res.json({
        success: true,
        deletedCount: 0,
        message: 'No archived messages to clear'
      });
    }
    
    let deletedCount = 0;
    
    for (const messageId of archivedMessageIds) {
      await Message.findByIdAndUpdate(
        messageId,
        { 
          $addToSet: { deletedFor: req.user._id },
          $unset: { [`archivedBy.${req.user._id}`]: "" }
        }
      );
      deletedCount++;
    }
    
    console.log(`✓ Cleared ${deletedCount} archived messages`);
    
    res.json({
      success: true,
      deletedCount: deletedCount,
      message: `Cleared ${deletedCount} archived message(s)`
    });
  } catch (error) {
    console.error('Error clearing archived messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear archived messages'
    });
  }
});

// DELETE /:id - delete message
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      console.log(`Message ${req.params.id} not found (already deleted)`);
      return res.json({
        success: true,
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

    // delete any replies to this message
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