/** Routes popup → tab, injects scripts if the page was open before install. */
const latestStatus = {
  running: false,
  completed: 0,
  total: 25,
  message: "Idle",
  raw: "",
  normalized: "",
  answer: "",
};

function isSparxUrl(url) {
  if (!url) return false;
  return /sparxmaths|sparx-learning|maths\.sparx/i.test(url);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function injectScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["solver.js", "content.js"],
  });
}

async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await injectScripts(tabId);
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

async function broadcastToTab(tabId, message) {
  try {
    return await sendToTab(tabId, message);
  } catch (firstErr) {
    // If no frame handled it, try injection once more
    try {
      await injectScripts(tabId);
      return await chrome.tabs.sendMessage(tabId, message);
    } catch {
      throw firstErr;
    }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "status") {
    Object.assign(latestStatus, msg);
    chrome.runtime.sendMessage({ type: "statusUpdate", ...latestStatus }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "getStatus") {
    sendResponse(latestStatus);
    return true;
  }

  if (msg.type === "command") {
    (async () => {
      try {
        const tab = await activeTab();
        if (!tab?.id) throw new Error("No active tab");
        if (!isSparxUrl(tab.url)) {
          throw new Error("Open Sparx Maths in this tab first, then refresh the page.");
        }
        const res = await broadcastToTab(tab.id, { action: msg.action, ...msg.options });
        sendResponse(res ?? { ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e) });
      }
    })();
    return true;
  }

  return false;
});
