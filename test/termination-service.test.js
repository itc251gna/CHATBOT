import test from "node:test";
import assert from "node:assert/strict";
import { buildTerminationSignal } from "../src/termination-service.js";

test("builds a neutral handoff termination signal from conversation history", () => {
  const signal = buildTerminationSignal({
    reason: "unable_to_resolve_after_attempts",
    lastResponseType: "followup",
    conversationState: {
      activeEntryId: "printer-1",
      activeTitle: "Εκτυπωτής δεν τυπώνει",
      actionCount: 4,
      lastStep: 2
    },
    messages: [
      { role: "user", text: "Δεν δουλεύει ο εκτυπωτής στο γραφείο." },
      { role: "bot", title: "Εκτυπωτής δεν τυπώνει", text: "Ελέγξτε χαρτί και toner." },
      { role: "user", text: "Το έκανα αλλά πάλι δεν τυπώνει, κόλλησα στο βήμα 2." }
    ]
  });

  assert.equal(signal.type, "termination");
  assert.equal(signal.schemaVersion, "2.0");
  assert.equal(signal.signal, "CHATBOT_HANDOFF_REQUESTED");
  assert.equal(signal.summary.title, "Εκτυπωτής δεν τυπώνει");
  assert.ok(signal.summary.problem.includes("Αρχικό πρόβλημα"));
  assert.ok(signal.summary.attemptedSteps.some((step) => step.includes("Το έκανα")));
  assert.ok(signal.summary.unresolvedIndicators.includes("δεν λύθηκε"));
  assert.ok(signal.summary.unresolvedIndicators.includes("κόλλησε σε βήμα"));
  assert.equal(signal.context.lastResponseType, "followup");
  assert.equal(signal.handoff.status, "needs_host_handoff");
  assert.equal(signal.handoff.topic.id, "printer-1");
  assert.equal(typeof signal.handoff.topic.riskLevel, "string");
  assert.equal(signal.handoff.routingHints.preferredNextStep, "host_application_route");
});

test("handles empty termination input safely", () => {
  const signal = buildTerminationSignal();

  assert.equal(signal.type, "termination");
  assert.equal(signal.reason, "unable_to_resolve_after_attempts");
  assert.equal(signal.summary.title, "Συνέχεια εκτός chatbot");
  assert.equal(signal.summary.messageCount, 0);
});

test("truncates long messages in the summary payload", () => {
  const signal = buildTerminationSignal({
    messages: [{ role: "user", text: "α".repeat(1000) }]
  });

  assert.ok(signal.summary.userMessages[0].length <= 420);
  assert.ok(signal.summary.problem.length <= 700);
});

test("redacts sensitive values in termination summaries", () => {
  const signal = buildTerminationSignal({
    messages: [
      { role: "user", text: "IP 10.4.5.6 και ΑΜΚΑ 01010112345 και email user@example.com" }
    ]
  });

  assert.ok(signal.summary.problem.includes("[REDACTED_IP]"));
  assert.ok(signal.summary.problem.includes("[REDACTED_AMKA]"));
  assert.ok(signal.summary.problem.includes("[REDACTED_EMAIL]"));
  assert.ok(!signal.summary.problem.includes("10.4.5.6"));
  assert.ok(!signal.handoff.problemStatement.includes("01010112345"));
});
