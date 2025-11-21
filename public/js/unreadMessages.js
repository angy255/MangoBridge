// group Chats functionality
let chatGroups = [];
let selectedGroupId = null;
let allUsers = [];
let groupMessages = [];
let isRecordingGroupMessage = false;
let groupMediaRecorder = null;
let groupAudioChunks = [];

// load chat groups
async function loadChatGroups() {
    try {
        const response = await fetch('/api/chatgroups');
        const data = await response.json();
        
        if (data.success) {
            chatGroups = data.data;
            
            // load messages for each group to calculate accurate unread counts
            const messagePromises = chatGroups.map(group => 
                fetch(`/api/chatgroups/${group._id}/messages`)
                    .then(res => res.json())
                    .then(msgData => {
                        if (msgData.success) {
                            // store messages for this group temporarily
                            group._messages = msgData.data;
                        }
                    })
                    .catch(err => console.error(`Error loading messages for group ${group._id}:`, err))
            );
            
            await Promise.all(messagePromises);
            
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

// get unread count for a group
function getGroupUnreadCount(groupId) {
    const group = chatGroups.find(g => g._id === groupId);
    if (!group) return 0;
    
    // use stored messages if available, otherwise use groupMessages
    const messages = group._messages || groupMessages;
    
    // count unread messages in this group
    const unreadCount = messages.filter(msg => {
        const isInGroup = group.messageThreads.includes(msg._id);
        const notOwnMessage = msg.userId !== currentUser.id;
        const notRead = !msg.isRead;
        
        return isInGroup && notOwnMessage && notRead;
    }).length;
    
    return unreadCount;
}

// update all group badges
function updateGroupBadges() {
    const totalUnread = chatGroups.reduce((sum, group) => {
        return sum + getGroupUnreadCount(group._id);
    }, 0);
    
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
    
    // render available users
    const usersList = document.getElementById('newGroupUsersList');
    usersList.innerHTML = allUsers.map(user => `
        <div class="user-item">
            <div style="display: flex; align-items: center;">
                <input type="checkbox" class="user-checkbox" value="${user._id}" id="user-${user._id}">
                <label for="user-${user._id}" style="margin-left: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px;">
                    <div class="user-avatar-small">
                        ${user.userName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span>${escapeHtml(user.userName)}</span>
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
    
    // get selected users
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

// THIS IS THE NEW FUNCTION THAT WAS MISSING
// create a new group chat (different from creating a group - this starts a chat in existing group)
function createGroupChat() {
    if (!selectedGroupId) {
        showNotification('Please select a group first', 'error');
        return;
    }
    
    // show the new message form
    showNewMessageForm();
}

// select group and display info
async function selectGroup(groupId) {
    selectedGroupId = groupId;
    renderChatGroups();
    
    const group = chatGroups.find(g => g._id === groupId);
    if (group) {
        // show group info with member names
        const infoDiv = document.getElementById('selectedGroupInfo');
        const nameSpan = document.getElementById('selectedGroupName');
        const membersSpan = document.getElementById('selectedGroupMembers');
        
        infoDiv.style.display = 'block';
        nameSpan.textContent = group.name;
        
        // display member names
        const memberNames = group.members?.map(m => m.userName || 'Unknown').join(', ') || 'No members';
        membersSpan.innerHTML = `<strong>Members:</strong> ${memberNames}`;
        
        // load group messages
        await loadGroupMessages(groupId);
        
        // mark messages as read for this user
        await markGroupMessagesAsRead(groupId);
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

// mark group messages as read
async function markGroupMessagesAsRead(groupId) {
    const group = chatGroups.find(g => g._id === groupId);
    if (!group) return;
    
    try {
        await fetch(`/api/chatgroups/${groupId}/mark-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        // reload group messages to get updated read status
        await loadGroupMessages(groupId);
        
        // reload all groups to update unread counts
        await loadChatGroups();
        
        // update badges
        updateGroupBadges();
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

// mark all messages as read in current group
async function markAllAsRead() {
    if (!selectedGroupId) {
        showNotification('Please select a group first', 'error');
        return;
    }
    
    const group = chatGroups.find(g => g._id === selectedGroupId);
    if (!group) return;
    
    const unreadCount = getGroupUnreadCount(selectedGroupId);
    
    if (unreadCount === 0) {
        showNotification('No unread messages in this group', 'error');
        return;
    }
    
    try {
        await fetch(`/api/chatgroups/${selectedGroupId}/mark-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        // reload group messages to reflect updated read status
        await loadGroupMessages(selectedGroupId);
        
        // reload all groups to update counts
        await loadChatGroups();
        
        // re-render group list to show updated unread badges
        renderChatGroups();
        
        //re-render messages to show they're read
        renderGroupMessages();
        
        // update all badges
        updateGroupBadges();
        
        showNotification('All messages marked as read', 'success');
    } catch (error) {
        console.error('Error marking all as read:', error);
        showNotification('Failed to mark messages as read', 'error');
    }
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
    
    // sort messages by timestamp - most recent first
    const sortedMessages = [...groupMessages].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    container.innerHTML = sortedMessages.map(msg => {
        const isOwnMessage = msg.userId === currentUser.id;
        
        return `
            <div class="message-card" data-id="${msg._id}">
                <div class="message-header">
                    <div class="user-info">
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
                    ${msg.aiNote ? `<div class="ai-note"> ${escapeHtml(msg.aiNote)}</div>` : ''}
                </div>
                ${isOwnMessage ? `
                    <div class="message-actions">
                        <button class="btn btn-danger btn-small" onclick="deleteGroupMessage('${msg._id}')"> Delete</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// delete group message
async function deleteGroupMessage(messageId) {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    
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
}

// show new message form
function showNewMessageForm() {
    document.getElementById('newMessageForm').style.display = 'block';
    document.getElementById('newMessageBtn').style.display = 'none';
}

// hide new message form
function hideNewMessageForm() {
    document.getElementById('newMessageForm').style.display = 'none';
    document.getElementById('newMessageBtn').style.display = 'block';
    document.getElementById('groupMessageText').value = '';
    document.getElementById('groupTranslationPreview').classList.remove('active');
}

// preview group message translation
async function previewGroupTranslation() {
    const messageText = document.getElementById('groupMessageText').value.trim();
    const sourceLang = document.getElementById('groupSourceLang').value;
    const targetLang = document.getElementById('groupTargetLang').value;
    
    if (!messageText) {
        showNotification('Please enter a message first', 'error');
        return;
    }
    
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
                <div class="preview-header">📋 Translation Preview:</div>
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

// send group message
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

// recording functionality for group messages
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
        btn.innerHTML = '⏹️ Stop';
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

// manage group members
async function manageGroupMembers() {
    if (!selectedGroupId) return;
    
    await loadAllUsers();
    
    const group = chatGroups.find(g => g._id === selectedGroupId);
    if (!group) return;
    
    // render current members
    const currentList = document.getElementById('currentMembersList');
    currentList.innerHTML = group.members.map(member => `
        <div class="member-item">
            <div style="display: flex; align-items: center;">
                <div class="user-avatar-small">
                    ${member.userName?.[0]?.toUpperCase() || 'U'}
                </div>
                <span>${escapeHtml(member.userName || 'Unknown User')}</span>
            </div>
            ${member._id !== currentUser.id ? `
                <button class="btn btn-danger btn-small" onclick="removeMember('${member._id}')">
                    Remove
                </button>
            ` : '<span style="color: #999; font-size: 12px;">You</span>'}
        </div>
    `).join('');
    
    // render available users
    const availableUsers = allUsers.filter(u => 
        !group.members.some(m => m._id === u._id)
    );
    
    const availableList = document.getElementById('availableUsersList');
    if (availableUsers.length === 0) {
        availableList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">All users are already members</p>';
    } else {
        availableList.innerHTML = availableUsers.map(user => `
            <div class="user-item">
                <div style="display: flex; align-items: center;">
                    <div class="user-avatar-small">
                        ${user.userName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span>${escapeHtml(user.userName)}</span>
                </div>
                <button class="btn btn-primary btn-small" onclick="addMember('${user._id}')">
                    Add
                </button>
            </div>
        `).join('');
    }
    
    document.getElementById('manageMembersModal').classList.add('active');
}

// add member to group
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

// remove member from group
async function removeMember(userId) {
    if (!selectedGroupId) return;
    
    if (!confirm('Remove this member from the group?')) return;
    
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
}

// close members modal
function closeMembersModal() {
    document.getElementById('manageMembersModal').classList.remove('active');
}

// delete current group
async function deleteCurrentGroup() {
    if (!selectedGroupId) return;
    
    const group = chatGroups.find(g => g._id === selectedGroupId);
    if (!group) return;
    
    if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return;
    
    try {
        const response = await fetch(`/api/chatgroups/${selectedGroupId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Group deleted', 'success');
            selectedGroupId = null;
            document.getElementById('selectedGroupInfo').style.display = 'none';
            document.getElementById('newMessageForm').style.display = 'none';
            document.getElementById('newMessageBtn').style.display = 'block';
            await loadChatGroups();
            updateGroupBadges();
        }
    } catch (error) {
        console.error('Error deleting group:', error);
        showNotification('Failed to delete group', 'error');
    }
}

// load group chats on page load
async function loadUnreadMessages(skipRender = false) {
    await loadChatGroups();
    await loadAllUsers();
    
    // if we have a selected group, reload its messages
    if (selectedGroupId && !skipRender) {
        await loadGroupMessages(selectedGroupId);
    }
}

// initialize group chats badges on page load (before tab is clicked)
async function initializeGroupChatsBadges() {
    try {
        // load groups silently
        const response = await fetch('/api/chatgroups');
        const data = await response.json();
        
        if (data.success) {
            chatGroups = data.data;
            
            // load messages for each group to calculate unread counts
            let totalUnread = 0;
            
            for (const group of chatGroups) {
                const msgResponse = await fetch(`/api/chatgroups/${group._id}/messages`);
                const msgData = await msgResponse.json();
                
                if (msgData.success) {
                    const unreadCount = msgData.data.filter(msg => 
                        msg.userId !== currentUser.id && !msg.isRead
                    ).length;
                    
                    totalUnread += unreadCount;
                }
            }
            
            // update badge
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