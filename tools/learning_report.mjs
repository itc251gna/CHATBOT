import path from "node:path";
import { buildLearningReport } from "../src/learning-report.js";

const logPath = process.argv[2] || process.env.CHAT_LEARNING_LOG_PATH || path.join("data", "learning-events.jsonl");
const report = await buildLearningReport(logPath);

console.log(JSON.stringify(report, null, 2));
