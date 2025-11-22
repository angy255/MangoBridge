// main app initialization
document.addEventListener('DOMContentLoaded', async() => {
    console.log('App initializing...', currentUser);
    
    // check if currentUser is defined
    if (typeof currentUser === 'undefined' || !currentUser) {
        console.error('Current user not defined');
        return;
    }
    
    
    try {
        // initialize group chats badges FIRST (before loading messages)
        // ensures the unread badge shows immediately on login
        if (typeof initializeGroupChatsBadges === 'function') {
            await initializeGroupChatsBadges();
        } else {
            console.warn('initializeGroupChatsBadges function not found');
        }
        
        // load messages
        if (typeof loadMessages === 'function') {
            await loadMessages();
        } else {
            console.error('loadMessages function not found');
        }

        // load group chats (will update badges again with more accurate data)
        if (typeof loadUnreadMessages === 'function') {
            await loadUnreadMessages(true); // skipRender = true
        } else {
            console.warn('loadUnreadMessages function not found');
        }

        // load calendar data
        if (typeof loadCalendar === 'function') {
            await loadCalendar();
        } else {
            console.warn('loadCalendar function not found');
        }
        
        setupNavigation();
        setupEventListeners();
        
        // handle tab navigation from URL or session storage
        const urlParams = new URLSearchParams(window.location.search);
        const tabFromUrl = urlParams.get('tab');
        const tabFromSession = sessionStorage.getItem('returnTab');
        
        if (tabFromUrl) {
            switchTab(tabFromUrl);
            // update active nav link
            document.querySelector
            // update active nav link
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('data-tab') === tabFromUrl) {
                    link.classList.add('active');
                }
            });
            // clear URL parameter
            window.history.replaceState({}, '', window.location.pathname);
        } else if (tabFromSession) {
            switchTab(tabFromSession);
            // update active nav link
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('data-tab') === tabFromSession) {
                    link.classList.add('active');
                }
            });
            // clear session storage
            sessionStorage.removeItem('returnTab');
        }

        console.log('✅ App initialized successfully');
    } catch (error) {
        console.error('Error during app initialization:', error);
    }
});

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    if (!navLinks.length) {
        console.error('No navigation links found');
        return;
    }
    
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tab = link.getAttribute('data-tab');
            switchTab(tab);
            
            // update active state
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
    
    console.log('✅ Navigation setup complete');
}

function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    } else {
        console.error('Tab not found:', tabName);
        return;
    }
    
    // load data for specific tabs
    try {
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
            console.log('Loading meeting summaries...');
            if (typeof loadMeetingSummaries === 'function') {
                loadMeetingSummaries();
            } else {
                console.error('loadMeetingSummaries function not found!');
            }
        } else if (tabName === 'home') {
            if (typeof loadMessages === 'function') {
                loadMessages();
            }
        }
    } catch (error) {
        console.error('Error switching tabs:', error);
    }
}

function setupEventListeners() {
    // archive selected
    const archiveBtn = document.getElementById('archiveSelectedBtn');
    if (archiveBtn) {
        archiveBtn.addEventListener('click', () => {
            if (typeof archiveSelected === 'function') {
                archiveSelected();
            }
        });
    }
    
    // clear archived
    const clearBtn = document.getElementById('clearArchivedBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (typeof clearArchived === 'function') {
                clearArchived();
            }
        });
    }
    
    // close modals when clicking outside
    const manageMembersModal = document.getElementById('manageMembersModal');
    if (manageMembersModal) {
        manageMembersModal.addEventListener('click', (e) => {
            if (e.target === manageMembersModal) {
                if (typeof closeMembersModal === 'function') {
                    closeMembersModal();
                }
            }
        });
    }
    
    const createGroupModal = document.getElementById('createGroupModal');
    if (createGroupModal) {
        createGroupModal.addEventListener('click', (e) => {
            if (e.target === createGroupModal) {
                if (typeof closeCreateGroupModal === 'function') {
                    closeCreateGroupModal();
                }
            }
        });
    }
    
    console.log('✅ Event listeners setup complete');
}