// background.js

let tabActivity = {};              // tabId -> latest activity payload + score
let recommendationsByTab = {};     // tabId -> { tabId, score, recommendation, at }
let activeTabId = null;
let lastActiveTime = Date.now();
let tabsToClose = new Set();       // Track tabs recommended for closing

// ----- Min-heap for least-active tabs -----
let heap = [];

function swap(i, j) { [heap[i], heap[j]] = [heap[j], heap[i]]; }

function heapifyUp(idx) {
  if (idx === 0) return;
  const p = Math.floor((idx - 1) / 2);
  if (heap[idx].score < heap[p].score) {
    swap(idx, p);
    heapifyUp(p);
  }
}

function heapifyDown(idx) {
  const l = 2 * idx + 1, r = 2 * idx + 2;
  let s = idx;
  if (l < heap.length && heap[l].score < heap[s].score) s = l;
  if (r < heap.length && heap[r].score < heap[s].score) s = r;
  if (s !== idx) { swap(idx, s); heapifyDown(s); }
}

function updateUnifiedPopup() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: (tabData) => {
          // Remove existing popup
          const oldPopup = document.getElementById('unified-tab-popup');
          if (oldPopup) oldPopup.remove();
          
          // Don't show if no tabs to close
          if (tabData.tabs.length === 0) return;

          // Create new popup
          const popup = document.createElement('div');
          popup.id = 'unified-tab-popup';
          popup.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 9999;
            max-width: 300px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          `;
          
          // Close button
          const closeBtn = document.createElement('span');
          closeBtn.textContent = '×';
          closeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 10px;
            cursor: pointer;
            font-size: 18px;
          `;
          closeBtn.onclick = () => popup.remove();
          
          // Popup content
          const content = document.createElement('div');
          content.innerHTML = `
            <strong>Tabs recommended to close:</strong>
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
              ${tabData.tabs.map(tab => 
                `<li>${tab.title}</li>`
              ).join('')}
            </ul>
          `;
          
          popup.appendChild(closeBtn);
          popup.appendChild(content);
          document.body.appendChild(popup);
        },
        args: [{
          tabs: Array.from(tabsToClose).map(t => ({
            id: t,
            title: tabActivity[t]?.tabTitle || 'Untitled tab'
          }))
        }]
      }).catch(console.error);
    });
  });
}

function pushHeap(tabId, score) {
  heap.push({ tabId, score });
  heapifyUp(heap.length - 1);
}

function updateHeap(tabId, score) {
  const idx = heap.findIndex(x => x.tabId === tabId);
  if (idx !== -1) {
    heap[idx].score = score;
    heapifyUp(idx);
    heapifyDown(idx);
  } else {
    pushHeap(tabId, score);
  }
}

// ----- Scoring -----
function calculateTabScore(data) {
  let score = 0;
  score += (data.activeTime || 0) * 0.5;
  score += (data.clickCount || 0) * 0.3;
  score += (data.keyPresses || 0) * 0.2;
  score += (data.maxScrollDepth || 0) * 0.1;
  score -= (data.idleTime || 0) * 0.5;
  return Math.max(0, score);
}

function recommendFromScore(score, data) {
  const tabAgeSeconds = (Date.now() - (data.firstSeen || Date.now())) / 1000;
  if (tabAgeSeconds < 5) return "No data yet";
  
  if (
    (!data.activeTime && !data.clickCount && 
     !data.keyPresses && !data.maxScrollDepth)
  ) {
    return (data.idleTime > 30) ? "close" : "No data yet";
  }

  if (score >= 20) return "keep";
  if (score >= 10) return "consider";
  return "close";
}

// ----- Tab events -----
chrome.tabs.onActivated.addListener(info => {
  updateTimeSpent();
  activeTabId = info.tabId;
  lastActiveTime = Date.now();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === activeTabId && changeInfo.status === "complete") {
    lastActiveTime = Date.now();
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  tabsToClose.delete(tabId);
  updateTimeSpent();
  delete tabActivity[tabId];
  delete recommendationsByTab[tabId];
  heap = heap.filter(x => x.tabId !== tabId);
  heapifyDown(0);
  if (tabsToClose.size > 0) {
    updateUnifiedPopup();
  }
});

function updateTimeSpent() {
  const now = Date.now();
  if (activeTabId !== null) {
    const timeSpent = (now - lastActiveTime) / 1000;
    tabActivity[activeTabId] = tabActivity[activeTabId] || { timeSpent: 0 };
    tabActivity[activeTabId].timeSpent += timeSpent;
  }
  lastActiveTime = now;
}

// ----- Message Handling -----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "tabActivity") {
    setTimeout(() => {
      const data = message.data || {};
      const tabId = sender?.tab?.id ?? activeTabId;
      
      if (!tabId) {
        sendResponse({ error: "No tabId" });
        return;
      }

      // Store tab title/URL if available
      if (data.tabTitle) tabActivity[tabId] = tabActivity[tabId] || {};
      if (data.tabTitle) tabActivity[tabId].tabTitle = data.tabTitle;
      if (data.url) tabActivity[tabId] = tabActivity[tabId] || {};
      if (data.url) tabActivity[tabId].url = data.url;

      const score = calculateTabScore(data);
      const recommendation = recommendFromScore(score, data);
      
      // Update data structures
      tabActivity[tabId] = { ...tabActivity[tabId], ...data, score };
      updateHeap(tabId, score);
      recommendationsByTab[tabId] = { tabId, score, recommendation, at: Date.now() };
      
      // Handle close recommendations
      if (recommendation === "close") {
        tabsToClose.add(tabId);
      } else {
        tabsToClose.delete(tabId);
      }
      
      // Update popup if needed
      if (recommendation === "close" || tabsToClose.has(tabId)) {
        updateUnifiedPopup();
      } else if (tabsToClose.size === 0) {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.scripting.executeScript({
              target: {tabId: tab.id},
              func: () => {
                const popup = document.getElementById('unified-tab-popup');
                if (popup) popup.remove();
              }
            }).catch(console.error);
          });
        });
      }
      
      sendResponse({ recommendation, score });
    }, 0);
    return true;
  }

  if (message.type === "userAction") {
    if (message.action === "close" && sender.tab?.id) {
      chrome.tabs.remove(sender.tab.id);
    }
    return false;
  }

  if (message.action === "getLastRecommendation") {
    const tabId = message.tabId;
    const rec = tabId ? recommendationsByTab[tabId] : null;
    sendResponse({ lastRecommendation: rec });
  }
  
  return false;
});

// Initial setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.scripting.executeScript({
          target: {tabId: tab.id},
          files: ['content.js']
        }).catch(console.error);
      }
    });
  });
});