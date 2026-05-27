import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "./text-normalizer.js";

const FIELD_ALIASES = new Map([
  ["title", "title"],
  ["τιτλοσ", "title"],
  ["keywords", "keywords"],
  ["keyword", "keywords"],
  ["λεξεισ κλειδια", "keywords"],
  ["λεξεισ", "keywords"],
  ["tags", "keywords"],
  ["answer", "answer"],
  ["απαντηση", "answer"],
  ["response", "answer"],
  ["actions", "actions"],
  ["ενεργειεσ", "actions"],
  ["steps", "actions"],
  ["βηματα", "actions"],
  ["followups", "followups"],
  ["followup", "followups"],
  ["linked answers", "followups"],
  ["step answers", "followups"],
  ["συνεχειες", "followups"],
  ["συνεχεια", "followups"],
  ["απαντησεισ συνεχειασ", "followups"],
  ["priority", "priority"],
  ["προτεραιοτητα", "priority"],
  ["owner", "owner"],
  ["ιδιοκτητησ", "owner"],
  ["υπευθυνοσ", "owner"],
  ["domain", "domain"],
  ["πεδιο", "domain"],
  ["γνωστικο πεδιο", "domain"],
  ["category", "category"],
  ["κατηγορια", "category"],
  ["risk", "riskLevel"],
  ["risk level", "riskLevel"],
  ["risklevel", "riskLevel"],
  ["επιπεδο κινδυνου", "riskLevel"],
  ["last reviewed", "lastReviewed"],
  ["lastreviewed", "lastReviewed"],
  ["reviewed", "lastReviewed"],
  ["τελευταιοσ ελεγχοσ", "lastReviewed"],
  ["user safe", "userSafe"],
  ["usersafe", "userSafe"],
  ["ασφαλεσ για χρηστη", "userSafe"],
  ["admin only", "adminOnly"],
  ["adminonly", "adminOnly"],
  ["μονο admin", "adminOnly"],
  ["examples", "examples"],
  ["example", "examples"],
  ["παραδειγματα", "examples"],
  ["παραδειγμα", "examples"],
  ["negative examples", "negativeExamples"],
  ["negativeexamples", "negativeExamples"],
  ["negative example", "negativeExamples"],
  ["αρνητικα παραδειγματα", "negativeExamples"],
  ["αρνητικο παραδειγμα", "negativeExamples"]
]);

const FOLLOWUP_FIELD_ALIASES = new Map([
  ["step", "step"],
  ["βημα", "step"],
  ["keywords", "keywords"],
  ["keyword", "keywords"],
  ["λεξεισ κλειδια", "keywords"],
  ["λεξεισ", "keywords"],
  ["answer", "answer"],
  ["απαντηση", "answer"],
  ["actions", "actions"],
  ["ενεργειεσ", "actions"]
]);

export function parseKnowledgeText(rawText, source = "inline") {
  return splitIntoBlocks(rawText)
    .map((block, index) => parseKnowledgeBlock(block, source, index + 1))
    .filter(Boolean);
}

export async function loadKnowledgeFromDirectory(directory) {
  const files = await readdir(directory, { withFileTypes: true });
  const txtFiles = files
    .filter((file) => file.isFile() && file.name.toLowerCase().endsWith(".txt"))
    .map((file) => path.join(directory, file.name))
    .sort((a, b) => a.localeCompare(b));

  const entries = [];
  for (const filePath of txtFiles) {
    const text = await readFile(filePath, "utf8");
    entries.push(...parseKnowledgeText(text, path.basename(filePath)));
  }

  return entries;
}

function splitIntoBlocks(rawText) {
  const blocks = [];
  let current = [];

  for (const line of String(rawText ?? "").split(/\r?\n/)) {
    if (/^\s*---+\s*$/.test(line)) {
      pushBlock(blocks, current);
      current = [];
      continue;
    }

    current.push(line);
  }

  pushBlock(blocks, current);
  return blocks;
}

function pushBlock(blocks, lines) {
  const block = lines.join("\n").trim();
  if (block) {
    blocks.push(block);
  }
}

function parseKnowledgeBlock(block, source, index) {
  const entry = {
    id: "",
    title: "",
    keywords: [],
    answer: "",
    actions: [],
    followups: [],
    priority: 0,
    owner: "",
    domain: "",
    category: "",
    riskLevel: "",
    lastReviewed: "",
    userSafe: true,
    adminOnly: false,
    examples: [],
    negativeExamples: [],
    source,
    sourceIndex: index
  };

  let currentField = "";
  const answerLines = [];

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentField === "answer") {
        answerLines.push("");
      }
      continue;
    }

    if (trimmed.startsWith("#")) {
      entry.title = trimmed.replace(/^#+\s*/, "").trim();
      currentField = "";
      continue;
    }

    const field = readField(trimmed);
    if (field) {
      currentField = field.name;
      applyField(entry, answerLines, field.name, field.value);
      continue;
    }

    if (currentField === "answer") {
      answerLines.push(line);
      continue;
    }

    if (currentField === "actions") {
      entry.actions.push(trimActionLine(trimmed));
      continue;
    }

    if (currentField === "followups") {
      const followup = parseFollowupLine(trimmed);
      if (followup) {
        entry.followups.push(followup);
      }
    }
  }

  entry.answer = answerLines.join("\n").trim();
  entry.keywords = uniqueList(entry.keywords);
  entry.actions = uniqueList(entry.actions.filter(Boolean));
  entry.followups = normalizeFollowups(entry.followups);
  entry.examples = uniqueList(entry.examples);
  entry.negativeExamples = uniqueList(entry.negativeExamples);

  if (!entry.title && entry.keywords.length > 0) {
    entry.title = entry.keywords[0];
  }

  if (!entry.title || (!entry.answer && entry.actions.length === 0)) {
    return null;
  }

  entry.id = createEntryId(entry.title, source, index);
  return entry;
}

function readField(line) {
  const match = line.match(/^([^:]+):\s*(.*)$/);
  if (!match) {
    return null;
  }

  const alias = FIELD_ALIASES.get(normalizeText(match[1]));
  if (!alias) {
    return null;
  }

  return {
    name: alias,
    value: match[2].trim()
  };
}

function applyField(entry, answerLines, fieldName, value) {
  if (fieldName === "title") {
    entry.title = value;
    return;
  }

  if (fieldName === "keywords") {
    entry.keywords.push(...splitList(value));
    return;
  }

  if (fieldName === "priority") {
    entry.priority = Number.parseInt(value, 10) || 0;
    return;
  }

  if (["owner", "domain", "category", "riskLevel", "lastReviewed"].includes(fieldName)) {
    entry[fieldName] = value;
    return;
  }

  if (fieldName === "userSafe" || fieldName === "adminOnly") {
    entry[fieldName] = parseBoolean(value, fieldName === "userSafe");
    return;
  }

  if (fieldName === "examples") {
    entry.examples.push(...splitList(value));
    return;
  }

  if (fieldName === "negativeExamples") {
    entry.negativeExamples.push(...splitList(value));
    return;
  }

  if (fieldName === "actions") {
    entry.actions.push(...splitActions(value));
    return;
  }

  if (fieldName === "followups" && value) {
    const followup = parseFollowupLine(value);
    if (followup) {
      entry.followups.push(followup);
    }
    return;
  }

  if (fieldName === "answer" && value) {
    answerLines.push(value);
  }
}

function parseFollowupLine(line) {
  const cleaned = trimActionLine(line);
  if (!cleaned) {
    return null;
  }

  const followup = {
    step: null,
    keywords: [],
    answer: "",
    actions: []
  };

  const parts = cleaned.split(/\s+\|\s+|;\s+/).map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const match = part.match(/^([^:=]+)\s*[:=]\s*(.*)$/);
    if (!match) {
      if (!followup.answer) {
        followup.answer = part;
      }
      continue;
    }

    const fieldName = FOLLOWUP_FIELD_ALIASES.get(normalizeText(match[1]));
    if (!fieldName) {
      continue;
    }

    const value = match[2].trim();
    if (fieldName === "step") {
      followup.step = parseStepNumber(value);
    } else if (fieldName === "keywords") {
      followup.keywords.push(...splitList(value));
    } else if (fieldName === "answer") {
      followup.answer = value;
    } else if (fieldName === "actions") {
      followup.actions.push(...splitActions(value));
    }
  }

  if (!followup.answer && followup.actions.length === 0) {
    return null;
  }

  followup.keywords = uniqueList(followup.keywords);
  followup.actions = uniqueList(followup.actions);
  return followup;
}

function parseStepNumber(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function normalizeFollowups(followups) {
  return followups
    .filter((followup) => followup.answer || followup.actions.length > 0)
    .map((followup) => ({
      step: Number.isInteger(followup.step) && followup.step > 0 ? followup.step : null,
      keywords: uniqueList(followup.keywords),
      answer: String(followup.answer ?? "").trim(),
      actions: uniqueList(followup.actions)
    }));
}

function splitList(value) {
  return String(value ?? "")
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitActions(value) {
  if (!value) {
    return [];
  }

  return splitList(value).map(trimActionLine);
}

function parseBoolean(value, fallback) {
  const normalized = normalizeText(value);
  if (["true", "yes", "y", "1", "ναι", "nai"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n", "0", "οχι", "oxi"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function trimActionLine(line) {
  return line.replace(/^[-*]\s*/, "").trim();
}

function uniqueList(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function createEntryId(title, source, index) {
  const slug = normalizeText(title).replace(/\s+/g, "-") || `entry-${index}`;
  const file = normalizeText(source).replace(/\s+/g, "-").replace(/-txt$/, "");
  return `${file}-${slug}-${index}`;
}
