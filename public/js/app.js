// main app initialization
document.addEventListener('DOMContentLoaded', async() => {
    console.log('App initializing...', currentUser);
    
    // add dark mode if user preference is set
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.theme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    
    // initialize all modules
    if (typeof currentUser !== 'undefined' && currentUser) {
        // Initialize group chats badges FIRST (before loading messages)
        // This ensures the unread badge shows immediately on login
        if (typeof initializeGroupChatsBadges === 'function') {
            await initializeGroupChatsBadges();
        }
        
        // load messages
        await loadMessages();

        // load group chats (will update badges again with more accurate data)
        if (typeof loadUnreadMessages === 'function') {
            await loadUnreadMessages(true); // skipRender = true
        }

        // load other data
        if (typeof loadCalendar === 'function') {
            loadCalendar();
        }
        
        setupNavigation();
        setupEventListeners();
    }
});

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tab = link.getAttribute('data-tab');
            switchTab(tab);
            
            // update active state
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

function switchTab(tabName) {
    // hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // load data for specific tabs
    if (tabName === 'unread') {
        if (typeof loadUnreadMessages === 'function') {
            loadUnreadMessages();
        }
    } else if (tabName === 'archived') {
        if (typeof loadArchivedMessages === 'function') {
            loadArchivedMessages();
        }
    } else if (tabName === 'calendar') {
        if (typeof renderCalendar === 'function') {
            renderCalendar();
        }
    } else if (tabName === 'summaries') {
        if (typeof loadMeetingSummaries === 'function') {
            loadMeetingSummaries();
        }
    } else if (tabName === 'home') {
        if (typeof loadMessages === 'function') {
            loadMessages();
        }
    }
}

function setupEventListeners() {
    // archive selected
    const archiveBtn = document.getElementById('archiveSelectedBtn');
    if (archiveBtn) {
        archiveBtn.addEventListener('click', archiveSelected);
    }
    
    // clear archived
    const clearBtn = document.getElementById('clearArchivedBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearArchived);
    }
    
    // close modals when clicking outside
    const manageMembersModal = document.getElementById('manageMembersModal');
    if (manageMembersModal) {
        manageMembersModal.addEventListener('click', (e) => {
            if (e.target === manageMembersModal) {
                closeMembersModal();
            }
        });
    }
    
    const createGroupModal = document.getElementById('createGroupModal');
    if (createGroupModal) {
        createGroupModal.addEventListener('click', (e) => {
            if (e.target === createGroupModal) {
                closeCreateGroupModal();
            }
        });
    }
}