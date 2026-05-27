import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildLearningReport } from "../src/learning-report.js";

const logPath = process.argv[2] || process.env.CHAT_LEARNING_LOG_PATH || path.join("data", "learning-events.jsonl");
const outputPath = path.resolve(process.argv[3] || path.join("dist", "regression-candidates.json"));
const report = await buildLearningReport(logPath);

const candidates = report.recommendedRegressionTests.map((candidate) => ({
  ...candidate,
  status: "review_required",
  expectedTitle: "",
  expectedType: "",
  note: "Συμπληρώστε expectedTitle/expectedType αφού εγκριθεί η σωστή user-facing απάντηση."
}));

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: logPath,
  candidates
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  outputPath,
  candidateCount: candidates.length
}, null, 2));
