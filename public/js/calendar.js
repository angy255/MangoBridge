// calendar functionality
// incorporate an api for the calendar here??
const API_CALENDAR_URL = '/api/calendar';
let currentMonth = new Date();
let selectedDate = null;
let calendarEvents = [];

// load calendar
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

// format date key
function formatDateKey(date) {
    return date.toISOString().split('T')[0];
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
            <div class="taskbar-event-actions">
                <button class="icon-btn" onclick="toggleEventComplete('${event._id}')" title="${event.completed ? 'Mark incomplete' : 'Mark complete'}">
                    ${event.completed ? '↩️' : '✓'}
                </button>
                <button class="icon-btn" onclick="editEvent('${event._id}')" title="Edit event">
                    ✏️
                </button>
                <button class="icon-btn" onclick="deleteEvent('${event._id}')" title="Delete event">
                    🗑️
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

// open event modal (ADD ONLY)
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
        
        try {
            const response = await fetch(API_CALENDAR_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate.toISOString(),
                    time: time,
                    title: title
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

// format time
function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
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

// edit event
async function editEvent(eventId) {
    const event = calendarEvents.find(e => e._id === eventId);
    if (!event) return;
    
    const newTitle = prompt('Edit event title:', event.title);
    if (!newTitle || newTitle === event.title) return;
    
    try {
        const response = await fetch(`${API_CALENDAR_URL}/${eventId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
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
}

// delete event
async function deleteEvent(eventId) {
    if (!confirm('Delete this event?')) return;
    
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