import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { appendLearningEvent } from "../src/learning-log.js";

test("writes redacted learning events when enabled", async () => {
  const previousEnabled = process.env.CHAT_LEARNING_LOG_ENABLED;
  const previousPath = process.env.CHAT_LEARNING_LOG_PATH;
  const directory = await mkdtemp(path.join(os.tmpdir(), "chatty-learning-"));
  const filePath = path.join(directory, "events.jsonl");

  try {
    process.env.CHAT_LEARNING_LOG_ENABLED = "true";
    process.env.CHAT_LEARNING_LOG_PATH = filePath;

    await appendLearningEvent({
      event: "chat_exchange",
      request: {
        message: "ΑΜΚΑ 01010112345, IP 10.4.5.6 και email user@example.com"
      }
    });

    const line = (await readFile(filePath, "utf8")).trim();
    const record = JSON.parse(line);

    assert.equal(record.event, "chat_exchange");
    assert.ok(record.request.message.includes("[REDACTED_AMKA]"));
    assert.ok(record.request.message.includes("[REDACTED_IP]"));
    assert.ok(record.request.message.includes("[REDACTED_EMAIL]"));
    assert.ok(!record.request.message.includes("01010112345"));
  } finally {
    if (previousEnabled === undefined) {
      delete process.env.CHAT_LEARNING_LOG_ENABLED;
    } else {
      process.env.CHAT_LEARNING_LOG_ENABLED = previousEnabled;
    }

    if (previousPath === undefined) {
      delete process.env.CHAT_LEARNING_LOG_PATH;
    } else {
      process.env.CHAT_LEARNING_LOG_PATH = previousPath;
    }

    await rm(directory, { recursive: true, force: true });
  }
});
