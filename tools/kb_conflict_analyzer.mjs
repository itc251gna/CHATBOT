import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeKnowledgeBase } from "../src/knowledge-audit.js";
import { loadKnowledgeFromDirectory } from "../src/knowledge-base.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const knowledgeDirectory = path.resolve(process.argv[2] || process.env.KNOWLEDGE_DIR || path.join(repoRoot, "knowledge"));
const outputDirectory = path.resolve(process.argv[3] || path.join(repoRoot, "dist", "kb-analysis"));

const entries = await loadKnowledgeFromDirectory(knowledgeDirectory);
const report = analyzeKnowledgeBase(entries);

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "knowledge-audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "knowledge-audit.md"), renderMarkdown(report), "utf8");

console.log(JSON.stringify({
  generatedAt: report.generatedAt,
  knowledgeDirectory,
  outputDirectory,
  totals: report.totals,
  score: report.score,
  warningCount: report.issues.filter((issue) => issue.severity === "warning").length,
  infoCount: report.issues.filter((issue) => issue.severity === "info").length
}, null, 2));

function renderMarkdown(report) {
  const lines = [
    "# Knowledge Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Score: ${report.score}/100`,
    "",
    "## Totals",
    "",
    `- Entries: ${report.totals.entries}`,
    `- Keywords: ${report.totals.keywords}`,
    `- Sources: ${report.totals.sources}`,
    `- Missing owner: ${report.totals.missingOwner}`,
    `- Missing last reviewed: ${report.totals.missingLastReviewed}`,
    "",
    "## Issues",
    ""
  ];

  for (const issue of report.issues.slice(0, 120)) {
    lines.push(`### ${issue.severity.toUpperCase()} - ${issue.type}`);
    lines.push("");
    lines.push(issue.message);
    lines.push("");
    lines.push(`Recommendation: ${issue.recommendation}`);
    lines.push("");
    for (const entry of issue.entries ?? []) {
      lines.push(`- ${entry.title} (${entry.source}, priority ${entry.priority})`);
    }
    lines.push("");
  }

  if (report.issues.length > 120) {
    lines.push(`_Only first 120 issues shown. Full JSON contains ${report.issues.length} issues._`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
