/**
 * Sparx page automation + floating control panel (stays on page when popup closes).
 */
(() => {
  // Prevent duplicate listeners/panels when background re-injects after install
  if (globalThis.__SPARX_SOLVER_LOADED__) return;
  globalThis.__SPARX_SOLVER_LOADED__ = true;

  if (typeof SparxDom === "undefined" || typeof SparxSolver === "undefined") {
    console.error("[Sparx Solver] Missing SparxDom/SparxSolver — reload the extension and refresh.");
    return;
  }

  const findAnswerTarget = () => SparxDom.findAnswerFocusTarget();
  const findQuestionText = () => SparxDom.findQuestionText();

  let running = false;
  let stopRequested = false;
  let lastQuestion = "";
  let lastFailRaw = "";
  let failStreak = 0;

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
    return !!(findQuestionText() || SparxDom.findAnswerInput() || SparxDom.looksLikeHundredClub());
  }

  /** Synthetic keys — unreliable for canvas/game UIs, kept as last resort. */
  function dispatchKey(key, code, type) {
    const opts = {
      key,
      code,
      keyCode: key.length === 1 ? key.charCodeAt(0) : 13,
      which: key.length === 1 ? key.charCodeAt(0) : 13,
      bubbles: true,
      cancelable: true,
      composed: true,
    };
    const targets = [document.activeElement, document.body, document, window].filter(Boolean);
    for (const target of targets) {
      try {
        target.dispatchEvent(new KeyboardEvent(type, opts));
      } catch {
        /* ignore */
      }
    }
  }

  function setNativeValue(el, value) {
    const str = String(value);
    if (el.isContentEditable || el.getAttribute?.("contenteditable") === "true") {
      el.focus();
      el.textContent = str;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: str, inputType: "insertText" }));
      return true;
    }

    const tag = el.tagName;
    const proto =
      tag === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    el.focus();
    if (desc?.set) desc.set.call(el, str);
    else el.value = str;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async function typeViaKeypad(value) {
    const str = String(value);
    let typed = 0;
    for (const ch of str) {
      const key = SparxDom.findKeypadKey(ch);
      if (!key || !SparxDom.clickEl(key)) return typed > 0;
      typed += 1;
      await sleep(70);
    }
    return typed === str.length;
  }

  async function typeViaKeyboard(value) {
    const target = findAnswerTarget();
    target?.focus?.();
    window.focus();
    await sleep(60);

    const str = String(value);
    for (const ch of str) {
      const code = ch >= "0" && ch <= "9" ? `Digit${ch}` : `Key${ch.toUpperCase()}`;
      dispatchKey(ch, code, "keydown");
      dispatchKey(ch, code, "keypress");
      if (document.activeElement && "value" in document.activeElement) {
        // Some React inputs only update on InputEvent
        document.activeElement.dispatchEvent(
          new InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" })
        );
      }
      dispatchKey(ch, code, "keyup");
      await sleep(45);
    }
  }

  async function typeAnswer(value) {
    const input = SparxDom.findAnswerInput();
    if (input) {
      setNativeValue(input, value);
      await sleep(80);
      return "input";
    }

    // Hundred Club: click the on-screen number pad (synthetic keys are ignored)
    if (await typeViaKeypad(value)) {
      return "keypad";
    }

    await typeViaKeyboard(value);
    return "keyboard";
  }

  async function submitAnswer() {
    // Prefer keypad OK / Enter
    for (const label of ["ok", "enter"]) {
      const btn = SparxDom.findKeypadKey(label);
      if (btn && SparxDom.clickEl(btn)) {
        await sleep(40);
        return "keypad";
      }
    }

    dispatchKey("Enter", "Enter", "keydown");
    dispatchKey("Enter", "Enter", "keypress");
    dispatchKey("Enter", "Enter", "keyup");

    const input = SparxDom.findAnswerInput();
    if (input?.form) {
      input.form.requestSubmit?.();
    }
    return "enter";
  }

  async function waitForQuestionChange(prevNormalized, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (stopRequested) return false;
      const raw = findQuestionText();
      if (raw) {
        const { normalized } = SparxSolver.solve(raw);
        if (normalized && normalized !== prevNormalized) return true;
      }
      await sleep(120);
    }
    return false;
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
        const debug = SparxDom.findQuestionTextDebug?.() || raw;
        failStreak = debug === lastFailRaw ? failStreak + 1 : 0;
        lastFailRaw = debug;

        sendStatus({
          running: true,
          completed,
          total: rounds,
          raw: debug,
          normalized: normalized || SparxSolver.normalize(debug),
          answer: null,
          message:
            failStreak >= 8
              ? `Stuck — hide panel (×), check both numbers are visible, then Scan`
              : `Can't solve "${debug}"${normalized ? ` → ${normalized}` : ""}`,
        });
        await sleep(failStreak >= 8 ? roundDelay : repeatDelay);
        continue;
      }

      failStreak = 0;
      lastFailRaw = "";

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

      lastQuestion = normalized;
      const method = await typeAnswer(answer);
      await sleep(120);
      await submitAnswer();

      const advanced = await waitForQuestionChange(normalized, Math.max(roundDelay, 900));
      completed += 1;
      sendStatus({
        running: true,
        completed,
        total: rounds,
        raw,
        normalized,
        answer,
        message: advanced
          ? `Submitted ${answer} via ${method} (${completed}/${rounds})`
          : `Submitted ${answer} via ${method} — waiting for next… (${completed}/${rounds})`,
      });

      if (!advanced) await sleep(roundDelay);
      else await sleep(Math.min(roundDelay, 400));
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
    const debug = SparxDom.findQuestionTextDebug?.() || raw;
    const { answer, normalized } = SparxSolver.solve(raw || debug);
    sendStatus({
      running,
      completed: 0,
      total: parseInt(panelUi?.roundsInput?.value, 10) || 25,
      raw: raw || debug,
      normalized,
      answer,
      message: answer
        ? `OK: ${normalized} = ${answer}`
        : raw
          ? `Found "${debug}" but can't solve — are both numbers on screen?`
          : "No question — hide panel (×) if it blocks the numbers",
    });
    return { raw: raw || debug, normalized, answer };
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

    root.classList.add("sparx-hidden");
    tab.classList.add("sparx-show");

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

    updatePanel({
      message: "Hidden by default (won't block question). Click Sparx Solver tab (bottom-left).",
    });

    let scanTimer;
    const observer = new MutationObserver(() => {
      if (running || root.classList.contains("sparx-hidden")) return;
      clearTimeout(scanTimer);
      scanTimer = setTimeout(() => {
        const raw = findQuestionText();
        if (!raw || !panelUi) return;
        const { answer, normalized } = SparxSolver.solve(raw);
        if (!answer) return;
        updatePanel({
          raw,
          normalized,
          answer,
          running: false,
          completed: 0,
          total: parseInt(panelUi.roundsInput.value, 10) || 25,
          message: `Detected: ${normalized} = ${answer}`,
        });
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
