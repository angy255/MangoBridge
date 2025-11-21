const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

// Get all users (for adding to groups)
router.get('/', requireAuth, async (req, res) => {
  try {
    const users = await User.find({}, 'userName email avatar')
      .sort({ userName: 1 });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

module.exports = router;