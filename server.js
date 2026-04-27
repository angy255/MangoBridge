require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// passport config
require('./config/passport')(passport);

// view engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// serve static files
app.use(express.static(path.join(__dirname, 'public')));

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 1000 * 60 * 60 * 24,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));

// flash messages
app.use(flash());

// passport middleware
app.use(passport.initialize());
app.use(passport.session());

// import routes
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const calendarRoutes = require('./routes/calendar');
const meetingRoutes = require('./routes/meetings');
const chatGroupRoutes = require('./routes/chatGroups');
const userRoutes = require('./routes/users');

// use routes
app.use('/', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/chatgroups', chatGroupRoutes);
app.use('/api/users', userRoutes);

// log registered routes
console.log('Registered API routes:');
console.log('   - /api/messages');
console.log('   - /api/calendar');
console.log('   - /api/meetings');
console.log('   - /api/chatgroups');
console.log('   - /api/users');

// main route 
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.render('index', { 
      user: {
        id: req.user._id.toString(), 
        email: req.user.email,
        name: req.user.name,
        userName: req.user.userName,
        avatar: req.user.avatar || req.user.name[0].toUpperCase(),
        theme: req.user.theme || 'light'
      }
    });
  } else {
    res.render('landing', { title: 'MangoBridge - Multilingual Work Platform' }); 
  }
});

// health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    deepgramConfigured: !!process.env.DEEPGRAM_API_KEY
  });
});

// error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Go to: http://localhost:${PORT}`);
  console.log(`Deepgram API Key: ${process.env.DEEPGRAM_API_KEY ? 'Configured' : 'Missing'}`);
});

module.exports = app;