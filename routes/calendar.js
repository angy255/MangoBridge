const express = require('express');
const router = express.Router();
const CalendarEvent = require('../models/CalendarEvent');
const { requireAuth } = require('../middleware/auth');

// GET events for a date range
router.get('/', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { userId: req.user._id };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const events = await CalendarEvent.find(query).sort({ date: 1, time: 1 });
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events'
    });
  }
});

// CREATE new event
router.post('/', requireAuth, async (req, res) => {
  try {
    const { date, time, title, location } = req.body;

    if (!date || !time || !title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const event = new CalendarEvent({
      userId: req.user._id,
      date: new Date(date),
      time,
      title,
      location: location || ''
    });

    await event.save();

    res.status(201).json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create event'
    });
  }
});

// UPDATE event (EDIT)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { title, time, date, location } = req.body;
    
    const event = await CalendarEvent.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    if (title !== undefined) event.title = title;
    if (time !== undefined) event.time = time;
    if (date !== undefined) event.date = new Date(date);
    if (location !== undefined) event.location = location;

    await event.save();

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update event'
    });
  }
});

// toggle event completion
router.patch('/:id/toggle', requireAuth, async (req, res) => {
  try {
    const event = await CalendarEvent.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    event.completed = !event.completed;
    await event.save();

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update event'
    });
  }
});

// DELETE event
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const event = await CalendarEvent.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete event'
    });
  }
});

module.exports = router;