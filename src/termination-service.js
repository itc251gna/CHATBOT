const SIGNAL_NAME = "CHATBOT_HANDOFF_REQUESTED";
const MAX_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 420;

export function buildTerminationSignal(context = {}) {
  const messages = normalizeMessages(context.messages);
  const conversationState = normalizeConversationState(context.conversationState);
  const userMessages = messages.filter((message) => message.role === "user");
  const botMessages = messages.filter((message) => message.role === "bot");
  const lastUserMessage = userMessages.at(-1)?.text ?? "";
  const title = buildTitle(conversationState, userMessages);

  return {
    type: "termination",
    schemaVersion: "2.0",
    signal: SIGNAL_NAME,
    reason: normalizeReason(context.reason),
    createdAt: new Date().toISOString(),
    summary: {
      title,
      problem: buildProblemSummary(userMessages, title),
      lastKnownTopic: conversationState.activeTitle || "",
      lastUserMessage,
      userMessages: userMessages.slice(-6).map((message) => message.text),
      botTopics: uniqueList(botMessages.map((message) => message.title).filter(Boolean)).slice(-5),
      attemptedSteps: buildAttemptedSteps(messages, conversationState),
      unresolvedIndicators: extractUnresolvedIndicators(userMessages),
      messageCount: messages.length
    },
    context: {
      conversationState,
      lastResponseType: truncate(String(context.lastResponseType ?? ""), 60)
    },
    handoff: buildStructuredHandoff({
      title,
      reason: normalizeReason(context.reason),
      conversationState,
      userMessages,
      botMessages,
      lastUserMessage,
      lastResponseType: context.lastResponseType
    }),
    recommendedAction: "host-application-decide-next-step"
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .slice(-MAX_MESSAGES)
    .map((message) => {
      const role = message?.role === "user" ? "user" : "bot";
      return {
        role,
        text: cleanText(message?.text ?? message?.content ?? message?.message ?? ""),
        title: cleanText(message?.title ?? ""),
        type: cleanText(message?.type ?? "")
      };
    })
    .filter((message) => message.text || message.title);
}

function normalizeConversationState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      activeEntryId: null,
      activeTitle: "",
      actionCount: 0,
      lastStep: null,
      source: "",
      priority: 0,
      domain: "",
      category: "",
      riskLevel: ""
    };
  }

  return {
    activeEntryId: cleanText(value.activeEntryId ?? ""),
    activeTitle: cleanText(value.activeTitle ?? ""),
    actionCount: Number.isInteger(value.actionCount) ? value.actionCount : Number.parseInt(value.actionCount ?? "0", 10) || 0,
    lastStep: Number.isInteger(value.lastStep) ? value.lastStep : Number.parseInt(value.lastStep ?? "0", 10) || null,
    source: cleanText(value.source ?? ""),
    priority: Number.isInteger(value.priority) ? value.priority : Number.parseInt(value.priority ?? "0", 10) || 0,
    domain: cleanText(value.domain ?? ""),
    category: cleanText(value.category ?? ""),
    riskLevel: cleanText(value.riskLevel ?? "")
  };
}

function normalizeReason(value) {
  const reason = cleanText(value);
  if (!reason) {
    return "unable_to_resolve_after_attempts";
  }

  return reason
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "unable_to_resolve_after_attempts";
}

function buildTitle(conversationState, userMessages) {
  if (conversationState.activeTitle) {
    return truncate(conversationState.activeTitle, 90);
  }

  const firstUseful = userMessages.find((message) => message.text.length >= 8)?.text ?? "";
  return truncate(firstUseful || "Συνέχεια εκτός chatbot", 90);
}

function buildProblemSummary(userMessages, title) {
  if (userMessages.length === 0) {
    return "Δεν υπάρχουν αρκετά μηνύματα συνομιλίας. Η εφαρμογή που φιλοξενεί το widget μπορεί να συνεχίσει με χειροκίνητη συλλογή στοιχείων.";
  }

  const first = userMessages[0]?.text ?? "";
  const last = userMessages.at(-1)?.text ?? "";

  if (first && last && first !== last) {
    return truncate(`Αρχικό πρόβλημα: ${first}. Τελευταία ενημέρωση χρήστη: ${last}.`, 700);
  }

  return truncate(`Ο χρήστης ζήτησε βοήθεια για: ${first || title}.`, 700);
}

function buildAttemptedSteps(messages, conversationState) {
  const steps = [];

  if (conversationState.lastStep) {
    steps.push(`Τελευταίο αναφερόμενο βήμα: ${conversationState.lastStep}`);
  }

  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }

    const normalized = normalizeGreek(message.text);
    if (
      normalized.includes("δοκιμασα") ||
      normalized.includes("το εκανα") ||
      normalized.includes("ελεγξα") ||
      normalized.includes("restart") ||
      normalized.includes("επανεκκινη")
    ) {
      steps.push(message.text);
    }
  }

  return uniqueList(steps).slice(-6);
}

function buildStructuredHandoff(context) {
  const unresolvedIndicators = extractUnresolvedIndicators(context.userMessages);
  const computedRiskLevel = context.conversationState.riskLevel || inferRiskLevel("", unresolvedIndicators);
  const attemptedSteps = buildAttemptedSteps(
    [
      ...context.userMessages.map((message) => ({ ...message, role: "user" })),
      ...context.botMessages.map((message) => ({ ...message, role: "bot" }))
    ],
    context.conversationState
  );

  return {
    status: "needs_host_handoff",
    reason: context.reason,
    topic: {
      id: context.conversationState.activeEntryId || "",
      title: context.conversationState.activeTitle || context.title || "",
      source: context.conversationState.source || "",
      domain: context.conversationState.domain || inferDomain(context.conversationState.activeTitle || context.title),
      category: context.conversationState.category || "",
      riskLevel: computedRiskLevel
    },
    resolutionState: {
      lastResponseType: truncate(String(context.lastResponseType ?? ""), 60),
      lastStep: context.conversationState.lastStep,
      actionCount: context.conversationState.actionCount,
      unresolvedIndicators,
      attemptedSteps
    },
    problemStatement: buildProblemSummary(context.userMessages, context.title),
    lastUserMessage: context.lastUserMessage,
    privacy: {
      redactionApplied: true,
      rawAudioStored: false,
      containsKnownSensitivePattern: false
    },
    routingHints: {
      preferredNextStep: "host_application_route",
      suggestedQueue: inferQueue(context.conversationState.activeTitle || context.title),
      urgency: inferUrgency(computedRiskLevel, unresolvedIndicators)
    }
  };
}

function extractUnresolvedIndicators(userMessages) {
  const indicators = [];
  const patterns = [
    ["δεν λύθηκε", ["δεν λυθηκε", "δεν δουλευει", "δεν διορθωθηκε", "παλι", "επιμενει", "ακομα", "εξακολουθει"]],
    ["κόλλησε σε βήμα", ["κολλησα", "κολλησε", "βημα"]],
    ["χρειάζεται επόμενη ενέργεια", ["τι αλλο", "τι να κανω", "δεν ξερω"]]
  ];

  for (const message of userMessages) {
    const normalized = normalizeGreek(message.text);
    for (const [label, terms] of patterns) {
      if (terms.some((term) => normalized.includes(term))) {
        indicators.push(label);
      }
    }
  }

  return uniqueList(indicators);
}

function cleanText(value) {
  return truncate(
    redactText(String(value ?? ""))
      .replace(/\s+/g, " ")
      .trim(),
    MAX_MESSAGE_LENGTH
  );
}

function redactText(value) {
  return String(value ?? "")
    .replace(/\b\d{11}\b/g, "[REDACTED_AMKA]")
    .replace(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, "[REDACTED_IP]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/(?:\+30\s*)?\b(?:2\d{9}|69\d{8})\b/g, "[REDACTED_PHONE]")
    .replace(/\b(?:password|passwd|κωδικ(?:όσ|οσ|ο|ό)|κωδικο|κωδικό)\s*[:= -]*\S+/giu, "[REDACTED_SECRET]");
}

function inferDomain(title) {
  const normalized = normalizeGreek(title);
  if (containsAny(normalized, ["medico", "lis", "ris", "pacs", "agfa"])) {
    return "it-clinical-apps";
  }

  if (containsAny(normalized, ["δικτυο", "internet", "mis", "φιλιπποσ", "filippos"])) {
    return "it-network";
  }

  if (containsAny(normalized, ["εκτυπω", "scanner", "σαρωση"])) {
    return "it-devices";
  }

  if (containsAny(normalized, ["ρευμα", "διαρροη", "ανελκυστηρασ", "κλιματισμοσ", "φωτισμοσ"])) {
    return "facilities";
  }

  return "general-support";
}

function inferQueue(title) {
  const domain = inferDomain(title);
  if (domain === "facilities") {
    return "facilities";
  }

  return "it-support";
}

function inferRiskLevel(riskLevel, unresolvedIndicators) {
  if (riskLevel) {
    return riskLevel;
  }

  return unresolvedIndicators.length > 0 ? "normal-unresolved" : "normal";
}

function inferUrgency(riskLevel, unresolvedIndicators) {
  const normalizedRisk = normalizeGreek(riskLevel);
  if (containsAny(normalizedRisk, ["high", "critical", "κρισιμο", "υψηλο"])) {
    return "high";
  }

  if (unresolvedIndicators.length >= 2) {
    return "normal";
  }

  return "low";
}

function containsAny(value, patterns) {
  return patterns.some((pattern) => value.includes(pattern));
}

function normalizeGreek(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, maxLength) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength <= 3) {
    return text.slice(0, maxLength);
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function uniqueList(items) {
  return [...new Set(items.map((item) => String(item ?? "").trim()).filter(Boolean))];
}
