import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_LOG_PATH = path.join(process.cwd(), "data", "learning-events.jsonl");

export async function buildLearningReport(logPath = process.env.CHAT_LEARNING_LOG_PATH || DEFAULT_LOG_PATH) {
  const events = await readEvents(logPath);
  const chatEvents = events.filter((event) => event.event === "chat_exchange");
  const terminationEvents = events.filter((event) => event.event === "termination_signal");

  const byTopic = new Map();
  const unresolvedByTopic = new Map();
  const lowConfidenceMessages = new Map();
  const lowConfidenceClusters = new Map();
  const responseTypes = new Map();
  const terminationReasons = new Map();

  for (const event of chatEvents) {
    const response = event.response ?? {};
    const request = event.request ?? {};
    const topic = clean(response.conversationState?.activeTitle || response.title || "Χωρίς ενεργό θέμα");
    increment(byTopic, topic);
    increment(responseTypes, clean(response.type || "unknown"));

    if (["fallback", "help"].includes(response.type)) {
      const message = clean(request.message);
      if (message) {
        increment(lowConfidenceMessages, message);
        increment(lowConfidenceClusters, clusterMessage(message));
      }
    }
  }

  for (const event of terminationEvents) {
    const summary = event.response?.summary ?? {};
    const topic = clean(summary.lastKnownTopic || summary.title || "Χωρίς ενεργό θέμα");
    increment(unresolvedByTopic, topic);
    increment(terminationReasons, clean(event.response?.reason || event.request?.reason || "unknown"));
  }

  return {
    generatedAt: new Date().toISOString(),
    source: logPath,
    totals: {
      events: events.length,
      chatExchanges: chatEvents.length,
      terminationSignals: terminationEvents.length
    },
    topTopics: topEntries(byTopic, 12),
    unresolvedTopics: topEntries(unresolvedByTopic, 12),
    responseTypes: topEntries(responseTypes, 12),
    terminationReasons: topEntries(terminationReasons, 12),
    lowConfidenceMessages: topEntries(lowConfidenceMessages, 20),
    lowConfidenceClusters: topEntries(lowConfidenceClusters, 20),
    reviewQueue: buildReviewQueue({
      unresolvedByTopic,
      lowConfidenceClusters,
      lowConfidenceMessages
    }),
    recommendedRegressionTests: buildRegressionCandidates(lowConfidenceMessages, unresolvedByTopic),
    reviewGuidance: [
      "Ελέγξτε πρώτα τα unresolvedTopics με πολλές επαναλήψεις.",
      "Για κάθε lowConfidenceMessages ομάδα, προσθέστε ή βελτιώστε entry στη γνωσιακή βάση μόνο αν η οδηγία είναι ασφαλής για απλό χρήστη.",
      "Μετατρέψτε τα συχνά unresolved σε tests πριν αλλάξετε keywords ή priority.",
      "Μην εισάγετε στοιχεία ασθενών, διαπιστευτήρια ή elevated/admin ενέργειες στη γνωσιακή βάση."
    ]
  };
}

async function readEvents(filePath) {
  let raw = "";
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => parseLine(line, index + 1))
    .filter(Boolean);
}

function parseLine(line, lineNumber) {
  try {
    return JSON.parse(line);
  } catch {
    return {
      event: "invalid_json",
      lineNumber
    };
  }
}

function buildReviewQueue({ unresolvedByTopic, lowConfidenceClusters, lowConfidenceMessages }) {
  const queue = [];

  for (const item of topEntries(unresolvedByTopic, 20)) {
    queue.push({
      type: "unresolved_topic",
      priority: item.count >= 5 ? "high" : "normal",
      label: item.label,
      count: item.count,
      suggestedAction: "Ελέγξτε αν το entry χρειάζεται πιο καθαρά followups, περισσότερα παραδείγματα ή ασφαλή επόμενα βήματα."
    });
  }

  for (const item of topEntries(lowConfidenceClusters, 20)) {
    queue.push({
      type: "low_confidence_cluster",
      priority: item.count >= 5 ? "high" : "normal",
      label: item.label,
      count: item.count,
      suggestedAction: "Εξετάστε αν λείπει keyword, synonym ή νέο user-facing entry."
    });
  }

  const repeatedMessages = topEntries(lowConfidenceMessages, 12).filter((item) => item.count > 1);
  for (const item of repeatedMessages) {
    queue.push({
      type: "repeated_low_confidence_message",
      priority: item.count >= 3 ? "high" : "normal",
      label: item.label,
      count: item.count,
      suggestedAction: "Χρησιμοποιήστε το σαν regression query αφού εγκριθεί η σωστή απάντηση."
    });
  }

  return queue.sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority) || b.count - a.count).slice(0, 30);
}

function buildRegressionCandidates(lowConfidenceMessages, unresolvedByTopic) {
  return [
    ...topEntries(lowConfidenceMessages, 10).map((item) => ({
      message: item.label,
      reason: "low_confidence",
      count: item.count
    })),
    ...topEntries(unresolvedByTopic, 10).map((item) => ({
      topic: item.label,
      reason: "termination_or_unresolved",
      count: item.count
    }))
  ];
}

function clusterMessage(value) {
  const tokens = clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((token) => token.length > 3)
    .filter((token) => !["προβλημα", "θελω", "ακομα", "παλι", "κανω", "χρειαζεται"].includes(token))
    .slice(0, 5)
    .sort();

  return tokens.length > 0 ? tokens.join(" ") : clean(value).slice(0, 80);
}

function increment(map, key) {
  const normalized = clean(key);
  if (!normalized) {
    return;
  }
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function topEntries(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "el"))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function priorityWeight(value) {
  return value === "high" ? 0 : 1;
}

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}
