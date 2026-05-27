import test from "node:test";
import assert from "node:assert/strict";
import { parseKnowledgeText } from "../src/knowledge-base.js";

test("parses Greek knowledge entries with keywords, answer and actions", () => {
  const entries = parseKnowledgeText(
    `
# Εκτυπωτής
keywords: εκτυπωτής, printer, toner
actions:
- Ελέγξτε το χαρτί.
- Κάντε επανεκκίνηση.
answer:
Ο εκτυπωτής χρειάζεται βασικό έλεγχο.
---
# Login
λέξεις κλειδιά: σύνδεση, password
απάντηση:
Ελέγξτε τη γλώσσα πληκτρολογίου.
`,
    "sample.txt"
  );

  assert.equal(entries.length, 2);
  assert.equal(entries[0].title, "Εκτυπωτής");
  assert.deepEqual(entries[0].keywords, ["εκτυπωτής", "printer", "toner"]);
  assert.deepEqual(entries[0].actions, ["Ελέγξτε το χαρτί.", "Κάντε επανεκκίνηση."]);
  assert.equal(entries[1].answer, "Ελέγξτε τη γλώσσα πληκτρολογίου.");
});

test("ignores blocks without a usable answer or action", () => {
  const entries = parseKnowledgeText(
    `
# Μόνο τίτλος
keywords: κενό
`,
    "empty.txt"
  );

  assert.equal(entries.length, 0);
});

test("parses linked follow-up answers per step", () => {
  const entries = parseKnowledgeText(
    `
# Internet
keywords: internet
actions:
- Ελέγξτε μία εσωτερική εφαρμογή.
- Δοκιμάστε δεύτερη ιστοσελίδα.
followups:
- step=1 | keywords=εσωτερική εφαρμογή, medico | answer=Αν δεν ανοίγει ούτε εσωτερική εφαρμογή, το θέμα μοιάζει με ΦΙΛΙΠΠΟΣ.
- step=2 | keywords=δεύτερη ιστοσελίδα | answer=Αν δεν ανοίγει ούτε δεύτερη ιστοσελίδα, κρατήστε το μήνυμα σφάλματος. | actions=Σημειώστε URL, Δοκιμάστε Ctrl+F5
answer:
Βασικός έλεγχος Internet.
`,
    "followups.txt"
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0].followups.length, 2);
  assert.equal(entries[0].followups[0].step, 1);
  assert.deepEqual(entries[0].followups[0].keywords, ["εσωτερική εφαρμογή", "medico"]);
  assert.equal(entries[0].followups[1].actions[1], "Δοκιμάστε Ctrl+F5");
});

test("parses optional governance metadata and examples", () => {
  const entries = parseKnowledgeText(
    `
# Smart entry
keywords: medico, εφαρμογή ασθενών
priority: 5
owner: IT Helpdesk
domain: clinical-apps
category: access
risk level: normal
last reviewed: 2026-05-22
user safe: yes
admin only: no
examples: δεν ανοίγει η εφαρμογή ασθενών, medico login
negative examples: ακτινολογικό pacs
actions:
- Κλείστε και ανοίξτε ξανά μόνο την εφαρμογή.
answer:
Ασφαλής οδηγία για απλό χρήστη.
`,
    "metadata.txt"
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0].owner, "IT Helpdesk");
  assert.equal(entries[0].domain, "clinical-apps");
  assert.equal(entries[0].category, "access");
  assert.equal(entries[0].riskLevel, "normal");
  assert.equal(entries[0].lastReviewed, "2026-05-22");
  assert.equal(entries[0].userSafe, true);
  assert.equal(entries[0].adminOnly, false);
  assert.deepEqual(entries[0].examples, ["δεν ανοίγει η εφαρμογή ασθενών", "medico login"]);
  assert.deepEqual(entries[0].negativeExamples, ["ακτινολογικό pacs"]);
});
