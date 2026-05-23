const $ = (id) => document.getElementById(id);

const roundsEl = $("rounds");
const delayEl = $("delay");
const startBtn = $("start");
const stopBtn = $("stop");
const scanBtn = $("scan");
const detectedEl = $("detected");
const answerEl = $("answer");
const progressEl = $("progress");
const statusEl = $("status");

function setRunning(running) {
  startBtn.disabled = running;
  stopBtn.disabled = !running;
}

function updateUI(data) {
  if (!data) return;
  detectedEl.textContent = data.normalized || data.raw || "—";
  answerEl.textContent = data.answer || "—";
  progressEl.textContent = `${data.completed ?? 0} / ${data.total ?? 0}`;
  statusEl.textContent = data.message || "—";
  setRunning(!!data.running);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToTab(message) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active tab");
  return chrome.tabs.sendMessage(tab.id, message);
}

startBtn.addEventListener("click", async () => {
  try {
    const rounds = parseInt(roundsEl.value, 10) || 25;
    const roundDelay = parseInt(delayEl.value, 10) || 800;
    await sendToTab({
      action: "start",
      rounds,
      roundDelay,
      repeatDelay: 250,
    });
    setRunning(true);
    statusEl.textContent = "Running…";
  } catch (e) {
    statusEl.textContent =
      "Open a Sparx Maths tab first (sparxmaths.com), then try again.";
  }
});

stopBtn.addEventListener("click", async () => {
  try {
    await sendToTab({ action: "stop" });
    setRunning(false);
    statusEl.textContent = "Stopping…";
  } catch {
    setRunning(false);
  }
});

scanBtn.addEventListener("click", async () => {
  try {
    const res = await sendToTab({ action: "scan" });
    updateUI({
      raw: res.raw,
      normalized: res.normalized,
      answer: res.answer,
      message: res.raw ? "Scanned page" : "No question found",
      running: res.running,
      completed: 0,
      total: parseInt(roundsEl.value, 10) || 25,
    });
  } catch {
    statusEl.textContent = "Not on a Sparx page — open Sparx Maths first.";
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "statusUpdate") updateUI(msg);
});

chrome.storage.local.get(["rounds", "delay"], (data) => {
  if (data.rounds) roundsEl.value = data.rounds;
  if (data.delay) delayEl.value = data.delay;
});

roundsEl.addEventListener("change", () => {
  chrome.storage.local.set({ rounds: roundsEl.value });
});
delayEl.addEventListener("change", () => {
  chrome.storage.local.set({ delay: delayEl.value });
});

(async () => {
  try {
    const res = await sendToTab({ action: "ping" });
    setRunning(!!res.running);
    chrome.runtime.sendMessage({ type: "getStatus" }, (status) => {
      if (status) updateUI(status);
    });
  } catch {
    statusEl.textContent = "Open Sparx Maths in this tab, then open the extension.";
  }
})();
