import test from "node:test";
import assert from "node:assert/strict";
import { analyzeKnowledgeBase } from "../src/knowledge-audit.js";
import { parseKnowledgeText } from "../src/knowledge-base.js";

test("detects duplicate keywords and broad high-priority terms", () => {
  const entries = parseKnowledgeText(
    `
# Γενικό πρόβλημα
keywords: πρόβλημα, πρόσβαση
priority: 5
actions:
- Περιγράψτε το πρόβλημα.
answer:
Γενική οδηγία.
---
# Ειδικό πρόβλημα πρόσβασης
keywords: πρόσβαση, medico login
priority: 4
owner: IT
last reviewed: 2026-05-22
actions:
- Ελέγξτε την εφαρμογή.
answer:
Ειδική οδηγία.
`,
    "audit.txt"
  );

  const report = analyzeKnowledgeBase(entries, { now: "2026-05-22T09:00:00.000Z" });

  assert.equal(report.totals.entries, 2);
  assert.ok(report.issues.some((issue) => issue.type === "duplicate_keyword"));
  assert.ok(report.issues.some((issue) => issue.type === "broad_high_priority_keyword"));
  assert.ok(report.score < 100);
});

test("flags user-unsafe knowledge entries", () => {
  const entries = parseKnowledgeText(
    `
# Admin-only οδηγία
keywords: service restart
priority: 4
user safe: no
admin only: yes
actions:
- Μην εμφανίζεται σε απλό χρήστη.
answer:
Admin περιεχόμενο.
`,
    "unsafe.txt"
  );

  const report = analyzeKnowledgeBase(entries);

  assert.ok(report.issues.some((issue) => issue.type === "unsafe_entry_flag"));
});
