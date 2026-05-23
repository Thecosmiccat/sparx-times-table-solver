/**
 * Math normalisation + solver (ported from desktop app, no OCR needed in-browser).
 */
const OCR_MAP = {
  "×": "*",
  "÷": "/",
  ":": "/",
  "?": "x",
  X: "x",
  O: "0",
  I: "1",
  l: "1",
};

function hasOperator(text) {
  return /[+\-*/=]/.test(text);
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

function repairGluedDigits(text) {
  if (!/^\d+$/.test(text)) return text;

  if (text.length === 2) {
    const expr = `${text[0]}*${text[1]}`;
    return canEval(expr) ? expr : text;
  }

  if (text.length < 3) return text;

  let bestExpr = null;
  let bestScore = -1;

  for (let i = 1; i < text.length; i++) {
    const left = text.slice(0, i);
    const right = text.slice(i);
    if (left.length > 4 || right.length > 4) continue;

    for (const op of ["*", "+", "-"]) {
      if (op === "-" && parseInt(left, 10) < parseInt(right, 10)) continue;
      const expr = `${left}${op}${right}`;
      if (!canEval(expr)) continue;
      const s = scoreSplit(left, right, op);
      if (s > bestScore) {
        bestScore = s;
        bestExpr = expr;
      }
    }
  }

  return bestExpr ?? text;
}

function normalize(raw) {
  let text = String(raw || "").trim();
  for (const [bad, good] of Object.entries(OCR_MAP)) {
    text = text.split(bad).join(good);
  }

  text = text.replace(/(\d)\s*x\s*(\d)/gi, "$1*$2");

  if (!hasOperator(text)) {
    text = text.replace(/(\d+)\s+(\d+)/g, "$1*$2");
  }

  text = text.replace(/[^0-9+\-*/().=x]/gi, "");
  text = text.replace(/\s*([+\-*/=()])\s*/g, "$1");

  if (!hasOperator(text)) {
    text = repairGluedDigits(text);
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

// Export for content script (same world)
if (typeof globalThis !== "undefined") {
  globalThis.SparxSolver = { normalize, solve };
}
