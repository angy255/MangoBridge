const express = require('express');
const router = express.Router();
const ChatGroup = require('../models/ChatGroup');
const Message = require('../models/Message');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { translateMessage } = require('../services/translationService');

// Get all chat groups for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const groups = await ChatGroup.find({
      $or: [
        { createdBy: req.user._id },
        { members: req.user._id }
      ]
    })
      .populate('members', 'userName avatar email')
      .sort({ createdAt: -1 });

    // fetch messages for each group with readBy data
    const groupsWithMessages = await Promise.all(groups.map(async (group) => {
      const messages = await Message.find({
        _id: { $in: group.messageThreads }
      }).sort({ timestamp: 1 }).lean();

      // enrich messages with user avatar data
      const enrichedMessages = await Promise.all(messages.map(async (msg) => {
        const user = await User.findById(msg.userId).select('avatar userName');
        return {
          ...msg,
          userAvatar: user ? user.avatar : '',
          userName: user ? user.userName : msg.userName,
          readBy: msg.readBy || {}
        };
      }));

      return {
        ...group.toObject(),
        _messages: enrichedMessages
      };
    }));

    res.json({
      success: true,
      data: groupsWithMessages
    });
  } catch (error) {
    console.error('Error fetching chat groups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat groups'
    });
  }
});

// create new chat group with members
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, color, memberIds } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Group name is required'
      });
    }

    // add creator to members if not already included
    const members = new Set([req.user._id.toString(), ...(memberIds || [])]);

    const group = new ChatGroup({
      name: name.trim(),
      createdBy: req.user._id,
      members: Array.from(members),
      messageThreads: [],
      color: color || '#667eea'
    });

    await group.save();
    
    // populate members before sending response
    await group.populate('members', 'userName avatar email');

    res.json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create chat group'
    });
  }
});

// Get messages for a specific group
router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const group = await ChatGroup.findOne({
      _id: req.params.id,
      $or: [
        { createdBy: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    const messages = await Message.find({
      _id: { $in: group.messageThreads }
    }).sort({ timestamp: 1 }).lean();

    // enrich messages with user avatar data
    const enrichedMessages = await Promise.all(messages.map(async (msg) => {
      const user = await User.findById(msg.userId).select('avatar userName');
      return {
        ...msg,
        userAvatar: user ? user.avatar : '',
        userName: user ? user.userName : msg.userName,
        readBy: msg.readBy || {}
      };
    }));

    res.json({
      success: true,
      data: enrichedMessages
    });
  } catch (error) {
    console.error('Error fetching group messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch group messages'
    });
  }
});

// Post new message to group
router.post('/:id/messages', requireAuth, async (req, res) => {
  try {
    const { originalText, sourceLang, targetLang } = req.body;

    if (!originalText || !sourceLang || !targetLang) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const group = await ChatGroup.findOne({
      _id: req.params.id,
      $or: [
        { createdBy: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // translate message
    const translationResult = await translateMessage(
      originalText,
      sourceLang,
      targetLang
    );

    // create message
    const message = new Message({
      userId: req.user._id,
      userName: req.user.userName,
      sourceLang,
      targetLang,
      originalText,
      translatedText: translationResult.translation,
      aiNote: translationResult.note,
      isRead: false
    });

    await message.save();

    // add message to group
    group.messageThreads.push(message._id);
    await group.save();

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error posting message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to post message'
    });
  }
});

// mark group messages as read
router.post('/:id/mark-read', requireAuth, async (req, res) => {
  try {
    const group = await ChatGroup.findOne({
      _id: req.params.id,
      $or: [
        { createdBy: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // mark messages as read ONLY for current user using the readBy map
    await Message.updateMany(
      { 
        _id: { $in: group.messageThreads },
        userId: { $ne: req.user._id }
      },
      { $set: { [`readBy.${req.user._id}`]: true } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read'
    });
  }
});

// add member to group
router.post('/:id/add-member', requireAuth, async (req, res) => {
  try {
    const { userId } = req.body;

    const group = await ChatGroup.findOne({
      _id: req.params.id,
      $or: [
        { createdBy: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // check if already a member
    if (group.members.includes(userId)) {
      return res.json({
        success: true,
        message: 'User already a member',
        data: group
      });
    }

    group.members.push(userId);
    await group.save();
    
    await group.populate('members', 'userName avatar email');

    res.json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add member'
    });
  }
});

// remove member from group
router.post('/:id/remove-member', requireAuth, async (req, res) => {
  try {
    const { userId } = req.body;

    const group = await ChatGroup.findOne({
      _id: req.params.id,
      createdBy: req.user._id //only creator can remove members
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found or you do not have permission'
      });
    }

    // can't remove the creator
    if (userId === group.createdBy.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove group creator'
      });
    }

    group.members = group.members.filter(
      memberId => memberId.toString() !== userId
    );
    await group.save();
    
    await group.populate('members', 'userName avatar email');

    res.json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove member'
    });
  }
});

// delete chat group and all associated messages
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const group = await ChatGroup.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found or you do not have permission'
      });
    }

    console.log(`Deleting group ${group.name} and its ${group.messageThreads.length} messages`);

    // delete all messages associated with this group so they're not in feed
    if (group.messageThreads.length > 0) {
      const deleteResult = await Message.deleteMany({
        _id: { $in: group.messageThreads }
      });
      console.log(`✓ Deleted ${deleteResult.deletedCount} messages from group`);
    }

    // now delete the group itself
    await ChatGroup.findByIdAndDelete(req.params.id);

    console.log(`✓ Group ${group.name} deleted successfully`);

    res.json({
      success: true,
      message: 'Group and all its messages deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete group'
    });
  }
});

module.exports = router;