/**
 * Math normalisation + solver (ported from desktop app, no OCR needed in-browser).
 */

/** Unambiguous symbol swaps — safe on any string. */
const SYMBOL_MAP = {
  "×": "*",
  "÷": "/",
  "−": "-",
  "–": "-",
  "—": "-",
  ":": "/",
};

/** Ambiguous OCR letter swaps — only when the string already looks numeric. */
const OCR_LETTER_MAP = {
  "?": "",
  X: "x",
  O: "0",
  I: "1",
  l: "1",
};

function hasOperator(text) {
  return /[+\-*/=]/.test(text);
}

function looksMostlyNumeric(text) {
  const cleaned = String(text || "").replace(/\s/g, "");
  if (!cleaned) return false;
  const mathish = cleaned.replace(/[^0-9+\-*/().=×÷xX?]/g, "");
  return mathish.length / cleaned.length >= 0.6 && /\d/.test(mathish);
}

function scoreSplit(left, right, op) {
  let score = 0;
  if (op === "*") score += 6;
  else if (op === "+") score += 4;
  if (left.length >= 1 && left.length <= 3 && right.length >= 1 && right.length <= 3) score += 10;
  if (left.length === 1 && right.length >= 2) score += 4;
  if (right.length === 1 && left.length >= 2) score += 4;
  score -= Math.abs(left.length - right.length);
  if (left.length === 1 && right.length > 2) score -= 6;
  if (right.length === 1 && left.length > 2) score -= 6;
  const li = parseInt(left, 10);
  const ri = parseInt(right, 10);
  // Times-table style operands
  if (li >= 1 && li <= 12 && ri >= 1 && ri <= 12) score += 8;
  if (li > 15 || ri > 15) score -= 8;
  return score;
}

function canEval(expr) {
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) return false;
  try {
    safeEval(expr);
    return true;
  } catch {
    return false;
  }
}

function safeEval(expr) {
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
    throw new Error("unsafe expression");
  }
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${expr});`)();
}

/**
 * Recover "912" → "9*12" style OCR misses.
 * Never split 1–2 digit strings — those are usually UI noise (scores, ids).
 */
function repairGluedDigits(text) {
  if (!/^\d+$/.test(text)) return text;
  if (text.length < 3 || text.length > 6) return text;

  let bestExpr = null;
  let bestScore = -1;

  for (let i = 1; i < text.length; i++) {
    const left = text.slice(0, i);
    const right = text.slice(i);
    if (left.length > 4 || right.length > 4) continue;
    // Avoid leading zeros in multi-digit operands
    if ((left.length > 1 && left.startsWith("0")) || (right.length > 1 && right.startsWith("0"))) {
      continue;
    }

    const li = parseInt(left, 10);
    const ri = parseInt(right, 10);
    // Scores like "100" must not become 10*0; zero is never a times-table operand
    if (li === 0 || ri === 0) continue;
    // Glued OCR is only for missing × (not scores reinvented as +/−)
    if (li < 1 || li > 12 || ri < 1 || ri > 12) continue;
    // "101" → 10*1 is score noise; keep 1*12 from "112"
    if (ri === 1) continue;

    const op = "*";
    const expr = `${left}${op}${right}`;
    if (!canEval(expr)) continue;
    const s = scoreSplit(left, right, op);
    if (s > bestScore) {
      bestScore = s;
      bestExpr = expr;
    }
  }

  // Require a confident split so random digit runs don't become fake questions
  return bestScore >= 18 ? bestExpr : text;
}

function normalize(raw) {
  let text = String(raw || "").trim();
  if (!text) return "";

  for (const [bad, good] of Object.entries(SYMBOL_MAP)) {
    text = text.split(bad).join(good);
  }

  if (looksMostlyNumeric(text)) {
    for (const [bad, good] of Object.entries(OCR_LETTER_MAP)) {
      text = text.split(bad).join(good);
    }
  }

  text = text.replace(/(\d)\s*[xX]\s*(\d)/g, "$1*$2");
  text = text.replace(/=\s*\?.*$/g, "");
  text = text.replace(/=.*$/, ""); // "12*7=?" leftovers → "12*7"

  if (!hasOperator(text)) {
    text = text.replace(/(\d+)\s+(\d+)/g, "$1*$2");
  }

  text = text.replace(/(\d)\s*[xX]\s*(\d)/g, "$1*$2");
  text = text.replace(/[^0-9+\-*/().=]/g, "");
  text = text.replace(/\s*([+\-*/=()])\s*/g, "$1");

  // 1–2 digit bare integers are UI noise (score/id). 3+ may be glued OCR like "912".
  if (/^\d{1,2}$/.test(text)) {
    return "";
  }

  if (!hasOperator(text)) {
    text = repairGluedDigits(text);
  }

  // Still a bare integer after repair → reject (unsplit noise)
  if (/^\d+$/.test(text) && !hasOperator(text)) {
    return "";
  }

  const opens = (text.match(/\(/g) || []).length;
  const closes = (text.match(/\)/g) || []).length;
  if (opens > closes) text += ")".repeat(opens - closes);

  return text.trim();
}

function formatResult(n) {
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(parseFloat(n.toFixed(6)));
}

function solve(raw) {
  const normalized = normalize(raw);
  if (!normalized) return { answer: null, normalized: "", type: "empty" };

  try {
    if (normalized.includes("=")) {
      const [lhs, rhs] = normalized.split("=", 2);
      if (!canEval(lhs) || !canEval(rhs)) {
        return { answer: null, normalized, type: "error" };
      }
      const l = safeEval(lhs);
      const r = safeEval(rhs);
      if (Math.abs(l - r) < 1e-9) {
        return { answer: formatResult(l), normalized, type: "equation" };
      }
      return { answer: null, normalized, type: "unsolvable" };
    }

    const result = safeEval(normalized);
    return {
      answer: formatResult(result),
      normalized,
      type: "expression",
    };
  } catch {
    return { answer: null, normalized, type: "error" };
  }
}

// Export for content script (same world) and Node tests
const SparxSolver = { normalize, solve, formatResult, repairGluedDigits };
if (typeof globalThis !== "undefined") {
  globalThis.SparxSolver = SparxSolver;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = SparxSolver;
}
