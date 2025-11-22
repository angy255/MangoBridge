// message handling
const API_URL = '/api';
let messages = [];
let unreadMessages = [];
let selectedMessages = new Set();
let editingMessageId = null;
let replyingToMessageId = null;

const languageNames = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German',
    zh: 'Chinese', ja: 'Japanese', pt: 'Portuguese', it: 'Italian',
    nl: 'Dutch', pl: 'Polish', ru: 'Russian', ko: 'Korean', tr: 'Turkish'
};

// update unread badge - count threads user is part of
function updateUnreadBadge() {
    const badge = document.getElementById('unreadBadge');
    
    // count unread messages from threads the user is part of
    const unreadCount = unreadMessages.filter(msg => {
        // message is unread AND user is not the author
        return !msg.isRead && msg.userId !== currentUser.id;
    }).length;

    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'inline-flex';
        } else {
            badge.textContent = '';
            badge.style.display = 'none';
        }
    }
}

// load ALL messages from ALL users for home feed
async function loadMessages() {
    try {
        console.log('Loading messages...');
        const response = await fetch(`${API_URL}/messages/all`);
        const data = await response.json();
        
        if (data.success) {
            messages = data.data;
            console.log(`Loaded ${messages.length} messages (after filtering)`);
            renderHomeMessages();
            updateUnreadBadge();
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        if (typeof showNotification === 'function') {
            showNotification('Failed to load messages', 'error');
        }
    }
}

// load archived messages
async function loadArchivedMessages() {
    try {
        const response = await fetch(`${API_URL}/messages/archived`);
        const data = await response.json();
        
        if (data.success) {
            renderArchivedMessages(data.data);
        }
    } catch (error) {
        console.error('Error loading archived messages:', error);
    }
}

// render home messages - ALL users' messages
function renderHomeMessages() {
    const container = document.getElementById('homeMessageList');
    const emptyState = document.getElementById('homeEmptyState');
    
    if (!container) {
        console.error('homeMessageList container not found');
        return;
    }
    
    if (messages.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        container.innerHTML = '';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    // filter out messages that are replies (they'll be shown within parent)
    const parentMessages = messages.filter(msg => !msg.parentMessageId);
    
    container.innerHTML = parentMessages.map(msg => {
        // get replies for this message
        const replies = messages.filter(r => r.parentMessageId === msg._id);
        
        const isOwnMessage = msg.userId === currentUser.id;
        let html = createMessageCard(msg, true, false, isOwnMessage, true);
        
        // add replies if any exist - NO CHECKBOXES FOR REPLIES
        if (replies.length > 0) {
            html += '<div class="replies-container">';
            replies.forEach(reply => {
                const isOwnReply = reply.userId === currentUser.id;
                html += createMessageCard(reply, false, false, isOwnReply, false, false, true);
            });
            html += '</div>';
        }
        
        return html;
    }).join('');
}

// render archived messages
function renderArchivedMessages(archivedMessages) {
    const container = document.getElementById('archivedMessageList');
    const emptyState = document.getElementById('archivedEmptyState');
    
    if (!container) {
        console.error('archivedMessageList container not found');
        return;
    }
    
    if (archivedMessages.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        container.innerHTML = '';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    // filter parent messages only
    const parentMessages = archivedMessages.filter(msg => !msg.parentMessageId);
    
    container.innerHTML = parentMessages.map(msg => {
        // get replies for this message
        const replies = archivedMessages.filter(r => r.parentMessageId === msg._id);
        
        let html = createMessageCard(msg, false, false, false, false, true);
        
        // add replies
        if (replies.length > 0) {
            html += '<div class="replies-container">';
            replies.forEach(reply => {
                html += createMessageCard(reply, false, false, false, false, true, true);
            });
            html += '</div>';
        }
        
        return html;
    }).join('');
}

// create message card HTML
function createMessageCard(msg, showCheckbox = false, markAsReadBtn = false, showActions = false, showReply = false, isArchived = false, isReply = false) {
    const isOwnMessage = msg.userId === currentUser.id;
    const isEditing = editingMessageId === msg._id;
    const isReplying = replyingToMessageId === msg._id;
    
    return `
        <div class="message-card ${!msg.isRead ? 'unread' : ''} ${isReply ? 'reply-card' : ''} ${selectedMessages.has(msg._id) ? 'selected' : ''}" data-id="${msg._id}">
            ${showCheckbox ? `
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <input type="checkbox" class="message-checkbox" ${selectedMessages.has(msg._id) ? 'checked' : ''} onchange="toggleMessageSelection('${msg._id}')" style="margin-top: 5px;">
                    <div style="flex: 1;">
            ` : '<div style="width: 100%;">'}
            <div class="message-header">
                <div class="user-info">
                    <span class="user-name">${escapeHtml(msg.userName)}</span>
                    <span class="lang-badge">${languageNames[msg.sourceLang]}</span>
                </div>
                <span class="timestamp">${new Date(msg.timestamp).toLocaleString()}</span>
            </div>
            <div class="message-text">
                <strong>Original:</strong> 
                ${isEditing ? `
                    <textarea id="edit-textarea-${msg._id}" class="form-textarea" style="width: 100%; min-height: 80px; margin-top: 10px;">${escapeHtml(msg.originalText)}</textarea>
                ` : escapeHtml(msg.originalText)}
            </div>
            <div class="translation">
                <div class="translation-label">Translated to ${languageNames[msg.targetLang]}</div>
                <div class="translation-text">${escapeHtml(msg.translatedText)}</div>
                ${msg.aiNote ? `<div class="ai-note">${escapeHtml(msg.aiNote)}</div>` : ''}
            </div>
            ${markAsReadBtn && !isReplying ? `
                <div class="message-actions">
                    <button class="btn btn-success" onclick="markAsRead('${msg._id}')">✓ Mark as Read</button>
                </div>
            ` : ''}
            ${showActions && isOwnMessage && !isReplying ? `
                <div class="message-actions">
                    ${isEditing ? `
                        <button class="btn btn-success" onclick="saveMessageEdit('${msg._id}')">Save</button>
                        <button class="btn btn-secondary" onclick="cancelMessageEdit()">Cancel</button>
                    ` : `
                        <button class="btn btn-secondary" onclick="editMessage('${msg._id}')">Edit</button>
                    `}
                    <button class="btn btn-danger" onclick="deleteMessage('${msg._id}')">Delete</button>
                </div>
            ` : ''}
            ${isArchived && isOwnMessage ? `
                <div class="message-actions">
                    <button class="btn btn-danger" onclick="deleteArchivedMessage('${msg._id}')">Delete</button>
                </div>
            ` : ''}
            ${showReply && !isOwnMessage && !isReplying ? `
                <div class="message-actions">
                    <button class="btn btn-primary" onclick="replyToMessage('${msg._id}')">Reply</button>
                </div>
            ` : ''}
            ${isReplying ? `
                <div class="reply-form" id="reply-form-${msg._id}">
                    <h4 style="margin-bottom: 15px; color: #667eea;">Writing Reply</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Your Language</label>
                            <select class="form-select" id="reply-source-lang-${msg._id}">
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="zh">Chinese</option>
                                <option value="ja">Japanese</option>
                                <option value="pt">Portuguese</option>
                                <option value="it">Italian</option>
                                <option value="nl">Dutch</option>
                                <option value="pl">Polish</option>
                                <option value="ru">Russian</option>
                                <option value="ko">Korean</option>
                                <option value="tr">Turkish</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Translate To</label>
                            <select class="form-select" id="reply-target-lang-${msg._id}">
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="zh">Chinese</option>
                                <option value="ja">Japanese</option>
                                <option value="pt">Portuguese</option>
                                <option value="it">Italian</option>
                                <option value="nl">Dutch</option>
                                <option value="pl">Polish</option>
                                <option value="ru">Russian</option>
                                <option value="ko">Korean</option>
                                <option value="tr">Turkish</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Your Reply</label>
                        <textarea id="reply-text-${msg._id}" class="form-textarea" placeholder="Write your reply..." style="min-height: 100px;"></textarea>
                    </div>
                    <div id="reply-preview-${msg._id}" class="translation-preview"></div>
                    <div class="button-row" style="margin-top: 15px;">
                        <button class="btn btn-info" onclick="previewReply('${msg._id}')">Preview Translation</button>
                        <button class="btn btn-primary" onclick="submitReply('${msg._id}')">Send Reply</button>
                        <button class="btn btn-secondary" onclick="cancelReply()">Cancel</button>
                    </div>
                </div>
            ` : ''}
            ${showCheckbox ? '</div></div>' : '</div>'}
        </div>
    `;
}

// escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// toggle message selection
function toggleMessageSelection(id) {
    const card = document.querySelector(`[data-id="${id}"]`);
    if (selectedMessages.has(id)) {
        selectedMessages.delete(id);
        if (card) card.classList.remove('selected');
    } else {
        selectedMessages.add(id);
        if (card) card.classList.add('selected');
    }
}

// archive selected messages - archives entire thread for this user
async function archiveSelected() {
    if (selectedMessages.size === 0) {
        showNotification('Please select messages to archive', 'error');
        return;
    }
    
    showConfirmModal(`Archive ${selectedMessages.size} message thread(s)?`, async () => {
        try {
            // get all message IDs including replies
            const allMessageIds = new Set();
            
            selectedMessages.forEach(msgId => {
                allMessageIds.add(msgId);
                // find all replies to this message
                const replies = messages.filter(m => m.parentMessageId === msgId);
                replies.forEach(reply => allMessageIds.add(reply._id));
            });
            
            const response = await fetch(`${API_URL}/messages/archive-thread`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageIds: Array.from(allMessageIds) })
            });
            
            const data = await response.json();
            
            if (data.success) {
                selectedMessages.clear();
                await loadMessages();
                showNotification('Message threads archived successfully', 'success');
            }
        } catch (error) {
            console.error('Error archiving messages:', error);
            showNotification('Failed to archive messages', 'error');
        }
    });
}

// edit message (inline textarea)
function editMessage(id) {
    if (editingMessageId) {
        showNotification('Please save or cancel the current edit first', 'error');
        return;
    }
    if (replyingToMessageId) {
        showNotification('Please finish your reply first', 'error');
        return;
    }
    editingMessageId = id;
    renderHomeMessages();
    
    setTimeout(() => {
        const textarea = document.getElementById(`edit-textarea-${id}`);
        if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
    }, 100);
}

// save message edit
async function saveMessageEdit(id) {
    const textarea = document.getElementById(`edit-textarea-${id}`);
    if (!textarea) return;
    
    const newText = textarea.value.trim();
    if (!newText) {
        showNotification('Message cannot be empty', 'error');
        return;
    }
    
    const msg = messages.find(m => m._id === id);
    if (newText === msg.originalText) {
        cancelMessageEdit();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/messages/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalText: newText })
        });
        
        const data = await response.json();
        
        if (data.success) {
            editingMessageId = null;
            await loadMessages();
            showNotification('Message updated successfully', 'success');
        }
    } catch (error) {
        console.error('Error editing message:', error);
        showNotification('Failed to edit message', 'error');
    }
}

// cancel message edit
function cancelMessageEdit() {
    editingMessageId = null;
    renderHomeMessages();
}

// reply to message
function replyToMessage(parentId) {
    if (replyingToMessageId) {
        showNotification('Please finish your current reply first', 'error');
        return;
    }
    if (editingMessageId) {
        showNotification('Please save your edit first', 'error');
        return;
    }
    
    replyingToMessageId = parentId;
    renderHomeMessages();
    
    setTimeout(() => {
        const textarea = document.getElementById(`reply-text-${parentId}`);
        if (textarea) {
            textarea.focus();
        }
    }, 100);
}

// preview reply translation
async function previewReply(parentId) {
    const replyText = document.getElementById(`reply-text-${parentId}`).value.trim();
    const sourceLang = document.getElementById(`reply-source-lang-${parentId}`).value;
    const targetLang = document.getElementById(`reply-target-lang-${parentId}`).value;
    
    if (!replyText) {
        showNotification('Please write a reply first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/meetings/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: replyText, sourceLang, targetLang })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const preview = document.getElementById(`reply-preview-${parentId}`);
            preview.innerHTML = `
                <div class="preview-header">Translation Preview:</div>
                <div class="preview-content">
                    <div style="margin-bottom: 10px;">
                        <strong>Original (${languageNames[sourceLang]}):</strong><br>
                        ${escapeHtml(replyText)}
                    </div>
                    <div style="border-top: 1px solid #ddd; padding-top: 10px;">
                        <strong>Translation (${languageNames[targetLang]}):</strong><br>
                        ${escapeHtml(data.translation)}
                    </div>
                </div>
            `;
            preview.classList.add('active');
        }
    } catch (error) {
        console.error('Error previewing reply:', error);
        showNotification('Failed to preview translation', 'error');
    }
}

// submit reply
async function submitReply(parentId) {
    const replyText = document.getElementById(`reply-text-${parentId}`).value.trim();
    const sourceLang = document.getElementById(`reply-source-lang-${parentId}`).value;
    const targetLang = document.getElementById(`reply-target-lang-${parentId}`).value;
    
    if (!replyText) {
        showNotification('Please write a reply', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/messages/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                parentMessageId: parentId,
                originalText: replyText,
                sourceLang: sourceLang,
                targetLang: targetLang
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            replyingToMessageId = null;
            await loadMessages();
            if (typeof loadUnreadMessages === 'function') {
                await loadUnreadMessages(true);
            }
            showNotification('Reply sent successfully!', 'success');
        }
    } catch (error) {
        console.error('Error sending reply:', error);
        showNotification('Failed to send reply', 'error');
    }
}

// cancel reply
function cancelReply() {
    replyingToMessageId = null;
    renderHomeMessages();
}

// delete message - soft delete for others' messages, hard delete for own messages
async function deleteMessage(id) {
    const msg = messages.find(m => m._id === id);
    const isOwnMessage = msg && msg.userId === currentUser.id;
    
    const confirmText = isOwnMessage 
        ? 'Permanently delete this message? This cannot be undone and will be removed for everyone.'
        : 'Remove this message from your view? The message will remain for other users.';
    
    showConfirmModal(confirmText, async () => {
        try {
            const response = await fetch(`${API_URL}/messages/${id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Remove from local array immediately for better UX
                messages = messages.filter(m => m._id !== id && m.parentMessageId !== id);
                renderHomeMessages();
                showNotification('Message removed successfully', 'success');
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            showNotification('Failed to remove message', 'error');
        }
    });
}

// delete archived message - soft delete for others' messages, hard delete for own messages
async function deleteArchivedMessage(id) {
    // find the message in the archived list to check ownership
    const response = await fetch(`${API_URL}/messages/archived`);
    const data = await response.json();
    const archivedMessages = data.success ? data.data : [];
    const msg = archivedMessages.find(m => m._id === id);
    const isOwnMessage = msg && msg.userId === currentUser.id;
    
    const confirmText = isOwnMessage 
        ? 'Permanently delete this message? This cannot be undone and will be removed for everyone.'
        : 'Remove this message from your view? The message will remain for other users.';
    
    showConfirmModal(confirmText, async () => {
        try {
            const response = await fetch(`${API_URL}/messages/${id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('Message removed successfully', 'success');
                await loadArchivedMessages();
                await loadMessages();
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            showNotification('Failed to remove message', 'error');
        }
    });
}

// mark all as read
async function markAllAsRead() {
    if (unreadMessages.length === 0) {
        showNotification('No unread messages', 'error');
        return;
    }
    
    showConfirmModal(`Mark all ${unreadMessages.length} messages as read?`, async () => {
        try {
            for (const msg of unreadMessages) {
                await fetch(`${API_URL}/messages/${msg._id}/read`, {
                    method: 'PATCH'
                });
            }
            
            await loadMessages();
            if (typeof loadUnreadMessages === 'function') {
                await loadUnreadMessages(true);
            }
            showNotification('All messages marked as read', 'success');
        } catch (error) {
            console.error('Error marking all as read:', error);
            showNotification('Failed to mark all as read', 'error');
        }
    });
}

// clear archived messages (PERMANENTLY DELETE ALL archived messages)
async function clearArchived() {
    showConfirmModal('Permanently delete all archived messages? This cannot be undone.', async () => {
        try {
            console.log('Clearing all archived messages...');
            const response = await fetch(`${API_URL}/messages/clear-archived`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                // clear archived view immediately
                document.getElementById('archivedMessageList').innerHTML = '';
                const emptyState = document.getElementById('archivedEmptyState');
                if (emptyState) emptyState.style.display = 'block';
                
                // reload messages to ensure home feed is updated
                await loadMessages();
                
                showNotification(
                    data.clearedCount > 0 
                        ? `Deleted ${data.clearedCount} archived message(s)` 
                        : 'No archived messages to clear',
                    data.clearedCount > 0 ? 'success' : 'error'
                );
            } else {
                throw new Error(data.error || 'Failed to clear archived messages');
            }
        } catch (error) {
            console.error('Error clearing archived:', error);
            showNotification('Error clearing archived messages', 'error');
        }
    });
}

// preview translation
let previewBtn = document.getElementById('previewBtn');
if (previewBtn) {
    previewBtn.addEventListener('click', async () => {
        const messageText = document.getElementById('messageText').value;
        const sourceLang = document.getElementById('sourceLang').value;
        const targetLang = document.getElementById('targetLang').value;
        
        if (!messageText) {
            showNotification('Please enter a message first', 'error');
            return;
        }
        
        document.getElementById('loadingIndicator').classList.add('active');
        
        try {
            const response = await fetch(`${API_URL}/meetings/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: messageText, sourceLang, targetLang })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const preview = document.getElementById('translationPreview');
                const content = document.getElementById('previewContent');
                
                content.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <strong>Original (${sourceLang.toUpperCase()}):</strong><br>
                        ${escapeHtml(messageText)}
                    </div>
                    <div style="border-top: 1px solid #ddd; padding-top: 10px;">
                        <strong>Translation (${targetLang.toUpperCase()}):</strong><br>
                        ${escapeHtml(data.translation)}
                    </div>
                `;
                
                preview.classList.add('active');
            }
        } catch (error) {
            console.error('Error previewing translation:', error);
            showNotification('Failed to preview translation', 'error');
        } finally {
            document.getElementById('loadingIndicator').classList.remove('active');
        }
    });
}

// submit message form
let messageForm = document.getElementById('messageForm');
if (messageForm) {
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const sourceLang = document.getElementById('sourceLang').value;
        const targetLang = document.getElementById('targetLang').value;
        const messageText = document.getElementById('messageText').value;
        
        document.getElementById('loadingIndicator').classList.add('active');
        
        try {
            const response = await fetch(`${API_URL}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceLang,
                    targetLang,
                    originalText: messageText
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                messageForm.reset();
                document.getElementById('translationPreview').classList.remove('active');
                await loadMessages();
                showNotification('Message sent successfully!', 'success');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            showNotification('Failed to send message', 'error');
        } finally {
            document.getElementById('loadingIndicator').classList.remove('active');
        }
    });
}

// recording functionality
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

let micButton = document.getElementById('micButton');
if (micButton) {
    micButton.addEventListener('click', toggleRecording);
}

async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.addEventListener('dataavailable', event => {
            audioChunks.push(event.data);
        });
        
        mediaRecorder.addEventListener('stop', async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await transcribeAudio(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        });
        
        mediaRecorder.start();
        isRecording = true;
        
        const btn = document.getElementById('micButton');
        btn.innerHTML = 'Stop Recording';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-danger');
        btn.style.animation = 'pulse 1.5s infinite';
    } catch (error) {
        console.error('Microphone error:', error);
        showNotification('Could not access microphone', 'error');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        
        const btn = document.getElementById('micButton');
        btn.innerHTML = 'Record';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-secondary');
        btn.style.animation = 'none';
    }
}

async function transcribeAudio(audioBlob) {
    const sourceLang = document.getElementById('sourceLang').value;
    
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('language', sourceLang);
        
        const response = await fetch(`${API_URL}/meetings/transcribe`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('messageText').value = data.transcript;
            showNotification('Audio transcribed successfully!', 'success');
        } else {
            showNotification(data.error || 'Transcription failed', 'error');
        }
    } catch (error) {
        console.error('Transcription error:', error);
        showNotification('Failed to transcribe audio', 'error');
    }
}

console.log('✅ messages.js loaded successfully');