/**
 * Runs on Sparx Maths pages — reads the question from the DOM and submits answers.
 */
(() => {
  const MATH_PATTERN = /(\d+\s*[×x*÷/+\-]\s*\d+|\d+\s+\d+|\d{2,4})/;

  let running = false;
  let stopRequested = false;
  let lastQuestion = "";

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function sendStatus(payload) {
    chrome.runtime.sendMessage({ type: "status", ...payload }).catch(() => {});
  }

  /** Find the answer input Sparx uses. */
  function findAnswerInput() {
    const candidates = [
      ...document.querySelectorAll('input[type="text"]:not([disabled])'),
      ...document.querySelectorAll('input[type="number"]:not([disabled])'),
      ...document.querySelectorAll('input[inputmode="numeric"]:not([disabled])'),
      ...document.querySelectorAll('input[type="tel"]:not([disabled])'),
      ...document.querySelectorAll("textarea:not([disabled])"),
    ];

    const visible = candidates.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 10 && r.bottom > 0 && r.top < window.innerHeight;
    });

    if (!visible.length) return null;

    const focused = document.activeElement;
    if (focused && visible.includes(focused)) return focused;

    return visible[visible.length - 1];
  }

  /** Pull question text from the page near the input or from prominent elements. */
  function findQuestionText() {
    const input = findAnswerInput();
    const texts = [];

    const selectors = [
      "[class*='question']",
      "[class*='Question']",
      "[class*='task']",
      "[class*='Task']",
      "[class*='prompt']",
      "[data-testid*='question']",
      "h1",
      "h2",
      "h3",
      "p",
      "span",
      "div",
    ];

    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (input && (el === input || el.contains(input))) continue;
        const t = (el.innerText || el.textContent || "").trim();
        if (t.length > 1 && t.length < 80 && MATH_PATTERN.test(t)) {
          texts.push(t.split("\n")[0].trim());
        }
      }
    }

    if (input) {
      let node = input.parentElement;
      for (let depth = 0; node && depth < 8; depth++) {
        const t = (node.innerText || "").trim();
        const lines = t
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => MATH_PATTERN.test(l));
        texts.push(...lines);
        node = node.parentElement;
      }
    }

    const bodyMatch = document.body.innerText.match(
      /[\d]+\s*[×x*÷/]\s*[\d]+|[\d]+\s*[\d]+/g
    );
    if (bodyMatch) texts.push(...bodyMatch);

    const unique = [...new Set(texts)];
    unique.sort((a, b) => b.length - a.length);

    for (const t of unique) {
      const cleaned = t.replace(/=\s*\?.*$/, "").replace(/\?/g, "").trim();
      if (cleaned.length >= 2) return cleaned;
    }

    return "";
  }

  function setInputValue(input, value) {
    input.focus();
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) {
      desc.set.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function submitAnswer(input) {
    const form = input.closest("form");
    if (form) {
      form.requestSubmit?.();
      if (!form.requestSubmit) {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    }

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true })
    );
    input.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true })
    );

    const buttons = [
      ...document.querySelectorAll("button"),
      ...document.querySelectorAll('[role="button"]'),
    ];
    for (const btn of buttons) {
      const label = (btn.innerText || btn.getAttribute("aria-label") || "").toLowerCase();
      if (/submit|check|enter|next|continue/.test(label) && !btn.disabled) {
        btn.click();
        return;
      }
    }
  }

  async function runSession({ rounds, roundDelay, repeatDelay }) {
    running = true;
    stopRequested = false;
    lastQuestion = "";
    let completed = 0;

    sendStatus({ running: true, completed, total: rounds, message: "Starting…" });

    while (completed < rounds && !stopRequested) {
      const raw = findQuestionText();
      const { answer, normalized, type } = SparxSolver.solve(raw);

      sendStatus({
        running: true,
        completed,
        total: rounds,
        raw,
        normalized,
        answer,
        message: raw
          ? answer
            ? `Solved: ${normalized} = ${answer}`
            : `Could not solve: ${raw}`
          : "No question found on page — open a Sparx question.",
      });

      if (!raw || !answer) {
        await sleep(repeatDelay);
        continue;
      }

      if (normalized === lastQuestion) {
        sendStatus({
          running: true,
          completed,
          total: rounds,
          raw,
          normalized,
          answer,
          message: "Waiting for next question…",
        });
        await sleep(repeatDelay);
        continue;
      }

      const input = findAnswerInput();
      if (!input) {
        sendStatus({
          running: true,
          completed,
          total: rounds,
          message: "No answer box found — click in the Sparx answer field.",
        });
        await sleep(repeatDelay);
        continue;
      }

      lastQuestion = normalized;
      setInputValue(input, answer);
      await sleep(150);
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
      message: stopRequested ? "Stopped." : "Session complete.",
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "start") {
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

    if (msg.action === "stop") {
      stopRequested = true;
      sendResponse({ ok: true });
      return true;
    }

    if (msg.action === "ping") {
      sendResponse({ ok: true, running });
      return true;
    }

    if (msg.action === "scan") {
      const raw = findQuestionText();
      const { answer, normalized } = SparxSolver.solve(raw);
      sendResponse({ ok: true, raw, normalized, answer, running });
      return true;
    }

    return false;
  });
})();
