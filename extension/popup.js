// popup.js
document.addEventListener("DOMContentLoaded", async () => {
  const recEl = document.getElementById("rec");
  const scoreEl = document.getElementById("score");

  // Find the active tab in the current window
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab) {
      recEl.textContent = "No active tab";
      scoreEl.textContent = "N/A";
      return;
    }

    chrome.runtime.sendMessage(
      { action: "getLastRecommendation", tabId: tab.id },
      (resp) => {
        const rec = resp && resp.lastRecommendation;
        if (rec) {
          recEl.textContent = rec.recommendation;
          scoreEl.textContent = rec.score.toFixed(2);
        } else {
          recEl.textContent = "No data yet";
          scoreEl.textContent = "N/A";
        }
      }
    );
  });
});
