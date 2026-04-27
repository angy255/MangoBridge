// calendar functionality
const API_CALENDAR_URL = '/api/calendar';
let currentMonth = new Date();
let selectedDate = null;
let calendarEvents = [];

// main load function - called on app initialization
async function loadCalendar() {
    await loadCalendarEvents();
    renderCalendar();
}

// load calendar events from API
async function loadCalendarEvents() {
    try {
        const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        
        const response = await fetch(
            `${API_CALENDAR_URL}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        );
        
        const data = await response.json();
        
        if (data.success) {
            calendarEvents = data.data;
        }
    } catch (error) {
        console.error('Error loading calendar events:', error);
    }
}

// render calendar
function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    document.getElementById('currentMonth').textContent = 
        currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    
    // add day headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        const header = document.createElement('div');
        header.style.fontWeight = 'bold';
        header.style.textAlign = 'center';
        header.style.padding = '10px';
        header.textContent = day;
        grid.appendChild(header);
    });
    
    // add empty cells
    for (let i = 0; i < firstDay; i++) {
        grid.appendChild(document.createElement('div'));
    }
    
    // add days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.textContent = day;
        
        const currentDate = new Date(year, month, day);
        const dateKey = formatDateKey(currentDate);
        
        if (currentDate.toDateString() === today.toDateString()) {
            dayDiv.classList.add('today');
        }
        
        const dayEvents = calendarEvents.filter(e => 
            formatDateKey(new Date(e.date)) === dateKey
        );
        
        // count incomplete tasks
        const incompleteTasks = dayEvents.filter(e => !e.completed).length;
        
        if (incompleteTasks > 0) {
            dayDiv.classList.add('has-events');
            const indicator = document.createElement('div');
            indicator.className = 'event-indicator';
            indicator.textContent = incompleteTasks;
            
            // color based on task count
            if (incompleteTasks >= 1 && incompleteTasks <= 3) {
                indicator.style.background = '#28a745'; // Green
            } else if (incompleteTasks >= 4 && incompleteTasks <= 6) {
                indicator.style.background = '#ffc107'; // Yellow
            } else if (incompleteTasks >= 7) {
                indicator.style.background = '#dc3545'; // Red
            }
            
            dayDiv.appendChild(indicator);
        }
        
        dayDiv.onclick = () => {
            openEventModal(currentDate);
        };
        
        grid.appendChild(dayDiv);
    }
    
    // render taskbar for today by default
    renderDayTaskbar(today);
}

// render day taskbar (side panel)
function renderDayTaskbar(date) {
    const taskbar = document.getElementById('dayTaskbar');
    const dateKey = formatDateKey(date);
    
    const events = calendarEvents.filter(e => 
        formatDateKey(new Date(e.date)) === dateKey
    ).sort((a, b) => a.time.localeCompare(b.time));
    
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    const taskbarHeader = `
        <div style="font-weight: bold; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #667eea;">
            ${dayOfWeek}, ${month}/${day}/${year}
        </div>
    `;
    
    if (events.length === 0) {
        taskbar.innerHTML = taskbarHeader + '<p style="text-align: center; color: #999;">No events for this day</p>';
        return;
    }
    
    taskbar.innerHTML = taskbarHeader + events.map(event => `
        <div class="taskbar-event-item ${event.completed ? 'completed' : ''}">
            <div class="event-time">${formatTime(event.time)}</div>
            <div class="event-title">${escapeHtml(event.title)}</div>
            ${event.location ? `<div style="font-size: 12px; color: #666; margin-top: 5px;">📍 ${escapeHtml(formatLocationText(event.location))}</div>` : ''}
            <div class="taskbar-event-actions">
                <button class="icon-btn" onclick="toggleEventComplete('${event._id}')" title="${event.completed ? 'Mark incomplete' : 'Mark complete'}">
                    ${event.completed ? 'Undo' : 'Completed'}
                </button>
                <button class="icon-btn" onclick="editEvent('${event._id}')" title="Edit event">
                    Edit
                </button>
                <button class="icon-btn" onclick="deleteEvent('${event._id}')" title="Delete event">
                    Delete
                </button>
            </div>
        </div>
    `).join('');
}

// previous month
let prevMonthBtn = document.getElementById('prevMonthBtn');
if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', async () => {
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
        await loadCalendarEvents();
        renderCalendar();
    });
}

// next month
let nextMonthBtn = document.getElementById('nextMonthBtn');
if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', async () => {
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
        await loadCalendarEvents();
        renderCalendar();
    });
}

// open event modal (add only)
function openEventModal(date) {
    selectedDate = date;
    
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    document.getElementById('modalDate').textContent = `${dayOfWeek}, ${month}/${day}/${year}`;
    
    // update side panel
    renderDayTaskbar(date);
    
    document.getElementById('eventModal').classList.add('active');
}

// close event modal
function closeEventModal() {
    document.getElementById('eventModal').classList.remove('active');
    document.getElementById('eventForm').reset();
    selectedDate = null;
}

// event form submission
let eventForm = document.getElementById('eventForm');
if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('eventTitle').value;
        const time = document.getElementById('eventTime').value;
        const location = document.getElementById('eventLocation').value;
        
        try {
            const response = await fetch(API_CALENDAR_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate.toISOString(),
                    time: time,
                    title: title,
                    location: location
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                await loadCalendarEvents();
                renderDayTaskbar(selectedDate);
                renderCalendar();
                eventForm.reset();
                showNotification('Event added successfully!', 'success');
            }
        } catch (error) {
            console.error('Error adding event:', error);
            showNotification('Failed to add event', 'error');
        }
    });
}

// toggle event completion
async function toggleEventComplete(eventId) {
    try {
        const response = await fetch(`${API_CALENDAR_URL}/${eventId}/toggle`, {
            method: 'PATCH'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadCalendarEvents();
            const today = new Date();
            renderDayTaskbar(today);
            renderCalendar();
            showNotification(
                data.data.completed ? 'Event marked as complete' : 'Event marked as incomplete',
                'success'
            );
        }
    } catch (error) {
        console.error('Error toggling event:', error);
        showNotification('Failed to update event', 'error');
    }
}

// edit event with modal instead of prompt
async function editEvent(eventId) {
    const event = calendarEvents.find(e => e._id === eventId);
    if (!event) return;
    
    // create edit modal
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2001;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        width: 90%;
    `;
    
    content.innerHTML = `
        <h3 style="margin-bottom: 20px; color: #667eea;">Edit Event</h3>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Title</label>
            <input type="text" id="editEventTitle" value="${escapeHtml(event.title)}" 
                   style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px;">
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Location</label>
            <input type="text" id="editEventLocation" value="${escapeHtml(event.location || '')}" 
                   style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px;" 
                   placeholder="Enter location (optional)">
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="saveEdit" class="btn btn-primary">Save</button>
            <button id="cancelEdit" class="btn btn-secondary">Cancel</button>
        </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    document.getElementById('saveEdit').addEventListener('click', async () => {
        const newTitle = document.getElementById('editEventTitle').value.trim();
        const newLocation = document.getElementById('editEventLocation').value.trim();
        
        if (!newTitle) {
            modal.remove();
            return;
        }
        
        // check if anything changed
        if (newTitle === event.title && newLocation === (event.location || '')) {
            modal.remove();
            return;
        }
        
        try {
            const response = await fetch(`${API_CALENDAR_URL}/${eventId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: newTitle,
                    location: newLocation
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                await loadCalendarEvents();
                const today = new Date();
                renderDayTaskbar(today);
                renderCalendar();
                showNotification('Event updated successfully', 'success');
            }
        } catch (error) {
            console.error('Error updating event:', error);
            showNotification('Failed to update event', 'error');
        }
        
        modal.remove();
    });
    
    document.getElementById('cancelEdit').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // focus input
    setTimeout(() => {
        const input = document.getElementById('editEventTitle');
        input.focus();
        input.select();
    }, 100);
}

async function deleteEvent(eventId) {
    showConfirmModal('Delete this event?', async () => {
        try {
            const response = await fetch(`${API_CALENDAR_URL}/${eventId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                await loadCalendarEvents();
                const today = new Date();
                renderDayTaskbar(today);
                renderCalendar();
                showNotification('Event deleted', 'success');
            }
        } catch (error) {
            console.error('Error deleting event:', error);
            showNotification('Failed to delete event', 'error');
        }
    });
}

// format date key
function formatDateKey(date) {
    return date.toISOString().split('T')[0];
}

// format time
function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Keep the UI's built-in location pin singular, even if users type one.
function formatLocationText(location) {
    return String(location).replace(/^(?:\s*📍\s*)+/u, '').trim();
}

// escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// close modal when clicking outside
let eventModal = document.getElementById('eventModal');
if (eventModal) {
    eventModal.addEventListener('click', (e) => {
        if (e.target === eventModal) {
            closeEventModal();
        }
    });
}

console.log('✅ calendar.js loaded successfully');