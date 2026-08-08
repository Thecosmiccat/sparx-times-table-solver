/**
 * Sparx Learning / Hundred Club DOM helpers (shadow DOM + split operand spans).
 */
const SparxDom = (() => {
  const OP_CHAR = /^[×x*÷/+\-−]$/;
  const DIGIT_ONLY = /^\d{1,3}$/;
  const SINGLE_DIGIT = /^\d$/;
  const NOISE =
    /hundred|club|sparx|task|round|score|timer|level|package|submit|enter|next|previous|cookie|menu|settings|package|student|games/i;

  function isOurUi(el) {
    return !!el?.closest?.("#sparx-solver-root, #sparx-solver-tab");
  }

  function isVisible(el) {
    if (!el || isOurUi(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    if (r.bottom < 0 || r.top > window.innerHeight) return false;
    if (r.right < 0 || r.left > window.innerWidth) return false;
    const s = window.getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    return true;
  }

  function getDirectText(el) {
    if (!el) return "";
    if (el.children.length === 0) return (el.textContent || "").trim();
    const nodes = [...el.childNodes];
    if (nodes.length === 1 && nodes[0].nodeType === Node.TEXT_NODE) {
      return (nodes[0].textContent || "").trim();
    }
    return "";
  }

  function* walkRoots(root) {
    if (!root) return;
    yield root;
    for (const el of root.querySelectorAll?.("*") || []) {
      yield el;
      if (el.shadowRoot) yield* walkRoots(el.shadowRoot);
    }
  }

  /** Normalise to solver-friendly expression (always use * not letter x). */
  function cleanLine(text) {
    return String(text || "")
      .replace(/=\s*\?.*$/i, "")
      .replace(/\?/g, "")
      .replace(/[−–—]/g, "-")
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/(\d)\s*x\s*(\d)/gi, "$1*$2")
      .replace(/\s*([*/+\-])\s*/g, "$1")
      .trim();
  }

  function isSolvable(text) {
    if (!text || NOISE.test(text)) return false;
    if (typeof SparxSolver === "undefined") return true;
    const { answer, normalized } = SparxSolver.solve(text);
    return !!(answer && normalized);
  }

  function scoreCandidate(text, source) {
    if (!text || text.length < 2 || text.length > 40) return -1;
    if (NOISE.test(text)) return -1;
    if (!/\d/.test(text)) return -1;
    if (!isSolvable(text)) return -1;

    let score = 0;
    if (/[*/+\-]/.test(text)) score += 25;
    if (/^\d{1,2}\s*[*/+\-]\s*\d{1,2}$/.test(text.replace(/\s/g, ""))) score += 30;
    if (source === "banner") score += 60;
    if (source === "tokens") score += 35;
    if (source === "large") score += 20;
    if (source === "near-input") score += 22;
    if (source === "aria") score += 15;
    if (source === "body") score += 5;
    return score;
  }

  function fontSize(el) {
    return parseFloat(window.getComputedStyle(el).fontSize) || 12;
  }

  const QUESTION_RE =
    /(\d{1,2}\s*[×x*÷/+\-−]\s*\d{1,2})\s*(?:=\s*\??)?/;

  /** Hundred Club: "12 × 7 = ?" in the top question box. */
  function findFromQuestionBanner() {
    let best = "";
    let bestScore = -1;

    for (const el of walkRoots(document.body)) {
      if (!isVisible(el)) continue;
      const raw = (el.innerText || el.textContent || "").trim();
      if (!raw || raw.length > 50) continue;

      const m = raw.match(QUESTION_RE);
      if (!m) continue;

      const expr = cleanLine(m[1]);
      if (!isSolvable(expr)) continue;

      const fs = fontSize(el);
      const r = el.getBoundingClientRect();
      let s = scoreCandidate(expr, "banner") + fs;
      if (r.top < window.innerHeight * 0.5) s += 50;
      if (raw.length <= 20) s += 20;

      if (s > bestScore) {
        bestScore = s;
        best = expr;
      }
    }
    return best;
  }

  /** Sparx uses "..." answer box + keyboard — not always a real <input>. */
  function findAnswerFocusTarget() {
    const input = findAnswerInput();
    if (input) return input;

    for (const el of walkRoots(document.body)) {
      if (!isVisible(el)) continue;
      const t = (el.innerText || el.textContent || "").trim();
      if (t === "..." || /^\.{2,}$/.test(t)) return el;
    }

    const game =
      document.querySelector("[class*='Hundred' i], [class*='hundred' i], [class*='game' i], main") ||
      document.body;
    return game;
  }

  function findAnswerInput() {
    const selectors = [
      'input[type="text"]:not([disabled])',
      'input[type="number"]:not([disabled])',
      'input[inputmode="numeric"]:not([disabled])',
      'input[type="tel"]:not([disabled])',
      'input[class*="answer" i]:not([disabled])',
      "textarea:not([disabled])",
      '[contenteditable="true"]',
      '[role="textbox"]',
    ];

    const candidates = [];
    for (const sel of selectors) {
      for (const root of [document, ...getShadowRoots()]) {
        for (const el of root.querySelectorAll?.(sel) || []) {
          if (isVisible(el)) candidates.push(el);
        }
      }
    }

    if (!candidates.length) return null;

    const focused = document.activeElement;
    if (focused && candidates.includes(focused)) return focused;

    candidates.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    });
    return candidates[0];
  }

  function getShadowRoots() {
    const roots = [];
    for (const el of document.querySelectorAll("*")) {
      if (el.shadowRoot) roots.push(el.shadowRoot);
    }
    return roots;
  }

  /**
   * Hundred Club shows a grid of 1–12 plus the question as two LARGE numbers.
   * Pick the pair of largest numbers on the same row, above the answer area.
   */
  function findFromOperandTokens(input) {
    const inputRect = input?.getBoundingClientRect();
    const items = [];

    for (const el of walkRoots(document.body)) {
      if (!isVisible(el)) continue;
      const direct = getDirectText(el);
      if (!direct) continue;

      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const fs = fontSize(el);

      if (DIGIT_ONLY.test(direct)) {
        items.push({ kind: "n", text: direct, x: cx, y: cy, fs });
      } else if (OP_CHAR.test(direct)) {
        const op = direct.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
        items.push({ kind: "o", text: op, x: cx, y: cy, fs });
      }
    }

    const nums = items.filter((i) => i.kind === "n");
    if (nums.length < 2) return "";

    const maxFs = Math.max(...nums.map((n) => n.fs));
    const bigNums = nums.filter((n) => n.fs >= maxFs * 0.88);
    if (bigNums.length < 2) return "";

    const ops = items.filter((i) => i.kind === "o");
    let bestExpr = "";
    let bestScore = -1;

    for (let i = 0; i < bigNums.length; i++) {
      for (let j = i + 1; j < bigNums.length; j++) {
        const a = bigNums[i];
        const b = bigNums[j];
        const dy = Math.abs(a.y - b.y);
        if (dy > 40) continue;

        const dx = Math.abs(a.x - b.x);
        if (dx < 20 || dx > 600) continue;

        const left = a.x < b.x ? a : b;
        const right = a.x < b.x ? b : a;

        const betweenOp = ops.find(
          (o) => o.x > left.x && o.x < right.x && Math.abs(o.y - left.y) < 45
        );

        const expr = betweenOp
          ? `${left.text}${betweenOp.text}${right.text}`
          : `${left.text}*${right.text}`;

        if (!isSolvable(expr)) continue;

        let s = left.fs + right.fs + 50;
        const midY = (left.y + right.y) / 2;
        if (inputRect && midY < inputRect.top) s += 25;
        if (inputRect) s += Math.max(0, 40 - Math.abs(midY - inputRect.top) / 15);
        s += Math.max(0, 30 - Math.abs(midY - window.innerHeight * 0.35) / 10);

        if (s > bestScore) {
          bestScore = s;
          bestExpr = expr;
        }
      }
    }

    return cleanLine(bestExpr);
  }

  function findFromLargeText() {
    let best = "";
    let bestScore = -1;

    for (const el of walkRoots(document.body)) {
      if (!isVisible(el)) continue;
      const fs = fontSize(el);
      if (fs < 26) continue;

      const t = cleanLine((el.innerText || el.textContent || "").trim());
      if (!t || t.length > 30) continue;

      const lines = t.split("\n").map((l) => cleanLine(l)).filter(Boolean);
      for (const line of lines) {
        const s = scoreCandidate(line, "large") + fs;
        if (s > bestScore) {
          bestScore = s;
          best = line;
        }
      }
    }
    return best;
  }

  function findNearInput(input) {
    if (!input) return "";
    let node = input.parentElement;
    let best = "";
    let bestScore = -1;

    for (let d = 0; node && d < 12; d++) {
      const lines = (node.innerText || "")
        .split("\n")
        .map((l) => cleanLine(l))
        .filter(Boolean);
      for (const line of lines) {
        const s = scoreCandidate(line, "near-input");
        if (s > bestScore) {
          bestScore = s;
          best = line;
        }
      }
      node = node.parentElement;
    }
    return best;
  }

  function findFromBodyScan() {
    const matches =
      document.body?.innerText?.match(/\d{1,2}\s*[×x*÷/+\-−]\s*\d{1,2}/g) || [];
    let best = "";
    let bestScore = -1;
    for (const m of matches) {
      const t = cleanLine(m);
      const s = scoreCandidate(t, "body");
      if (s > bestScore) {
        bestScore = s;
        best = t;
      }
    }
    return best;
  }

  function findQuestionText() {
    const input = findAnswerFocusTarget();
    const candidates = [
      { text: findFromQuestionBanner(), source: "banner" },
      { text: findFromLargeText(), source: "large" },
      { text: findFromOperandTokens(input), source: "tokens" },
      { text: findNearInput(input), source: "near-input" },
      { text: findFromBodyScan(), source: "body" },
    ].filter((c) => c.text);

    let best = "";
    let bestScore = -1;
    for (const c of candidates) {
      const s = scoreCandidate(c.text, c.source);
      if (s > bestScore) {
        bestScore = s;
        best = c.text;
      }
    }
    return best;
  }

  /** For UI: raw text even if unsolvable (debug). */
  function findQuestionTextDebug() {
    const banner = findFromQuestionBanner();
    if (banner) return banner;
    const input = findAnswerFocusTarget();
    const parts = [
      findFromLargeText(),
      findFromOperandTokens(input),
      findFromBodyScan(),
    ].filter(Boolean);
    return parts[0] || "";
  }

  function isClickable(el) {
    if (!el || isOurUi(el)) return false;
    const tag = el.tagName;
    if (tag === "BUTTON" || tag === "A") return true;
    if (el.getAttribute?.("role") === "button") return true;
    if (typeof el.onclick === "function") return true;
    const s = window.getComputedStyle(el);
    if (s.cursor === "pointer") return true;
    // Many Sparx keypad keys are styled divs
    if (tag === "DIV" || tag === "SPAN") {
      const r = el.getBoundingClientRect();
      if (r.width >= 28 && r.width <= 120 && r.height >= 28 && r.height <= 120) return true;
    }
    return false;
  }

  /**
   * Find on-screen keypad key (digit or "ok"/"enter"/"✓").
   * Prefers bottom-of-screen controls so we don't hit the 1–12 practice grid.
   */
  function findKeypadKey(label) {
    const want = String(label).trim().toLowerCase();
    const aliases =
      want === "ok" || want === "enter"
        ? ["ok", "enter", "✓", "✔", "➜", "→", "go"]
        : [want];

    const matches = [];
    for (const el of walkRoots(document.body)) {
      if (!isVisible(el) || !isClickable(el)) continue;
      const t = (getDirectText(el) || (el.innerText || "").trim()).toLowerCase();
      if (!aliases.includes(t)) continue;

      // Skip large multi-line containers
      if ((el.innerText || "").trim().includes("\n")) continue;

      const r = el.getBoundingClientRect();
      let score = 0;
      // Prefer bottom half (keypad lives under the question)
      if (r.top > window.innerHeight * 0.45) score += 40;
      if (r.top > window.innerHeight * 0.55) score += 20;
      // Digit keys are roughly square / compact
      if (SINGLE_DIGIT.test(want) && Math.abs(r.width - r.height) < 30) score += 15;
      if (el.tagName === "BUTTON") score += 10;
      score += Math.min(r.width, 80) / 10;
      matches.push({ el, score });
    }

    matches.sort((a, b) => b.score - a.score);
    return matches[0]?.el || null;
  }

  function clickEl(el) {
    if (!el) return false;
    const mouse = { bubbles: true, cancelable: true, view: window, button: 0 };
    // Press sequence helps frameworks that listen to pointer/mouse down;
    // finish with a single .click() so the click handler only runs once.
    try {
      if (typeof PointerEvent === "function") {
        el.dispatchEvent(new PointerEvent("pointerdown", mouse));
      }
    } catch {
      /* jsdom / older engines */
    }
    el.dispatchEvent(new MouseEvent("mousedown", mouse));
    try {
      if (typeof PointerEvent === "function") {
        el.dispatchEvent(new PointerEvent("pointerup", mouse));
      }
    } catch {
      /* ignore */
    }
    el.dispatchEvent(new MouseEvent("mouseup", mouse));
    if (typeof el.click === "function") el.click();
    else el.dispatchEvent(new MouseEvent("click", mouse));
    return true;
  }

  /** True when page looks like Hundred Club (keypad / "..." answer, no real input). */
  function looksLikeHundredClub() {
    if (findAnswerInput()) return false;
    if (findKeypadKey("ok") || findKeypadKey("1")) return true;
    for (const el of walkRoots(document.body)) {
      if (!isVisible(el)) continue;
      const t = (el.innerText || "").trim();
      if (t === "..." || /^\.{2,}$/.test(t)) return true;
    }
    return false;
  }

  return {
    findQuestionText,
    findQuestionTextDebug,
    findAnswerInput,
    findAnswerFocusTarget,
    findKeypadKey,
    clickEl,
    looksLikeHundredClub,
    isSolvable,
    cleanLine,
    isVisible,
    isOurUi,
  };
})();

if (typeof globalThis !== "undefined") {
  globalThis.SparxDom = SparxDom;
}
