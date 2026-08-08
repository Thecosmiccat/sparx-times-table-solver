/**
 * Integration tests for Hundred Club DOM helpers (jsdom).
 * Run: node tests/sparx-dom.test.js
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function loadExtensionInto(dom) {
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.HTMLElement = window.HTMLElement;
  global.HTMLInputElement = window.HTMLInputElement;
  global.HTMLTextAreaElement = window.HTMLTextAreaElement;
  global.Node = window.Node;
  global.getComputedStyle = window.getComputedStyle.bind(window);

  // jsdom default computed style is sparse — stub readable sizes for visibility checks
  window.getComputedStyle = (el) => {
    const style = {
      display: "block",
      visibility: "visible",
      opacity: "1",
      fontSize: el.style.fontSize || "16px",
      cursor: el.tagName === "BUTTON" ? "pointer" : "default",
      getPropertyValue: () => "",
    };
    return style;
  };

  // Layout: give elements fake boxes so isVisible / keypad scoring work
  let y = 40;
  for (const el of window.document.querySelectorAll("body *")) {
    const tag = el.tagName;
    const text = (el.textContent || "").trim();
    const isKey = tag === "BUTTON";
    const isBanner = el.classList?.contains("banner") || /[×x*]/.test(text);
    const top = isBanner ? 40 : isKey ? 400 + (y++ % 4) * 80 : 200;
    const left = isKey ? 100 + (parseInt(text, 10) || 0) * 20 : 120;
    const width = isKey ? 72 : isBanner ? 280 : 40;
    const height = isKey ? 72 : isBanner ? 50 : 40;
    el.getBoundingClientRect = () => ({
      x: left,
      y: top,
      top,
      left,
      right: left + width,
      bottom: top + height,
      width,
      height,
      toJSON: () => ({}),
    });
  }

  window.innerHeight = 800;
  window.innerWidth = 1200;

  const solverCode = fs.readFileSync(path.join(__dirname, "../extension/solver.js"), "utf8");
  const domCode = fs.readFileSync(path.join(__dirname, "../extension/sparx-dom.js"), "utf8");
  window.eval(solverCode);
  window.eval(domCode);
  return window;
}

const html = fs.readFileSync(path.join(__dirname, "fixtures/hundred-club-mock.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://maths.sparx-learning.com/game" });
// Let inline mock script build keypad
const window = loadExtensionInto(dom);

console.log("Hundred Club mock detection");
const q = window.SparxDom.findQuestionText();
assert(!!q, "found a question");
assert(/12\*7|12\s*\*\s*7/.test(q.replace(/\s/g, "")), `question is 12*7 (got ${q})`);

const solved = window.SparxSolver.solve(q);
assert(solved.answer === "84", `answer is 84 (got ${solved.answer})`);

console.log("\nKeypad targeting");
const key8 = window.SparxDom.findKeypadKey("8");
const key4 = window.SparxDom.findKeypadKey("4");
const ok = window.SparxDom.findKeypadKey("ok");
assert(!!key8, "find digit 8 key");
assert(!!key4, "find digit 4 key");
assert(!!ok, "find OK key");
assert(key8?.tagName === "BUTTON", "digit key is a button");
assert(ok?.textContent.trim().toLowerCase() === "ok", "OK label");

console.log("\nAnswer entry via keypad clicks");
window.SparxDom.clickEl(key8);
window.SparxDom.clickEl(key4);
window.SparxDom.clickEl(ok);
assert(window.__mock.getQuestion() === "9 × 9 = ?", "advanced to next question after correct answer");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
