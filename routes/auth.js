const express = require('express');
const router = express.Router();
const passport = require('passport');
const validator = require('validator');
const multer = require('multer');
const User = require('../models/User');
const { ensureGuest, ensureAuth } = require('../middleware/auth');
const cloudinary = require('../middleware/cloudinary');

// configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 200 * 1024 }, // 200KB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// GET Login page
router.get('/login', ensureGuest, (req, res) => {
  res.render('login', {
    title: 'Login'
  });
});

// POST Login
router.post('/login', (req, res, next) => {
  const validationErrors = [];
  
  if (!validator.isEmail(req.body.email))
    validationErrors.push({ msg: 'Please enter a valid email address.' });
  if (validator.isEmpty(req.body.password))
    validationErrors.push({ msg: 'Password cannot be blank.' });

  if (validationErrors.length) {
    req.flash('errors', validationErrors);
    return res.redirect('/login');
  }
  
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false,
  });

  passport.authenticate('local', async (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash('errors', info);
      return res.redirect('/login');
    }
    req.logIn(user, async (err) => {
      if (err) {
        return next(err);
      }
      
      // update last active
      await User.findByIdAndUpdate(user._id, { lastActive: new Date() });
      
      req.flash('success', { msg: 'Success! You are logged in.' });
      res.redirect('/');
    });
  })(req, res, next);
});

// GET Signup page
router.get('/signup', ensureGuest, (req, res) => {
  res.render('signup', {
    title: 'Create Account'
  });
});

// POST Signup
router.post('/signup', async (req, res, next) => {
  const validationErrors = [];
  
  if (!validator.isEmail(req.body.email))
    validationErrors.push({ msg: 'Please enter a valid email address.' });
  if (!validator.isLength(req.body.password, { min: 8 }))
    validationErrors.push({ msg: 'Password must be at least 8 characters long' });
  if (req.body.password !== req.body.confirmPassword)
    validationErrors.push({ msg: 'Passwords do not match' });
  if (validator.isEmpty(req.body.userName))
    validationErrors.push({ msg: 'Username cannot be blank' });

  if (validationErrors.length) {
    req.flash('errors', validationErrors);
    return res.redirect('/signup');
  }
  
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false,
  });

  try {
    const existingUser = await User.findOne({
      $or: [
        { email: req.body.email },
        { userName: req.body.userName }
      ]
    });

    if (existingUser) {
      req.flash('errors', {
        msg: 'Account with that email address or username already exists.',
      });
      return res.redirect('/signup');
    }

    const user = new User({
      userName: req.body.userName,
      email: req.body.email,
      password: req.body.password,
      name: req.body.userName,
      avatar: req.body.userName[0].toUpperCase(),
      theme: 'light'
    });

    await user.save();

    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      res.redirect('/');
    });
  } catch (err) {
    return next(err);
  }
});

// GET Profile page (own profile)
router.get('/profile', ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.render('profile', {
      title: 'Profile',
      user: user,
      cloudName: process.env.CLOUD_NAME,
      isOwnProfile: true
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    res.redirect('/');
  }
});

// GET Public profile page (view other users)
router.get('/profile/:userId', ensureAuth, async (req, res) => {
  try {
    const viewedUser = await User.findById(req.params.userId);
    
    if (!viewedUser) {
      req.flash('errors', { msg: 'User not found' });
      return res.redirect('/');
    }
    
    // Check if viewing own profile
    const isOwnProfile = req.user._id.toString() === req.params.userId;
    
    res.render('profile', {
      title: `${viewedUser.userName}'s Profile`,
      user: viewedUser,
      cloudName: process.env.CLOUD_NAME,
      isOwnProfile: isOwnProfile,
      currentUser: req.user
    });
  } catch (error) {
    console.error('Error loading user profile:', error);
    req.flash('errors', { msg: 'Failed to load profile' });
    res.redirect('/');
  }
});

// POST Update profile (with Cloudinary upload)
router.post('/profile', ensureAuth, upload.single('avatar'), async (req, res) => {
  try {
    const { city, state, country, about, theme } = req.body;
    
    const updateData = {
      location: {
        city: city || '',
        state: state || '',
        country: country || ''
      },
      about: about || '',
      theme: theme || 'light'
    };
    
    // if a file was uploaded, upload to Cloudinary
    if (req.file) {
      try {
        // upload image to Cloudinary using buffer
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'team-chat-avatars',
              transformation: [
                { width: 150, height: 150, crop: 'fill' },
                { quality: 'auto:low' }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          
          uploadStream.end(req.file.buffer);
        });
        
        updateData.avatar = result.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        req.flash('errors', { msg: 'Failed to upload image' });
        return res.redirect('/profile');
      }
    }
    
    await User.findByIdAndUpdate(req.user._id, updateData);
    
    req.flash('success', { msg: 'Profile updated successfully!' });
    res.redirect('/profile');
  } catch (error) {
    console.error('Error updating profile:', error);
    req.flash('errors', { msg: 'Failed to update profile' });
    res.redirect('/profile');
  }
});

// API endpoint for Cloudinary widget uploads
router.post('/api/upload-avatar', ensureAuth, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'No image URL provided'
      });
    }
    
    // update user's avatar
    await User.findByIdAndUpdate(req.user._id, { avatar: imageUrl });
    
    res.json({
      success: true,
      message: 'Avatar updated successfully',
      avatarUrl: imageUrl
    });
  } catch (error) {
    console.error('Error updating avatar:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update avatar'
    });
  }
});

// logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.log('Error during logout:', err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.log('Error destroying session:', err);
      }
      res.redirect('/login');
    });
  });
});

module.exports = router;