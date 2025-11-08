// server.js - main server file
require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  console.log('📊 Database:', mongoose.connection.name); // shows which database you're connected to
  console.log('🔗 Host:', mongoose.connection.host);
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// message Schema
const messageSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
    trim: true
  },
  sourceLang: {
    type: String,
    required: true,
    enum: ['en', 'es', 'fr']
  },
  targetLang: {
    type: String,
    required: true,
    enum: ['en', 'es', 'fr']
  },
  originalText: {
    type: String,
    required: true
  },
  translatedText: {
    type: String,
    required: true
  },
  aiNote: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Message = mongoose.model('Message', messageSchema);

// translation Service
const languageNames = {
  en: 'English',
  es: 'Spanish',
  fr: 'French'
};

async function translateMessage(text, sourceLang, targetLang) {
  try {
    // fallback idiom translations
    // need to DEFINITELY change these lol not right at all
    const idiomMap = {
      "i'm in a pickle": {
        es: "Estoy en un aprieto",
        fr: "Je suis dans le pétrin"
      },
      "break a leg": {
        es: "¡Mucha mierda!",
        fr: "Merde!"
      },
      "piece of cake": {
        es: "Pan comido",
        fr: "C'est du gâteau"
      },
      "it's raining cats and dogs": {
        es: "Llueve a cántaros",
        fr: "Il pleut des cordes"
      },
      "hit the nail on the head": {
        es: "Dar en el clavo",
        fr: "Mettre le doigt dessus"
      },
      "cost an arm and a leg": {
        es: "Costar un ojo de la cara",
        fr: "Coûter les yeux de la tête"
      },
      "under the weather": {
        es: "Estar pachucho",
        fr: "Être mal fichu"
      },
      "the ball is in your court": {
        es: "La pelota está en tu tejado",
        fr: "La balle est dans ton camp"
      }
    };

    const lowerText = text.toLowerCase();
    
    // check for idioms
    for (const [idiom, translations] of Object.entries(idiomMap)) {
      if (lowerText.includes(idiom) && translations[targetLang]) {
        return {
          translation: translations[targetLang],
          note: `Culturally adapted idiom from "${idiom}"`
        };
      }
    }

    // basic translation placeholder
    // TODO: Integrate with proper translation API (Google Translate, DeepL, etc.) Find 1 or 2 make sense, are they free, what do they do? etc
    return {
      translation: `[${languageNames[targetLang]}] ${text}`,
      note: "Basic translation - integrate a proper translation API for production"
    };

  } catch (error) {
    console.error('Translation error:', error);
    throw new Error('Translation service failed');
  }
}

// ============================================
// FRONTEND ROUTES (EJS)
// ============================================

// home page - renders the main EJS template
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Multilingual Team Chat',
    nodeEnv: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// API ROUTES
// ============================================

// health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// get all messages
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find()
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

// get single message
app.get('/api/messages/:id', async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }
    
    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch message'
    });
  }
});

// create new message
app.post('/api/messages', async (req, res) => {
  try {
    const { userName, sourceLang, targetLang, originalText } = req.body;

    // validation
    if (!userName || !sourceLang || !targetLang || !originalText) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // translate the message
    const translationResult = await translateMessage(
      originalText,
      sourceLang,
      targetLang
    );

    // create new message
    const message = new Message({
      userName,
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

// update message
app.put('/api/messages/:id', async (req, res) => {
  try {
    const { userName, sourceLang, targetLang, originalText } = req.body;

    // translate the updated message
    const translationResult = await translateMessage(
      originalText,
      sourceLang,
      targetLang
    );

    const message = await Message.findByIdAndUpdate(
      req.params.id,
      {
        userName,
        sourceLang,
        targetLang,
        originalText,
        translatedText: translationResult.translation,
        aiNote: translationResult.note
      },
      { new: true, runValidators: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update message'
    });
  }
});

// delete message
app.delete('/api/messages/:id', async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

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

// delete all messages
app.delete('/api/messages', async (req, res) => {
  try {
    const result = await Message.deleteMany({});
    
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} messages`
    });
  } catch (error) {
    console.error('Error deleting messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete messages'
    });
  }
});

// error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Visit: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
});

// help from claude here