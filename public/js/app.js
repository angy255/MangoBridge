// public/js/app.js - Frontend JavaScript

// API Configuration - using relative paths since frontend and backend are on same server
const API_URL = '/api';

// global array to store all messages (synced with backend)
let messages = [];

// variable to track which message is being edited
let editingId = null;

// map language codes to full names for display
const languageNames = {
    en: 'English',
    es: 'Spanish',
    fr: 'French'
};

/**
 * fetch all messages from the backend
 */
async function fetchMessages() {
    try {
        const response = await fetch(`${API_URL}/messages`);
        const data = await response.json();
        
        if (data.success) {
            messages = data.data;
            renderMessages();
        } else {
            console.error('Failed to fetch messages:', data.error);
            showError('Failed to load messages');
        }
    } catch (error) {
        console.error('Error fetching messages:', error);
        showError('Could not connect to server');
    }
}

/**
 * shows error message to user
 */
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
}

/**
 * shows success message to user
 */
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => successDiv.remove(), 300);
    }, 3000);
}

/**
 * handles form submission for creating or updating messages
 */
async function handleSubmit(e) {
    e.preventDefault();

    // show loading indicator
    document.getElementById('loadingIndicator').classList.add('active');

    // get form values
    const userName = document.getElementById('userName').value;
    const sourceLang = document.getElementById('sourceLang').value;
    const targetLang = document.getElementById('targetLang').value;
    const messageText = document.getElementById('messageText').value;

    try {
        // create or update message via API
        const url = editingId 
            ? `${API_URL}/messages/${editingId}`
            : `${API_URL}/messages`;
        
        const method = editingId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userName,
                sourceLang,
                targetLang,
                originalText: messageText
            })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(editingId ? 'Message updated!' : 'Message sent!');
            editingId = null;
            
            // refresh messages from backend
            await fetchMessages();
            
            // clear the form
            document.getElementById('messageForm').reset();
        } else {
            showError(data.error || 'Failed to save message');
        }
    } catch (error) {
        console.error('Error saving message:', error);
        showError('Could not connect to server');
    } finally {
        // hide loading indicator
        document.getElementById('loadingIndicator').classList.remove('active');
    }
}

/**
 * renders all messages to the DOM
 */
function renderMessages() {
    const messageList = document.getElementById('messageList');
    const emptyState = document.getElementById('emptyState');

    // show empty state if no messages
    if (messages.length === 0) {
        emptyState.style.display = 'block';
        messageList.innerHTML = '';
        return;
    }

    // hide empty state and render messages
    emptyState.style.display = 'none';
    
    messageList.innerHTML = messages.map(msg => {
        // format timestamp
        const timestamp = new Date(msg.timestamp).toLocaleString();
        
        return `
            <div class="message-card">
                <div class="message-header">
                    <div class="user-info">
                        <span class="user-name">${escapeHtml(msg.userName)}</span>
                        <span class="lang-badge">${languageNames[msg.sourceLang]}</span>
                    </div>
                    <span class="timestamp">${timestamp}</span>
                </div>
                
                <div class="message-text">
                    <strong>Original:</strong> ${escapeHtml(msg.originalText)}
                </div>
                
                <div class="translation">
                    <div class="translation-label">
                        🌐 Translated to ${languageNames[msg.targetLang]}
                    </div>
                    <div class="translation-text">${escapeHtml(msg.translatedText)}</div>
                    
                    ${msg.aiNote ? `
                        <div class="ai-note">
                            🤖 ${escapeHtml(msg.aiNote)}
                        </div>
                    ` : ''}
                </div>
                
                <div class="message-actions">
                    <button class="btn btn-edit" onclick="editMessage('${msg._id}')">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-delete" onclick="deleteMessage('${msg._id}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * escape HTML to prevent XSS attacks
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * prepares a message for editing
 */
function editMessage(id) {
    const message = messages.find(m => m._id === id);
    if (!message) return;

    // populate form fields
    document.getElementById('userName').value = message.userName;
    document.getElementById('sourceLang').value = message.sourceLang;
    document.getElementById('targetLang').value = message.targetLang;
    document.getElementById('messageText').value = message.originalText;

    // set editing state
    editingId = id;
    
    // scroll to form
    document.getElementById('messageForm').scrollIntoView({ behavior: 'smooth' });
    
    // focus on text area
    document.getElementById('messageText').focus();
}


// not sure if I want to keep delete and clear as an option, since it would be good to have a history of exchanges for team members
/**
 * deletes a message
 */
async function deleteMessage(id) {
    if (!confirm('Are you sure you want to delete this message?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/messages/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Message deleted!');
            await fetchMessages();
        } else {
            showError(data.error || 'Failed to delete message');
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        showError('Could not connect to server');
    }
}

/**
 * clears all messages
 */
async function clearAllMessages() {
    if (!confirm('Are you sure you want to clear all messages? This cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/messages`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('All messages cleared!');
            await fetchMessages();
        } else {
            showError(data.error || 'Failed to clear messages');
        }
    } catch (error) {
        console.error('Error clearing messages:', error);
        showError('Could not connect to server');
    }
}

// add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// initialize app
document.getElementById('messageForm').addEventListener('submit', handleSubmit);

// fetch messages when page loads
fetchMessages();

// refresh messages every 30 seconds
setInterval(fetchMessages, 30000);