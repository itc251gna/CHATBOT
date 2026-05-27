import test from "node:test";
import assert from "node:assert/strict";
import { createChatEngine } from "../src/chat-engine.js";
import { parseKnowledgeText } from "../src/knowledge-base.js";

const entries = parseKnowledgeText(
  `
# Εκτυπωτής δεν τυπώνει
keywords: εκτυπωτής, εκτυπωτη, printer, δεν τυπώνει
actions:
- Ελέγξτε το χαρτί.
answer:
Ξεκινήστε από τον βασικό έλεγχο του εκτυπωτή.
---
# Αδυναμία σύνδεσης χρήστη
keywords: login, σύνδεση, κωδικός, password, χρήστης, λογαριασμός
actions:
- Ελέγξτε το Caps Lock.
answer:
Ελέγξτε πρώτα τα στοιχεία σύνδεσης.
`,
  "test.txt"
);

test("matches a user message to the best keyword entry", () => {
  const engine = createChatEngine(entries);
  const response = engine.answer("Ο εκτυπωτής στο γραφείο δεν τυπώνει");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Εκτυπωτής δεν τυπώνει");
  assert.ok(response.answer.includes("εκτυπωτή"));
  assert.equal(response.actions[0], "Ελέγξτε το χαρτί.");
  assert.ok(response.actions.some((action) => action.includes("τι αποτέλεσμα πήρατε")));
  assert.equal(response.escalationDelayed, true);
});

test("returns help topics for a broad help question", () => {
  const engine = createChatEngine(entries);
  const response = engine.answer("τι μπορώ να κάνω;");

  assert.equal(response.type, "help");
  assert.ok(response.suggestions.length > 0);
});

test("understands account-related shorthand", () => {
  const engine = createChatEngine(entries);
  const response = engine.answer("χρηστης");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Αδυναμία σύνδεσης χρήστη");
});

test("returns a fallback when there is no reliable match", () => {
  const engine = createChatEngine(entries);
  const response = engine.answer("χρειάζομαι αλλαγή φωτισμού");

  assert.equal(response.type, "fallback");
  assert.ok(!response.answer.includes("αίτημα"));
  assert.ok(!response.ticketPayload);
});

test("does not include ticket data for matched problems", () => {
  const engine = createChatEngine(entries);
  const response = engine.answer("Ο εκτυπωτής στο γραφείο δεν τυπώνει IP 10.4.5.6");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Εκτυπωτής δεν τυπώνει");
  assert.ok(!response.ticketDraft);
  assert.ok(!response.ticketPayload);
  assert.ok(!response.answer.includes("αίτημα"));
  assert.ok(!response.actions.join(" ").includes("ticket"));
});

test("continues conversation without carrying ticket fields", () => {
  const engine = createChatEngine(entries);
  const first = engine.answer("Ο εκτυπωτής δεν τυπώνει IP 10.4.5.6");
  const next = engine.answer("κόλλησα στο βήμα 1, ονοματεπώνυμο: Γιάννης Παπαδόπουλος, τμήμα: ΤΕΠ", {
    conversationState: first.conversationState
  });

  assert.equal(next.type, "followup");
  assert.ok(!next.ticketDraft);
  assert.ok(!next.ticketPayload);
});

test("does not expose clinical identifiers as ticket data from chat", () => {
  const clinicalEntries = parseKnowledgeText(
    `
# Medico παραγγελία ασθενή
keywords: medico, εφαρμογή ασθενών, παραγγελία, ασθενής
actions:
- Ελέγξτε αν ανοίγει η καρτέλα.
answer:
Ελέγξτε πρώτα την εφαρμογή ασθενών.
`,
    "clinical.txt"
  );
  const engine = createChatEngine(clinicalEntries);
  const response = engine.answer("στο medico δεν φαίνεται η παραγγελία για ΑΜΚΑ 01010112345");

  assert.equal(response.type, "match");
  assert.ok(!response.ticketDraft);
  assert.ok(!response.ticketPayload);
});

test("does not switch to ticket collection after repeated attempts", () => {
  const engine = createChatEngine(entries);
  const response = engine.answer("χρειάζομαι αλλαγή φωτισμού", { interactionCount: 3 });

  assert.equal(response.type, "fallback");
  assert.ok(!response.answer.includes("αίτημα"));
  assert.ok(!response.ticketDraft);
  assert.ok(!response.ticketPayload);
});

test("explicit ticket text in chat still returns only normal guidance", () => {
  const engine = createChatEngine(entries);
  const response = engine.answer("θέλω να ανοίξει ticket για τον εκτυπωτή", { interactionCount: 1 });

  assert.equal(response.type, "match");
  assert.equal(response.title, "Εκτυπωτής δεν τυπώνει");
  assert.ok(!response.ticketDraft);
  assert.ok(!response.ticketPayload);
});

test("continues the active topic when the user is stuck on a step", () => {
  const guidedEntries = parseKnowledgeText(
    `
# Internet
keywords: internet, ιστοσελίδα
actions:
- Ελέγξτε αν ανοίγει εσωτερική εφαρμογή.
- Δοκιμάστε δεύτερη ιστοσελίδα.
followups:
- step=2 | keywords=δεύτερη ιστοσελίδα | answer=Αν κολλήσατε στη δεύτερη ιστοσελίδα, πείτε μου αν ανοίγει άλλη εξωτερική σελίδα. | actions=Γράψτε URL, Κρατήστε μήνυμα σφάλματος
answer:
Ελέγχουμε πρώτα αν το θέμα αφορά μόνο μία ιστοσελίδα.
`,
    "guided.txt"
  );
  const engine = createChatEngine(guidedEntries);
  const first = engine.answer("δεν ανοίγει το internet");
  const followup = engine.answer("κόλλησα στο βήμα 2", {
    conversationState: first.conversationState
  });

  assert.equal(first.type, "match");
  assert.equal(followup.type, "followup");
  assert.equal(followup.title, "Internet - βήμα 2");
  assert.ok(followup.answer.includes("δεύτερη ιστοσελίδα"));
  assert.equal(followup.actions[0], "Γράψτε URL");
  assert.equal(followup.conversationState.activeEntryId, first.entryId);
});

test("provides generic step guidance when no linked follow-up exists", () => {
  const engine = createChatEngine(entries);
  const first = engine.answer("ο εκτυπωτής δεν τυπώνει");
  const followup = engine.answer("δεν μπορώ στο βήμα 1", {
    conversationState: first.conversationState
  });

  assert.equal(followup.type, "followup");
  assert.ok(followup.title.includes("βοήθεια στο βήμα 1"));
  assert.ok(followup.answer.includes("Το βήμα 1 είναι"));
});

test("keeps the active topic when the user gives a vague unresolved response", () => {
  const engine = createChatEngine(entries);
  const first = engine.answer("ο εκτυπωτής δεν τυπώνει");
  const next = engine.answer("ακόμα έχω πρόβλημα", {
    conversationState: first.conversationState
  });

  assert.equal(next.type, "followup");
  assert.equal(next.entryId, first.entryId);
  assert.ok(next.title.includes("Εκτυπωτής δεν τυπώνει"));
});

test("keeps the active topic even when a new topic is not explicitly requested", () => {
  const engine = createChatEngine(entries);
  const first = engine.answer("ο εκτυπωτής δεν τυπώνει");
  const next = engine.answer("έχω πρόβλημα σύνδεση password χρήστη", {
    conversationState: first.conversationState
  });

  assert.equal(next.type, "followup");
  assert.equal(next.entryId, first.entryId);
});

test("changes topic only when the user explicitly asks for a context switch", () => {
  const engine = createChatEngine(entries);
  const first = engine.answer("ο εκτυπωτής δεν τυπώνει");
  const next = engine.answer("αλλαγή θέματος: έχω πρόβλημα σύνδεση password χρήστη", {
    conversationState: first.conversationState
  });

  assert.equal(next.type, "match");
  assert.equal(next.title, "Αδυναμία σύνδεσης χρήστη");
});

test("allows explicit correction to refocus inside the same knowledge family", () => {
  const sapEntries = parseKnowledgeText(
    `
# SAP παραγγελίες
keywords: sap παραγγελία, παραγγελία sap, μηςπυ sap
domain: sap-mm
category: orders
actions:
- Ελέγξτε αν αφορά μία ή πολλές παραγγελίες.
answer:
Οδηγία για παραγγελίες SAP.
---
# SAP αποθέματα
keywords: sap αποθέματα, παρακολούθηση αποθεμάτων, mb21, κράτηση sap
domain: sap-mm
category: inventory
actions:
- Ελέγξτε αποθήκη και υλικό.
answer:
Οδηγία για αποθέματα SAP.
`,
    "sap.txt"
  );
  const engine = createChatEngine(sapEntries);
  const first = engine.answer("πρόβλημα με παραγγελία sap");
  const next = engine.answer("δεν αφορά πρόβλημα παραγγελίας, αφορά παρακολούθηση αποθεμάτων", {
    conversationState: first.conversationState
  });

  assert.equal(next.type, "match");
  assert.equal(next.title, "SAP αποθέματα");
  assert.ok(next.answer.includes("διορθώνω το ενεργό θέμα"));
});

test("allows specific transaction refinement inside the same knowledge family", () => {
  const sapEntries = parseKnowledgeText(
    `
# SAP παραγγελίες
keywords: sap παραγγελία, παραγγελία sap, μηςπυ sap
domain: sap-mm
category: orders
actions:
- Ελέγξτε αν αφορά μία ή πολλές παραγγελίες.
answer:
Οδηγία για παραγγελίες SAP.
---
# SAP κρατήσεις
keywords: mb21, transaction mb21, κράτηση sap, sap κρατήσεις
domain: sap-mm
category: reservations
actions:
- Ελέγξτε αποθήκη και υλικό.
answer:
Οδηγία για κρατήσεις SAP.
`,
    "sap-refine.txt"
  );
  const engine = createChatEngine(sapEntries);
  const first = engine.answer("πρόβλημα με παραγγελία sap");
  const next = engine.answer("πρόβλημα με το transaction mb21", {
    conversationState: first.conversationState
  });

  assert.equal(next.type, "match");
  assert.equal(next.title, "SAP κρατήσεις");
});

test("ends an active conversation with common exit phrases", () => {
  const engine = createChatEngine(entries);
  const first = engine.answer("ο εκτυπωτής δεν τυπώνει");
  const next = engine.answer("τέλος συνομιλίας", {
    conversationState: first.conversationState
  });

  assert.equal(next.type, "control");
  assert.equal(next.controlAction, "end");
  assert.equal(next.title, "Τέλος συνομιλίας");
  assert.equal(next.conversationState, null);
  assert.equal(next.shouldResetConversation, true);
});

test("cancels an active conversation without matching knowledge", () => {
  const engine = createChatEngine(entries);
  const first = engine.answer("ο εκτυπωτής δεν τυπώνει");
  const next = engine.answer("άκυρο", {
    conversationState: first.conversationState
  });

  assert.equal(next.type, "control");
  assert.equal(next.controlAction, "cancel");
  assert.equal(next.conversationState, null);
});

test("resets an active conversation without keeping the old context", () => {
  const engine = createChatEngine(entries);
  const first = engine.answer("ο εκτυπωτής δεν τυπώνει");
  const next = engine.answer("ξεκίνα από την αρχή", {
    conversationState: first.conversationState
  });

  assert.equal(next.type, "control");
  assert.equal(next.controlAction, "reset");
  assert.equal(next.conversationState, null);
  assert.ok(next.suggestions.length > 0);
});

test("recognizes additional production reset and exit phrases", () => {
  const engine = createChatEngine(entries);
  const first = engine.answer("ο εκτυπωτής δεν τυπώνει");
  const end = engine.answer("τέρμα", {
    conversationState: first.conversationState
  });
  const reset = engine.answer("νέο ερώτημα", {
    conversationState: first.conversationState
  });

  assert.equal(end.type, "control");
  assert.equal(end.controlAction, "end");
  assert.equal(reset.type, "control");
  assert.equal(reset.controlAction, "reset");
});

test("does not treat technical cancellation topics as chat cancellation", () => {
  const clinicalEntries = parseKnowledgeText(
    `
# Ακύρωση παραγγελίας στο Medico
keywords: ακύρωση παραγγελίας, ακυρωση παραγγελιας, medico
actions:
- Μην κάνετε διπλή καταχώρηση.
answer:
Συλλέξτε ασφαλή στοιχεία για αρμόδιο έλεγχο.
`,
    "clinical.txt"
  );
  const engine = createChatEngine(clinicalEntries);
  const response = engine.answer("ακύρωση παραγγελίας στο medico");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Ακύρωση παραγγελίας στο Medico");
});

test("asks for clarification when two knowledge entries are equally plausible", () => {
  const ambiguousEntries = parseKnowledgeText(
    `
# Medico πρόσβαση
keywords: πρόσβαση
priority: 4
actions:
- Γράψτε ποια εφαρμογή αφορά.
answer:
Οδηγία Medico.
---
# MIS πρόσβαση
keywords: πρόσβαση
priority: 4
actions:
- Γράψτε αν αφορά MIS.
answer:
Οδηγία MIS.
`,
    "ambiguous.txt"
  );
  const engine = createChatEngine(ambiguousEntries);
  const response = engine.answer("πρόσβαση");

  assert.equal(response.type, "clarification");
  assert.equal(response.title, "Χρειάζεται διευκρίνιση");
  assert.equal(response.suggestions.length, 2);
});

test("exposes smart portal search results with semantic scoring", () => {
  const engine = createChatEngine(entries);
  const result = engine.search("δεν τυπωνει printer", { limit: 3 });

  assert.equal(result.results[0].title, "Εκτυπωτής δεν τυπώνει");
  assert.ok(result.results[0].confidence > 0);
  assert.ok(["lexical", "hybrid", "semantic", "bm25"].includes(result.results[0].matchType));
  assert.equal(typeof result.results[0].bm25Score, "number");
});

test("matched answers expose guided step suggestions", () => {
  const engine = createChatEngine(entries);
  const response = engine.answer("ο εκτυπωτής δεν τυπώνει");

  assert.equal(response.type, "match");
  assert.ok(response.suggestions.some((suggestion) => suggestion.title === "Κόλλησα στο βήμα 1"));
});

test("application context nudges ambiguous first messages without changing sticky behavior", () => {
  const contextualEntries = parseKnowledgeText(
    `
# Medico δεν ανοίγει
keywords: δεν ανοίγει, medico, εφαρμογή ασθενών
priority: 4
actions:
- Κλείστε και ανοίξτε ξανά την εφαρμογή.
answer:
Οδηγία Medico.
---
# Internet δεν ανοίγει
keywords: δεν ανοίγει, internet, ιστοσελίδα
priority: 4
actions:
- Δοκιμάστε δεύτερη ιστοσελίδα.
answer:
Οδηγία Internet.
`,
    "context.txt"
  );
  const engine = createChatEngine(contextualEntries);
  const response = engine.answer("δεν ανοίγει", { applicationContext: "medico" });
  const search = engine.search("δεν ανοίγει", { limit: 2, applicationContext: "medico" });

  assert.equal(response.type, "match");
  assert.equal(response.title, "Medico δεν ανοίγει");
  assert.equal(search.results[0].title, "Medico δεν ανοίγει");
});
