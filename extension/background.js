/** Relays status updates from content script to the popup. */
const latestStatus = {
  running: false,
  completed: 0,
  total: 25,
  message: "Idle",
  raw: "",
  normalized: "",
  answer: "",
};

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
  return false;
});
