import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildLearningReport } from "../src/learning-report.js";

test("builds an operational learning report from redacted local events", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "chatty-learning-report-"));
  const filePath = path.join(directory, "events.jsonl");

  try {
    const events = [
      {
        event: "chat_exchange",
        request: { message: "άγνωστο πρόβλημα εφαρμογής" },
        response: { type: "fallback", title: "", conversationState: { activeTitle: "Ασαφές τεχνικό θέμα" } }
      },
      {
        event: "termination_signal",
        request: { reason: "unable_to_resolve_after_attempts" },
        response: { reason: "unable_to_resolve_after_attempts", summary: { title: "Ασαφές τεχνικό θέμα" } }
      }
    ];

    await writeFile(filePath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
    const report = await buildLearningReport(filePath);

    assert.equal(report.totals.events, 2);
    assert.equal(report.totals.chatExchanges, 1);
    assert.equal(report.totals.terminationSignals, 1);
    assert.ok(report.reviewQueue.length > 0);
    assert.ok(report.recommendedRegressionTests.length > 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
