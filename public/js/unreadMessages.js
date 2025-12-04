// group chats functionality
let chatGroups = [];
let selectedGroupId = null;
let allUsers = [];
let groupMessages = [];
let isRecordingGroupMessage = false;
let groupMediaRecorder = null;
let groupAudioChunks = [];

// initialize group chat badges (called before page loads fully)
async function initializeGroupChatsBadges() {
    try {
        const response = await fetch('/api/chatgroups');
        const data = await response.json();
        
        if (data.success) {
            // Groups now come with _messages already populated from server
            chatGroups = data.data;
            
            let totalUnread = 0;
            
            // Calculate unread count from the _messages that came with each group
            for (const group of chatGroups) {
                if (group._messages && Array.isArray(group._messages)) {
                    const unreadCount = group._messages.filter(msg => {
                        const notOwnMessage = msg.userId !== currentUser.id;
                        const notReadByCurrentUser = !msg.readBy || !msg.readBy[currentUser.id];
                        return notOwnMessage && notReadByCurrentUser;
                    }).length;
                    
                    totalUnread += unreadCount;
                }
            }
            
            const badge = document.getElementById('unreadBadge');
            if (badge) {
                if (totalUnread > 0) {
                    badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
                    badge.style.display = 'inline-flex';
                } else {
                    badge.textContent = '';
                    badge.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('Error initializing group chat badges:', error);
    }
}

// this is the main load function for the group chats tab
async function loadUnreadMessages(skipRender = false) {
    await loadChatGroups();
    await loadAllUsers();
    
    if (selectedGroupId && !skipRender) {
        await loadGroupMessages(selectedGroupId);
    }
}

// load chat groups
async function loadChatGroups() {
    try {
        const response = await fetch('/api/chatgroups');
        const data = await response.json();
        
        if (data.success) {
            //groups now come with _messages already populated from server
            chatGroups = data.data;
            
            // log unread counts for debugging!!
            chatGroups.forEach(group => {
                if (group._messages) {
                    const unreadCount = group._messages.filter(msg => {
                        const notOwnMessage = msg.userId !== currentUser.id;
                        const notReadByCurrentUser = !msg.readBy || !msg.readBy[currentUser.id];
                        return notOwnMessage && notReadByCurrentUser;
                    }).length;
                    console.log(`Group ${group.name} has ${unreadCount} unread messages`);
                }
            });
            
            renderChatGroups();
            updateGroupBadges();
        }
    } catch (error) {
        console.error('Error loading chat groups:', error);
    }
}

// load all users for member management
async function loadAllUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (data.success) {
            allUsers = data.data;
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// load messages for a specific group
async function loadGroupMessages(groupId) {
    try {
        const response = await fetch(`/api/chatgroups/${groupId}/messages`);
        const data = await response.json();
        
        if (data.success) {
            groupMessages = data.data;
            renderGroupMessages();
        }
    } catch (error) {
        console.error('Error loading group messages:', error);
    }
}

// helper function to get user avatar HTML for group messages
function getGroupUserAvatarHTML(msg) {
    const userAvatar = msg.userAvatar || '';
    const userName = msg.userName || 'User';
    
    if (userAvatar && userAvatar.startsWith('http')) {
        return `<img src="${userAvatar}" alt="${escapeHtml(userName)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else if (userAvatar && userAvatar.length > 2) {
        return escapeHtml(userAvatar);
    } else {
        return userName.charAt(0).toUpperCase();
    }
}

// helper function to get user object avatar HTML (for user lists in modals)
function getUserObjectAvatarHTML(user) {
    const avatar = user.avatar || '';
    const userName = user.userName || 'User';
    
    if (avatar && avatar.startsWith('http')) {
        return `<img src="${avatar}" alt="${escapeHtml(userName)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else if (avatar && avatar.length > 2) {
        return escapeHtml(avatar);
    } else {
        return userName.charAt(0).toUpperCase();
    }
}

// render chat groups sidebar
function renderChatGroups() {
    const container = document.getElementById('chatGroupsList');
    
    if (!container) return;
    
    if (chatGroups.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px; font-size: 13px;">No groups yet. Create one!</p>';
        return;
    }
    
    container.innerHTML = chatGroups.map(group => {
        const unreadCount = getGroupUnreadCount(group._id);
        console.log(`Rendering group ${group.name} with ${unreadCount} unread messages`);
        
        return `
        <div class="chat-group-item ${selectedGroupId === group._id ? 'active' : ''}" 
             onclick="selectGroup('${group._id}')"
             style="padding: 12px; margin-bottom: 8px; background: ${selectedGroupId === group._id ? group.color + '33' : 'white'}; border-left: 4px solid ${group.color}; border-radius: 8px; cursor: pointer; transition: all 0.3s ease; position: relative;">
            <div style="font-weight: 600; color: ${group.color}; margin-bottom: 5px;">
                ${escapeHtml(group.name)}
                ${unreadCount > 0 ? `<span class="group-unread-badge">${unreadCount}</span>` : ''}
            </div>
            <div style="font-size: 12px; color: #666;">
                ${group.members?.length || 0} member${(group.members?.length || 0) !== 1 ? 's' : ''}
            </div>
        </div>
    `}).join('');
}

// render group messages
function renderGroupMessages() {
    const container = document.getElementById('groupMessagesList');
    const emptyState = document.getElementById('groupEmptyState');
    
    if (!container) return;
    
    if (groupMessages.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        container.innerHTML = '';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    const sortedMessages = [...groupMessages].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    const languageNames = {
        en: 'English', es: 'Spanish', fr: 'French', de: 'German',
        zh: 'Chinese', ja: 'Japanese', pt: 'Portuguese', it: 'Italian',
        nl: 'Dutch', pl: 'Polish', ru: 'Russian', ko: 'Korean', tr: 'Turkish'
    };
    
    container.innerHTML = sortedMessages.map(msg => {
        const isOwnMessage = msg.userId === currentUser.id;
        
        return `
            <div class="message-card" data-id="${msg._id}">
                <div class="message-header">
                    <div class="user-info">
                        <div class="user-avatar-small">
                            ${getGroupUserAvatarHTML(msg)}
                        </div>
                        <span class="user-name">${escapeHtml(msg.userName)}</span>
                        <span class="lang-badge">${languageNames[msg.sourceLang]}</span>
                    </div>
                    <span class="timestamp">${new Date(msg.timestamp).toLocaleString()}</span>
                </div>
                <div class="message-text">
                    <strong>Original:</strong> ${escapeHtml(msg.originalText)}
                </div>
                <div class="translation">
                    <div class="translation-label">Translated to ${languageNames[msg.targetLang]}</div>
                    <div class="translation-text">${escapeHtml(msg.translatedText)}</div>
                </div>
                ${isOwnMessage ? `
                    <div class="message-actions">
                        <button class="btn btn-danger btn-small" onclick="deleteGroupMessage('${msg._id}')">Delete</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// get unread count for a group
function getGroupUnreadCount(groupId) {
    const group = chatGroups.find(g => g._id === groupId);
    if (!group) {
        console.log(`Group ${groupId} not found`);
        return 0;
    }
    
    if (!group._messages) {
        console.log(`Group ${group.name} has no _messages array`);
        return 0;
    }
    
    const messages = group._messages;
    
    const unreadMessages = messages.filter(msg => {
        const notOwnMessage = msg.userId !== currentUser.id;
        const notReadByCurrentUser = !msg.readBy || !msg.readBy[currentUser.id];
        
        return notOwnMessage && notReadByCurrentUser;
    });
    
    console.log(`Group ${group.name}: ${unreadMessages.length} unread out of ${messages.length} total messages`);
    
    return unreadMessages.length;
}

// update all group badges
function updateGroupBadges() {
    const totalUnread = chatGroups.reduce((sum, group) => {
        return sum + getGroupUnreadCount(group._id);
    }, 0);
    
    console.log(`Total unread across all groups: ${totalUnread}`);
    
    const badge = document.getElementById('unreadBadge');
    if (badge) {
        if (totalUnread > 0) {
            badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
            badge.style.display = 'inline-flex';
        } else {
            badge.textContent = '';
            badge.style.display = 'none';
        }
    }
}

// create new group with member selection
async function createNewGroup() {
    await loadAllUsers();
    
    document.getElementById('createGroupModal').classList.add('active');
    
    const otherUsers = allUsers.filter(user => user._id !== currentUser.id);
    
    const usersList = document.getElementById('newGroupUsersList');
    usersList.innerHTML = otherUsers.map(user => `
        <div class="user-item">
            <div style="display: flex; align-items: center;">
                <input type="checkbox" class="user-checkbox" value="${user._id}" id="user-${user._id}">
                <label for="user-${user._id}" style="margin-left: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px;">
                    <div class="user-avatar-small">
                        ${getUserObjectAvatarHTML(user)}
                    </div>
                    <a href="/profile/${user._id}" style="color: inherit; text-decoration: none; font-weight: 500;" onclick="event.stopPropagation();">
                        ${escapeHtml(user.userName)}
                    </a>
                </label>
            </div>
        </div>
    `).join('');
}

// save new group
async function saveNewGroup() {
    const name = document.getElementById('newGroupName').value.trim();
    
    if (!name) {
        showNotification('Please enter a group name', 'error');
        return;
    }
    
    const checkboxes = document.querySelectorAll('#newGroupUsersList .user-checkbox:checked');
    const memberIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (memberIds.length === 0) {
        showNotification('Please select at least one member', 'error');
        return;
    }
    
    const colors = ['#667eea', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    try {
        const response = await fetch('/api/chatgroups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color, memberIds })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Group created successfully!', 'success');
            closeCreateGroupModal();
            await loadChatGroups();
        }
    } catch (error) {
        console.error('Error creating group:', error);
        showNotification('Failed to create group', 'error');
    }
}

// close create group modal
function closeCreateGroupModal() {
    document.getElementById('createGroupModal').classList.remove('active');
    document.getElementById('newGroupName').value = '';
}

// select group and display info
async function selectGroup(groupId) {
    selectedGroupId = groupId;
    
    const group = chatGroups.find(g => g._id === groupId);
    if (group) {
        const infoDiv = document.getElementById('selectedGroupInfo');
        const nameSpan = document.getElementById('selectedGroupName');
        const membersSpan = document.getElementById('selectedGroupMembers');
        
        infoDiv.style.display = 'block';
        nameSpan.textContent = group.name;
        
        const memberNames = group.members?.map(m => m.userName || 'Unknown').join(', ') || 'No members';
        membersSpan.innerHTML = `<strong>Members:</strong> ${memberNames}`;
        
        const isCreator = group.createdBy.toString() === currentUser.id;
        const manageBtn = document.querySelector('#selectedGroupInfo button[onclick="manageGroupMembers()"]');
        const deleteBtn = document.querySelector('#selectedGroupInfo button[onclick="deleteCurrentGroup()"]');
        
        if (manageBtn && deleteBtn) {
            if (isCreator) {
                manageBtn.style.display = 'inline-block';
                deleteBtn.style.display = 'inline-block';
            } else {
                manageBtn.style.display = 'none';
                deleteBtn.style.display = 'none';
            }
        }
        
        await loadGroupMessages(groupId);
        
        // mark messages as read
        await markGroupMessagesAsRead(groupId);
        
        // update local messages array with readBy data
        if (group._messages && Array.isArray(group._messages)) {
            group._messages.forEach(msg => {
                if (!msg.readBy) {
                    msg.readBy = {};
                }
                msg.readBy[currentUser.id] = true;
            });
        }
        
        // update the UI immediately
        renderChatGroups();
        updateGroupBadges();
    }
}

// mark group messages as read
async function markGroupMessagesAsRead(groupId) {
    const group = chatGroups.find(g => g._id === groupId);
    if (!group) return;
    
    try {
        const response = await fetch(`/api/chatgroups/${groupId}/mark-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`Marked messages as read for group ${group.name}`);
        }
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

function createGroupChat() {
    if (!selectedGroupId) {
        showNotification('Please select a group first', 'error');
        return;
    }
    showNewMessageForm();
}

function showNewMessageForm() {
    document.getElementById('newMessageForm').style.display = 'block';
    document.getElementById('newMessageBtn').style.display = 'none';
}

function hideNewMessageForm() {
    document.getElementById('newMessageForm').style.display = 'none';
    document.getElementById('newMessageBtn').style.display = 'block';
    document.getElementById('groupMessageText').value = '';
    document.getElementById('groupTranslationPreview').classList.remove('active');
}

async function previewGroupTranslation() {
    const messageText = document.getElementById('groupMessageText').value.trim();
    const sourceLang = document.getElementById('groupSourceLang').value;
    const targetLang = document.getElementById('groupTargetLang').value;
    
    if (!messageText) {
        showNotification('Please enter a message first', 'error');
        return;
    }
    
    const languageNames = {
        en: 'English', es: 'Spanish', fr: 'French', de: 'German',
        zh: 'Chinese', ja: 'Japanese', pt: 'Portuguese', it: 'Italian',
        nl: 'Dutch', pl: 'Polish', ru: 'Russian', ko: 'Korean', tr: 'Turkish'
    };
    
    try {
        const response = await fetch(`${API_URL}/meetings/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: messageText, sourceLang, targetLang })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const preview = document.getElementById('groupTranslationPreview');
            
            if (!preview) {
                console.error('Preview element not found');
                showNotification('Preview element not found', 'error');
                return;
            }
            
            preview.innerHTML = `
                <div class="preview-header">Translation Preview:</div>
                <div class="preview-content">
                    <div style="margin-bottom: 10px;">
                        <strong>Original (${languageNames[sourceLang]}):</strong><br>
                        ${escapeHtml(messageText)}
                    </div>
                    <div style="border-top: 1px solid #ddd; padding-top: 10px;">
                        <strong>Translation (${languageNames[targetLang]}):</strong><br>
                        ${escapeHtml(data.translation)}
                    </div>
                </div>
            `;
            
            preview.classList.add('active');
            showNotification('Preview generated!', 'success');
        }
    } catch (error) {
        console.error('Error previewing translation:', error);
        showNotification('Failed to preview translation', 'error');
    }
}

async function sendGroupMessage() {
    if (!selectedGroupId) {
        showNotification('Please select a group first', 'error');
        return;
    }
    
    const messageText = document.getElementById('groupMessageText').value.trim();
    const sourceLang = document.getElementById('groupSourceLang').value;
    const targetLang = document.getElementById('groupTargetLang').value;
    
    if (!messageText) {
        showNotification('Please enter a message', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/chatgroups/${selectedGroupId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                originalText: messageText,
                sourceLang,
                targetLang
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Message sent successfully!', 'success');
            hideNewMessageForm();
            await loadGroupMessages(selectedGroupId);
            await loadChatGroups();
            updateGroupBadges();
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Failed to send message', 'error');
    }
}

async function deleteGroupMessage(messageId) {
    showConfirmModal('Delete this message? This cannot be undone.', async () => {
        try {
            const response = await fetch(`${API_URL}/messages/${messageId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('Message deleted successfully', 'success');
                await loadGroupMessages(selectedGroupId);
                await loadChatGroups();
                updateGroupBadges();
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            showNotification('Failed to delete message', 'error');
        }
    });
}

async function manageGroupMembers() {
    if (!selectedGroupId) return;
    
    await loadAllUsers();
    
    const group = chatGroups.find(g => g._id === selectedGroupId);
    if (!group) return;
    
    // sort current members alphabetically by userName
    const sortedMembers = [...group.members].sort((a, b) => {
        const nameA = (a.userName || '').toLowerCase();
        const nameB = (b.userName || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });
    
    const currentList = document.getElementById('currentMembersList');
    currentList.innerHTML = sortedMembers.map(member => `
        <div class="member-item">
            <div style="display: flex; align-items: center;">
                <div class="user-avatar-small">
                    ${getUserObjectAvatarHTML(member)}
                </div>
                <a href="/profile/${member._id}" style="color: inherit; text-decoration: none; font-weight: 500; margin-left: 10px;" onclick="event.stopPropagation();">
                    ${escapeHtml(member.userName || 'Unknown User')}
                </a>
            </div>
            ${member._id !== currentUser.id ? `
                <button class="btn btn-danger btn-small" onclick="removeMember('${member._id}')">
                    Remove
                </button>
            ` : '<span style="color: #999; font-size: 12px;">You</span>'}
        </div>
    `).join('');
    
    const availableUsers = allUsers.filter(u => 
        !group.members.some(m => m._id === u._id) && u._id !== currentUser.id
    );
    
    // sort available users alphabetically by userName
    availableUsers.sort((a, b) => {
        const nameA = (a.userName || '').toLowerCase();
        const nameB = (b.userName || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });
    
    const availableList = document.getElementById('availableUsersList');
    if (availableUsers.length === 0) {
        availableList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">All users are already members</p>';
    } else {
        availableList.innerHTML = availableUsers.map(user => `
            <div class="user-item">
                <div style="display: flex; align-items: center;">
                    <div class="user-avatar-small">
                        ${getUserObjectAvatarHTML(user)}
                    </div>
                    <a href="/profile/${user._id}" style="color: inherit; text-decoration: none; font-weight: 500; margin-left: 10px;" onclick="event.stopPropagation();">
                        ${escapeHtml(user.userName)}
                    </a>
                </div>
                <button class="btn btn-primary btn-small" onclick="addMember('${user._id}')">
                    Add
                </button>
            </div>
        `).join('');
    }
    
    document.getElementById('manageMembersModal').classList.add('active');
}

async function addMember(userId) {
    if (!selectedGroupId) return;
    
    try {
        const response = await fetch(`/api/chatgroups/${selectedGroupId}/add-member`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Member added!', 'success');
            await loadChatGroups();
            await manageGroupMembers();
        }
    } catch (error) {
        console.error('Error adding member:', error);
        showNotification('Failed to add member', 'error');
    }
}

async function removeMember(userId) {
    if (!selectedGroupId) return;
    
    showConfirmModal('Remove this member from the group?', async () => {
        try {
            const response = await fetch(`/api/chatgroups/${selectedGroupId}/remove-member`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('Member removed', 'success');
                await loadChatGroups();
                await manageGroupMembers();
            }
        } catch (error) {
            console.error('Error removing member:', error);
            showNotification('Failed to remove member', 'error');
        }
    });
}

async function closeMembersModal() {
    document.getElementById('manageMembersModal').classList.remove('active');
    await loadChatGroups();
    if (selectedGroupId) {
        await selectGroup(selectedGroupId);
    }
}

async function deleteCurrentGroup() {
    if (!selectedGroupId) return;
    
    const group = chatGroups.find(g => g._id === selectedGroupId);
    if (!group) return;
    
    showConfirmModal(`Delete "${group.name}"? This cannot be undone.`, async () => {
        try {
            const response = await fetch(`/api/chatgroups/${selectedGroupId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('Group deleted', 'success');
                
                const deletedGroupId = selectedGroupId;
                selectedGroupId = null;
                
                document.getElementById('selectedGroupInfo').style.display = 'none';
                document.getElementById('newMessageForm').style.display = 'none';
                document.getElementById('newMessageBtn').style.display = 'block';
                
                document.getElementById('groupMessagesList').innerHTML = '';
                const emptyState = document.getElementById('groupEmptyState');
                if (emptyState) emptyState.style.display = 'block';
                
                chatGroups = chatGroups.filter(g => g._id !== deletedGroupId);
                renderChatGroups();
                updateGroupBadges();
                await loadChatGroups();
            }
        } catch (error) {
            console.error('Error deleting group:', error);
            showNotification('Failed to delete group', 'error');
        }
    });
}

async function toggleGroupRecording() {
    if (isRecordingGroupMessage) {
        stopGroupRecording();
    } else {
        await startGroupRecording();
    }
}

async function startGroupRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        groupMediaRecorder = new MediaRecorder(stream);
        groupAudioChunks = [];
        
        groupMediaRecorder.addEventListener('dataavailable', event => {
            groupAudioChunks.push(event.data);
        });
        
        groupMediaRecorder.addEventListener('stop', async () => {
            const audioBlob = new Blob(groupAudioChunks, { type: 'audio/webm' });
            await transcribeGroupAudio(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        });
        
        groupMediaRecorder.start();
        isRecordingGroupMessage = true;
        
        const btn = document.getElementById('groupMicButton');
        btn.innerHTML = 'Stop';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-danger');
        btn.style.animation = 'pulse 1.5s infinite';
    } catch (error) {
        console.error('Microphone error:', error);
        showNotification('Could not access microphone', 'error');
    }
}

function stopGroupRecording() {
    if (groupMediaRecorder && isRecordingGroupMessage) {
        groupMediaRecorder.stop();
        isRecordingGroupMessage = false;
        
        const btn = document.getElementById('groupMicButton');
        btn.innerHTML = 'Record';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-secondary');
        btn.style.animation = 'none';
    }
}

async function transcribeGroupAudio(audioBlob) {
    const sourceLang = document.getElementById('groupSourceLang').value;
    
    showNotification('Transcribing audio...', 'success');
    
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
            document.getElementById('groupMessageText').value = data.transcript;
            showNotification('Audio transcribed successfully!', 'success');
        } else {
            showNotification(data.error || 'Transcription failed', 'error');
        }
    } catch (error) {
        console.error('Transcription error:', error);
        showNotification('Failed to transcribe audio', 'error');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('✅ unreadMessages.js (group chats) loaded successfully');