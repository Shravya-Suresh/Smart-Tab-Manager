let clickCount = 0;
let keyPressCount = 0;
let maxScrollDepth = 0;
let activeTime = 0;  // seconds user is active
let idleTime = 0;    // seconds user is idle
const IDLE_THRESHOLD = 5;  // seconds
const firstSeen = Date.now();  // Track when tab was opened

// --- Helper to safely message background ---
function safeSendMessage(message, callback) {
    try {
        if (chrome?.runtime?.id) {
            chrome.runtime.sendMessage(message, callback || (() => {
                void chrome.runtime?.lastError; // ✅ ignore errors
            }));
        }
    } catch {
        // ✅ swallow "Extension context invalidated"
    }
}

// Reset idle timer on user activity
function resetIdleTimer() {
    idleTime = 0;
}

// Track clicks
document.addEventListener("click", () => {
    clickCount++;
    resetIdleTimer();
});

// Track typing
document.addEventListener("keydown", () => {
    keyPressCount++;
    resetIdleTimer();
});

// Track scroll depth
document.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = (scrollTop / docHeight) * 100;
    if (scrolled > maxScrollDepth) {
        maxScrollDepth = scrolled;
        resetIdleTimer();
    }
});

// Update active/idle time every second
setInterval(() => {
    idleTime++;
    if (idleTime < IDLE_THRESHOLD) {
        activeTime++;
    }
}, 1000);

// Send activity data to background script
function sendActivityToBackground() {
    const activityData = {
        firstSeen,
        activeTime,
        idleTime,
        keyPresses: keyPressCount,
        clickCount,
        maxScrollDepth,
        tabTitle: document.title || 'N/A',
        url: window.location.href || 'N/A'
    };
    safeSendMessage({ type: "tabActivity", data: activityData });
}

// Debounced activity reporting
let lastSendTime = 0;
setInterval(() => {
    const now = Date.now();
    if (now - lastSendTime >= 2500) {
        sendActivityToBackground();
        lastSendTime = now;
    }
}, 3000);

// Show notification popup
let lastPopupData = null; // Keep track of last shown popup

function showTabNotification(currentData) {
    // Do not show if same as last closed popup
    if (lastPopupData && JSON.stringify(lastPopupData) === JSON.stringify(currentData)) return;

    // Check if popup already exists
    if (document.getElementById('smart-tab-popup')) return;

    const popup = document.createElement('div');
    popup.id = 'smart-tab-popup';
    popup.style.position = 'fixed';
    popup.style.top = '20px';
    popup.style.right = '20px';
    popup.style.zIndex = '999999';
    popup.style.backgroundColor = '#fff';
    popup.style.border = '1px solid #ccc';
    popup.style.borderRadius = '4px';
    popup.style.padding = '15px';
    popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    popup.style.fontFamily = 'Arial, sans-serif';
    
    popup.innerHTML = `
        <div style="margin-bottom: 10px;">This tab is recommended to close</div>
        <div style="display: flex; gap: 10px;">
            <button id="keepTabBtn" style="padding: 5px 10px; background: #e0e0e0; border: none; border-radius: 3px;">Keep</button>
            <button id="closeTabBtn" style="padding: 5px 10px; background: #ff6b6b; color: white; border: none; border-radius: 3px;">Close</button>
        </div>
    `;
    
    document.body.appendChild(popup);

    // Handlers
    document.getElementById('keepTabBtn').addEventListener('click', () => {
        popup.remove();
        safeSendMessage({ type: "userAction", action: "keep" });
        lastPopupData = currentData; // store last popup data
    });

    document.getElementById('closeTabBtn').addEventListener('click', () => {
        popup.remove();
        safeSendMessage({ type: "userAction", action: "close" });
        lastPopupData = currentData; // store last popup data
    });

    // Auto-close after 10 seconds
    setTimeout(() => {
        if (document.body.contains(popup)) {
            popup.remove();
        }
    }, 10000);
}

// Initial send
sendActivityToBackground();
