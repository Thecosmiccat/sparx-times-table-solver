/**
 * Sparx Learning / Hundred Club DOM helpers (shadow DOM + split operand spans).
 */
const SparxDom = (() => {
  const MATH_LINE =
    /(\d+\s*[×x*÷/+\-−]\s*\d+|\d+\s*[×x*]\s*\d+|\d+\s+\d+|\d{2,4})/;
  const OP_CHAR = /^[×x*÷/+\-−]$/;
  const DIGIT_ONLY = /^\d{1,3}$/;
  const NOISE =
    /hundred|club|sparx|task|round|score|timer|level|package|submit|enter|next|previous|cookie|menu|settings/i;

  function isOurUi(el) {
    return !!el?.closest?.("#sparx-solver-root");
  }

  function isVisible(el) {
    if (!el || isOurUi(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    if (r.bottom < 0 || r.top > window.innerHeight) return false;
    if (r.right < 0 || r.left > window.innerWidth) return false;
    const s = window.getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
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
    yield root;
    for (const el of root.querySelectorAll?.("*") || []) {
      yield el;
      if (el.shadowRoot) yield* walkRoots(el.shadowRoot);
    }
  }

  function cleanLine(text) {
    return text
      .replace(/=\s*\?.*$/i, "")
      .replace(/\?/g, "")
      .replace(/[−]/g, "-")
      .replace(/×/g, "x")
      .trim();
  }

  function scoreCandidate(text, source) {
    if (!text || text.length < 2 || text.length > 40) return -1;
    if (NOISE.test(text)) return -1;
    if (!/\d/.test(text)) return -1;
    let score = 0;
    if (MATH_LINE.test(text)) score += 30;
    if (/[×x*÷/+\-]/.test(text)) score += 20;
    if (source === "tokens") score += 25;
    if (source === "large") score += 15;
    if (source === "near-input") score += 20;
    if (source === "aria") score += 18;
    if (/^\d+\s*[x*]\s*\d+$/i.test(text.replace(/\s/g, ""))) score += 15;
    return score;
  }

  function findAnswerInput() {
    const selectors = [
      'input[type="text"]:not([disabled])',
      'input[type="number"]:not([disabled])',
      'input[inputmode="numeric"]:not([disabled])',
      'input[type="tel"]:not([disabled])',
      'input[class*="answer" i]:not([disabled])',
      'input[class*="Answer" i]:not([disabled])',
      'input[data-testid*="answer" i]:not([disabled])',
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

  /** Hundred Club: "12" and "12" in separate large spans, × may be CSS-only */
  function findFromOperandTokens(input) {
    const inputRect = input?.getBoundingClientRect();
    const items = [];

    for (const el of walkRoots(document.body)) {
      if (!isVisible(el)) continue;
      const direct = getDirectText(el);
      if (!direct) continue;

      const r = el.getBoundingClientRect();
      if (DIGIT_ONLY.test(direct)) {
        items.push({ kind: "n", text: direct, x: r.left + r.width / 2, y: r.top + r.height / 2, fs: fontSize(el) });
      } else if (OP_CHAR.test(direct)) {
        const op = direct.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
        items.push({ kind: "o", text: op, x: r.left + r.width / 2, y: r.top + r.height / 2, fs: fontSize(el) });
      }
    }

    if (items.length < 2) return "";

    const rows = clusterByY(items, 40);
    let best = "";
    let bestScore = -1;

    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      const nums = row.filter((i) => i.kind === "n");
      const ops = row.filter((i) => i.kind === "o");
      let expr = "";

      if (nums.length >= 2) {
        if (ops.length) {
          expr = row.map((i) => i.text).join("");
        } else {
          expr = `${nums[0].text}*${nums[1].text}`;
        }
      } else if (nums.length === 1 && row.length >= 2) {
        continue;
      } else {
        continue;
      }

      let s = scoreCandidate(expr, "tokens") + Math.min(...nums.map((n) => n.fs));
      if (inputRect) {
        const rowY = nums[0].y;
        if (rowY < inputRect.top) s += 15;
        const dy = Math.abs(rowY - inputRect.top);
        s += Math.max(0, 30 - dy / 10);
      }
      if (s > bestScore) {
        bestScore = s;
        best = expr;
      }
    }

    return cleanLine(best);
  }

  function fontSize(el) {
    return parseFloat(window.getComputedStyle(el).fontSize) || 12;
  }

  function clusterByY(items, threshold) {
    const rows = [];
    const sorted = [...items].sort((a, b) => a.y - b.y);
    for (const item of sorted) {
      let row = rows.find((r) => Math.abs(r[0].y - item.y) <= threshold);
      if (!row) {
        row = [];
        rows.push(row);
      }
      row.push(item);
    }
    return rows;
  }

  function findFromLargeText() {
    let best = "";
    let bestScore = -1;

    for (const el of walkRoots(document.body)) {
      if (!isVisible(el)) continue;
      const fs = fontSize(el);
      if (fs < 22) continue;
      const t = cleanLine((el.innerText || el.textContent || "").trim());
      if (t.length > 50) continue;
      const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
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

    for (let d = 0; node && d < 14; d++) {
      const t = (node.innerText || "").trim();
      const lines = t.split("\n").map((l) => cleanLine(l)).filter(Boolean);
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

  function findFromAria() {
    let best = "";
    let bestScore = -1;

    for (const el of walkRoots(document.body)) {
      if (!isVisible(el)) continue;
      const label = el.getAttribute?.("aria-label") || "";
      const labelled = el.getAttribute?.("aria-labelledby");
      let extra = label;
      if (labelled) {
        const ref = document.getElementById(labelled);
        if (ref) extra += " " + (ref.textContent || "");
      }
      const t = cleanLine(extra);
      const s = scoreCandidate(t, "aria");
      if (s > bestScore) {
        bestScore = s;
        best = t;
      }
    }
    return best;
  }

  function findFromBodyScan() {
    const matches =
      document.body?.innerText?.match(/\d+\s*[×x*÷/+\-−]\s*\d+|\d+\s+\d+/g) || [];
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

  function findFromSvgText() {
    let best = "";
    let bestScore = -1;
    for (const el of document.querySelectorAll("svg text, svg tspan")) {
      if (!isVisible(el)) continue;
      const t = cleanLine(el.textContent || "");
      const s = scoreCandidate(t, "svg");
      if (s > bestScore) {
        bestScore = s;
        best = t;
      }
    }
    return best;
  }

  function findQuestionText() {
    const input = findAnswerInput();
    const candidates = [
      findFromOperandTokens(input),
      findNearInput(input),
      findFromLargeText(),
      findFromAria(),
      findFromSvgText(),
      findFromBodyScan(),
    ].filter(Boolean);

    let best = "";
    let bestScore = -1;
    for (const c of candidates) {
      const s = scoreCandidate(c, "merge");
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    return best;
  }

  return {
    findQuestionText,
    findAnswerInput,
    isVisible,
    isOurUi,
  };
})();

if (typeof globalThis !== "undefined") {
  globalThis.SparxDom = SparxDom;
}
