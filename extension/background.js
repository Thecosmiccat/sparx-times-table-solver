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

const CONTENT_SCRIPTS = ["solver.js", "sparx-dom.js", "content.js"];

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
    files: CONTENT_SCRIPTS,
  });
  // Panel styles only matter in the top frame
  try {
    await chrome.scripting.insertCSS({
      target: { tabId, allFrames: false },
      files: ["panel.css"],
    });
  } catch {
    /* ignore CSS inject failures */
  }
}

/** Discover frame ids without webNavigation permission. */
async function listFrameIds(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => true,
    });
    return results.map((r) => r.frameId).filter((id) => typeof id === "number");
  } catch {
    return [0];
  }
}

async function sendToFrame(tabId, frameId, message) {
  return chrome.tabs.sendMessage(tabId, message, { frameId });
}

/**
 * Send to every frame; prefer a frame that returns ok:true (handles the question).
 * Needed because Hundred Club often runs inside an iframe.
 */
async function broadcastToTab(tabId, message) {
  let frameIds = await listFrameIds(tabId);
  if (!frameIds.length) frameIds = [0];

  let lastError = null;
  let anyResponse = null;

  const tryAll = async () => {
    for (const frameId of frameIds) {
      try {
        const res = await sendToFrame(tabId, frameId, message);
        if (res != null) anyResponse = res;
        if (res?.ok) return res;
      } catch (e) {
        lastError = e;
      }
    }
    return null;
  };

  let res = await tryAll();
  if (res?.ok) return res;

  // Page may have been open before install — inject and retry once
  try {
    await injectScripts(tabId);
    frameIds = await listFrameIds(tabId);
    if (!frameIds.length) frameIds = [0];
    res = await tryAll();
    if (res?.ok) return res;
    if (anyResponse) return anyResponse;
  } catch (e) {
    lastError = e;
  }

  if (anyResponse) return anyResponse;
  throw lastError || new Error("No Sparx content script responded — refresh the page.");
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
