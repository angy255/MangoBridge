// main app initialization
document.addEventListener('DOMContentLoaded', async() => {
    console.log('App initializing...', currentUser);
    // add dark mode if user preference is set
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.theme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    
    // initialize all modules
    if (typeof currentUser !== 'undefined' && currentUser) {
        // load messages first, then update badge
        
        await loadMessages();

        // load unread and update badge
        await loadUnreadMessages();

        // load other data
        loadCalendar();
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
        // don't force reload if we're in the middle of replying
        loadUnreadMessages(false);
    } else if (tabName === 'archived') {
        loadArchivedMessages();
    } else if (tabName === 'calendar') {
        renderCalendar();
    }
    // always update the badge when swtiching tabs
    updateUnreadBadge();
}

function setupEventListeners() {
    // archive selected
    const archiveBtn = document.getElementById('archiveSelectedBtn');
    if (archiveBtn) {
        archiveBtn.addEventListener('click', archiveSelected);
    }
    
    // mark all as read
    const markAllBtn = document.getElementById('markAllReadBtn');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', markAllAsRead);
    }
    
    // clear archived
    const clearBtn = document.getElementById('clearArchivedBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearArchived);
    }
}