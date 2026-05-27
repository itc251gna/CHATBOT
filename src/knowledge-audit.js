import { normalizeText, tokenize } from "./text-normalizer.js";

const GENERIC_KEYWORDS = new Set(
  [
    "προβλημα",
    "βλαβη",
    "σφαλμα",
    "δεν λειτουργει",
    "δεν δουλευει",
    "δεν ανοιγει",
    "αιτημα",
    "ticket",
    "πληροφοριεσ",
    "χρηστησ",
    "δικτυο"
  ].map(normalizeText)
);

const HIGH_PRIORITY = 4;

export function analyzeKnowledgeBase(entries, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const preparedEntries = entries.map(prepareAuditEntry);
  const issues = [
    ...findDuplicateKeywords(preparedEntries),
    ...findBroadHighPriorityKeywords(preparedEntries),
    ...findOverlappingEntries(preparedEntries),
    ...findGovernanceGaps(preparedEntries, now),
    ...findSafetyFlagIssues(preparedEntries)
  ].sort(sortIssues);

  return {
    generatedAt: now.toISOString(),
    totals: {
      entries: preparedEntries.length,
      keywords: preparedEntries.reduce((sum, entry) => sum + entry.keywords.length, 0),
      sources: new Set(preparedEntries.map((entry) => entry.source)).size,
      adminOnly: preparedEntries.filter((entry) => entry.adminOnly).length,
      userSafeFalse: preparedEntries.filter((entry) => entry.userSafe === false).length,
      missingOwner: preparedEntries.filter((entry) => !entry.owner).length,
      missingLastReviewed: preparedEntries.filter((entry) => !entry.lastReviewed).length
    },
    issues,
    score: calculateQualityScore(preparedEntries, issues)
  };
}

function prepareAuditEntry(entry) {
  return {
    ...entry,
    normalizedTitle: normalizeText(entry.title),
    keywords: (entry.keywords ?? []).map((keyword) => ({
      raw: keyword,
      normalized: normalizeText(keyword),
      tokens: tokenize(keyword)
    })),
    titleTokens: tokenize(entry.title),
    allTokens: new Set(tokenize([entry.title, ...(entry.keywords ?? [])].join(" ")))
  };
}

function findDuplicateKeywords(entries) {
  const byKeyword = new Map();
  for (const entry of entries) {
    for (const keyword of entry.keywords) {
      if (!keyword.normalized) {
        continue;
      }

      const items = byKeyword.get(keyword.normalized) ?? [];
      items.push({ entry, keyword: keyword.raw });
      byKeyword.set(keyword.normalized, items);
    }
  }

  const issues = [];
  for (const [keyword, items] of byKeyword) {
    const uniqueEntryIds = new Set(items.map((item) => item.entry.id));
    if (uniqueEntryIds.size < 2) {
      continue;
    }

    issues.push({
      severity: isGenericKeyword(keyword) ? "warning" : "info",
      type: "duplicate_keyword",
      message: `Το keyword "${items[0].keyword}" υπάρχει σε ${uniqueEntryIds.size} entries.`,
      keyword: items[0].keyword,
      entries: summarizeIssueEntries(items.map((item) => item.entry)),
      recommendation: "Κρατήστε το keyword στο πιο ειδικό entry ή χαμηλώστε priority στα γενικά entries."
    });
  }

  return issues;
}

function findBroadHighPriorityKeywords(entries) {
  const issues = [];
  for (const entry of entries) {
    if (entry.priority < HIGH_PRIORITY) {
      continue;
    }

    for (const keyword of entry.keywords) {
      const singleGenericToken = keyword.tokens.length === 1 && (keyword.tokens[0].length <= 4 || isGenericKeyword(keyword.normalized));
      if (!singleGenericToken) {
        continue;
      }

      issues.push({
        severity: "warning",
        type: "broad_high_priority_keyword",
        message: `Το high-priority entry "${entry.title}" έχει πολύ γενικό keyword "${keyword.raw}".`,
        keyword: keyword.raw,
        entries: summarizeIssueEntries([entry]),
        recommendation: "Αντικαταστήστε το με πιο συγκεκριμένη φράση ή μειώστε το priority."
      });
    }
  }

  return issues;
}

function findOverlappingEntries(entries) {
  const issues = [];
  for (let index = 0; index < entries.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < entries.length; nextIndex += 1) {
      const first = entries[index];
      const second = entries[nextIndex];
      const overlap = jaccard(first.allTokens, second.allTokens);
      if (overlap < 0.42 || first.allTokens.size < 3 || second.allTokens.size < 3) {
        continue;
      }

      issues.push({
        severity: overlap >= 0.6 ? "warning" : "info",
        type: "entry_overlap",
        message: `Τα entries "${first.title}" και "${second.title}" έχουν υψηλή επικάλυψη όρων.`,
        overlap: Number(overlap.toFixed(2)),
        entries: summarizeIssueEntries([first, second]),
        recommendation: "Ελέγξτε αν χρειάζονται πιο ειδικά keywords, negative examples ή συγχώνευση."
      });
    }
  }

  return issues;
}

function findGovernanceGaps(entries, now) {
  const issues = [];
  for (const entry of entries) {
    if (!entry.owner) {
      issues.push({
        severity: "info",
        type: "missing_owner",
        message: `Το entry "${entry.title}" δεν έχει owner.`,
        entries: summarizeIssueEntries([entry]),
        recommendation: "Προσθέστε owner ώστε να ξέρουμε ποιος εγκρίνει αλλαγές."
      });
    }

    if (!entry.lastReviewed) {
      issues.push({
        severity: "info",
        type: "missing_last_reviewed",
        message: `Το entry "${entry.title}" δεν έχει last reviewed ημερομηνία.`,
        entries: summarizeIssueEntries([entry]),
        recommendation: "Προσθέστε last reviewed σε μορφή YYYY-MM-DD μετά από έλεγχο."
      });
      continue;
    }

    const reviewedAt = new Date(entry.lastReviewed);
    if (Number.isNaN(reviewedAt.getTime())) {
      issues.push({
        severity: "info",
        type: "invalid_last_reviewed",
        message: `Το entry "${entry.title}" έχει μη αναγνώσιμη last reviewed τιμή.`,
        entries: summarizeIssueEntries([entry]),
        recommendation: "Χρησιμοποιήστε μορφή YYYY-MM-DD."
      });
      continue;
    }

    const daysSinceReview = (now.getTime() - reviewedAt.getTime()) / 86_400_000;
    if (daysSinceReview > 365) {
      issues.push({
        severity: "info",
        type: "stale_review",
        message: `Το entry "${entry.title}" έχει να ελεγχθεί πάνω από 12 μήνες.`,
        entries: summarizeIssueEntries([entry]),
        recommendation: "Προγραμματίστε επανέλεγχο γνώσης."
      });
    }
  }

  return issues;
}

function findSafetyFlagIssues(entries) {
  return entries
    .filter((entry) => entry.adminOnly || entry.userSafe === false)
    .map((entry) => ({
      severity: "warning",
      type: "unsafe_entry_flag",
      message: `Το entry "${entry.title}" έχει flag που δεν είναι για απλό χρήστη.`,
      entries: summarizeIssueEntries([entry]),
      recommendation: "Μην το προβάλλετε σε user-facing chat ή ξαναγράψτε το με ασφαλείς ενέργειες χρήστη."
    }));
}

function summarizeIssueEntries(entries) {
  const unique = new Map();
  for (const entry of entries) {
    unique.set(entry.id, {
      id: entry.id,
      title: entry.title,
      source: entry.source,
      priority: entry.priority,
      owner: entry.owner || "",
      domain: entry.domain || ""
    });
  }

  return [...unique.values()];
}

function isGenericKeyword(value) {
  return GENERIC_KEYWORDS.has(normalizeText(value));
}

function jaccard(first, second) {
  const intersection = [...first].filter((token) => second.has(token)).length;
  const union = new Set([...first, ...second]).size;
  return union === 0 ? 0 : intersection / union;
}

function calculateQualityScore(entries, issues) {
  if (entries.length === 0) {
    return 0;
  }

  const penalties = issues.reduce((sum, issue) => {
    if (issue.severity === "warning") {
      return sum + 2;
    }

    if (issue.severity === "error") {
      return sum + 4;
    }

    return sum + 0.4;
  }, 0);

  return Number(Math.max(0, Math.min(100, 100 - penalties / Math.max(1, entries.length) * 10)).toFixed(1));
}

function sortIssues(first, second) {
  const weight = { error: 0, warning: 1, info: 2 };
  return (weight[first.severity] ?? 3) - (weight[second.severity] ?? 3) || first.type.localeCompare(second.type);
}
