import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createChatEngine } from "../src/chat-engine.js";
import { loadKnowledgeFromDirectory } from "../src/knowledge-base.js";

const knowledgeDirectory = fileURLToPath(new URL("../knowledge", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/regression-queries.json", import.meta.url));

test("reviewed regression queries keep routing to expected knowledge", async () => {
  const raw = await readFile(fixturePath, "utf8");
  const cases = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));

  assert.ok(Array.isArray(cases));
  assert.ok(cases.length > 0);

  for (const item of cases) {
    const response = engine.answer(item.message, item.context ?? {});
    assert.equal(response.type, item.expectedType, item.message);
    if (item.expectedTitle) {
      assert.equal(response.title, item.expectedTitle, item.message);
    }
  }
});
