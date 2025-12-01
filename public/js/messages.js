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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// update unread badge
function updateUnreadBadge() {
    const badge = document.getElementById('unreadBadge');
    
    const unreadCount = unreadMessages.filter(msg => {
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

// load ALL messages from ALL users for home feed (excluding archived)
async function loadMessages() {
    try {
        console.log('Loading messages...');
        const response = await fetch(`${API_URL}/messages/all`);
        const data = await response.json();
        
        if (data.success) {
            messages = data.data;
            console.log(`Loaded ${messages.length} messages (after filtering)`);
            if (messages.length > 0) {
                console.log('userAvatar field specifically:', messages[0].userAvatar);
            }
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
            console.log('Archived messages loaded:', data.data.length);
            if (data.data.length > 0) {
                console.log('Sample archived message:', data.data[0]);
            }
            renderArchivedMessages(data.data);
        }
    } catch (error) {
        console.error('Error loading archived messages:', error);
    }
}

// render home messages
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
    
    const parentMessages = messages.filter(msg => !msg.parentMessageId);
    
    container.innerHTML = parentMessages.map(msg => {
        const replies = messages.filter(r => r.parentMessageId === msg._id);
        
        const isOwnMessage = msg.userId.toString() === currentUser.id.toString();
        let html = createMessageCard(msg, true, false, isOwnMessage, true);
        
        if (replies.length > 0) {
            html += '<div class="replies-container">';
            replies.forEach(reply => {
                const isOwnReply = reply.userId.toString() === currentUser.id.toString();
                html += createMessageCard(reply, false, false, isOwnReply, false, false, true);
            });
            html += '</div>';
        }
        
        return html;
    }).join('');
}

// render archived messages - no edit or delete buttons
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
    
    const parentMessages = archivedMessages.filter(msg => !msg.parentMessageId);
    
    container.innerHTML = parentMessages.map(msg => {
        const replies = archivedMessages.filter(r => r.parentMessageId === msg._id);
        
        let html = createMessageCard(msg, false, false, false, false, true);
        
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

// helper function to get user avatar HTML (matches group chat version)
function getUserAvatarHTML(msg) {
    const userAvatar = msg.userAvatar || '';
    const userName = msg.userName || 'User';
    
    if (userAvatar && userAvatar.startsWith('http')) {
        const html = `<img src="${userAvatar}" alt="${escapeHtml(userName)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        console.log('Returning img tag:', html);
        return html;
    } else if (userAvatar && userAvatar.length > 2 && !userAvatar.startsWith('http')) {
        console.log('Returning text avatar:', userAvatar);
        return escapeHtml(userAvatar);
    } else {
        const fallback = userName.charAt(0).toUpperCase();
        console.log('Returning fallback letter:', fallback);
        return fallback;
    }
}

// create message card HTML
function createMessageCard(msg, showCheckbox = false, markAsReadBtn = false, showActions = false, showReply = false, isArchived = false, isReply = false) {
    
    const isOwnMessage = msg.userId.toString() === currentUser.id.toString();
    const isEditing = editingMessageId === msg._id;
    const isReplying = replyingToMessageId === msg._id;
    
    const avatarHTML = getUserAvatarHTML(msg);
    
    return `
        <div class="message-card ${!msg.isRead ? 'unread' : ''} ${isReply ? 'reply-card' : ''} ${selectedMessages.has(msg._id) ? 'selected' : ''}" data-id="${msg._id}">
            ${showCheckbox ? `
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <input type="checkbox" class="message-checkbox" ${selectedMessages.has(msg._id) ? 'checked' : ''} onchange="toggleMessageSelection('${msg._id}')" style="margin-top: 5px;">
                    <div style="flex: 1;">
            ` : '<div style="width: 100%;">'}
            <div class="message-header">
                <div class="user-info">
                    <div class="user-avatar-small">
                        ${getUserAvatarHTML(msg)}
                    </div>
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

// archive selected messages
async function archiveSelected() {
    if (selectedMessages.size === 0) {
        showNotification('Please select messages to archive', 'error');
        return;
    }
    
    showConfirmModal(`Archive ${selectedMessages.size} message thread(s)?`, async () => {
        try {
            const allMessageIds = new Set();
            
            selectedMessages.forEach(msgId => {
                allMessageIds.add(msgId);
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

function cancelMessageEdit() {
    editingMessageId = null;
    renderHomeMessages();
}

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

function cancelReply() {
    replyingToMessageId = null;
    renderHomeMessages();
}

async function deleteMessage(id) {
    const msg = messages.find(m => m._id === id);
    const isOwnMessage = msg && msg.userId.toString() === currentUser.id.toString();
    
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

// clear archived - permanently delete archived messages for user
async function clearArchived() {
    showConfirmModal('Permanently delete all archived messages?', async () => {
        try {
            console.log('Clearing all archived messages...');
            const response = await fetch(`${API_URL}/messages/delete-archived`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('archivedMessageList').innerHTML = '';
                const emptyState = document.getElementById('archivedEmptyState');
                if (emptyState) emptyState.style.display = 'block';
                
                await loadMessages();
                
                showNotification(
                    data.deletedCount > 0 
                        ? `Permanently deleted ${data.deletedCount} archived message(s)` 
                        : 'No archived messages to clear',
                    data.deletedCount > 0 ? 'success' : 'error'
                );
            } else {
                throw new Error(data.error || 'Failed to clear archived messages');
            }
        } catch (error) {
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