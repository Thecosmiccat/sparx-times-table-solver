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
  answerEl.textContent = data.answer ?? "—";
  progressEl.textContent = `${data.completed ?? 0} / ${data.total ?? 0}`;
  statusEl.textContent = data.message || "—";
  setRunning(!!data.running);
}

function sendCommand(action, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "command", action, options }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (res?.ok === false) reject(new Error(res.error || "Failed"));
      else resolve(res);
    });
  });
}

startBtn.addEventListener("click", async () => {
  statusEl.textContent = "Starting…";
  try {
    await sendCommand("start", {
      rounds: parseInt(roundsEl.value, 10) || 25,
      roundDelay: parseInt(delayEl.value, 10) || 800,
      repeatDelay: 250,
    });
    setRunning(true);
    statusEl.textContent = "Running — use the panel on the Sparx page (popup can close).";
  } catch (e) {
    statusEl.textContent = e.message || "Failed — refresh Sparx and use the on-page panel.";
  }
});

stopBtn.addEventListener("click", async () => {
  try {
    await sendCommand("stop", {});
    setRunning(false);
    statusEl.textContent = "Stopped.";
  } catch {
    setRunning(false);
  }
});

scanBtn.addEventListener("click", async () => {
  try {
    const res = await sendCommand("scan", {});
    updateUI({
      raw: res.raw,
      normalized: res.normalized,
      answer: res.answer,
      message: res.raw ? "Scanned" : "No question found",
      running: res.running,
      completed: 0,
      total: parseInt(roundsEl.value, 10) || 25,
    });
  } catch (e) {
    statusEl.textContent = e.message || "Scan failed — use the panel on the Sparx page.";
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "statusUpdate") updateUI(msg);
});

chrome.storage.local.get(["rounds", "delay"], (data) => {
  if (data.rounds) roundsEl.value = data.rounds;
  if (data.delay) delayEl.value = data.delay;
});

roundsEl.addEventListener("change", () => chrome.storage.local.set({ rounds: roundsEl.value }));
delayEl.addEventListener("change", () => chrome.storage.local.set({ delay: delayEl.value }));

(async () => {
  statusEl.textContent = "Tip: use the Sparx Solver panel on the page (bottom-left).";
  try {
    const res = await sendCommand("ping", {});
    setRunning(!!res.running);
    chrome.runtime.sendMessage({ type: "getStatus" }, (s) => s && updateUI(s));
  } catch {
    statusEl.textContent = "Open Sparx, refresh, then use the panel on the page.";
  }
})();
