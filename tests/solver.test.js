/**
 * Lightweight Node tests for the maths solver (no Chrome APIs).
 * Run: node tests/solver.test.js
 */
const path = require("path");
const solver = require(path.join(__dirname, "..", "extension", "solver.js"));

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  const ok = Object.is(actual, expected) || actual === expected;
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

function solveAnswer(raw) {
  return solver.solve(raw).answer;
}

console.log("normalize / Hundred Club banners");
assertEqual(solver.normalize("12 × 7 = ?"), "12*7", "unicode multiply with =?");
assertEqual(solver.normalize("12 x 7"), "12*7", "letter x multiply");
assertEqual(solver.normalize("8÷2"), "8/2", "division");
assertEqual(solver.normalize("5+3"), "5+3", "addition");
assertEqual(solver.normalize("12"), "", "lone small int filtered as noise");

console.log("\nsolve answers");
assertEqual(solveAnswer("12 × 7 = ?"), "84", "12×7");
assertEqual(solveAnswer("9 x 9"), "81", "9x9");
assertEqual(solveAnswer("11*12"), "132", "11*12");
assertEqual(solveAnswer("8÷2"), "4", "8÷2");
assertEqual(solveAnswer("15-7"), "8", "15-7");
assertEqual(solveAnswer("3+4"), "7", "3+4");
assertEqual(solveAnswer(""), null, "empty");
assertEqual(solveAnswer("hello"), null, "non-math");

console.log("\nglued digit repair (OCR-ish)");
assertEqual(solveAnswer("67"), null, "2-digit alone is noise, not 6*7");
assertEqual(solveAnswer("912"), "108", "9*12 preferred over noise");
assertEqual(solveAnswer("6 7"), "42", "spaced operands become multiply");
assertEqual(solveAnswer("100"), null, "score 100 is not 10*0");
assertEqual(solveAnswer("101"), null, "score 101 is not 10*1");
assertEqual(solveAnswer("112"), "12", "1*12 glued OCR still works");
assertEqual(solveAnswer("0 x 5"), "0", "explicit 0×5 still solves");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
