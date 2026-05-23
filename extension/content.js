/**
 * Sparx page automation + floating control panel (stays on page when popup closes).
 */
(() => {
  const findAnswerInput = () => SparxDom.findAnswerInput();
  const findQuestionText = () => SparxDom.findQuestionText();

  let running = false;
  let stopRequested = false;
  let lastQuestion = "";

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function sendStatus(payload) {
    chrome.runtime.sendMessage({ type: "status", ...payload }).catch(() => {});
    if (window === window.top && panelUi) {
      updatePanel(payload);
    }
  }

  function canHandlePage() {
    return !!(findAnswerInput() || findQuestionText());
  }

  function setInputValue(input, value) {
    input.focus();
    if (input.isContentEditable) {
      input.textContent = value;
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
      return;
    }
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc?.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function submitAnswer(input) {
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      })
    );
    input.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      })
    );

    const form = input.closest("form");
    form?.requestSubmit?.();

    for (const btn of document.querySelectorAll("button, [role='button']")) {
      const label = (btn.innerText || btn.getAttribute("aria-label") || "").toLowerCase();
      if (/submit|check|enter|next|continue|done/.test(label) && !btn.disabled) {
        btn.click();
        return;
      }
    }
  }

  async function runSession({ rounds, roundDelay, repeatDelay }) {
    if (running) return;
    running = true;
    stopRequested = false;
    lastQuestion = "";
    let completed = 0;
    let dupes = 0;

    sendStatus({ running: true, completed, total: rounds, message: "Running…" });

    while (completed < rounds && !stopRequested) {
      const raw = findQuestionText();
      const { answer, normalized } = SparxSolver.solve(raw);

      if (!raw) {
        sendStatus({
          running: true,
          completed,
          total: rounds,
          raw: "",
          normalized: "",
          answer: null,
          message: "No question visible — open a question.",
        });
        await sleep(repeatDelay);
        continue;
      }

      if (!answer) {
        sendStatus({
          running: true,
          completed,
          total: rounds,
          raw,
          normalized,
          answer: null,
          message: `Can't solve: ${raw}`,
        });
        await sleep(repeatDelay);
        continue;
      }

      sendStatus({
        running: true,
        completed,
        total: rounds,
        raw,
        normalized,
        answer,
        message: `${normalized} = ${answer}`,
      });

      if (normalized === lastQuestion) {
        dupes += 1;
        if (dupes > 40) {
          lastQuestion = "";
          dupes = 0;
        }
        await sleep(repeatDelay);
        continue;
      }
      dupes = 0;

      const input = findAnswerInput();
      if (!input) {
        sendStatus({
          running: true,
          completed,
          total: rounds,
          raw,
          normalized,
          answer,
          message: "Click the answer box, then Start again.",
        });
        await sleep(repeatDelay);
        continue;
      }

      lastQuestion = normalized;
      setInputValue(input, answer);
      await sleep(120);
      submitAnswer(input);

      completed += 1;
      sendStatus({
        running: true,
        completed,
        total: rounds,
        raw,
        normalized,
        answer,
        message: `Submitted ${answer} (${completed}/${rounds})`,
      });

      await sleep(roundDelay);
    }

    running = false;
    sendStatus({
      running: false,
      completed,
      total: rounds,
      message: stopRequested ? "Stopped." : "Done!",
    });
  }

  function doScan() {
    const raw = findQuestionText();
    const { answer, normalized } = SparxSolver.solve(raw);
    sendStatus({
      running,
      completed: 0,
      total: parseInt(panelUi?.roundsInput?.value, 10) || 25,
      raw,
      normalized,
      answer,
      message: raw
        ? "Scanned"
        : "No question found — try Hide panel (×) if it blocks the numbers",
    });
    return { raw, normalized, answer };
  }

  // ── Floating panel (top frame only) ─────────────────────────────────────
  let panelUi = null;

  function updatePanel(data) {
    if (!panelUi) return;
    panelUi.detected.textContent = data.normalized || data.raw || "—";
    panelUi.answer.textContent = data.answer ?? "—";
    panelUi.progress.textContent = `${data.completed ?? 0} / ${data.total ?? 0}`;
    panelUi.status.textContent = data.message || "—";
    panelUi.startBtn.disabled = !!data.running;
    panelUi.stopBtn.disabled = !data.running;
  }

  function createPanel() {
    if (window !== window.top || document.getElementById("sparx-solver-root")) return;

    const root = document.createElement("div");
    root.id = "sparx-solver-root";
    root.innerHTML = `
      <div id="sparx-solver-panel" class="sparx-collapsed">
        <div class="sparx-head">
          <strong>Sparx Solver</strong>
          <button type="button" class="sparx-minimize" title="Expand / collapse">+</button>
          <button type="button" class="sparx-hide" title="Hide (won't block question)">×</button>
        </div>
        <div class="sparx-body">
          <label>Rounds</label>
          <input type="number" class="sparx-rounds" min="1" max="999" value="25" />
          <label>Delay (ms)</label>
          <input type="number" class="sparx-delay" min="200" max="5000" step="50" value="800" />
          <div class="sparx-btns">
            <button type="button" class="sparx-start sparx-action">Start</button>
            <button type="button" class="sparx-stop sparx-action" disabled>Stop</button>
          </div>
          <button type="button" class="sparx-scan sparx-action">Scan question</button>
          <div class="sparx-info">
            <div>Detected: <em class="sparx-detected">—</em></div>
            <div>Answer: <em class="sparx-answer">—</em></div>
            <div>Progress: <em class="sparx-progress">0 / 0</em></div>
          </div>
          <div class="sparx-status">Collapsed bar — click + to expand. Use × if it covers the question.</div>
        </div>
      </div>
    `;

    const tab = document.createElement("button");
    tab.id = "sparx-solver-tab";
    tab.type = "button";
    tab.textContent = "Sparx Solver";
    tab.title = "Show Sparx Solver panel";

    document.documentElement.appendChild(root);
    document.documentElement.appendChild(tab);

    const panel = root.querySelector("#sparx-solver-panel");
    const head = panel.querySelector(".sparx-head");
    const minBtn = panel.querySelector(".sparx-minimize");

    panelUi = {
      roundsInput: panel.querySelector(".sparx-rounds"),
      delayInput: panel.querySelector(".sparx-delay"),
      startBtn: panel.querySelector(".sparx-start"),
      stopBtn: panel.querySelector(".sparx-stop"),
      detected: panel.querySelector(".sparx-detected"),
      answer: panel.querySelector(".sparx-answer"),
      progress: panel.querySelector(".sparx-progress"),
      status: panel.querySelector(".sparx-status"),
    };

    chrome.storage.local.get(["rounds", "delay"], (d) => {
      if (d.rounds) panelUi.roundsInput.value = d.rounds;
      if (d.delay) panelUi.delayInput.value = d.delay;
    });

    panelUi.roundsInput.addEventListener("change", () => {
      chrome.storage.local.set({ rounds: panelUi.roundsInput.value });
    });
    panelUi.delayInput.addEventListener("change", () => {
      chrome.storage.local.set({ delay: panelUi.delayInput.value });
    });

    const hideBtn = panel.querySelector(".sparx-hide");

    minBtn.addEventListener("click", () => {
      const collapsed = panel.classList.toggle("sparx-collapsed");
      minBtn.textContent = collapsed ? "+" : "−";
    });

    hideBtn.addEventListener("click", () => {
      root.classList.add("sparx-hidden");
      tab.classList.add("sparx-show");
    });

    tab.addEventListener("click", () => {
      root.classList.remove("sparx-hidden");
      tab.classList.remove("sparx-show");
    });

    let drag = false;
    let ox = 0;
    let oy = 0;
    head.addEventListener("mousedown", (e) => {
      drag = true;
      ox = e.clientX - root.offsetLeft;
      oy = e.clientY - root.offsetTop;
      root.style.left = `${root.offsetLeft}px`;
      root.style.top = `${root.offsetTop}px`;
      root.style.right = "auto";
      root.style.bottom = "auto";
    });
    document.addEventListener("mousemove", (e) => {
      if (!drag) return;
      root.style.left = `${e.clientX - ox}px`;
      root.style.top = `${e.clientY - oy}px`;
    });
    document.addEventListener("mouseup", () => {
      drag = false;
    });

    panelUi.startBtn.addEventListener("click", () => {
      if (!canHandlePage()) {
        // Question may be in an iframe — ask background to start all frames
        chrome.runtime.sendMessage({
          type: "command",
          action: "start",
          options: {
            rounds: parseInt(panelUi.roundsInput.value, 10) || 25,
            roundDelay: parseInt(panelUi.delayInput.value, 10) || 800,
            repeatDelay: 250,
          },
        });
        return;
      }
      runSession({
        rounds: parseInt(panelUi.roundsInput.value, 10) || 25,
        roundDelay: parseInt(panelUi.delayInput.value, 10) || 800,
        repeatDelay: 250,
      });
    });

    panelUi.stopBtn.addEventListener("click", () => {
      stopRequested = true;
      chrome.runtime.sendMessage({ type: "command", action: "stop", options: {} });
    });

    panelUi.scanBtn = panel.querySelector(".sparx-scan");
    panelUi.scanBtn.addEventListener("click", () => {
      if (canHandlePage()) {
        doScan();
      } else {
        chrome.runtime.sendMessage({ type: "command", action: "scan", options: {} });
      }
    });

    updatePanel({ message: "Hundred Club ready — click + then Scan." });

    let scanTimer;
    const observer = new MutationObserver(() => {
      if (running || root.classList.contains("sparx-hidden")) return;
      clearTimeout(scanTimer);
      scanTimer = setTimeout(() => {
        const raw = findQuestionText();
        if (raw && panelUi) {
          const { answer, normalized } = SparxSolver.solve(raw);
          updatePanel({
            raw,
            normalized,
            answer,
            running: false,
            completed: 0,
            total: parseInt(panelUi.roundsInput.value, 10) || 25,
            message: "Question detected",
          });
        }
      }, 500);
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "ping") {
      if (window !== window.top) return false;
      sendResponse({ ok: true, running, hasPanel: true });
      return true;
    }

    if (msg.action === "stop") {
      stopRequested = true;
      sendResponse({ ok: true });
      return true;
    }

    if (msg.action === "scan") {
      if (!canHandlePage()) return false;
      sendResponse({ ok: true, ...doScan(), running });
      return true;
    }

    if (msg.action === "start") {
      if (!canHandlePage()) return false;
      if (running) {
        sendResponse({ ok: false, error: "Already running" });
        return true;
      }
      runSession({
        rounds: msg.rounds ?? 25,
        roundDelay: msg.roundDelay ?? 800,
        repeatDelay: msg.repeatDelay ?? 250,
      });
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "statusUpdate" && window === window.top) {
      updatePanel(msg);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createPanel);
  } else {
    createPanel();
  }
})();
