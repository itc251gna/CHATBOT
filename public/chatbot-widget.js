(function () {
  if (window.__hospitalIntranetChatbotLoaded) {
    return;
  }
  window.__hospitalIntranetChatbotLoaded = true;

  const script = document.currentScript;
  const dataset = script?.dataset || {};
  const defaults = {
    apiUrl: resolveUrl("/api/chat"),
    terminationUrl: resolveUrl("/api/termination"),
    topicsUrl: resolveUrl("/api/topics"),
    title: "Τεχνική υποστήριξη",
    subtitle: "Εσωτερική καθοδήγηση",
    launcherLabel: "?",
    speechLanguage: "el-GR",
    handoffMinMessages: 3,
    applicationContext: "",
    departmentContext: ""
  };
  const scriptConfig = compactObject({
    apiUrl: dataset.chatbotApi || dataset.apiUrl,
    terminationUrl: dataset.chatbotTermination || dataset.terminationUrl,
    topicsUrl: dataset.chatbotTopics || dataset.topicsUrl,
    title: dataset.title,
    subtitle: dataset.subtitle,
    launcherLabel: dataset.launcherLabel,
    speechLanguage: dataset.speechLanguage,
    handoffMinMessages: dataset.handoffMinMessages,
    applicationContext: dataset.appContext || dataset.applicationContext,
    departmentContext: dataset.departmentContext
  });
  const config = Object.assign({}, defaults, window.HospitalChatbot || {}, scriptConfig);
  config.apiUrl = resolveUrl(config.apiUrl);
  config.terminationUrl = resolveUrl(config.terminationUrl);
  config.topicsUrl = resolveUrl(config.topicsUrl);
  config.handoffMinMessages = Number.parseInt(config.handoffMinMessages, 10) || defaults.handoffMinMessages;
  const requestTimeoutMs = Number(config.requestTimeoutMs) || 12000;

  const host = document.createElement("div");
  host.id = "hospital-chatbot-host";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        color: #172033;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      .hc-root {
        bottom: 22px;
        position: fixed;
        right: 22px;
        z-index: 2147483000;
      }

      .hc-launcher {
        align-items: center;
        background: #0f766e;
        border: 0;
        border-radius: 999px;
        box-shadow: 0 14px 34px rgba(15, 23, 42, 0.24);
        color: #ffffff;
        cursor: pointer;
        display: inline-flex;
        font-size: 28px;
        font-weight: 700;
        height: 58px;
        justify-content: center;
        line-height: 1;
        transition: transform 160ms ease, background 160ms ease;
        width: 58px;
      }

      .hc-launcher:hover {
        background: #115e59;
        transform: translateY(-1px);
      }

      .hc-launcher:focus-visible,
      .hc-icon-button:focus-visible,
      .hc-chip:focus-visible,
      .hc-handoff:focus-visible,
      .hc-mic:focus-visible,
      .hc-send:focus-visible,
      .hc-input:focus-visible {
        outline: 3px solid rgba(245, 158, 11, 0.58);
        outline-offset: 2px;
      }

      .hc-launcher[hidden] {
        display: none;
      }

      .hc-panel {
        background: #ffffff;
        border: 1px solid #d6e0e8;
        border-radius: 8px;
        bottom: 76px;
        box-shadow: 0 22px 54px rgba(15, 23, 42, 0.26);
        display: grid;
        grid-template-rows: auto 1fr auto auto;
        height: min(620px, calc(100vh - 110px));
        overflow: hidden;
        position: absolute;
        right: 0;
        width: min(430px, calc(100vw - 32px));
      }

      .hc-panel[hidden] {
        display: none;
      }

      .hc-header {
        align-items: center;
        background: #172033;
        color: #ffffff;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        padding: 14px 16px;
      }

      .hc-title {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      .hc-title strong {
        font-size: 15px;
        font-weight: 700;
        line-height: 1.2;
      }

      .hc-title span {
        color: #a7f3d0;
        font-size: 12px;
        line-height: 1.2;
      }

      .hc-icon-button {
        align-items: center;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.32);
        border-radius: 6px;
        color: #ffffff;
        cursor: pointer;
        display: inline-flex;
        font-size: 20px;
        height: 34px;
        justify-content: center;
        line-height: 1;
        width: 34px;
      }

      .hc-messages {
        background: #f6f8fb;
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow-y: auto;
        padding: 14px;
      }

      .hc-message {
        border-radius: 8px;
        font-size: 14px;
        line-height: 1.45;
        max-width: 92%;
        padding: 10px 12px;
        white-space: pre-line;
      }

      .hc-message.bot {
        align-self: flex-start;
        background: #ffffff;
        border: 1px solid #dce5ee;
      }

      .hc-message.user {
        align-self: flex-end;
        background: #0f766e;
        color: #ffffff;
      }

      .hc-message.error {
        background: #fff7ed;
        border-color: #fed7aa;
        color: #7c2d12;
      }

      .hc-actions {
        margin-top: 10px;
      }

      .hc-actions strong {
        display: block;
        font-size: 13px;
        margin-bottom: 6px;
      }

      .hc-actions ol {
        margin: 0;
        padding-left: 20px;
      }

      .hc-actions li + li {
        margin-top: 5px;
      }

      .hc-suggestions {
        align-items: center;
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
        display: flex;
        gap: 8px;
        min-height: 48px;
        overflow-x: auto;
        padding: 8px 10px;
      }

      .hc-chip,
      .hc-handoff {
        border-radius: 999px;
        cursor: pointer;
        flex: 0 0 auto;
        font-size: 12px;
        font-weight: 650;
        line-height: 1.2;
        max-width: 220px;
        overflow: hidden;
        padding: 7px 10px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .hc-chip {
        background: #eef8f6;
        border: 1px solid #b8dfd9;
        color: #115e59;
      }

      .hc-handoff {
        background: #fff7ed;
        border: 1px solid #fdba74;
        color: #9a3412;
      }

      .hc-form {
        align-items: end;
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
        display: grid;
        gap: 8px;
        grid-template-columns: 1fr auto auto;
        padding: 10px;
      }

      .hc-input {
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        color: #172033;
        font: inherit;
        font-size: 14px;
        line-height: 1.35;
        max-height: 104px;
        min-height: 42px;
        outline: none;
        padding: 10px 11px;
        resize: vertical;
        width: 100%;
      }

      .hc-input:focus {
        border-color: #0f766e;
        box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
      }

      .hc-mic,
      .hc-send {
        align-items: center;
        border: 0;
        border-radius: 8px;
        cursor: pointer;
        display: inline-flex;
        font-size: 14px;
        font-weight: 750;
        height: 42px;
        justify-content: center;
      }

      .hc-mic {
        background: #e6f4f1;
        color: #115e59;
        min-width: 42px;
        padding: 0 10px;
      }

      .hc-mic.listening {
        background: #fee2e2;
        color: #991b1b;
      }

      .hc-mic.unavailable {
        background: #eef2f7;
        color: #64748b;
        cursor: help;
      }

      .hc-send {
        background: #f59e0b;
        color: #172033;
        min-width: 74px;
        padding: 0 14px;
      }

      .hc-mic:disabled,
      .hc-send:disabled {
        cursor: wait;
        opacity: 0.68;
      }

      @media (max-width: 520px) {
        .hc-root {
          bottom: 14px;
          right: 14px;
        }

        .hc-panel {
          bottom: 72px;
          height: min(620px, calc(100vh - 96px));
          width: calc(100vw - 28px);
        }
      }
    </style>

    <div class="hc-root">
      <section class="hc-panel" hidden aria-label="Τεχνική υποστήριξη">
        <header class="hc-header">
          <div class="hc-title">
            <strong></strong>
            <span></span>
          </div>
          <button class="hc-icon-button" type="button" aria-label="Κλείσιμο" title="Κλείσιμο">×</button>
        </header>
        <div class="hc-messages" role="log" aria-live="polite"></div>
        <div class="hc-suggestions" aria-label="Προτεινόμενα θέματα"></div>
        <form class="hc-form">
          <textarea class="hc-input" rows="1" autocomplete="off" placeholder="Περιγράψτε το πρόβλημα"></textarea>
          <button class="hc-mic" type="button" aria-label="Υπαγόρευση με μικρόφωνο" title="Υπαγόρευση με μικρόφωνο">&#127908;</button>
          <button class="hc-send" type="submit">Αποστολή</button>
        </form>
      </section>
      <button class="hc-launcher" type="button" aria-label="Άνοιγμα τεχνικής υποστήριξης" title="Τεχνική υποστήριξη"></button>
    </div>
  `;

  const panel = shadow.querySelector(".hc-panel");
  const launcher = shadow.querySelector(".hc-launcher");
  const closeButton = shadow.querySelector(".hc-icon-button");
  const messages = shadow.querySelector(".hc-messages");
  const suggestions = shadow.querySelector(".hc-suggestions");
  const form = shadow.querySelector(".hc-form");
  const input = shadow.querySelector(".hc-input");
  const micButton = shadow.querySelector(".hc-mic");
  const sendButton = shadow.querySelector(".hc-send");

  shadow.querySelector(".hc-title strong").textContent = config.title;
  shadow.querySelector(".hc-title span").textContent = config.subtitle;
  launcher.textContent = config.launcherLabel;

  let initialized = false;
  let busy = false;
  let busyGuardTimer = 0;
  let userMessageCount = 0;
  let conversationState = null;
  let conversationLog = [];
  let unresolvedCount = 0;
  let handoffAvailable = false;
  let lastResponseType = "";
  let lastTerminationSignal = null;
  let recognition = null;
  let micMode = "unavailable";
  let listening = false;
  let speechUnavailableMessage = "";

  launcher.addEventListener("click", openPanel);
  closeButton.addEventListener("click", closePanel);
  window.HospitalChatbotWidget = {
    open: openPanel,
    close: closePanel,
    reset: resetConversation,
    send: submitMessage,
    requestTermination: requestTerminationSignal,
    getTerminationSignal: () => lastTerminationSignal,
    isListening: () => listening
  };
  window.dispatchEvent(new CustomEvent("hospital-chatbot-ready"));
  setupSpeechRecognition();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitMessage(input.value);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage(input.value);
    }
  });

  function openPanel() {
    panel.hidden = false;
    launcher.hidden = true;
    input.focus();

    if (!initialized) {
      initialized = true;
      addMessage("bot", "Γεια σας. Μπορώ να σας καθοδηγήσω με τις διαθέσιμες οδηγίες του νοσοκομείου.", {
        record: false
      });
      loadTopics();
    }
  }

  function closePanel() {
    panel.hidden = true;
    launcher.hidden = false;
    resetConversation();
  }

  function resetConversation() {
    initialized = false;
    userMessageCount = 0;
    conversationState = null;
    conversationLog = [];
    unresolvedCount = 0;
    handoffAvailable = false;
    lastResponseType = "";
    lastTerminationSignal = null;
    messages.replaceChildren();
    suggestions.replaceChildren();
    input.value = "";
  }

  async function submitMessage(rawMessage) {
    const message = rawMessage.trim();
    if (!message || busy) {
      return;
    }

    input.value = "";
    userMessageCount += 1;
    setBusy(true);
    addMessage("user", message);

    try {
      const response = await fetchJson(config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          message,
          interactionCount: userMessageCount,
          conversationState,
          applicationContext: config.applicationContext || "",
          departmentContext: config.departmentContext || ""
        })
      });
      const payload = response.payload;
      lastResponseType = payload.type || "";
      updateConversationState(payload);
      addBotResponse(payload);
      if (handleConversationControl(payload)) {
        renderSuggestions(payload.suggestions || []);
        return;
      }
      updateHandoffAvailability(payload, message);
      renderSuggestions(payload.suggestions || []);
    } catch (error) {
      addConnectionError(error);
    } finally {
      setBusy(false);
    }
  }

  async function loadTopics() {
    try {
      const { payload } = await fetchJson(config.topicsUrl);
      renderSuggestions(payload.topics || []);
    } catch {
      renderSuggestions([]);
    }
  }

  function addBotResponse(payload) {
    const answer = payload.answer || "Δεν βρέθηκε ακόμη απάντηση για αυτό το θέμα.";
    const text = payload.title ? `${payload.title}\n\n${answer}` : answer;
    const wrapper = addMessage("bot", text, {
      meta: {
        title: payload.title || "",
        type: payload.type || "",
        actions: payload.actions || []
      }
    });

    if (Array.isArray(payload.actions) && payload.actions.length > 0) {
      const actions = document.createElement("div");
      actions.className = "hc-actions";

      const title = document.createElement("strong");
      title.textContent = "Ενέργειες";

      const list = document.createElement("ol");
      for (const action of payload.actions) {
        const item = document.createElement("li");
        item.textContent = action;
        list.appendChild(item);
      }

      actions.append(title, list);
      wrapper.appendChild(actions);
    }
  }

  function updateConversationState(payload) {
    if (payload?.type === "control" || payload?.conversationState === null) {
      conversationState = null;
      return;
    }

    if (payload?.conversationState) {
      conversationState = payload.conversationState;
      return;
    }

    if (payload?.type === "match" && payload.entryId) {
      conversationState = {
        activeEntryId: payload.entryId,
        activeTitle: payload.title || "",
        actionCount: Array.isArray(payload.actions) ? payload.actions.length : 0,
        lastStep: null
      };
      return;
    }

    if (payload?.type === "help" || payload?.type === "clarification") {
      conversationState = null;
    }
  }

  function handleConversationControl(payload) {
    if (payload?.type !== "control") {
      return false;
    }

    conversationState = null;
    conversationLog = [];
    unresolvedCount = 0;
    handoffAvailable = false;
    lastTerminationSignal = null;
    userMessageCount = 0;
    return true;
  }

  function updateHandoffAvailability(payload, userText) {
    const normalized = normalizeClientText(userText);
    const userIsStillStuck = [
      "δεν λυθηκε",
      "δεν δουλευει",
      "παλι",
      "επιμενει",
      "κολλησα",
      "κολλησε",
      "δεν μπορω",
      "δεν ξερω",
      "δεν λυνεται",
      "δεν εφτιαξε",
      "δεν διορθωθηκε",
      "δεν βοηθησε",
      "δεν πετυχε",
      "ακομα",
      "τι αλλο",
      "τι να κανω"
    ].some((pattern) => normalized.includes(pattern));

    if (payload.type === "fallback") {
      unresolvedCount += 1;
    } else if (payload.type === "followup" && userIsStillStuck) {
      unresolvedCount += 1;
    } else if (userIsStillStuck && userMessageCount >= 2) {
      unresolvedCount += 1;
    } else {
      unresolvedCount = Math.max(0, unresolvedCount - 1);
    }

    handoffAvailable =
      userMessageCount >= config.handoffMinMessages &&
      (unresolvedCount >= 2 || userIsStillStuck || payload.type === "fallback");
  }

  async function requestTerminationSignal(reason = "unable_to_resolve_after_attempts") {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      const { payload } = await fetchJson(config.terminationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          messages: conversationLog,
          conversationState,
          reason,
          lastResponseType
        })
      });

      lastTerminationSignal = payload;
      handoffAvailable = false;
      window.dispatchEvent(
        new CustomEvent("hospital-chatbot-termination", {
          detail: lastTerminationSignal
        })
      );
      addMessage(
        "bot",
        "Δεν μπόρεσα να λύσω το θέμα με τις διαθέσιμες οδηγίες. Ετοίμασα μια σύντομη περίληψη της συνομιλίας, ώστε η συνέχεια να γίνει από το σωστό σημείο.",
        { record: false }
      );
      renderSuggestions([]);
    } catch (error) {
      addConnectionError(error);
    } finally {
      setBusy(false);
    }
  }

  function addMessage(role, text, options = {}) {
    const message = document.createElement("div");
    message.className = `hc-message ${role}`;
    message.textContent = text;
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;

    if (options.record !== false) {
      recordMessage(role, text, options.meta);
    }

    return message;
  }

  function recordMessage(role, text, meta = {}) {
    conversationLog.push({
      role: role.startsWith("user") ? "user" : "bot",
      text: String(text ?? "").trim(),
      title: meta.title || "",
      type: meta.type || "",
      actions: Array.isArray(meta.actions) ? meta.actions : []
    });
    conversationLog = conversationLog.slice(-30);
  }

  function renderSuggestions(items) {
    suggestions.replaceChildren();

    if (handoffAvailable) {
      const handoff = document.createElement("button");
      handoff.className = "hc-handoff";
      handoff.type = "button";
      handoff.textContent = "Δεν λύθηκε";
      handoff.title = "Συνέχεια εκτός chatbot με σύνοψη συνομιλίας";
      handoff.addEventListener("click", () => requestTerminationSignal());
      suggestions.appendChild(handoff);
    }

    for (const item of items.slice(0, 6)) {
      const chip = document.createElement("button");
      chip.className = "hc-chip";
      chip.type = "button";
      chip.textContent = item.title || String(item);
      chip.title = Array.isArray(item.keywords) ? item.keywords.join(", ") : chip.textContent;
      chip.addEventListener("click", () => submitMessage(chip.textContent));
      suggestions.appendChild(chip);
    }
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    sendButton.disabled = nextBusy;
    input.disabled = nextBusy;
    micButton.disabled = (nextBusy && !listening) || !canUseMicButton();
    sendButton.textContent = nextBusy ? "..." : "Αποστολή";

    window.clearTimeout(busyGuardTimer);
    if (nextBusy) {
      busyGuardTimer = window.setTimeout(() => {
        if (!busy) {
          return;
        }

        addMessage("bot error", "Η απάντηση άργησε περισσότερο από το αναμενόμενο. Το πεδίο ξεκλειδώθηκε για να δοκιμάσετε ξανά.", {
          record: false
        });
        setBusy(false);
      }, requestTimeoutMs + 2000);
    }
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const message = payload.error || `HTTP ${response.status}`;
        throw new Error(message);
      }

      return { response, payload };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function addConnectionError(error) {
    const timeoutMessage = "Η υπηρεσία τεχνικής υποστήριξης δεν απάντησε εγκαίρως. Δοκιμάστε ξανά σε λίγα δευτερόλεπτα.";
    const genericMessage = "Δεν ήταν δυνατή η σύνδεση με την υπηρεσία τεχνικής υποστήριξης. Δοκιμάστε ξανά.";
    addMessage("bot error", error?.name === "AbortError" ? timeoutMessage : genericMessage, {
      record: false
    });
  }

  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const secureLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

    micButton.addEventListener("click", handleMicButtonClick);

    if (!window.isSecureContext && !secureLocalhost) {
      const secureContextMessage =
        window.location.protocol === "https:"
          ? "Το μικρόφωνο απαιτεί HTTPS με αξιόπιστο πιστοποιητικό. Το τρέχον HTTPS δεν θεωρείται πλήρως ασφαλές από τον browser."
          : "Το μικρόφωνο στον browser απαιτεί HTTPS ή localhost. Η εφαρμογή τώρα ανοίγει με HTTP, οπότε η υπαγόρευση δεν μπορεί να ενεργοποιηθεί.";
      configureUnavailableSpeech(secureContextMessage);
      return;
    }

    if (!SpeechRecognition) {
      configureUnavailableSpeech("Ο τρέχων browser δεν υποστηρίζει υπαγόρευση με Web Speech API. Χρησιμοποιήστε Chrome/Edge ή πληκτρολογήστε στο πεδίο.");
      return;
    }

    micMode = "dictation";
    recognition = new SpeechRecognition();
    recognition.lang = config.speechLanguage || "el-GR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.addEventListener("result", (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      if (!transcript) {
        return;
      }

      input.value = input.value ? `${input.value.trim()} ${transcript}` : transcript;
      input.focus();
    });

    recognition.addEventListener("end", () => {
      listening = false;
      updateMicButton();
    });

    recognition.addEventListener("error", (event) => {
      listening = false;
      updateMicButton();
      addSpeechErrorMessage(event?.error);
    });

    updateMicButton();
  }

  function configureUnavailableSpeech(message) {
    micMode = "unavailable";
    speechUnavailableMessage = message;
    micButton.classList.add("unavailable");
    micButton.disabled = false;
    micButton.title = message;
    micButton.setAttribute("aria-label", message);
  }

  function handleMicButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (micMode === "dictation") {
      toggleSpeechRecognition();
      return;
    }

    if (speechUnavailableMessage) {
      addMessage("bot error", speechUnavailableMessage, { record: false });
    }
  }

  function toggleSpeechRecognition() {
    if (!recognition || busy) {
      return;
    }

    if (listening) {
      recognition.stop();
      return;
    }

    try {
      recognition.start();
      listening = true;
      updateMicButton();
    } catch {
      listening = false;
      updateMicButton();
      addSpeechErrorMessage();
    }
  }

  function updateMicButton() {
    micButton.classList.toggle("listening", listening);
    micButton.setAttribute("aria-pressed", String(listening));
    micButton.title = listening ? "Διακοπή υπαγόρευσης" : "Υπαγόρευση με μικρόφωνο";
    micButton.setAttribute("aria-label", micButton.title);
  }

  function addSpeechErrorMessage(reason) {
    const messages = {
      "not-allowed": "Δεν δόθηκε άδεια μικροφώνου στον browser.",
      "service-not-allowed": "Η υπηρεσία υπαγόρευσης δεν επιτρέπεται από τον browser ή την πολιτική του σταθμού.",
      network: "Η υπαγόρευση δεν μπόρεσε να συνδεθεί στην υπηρεσία αναγνώρισης φωνής του browser.",
      "no-speech": "Δεν ακούστηκε καθαρή φωνή. Δοκιμάστε ξανά ή γράψτε στο πεδίο κειμένου."
    };
    addMessage("bot error", messages[reason] || "Δεν ήταν δυνατή η ενεργοποίηση μικροφώνου. Γράψτε στο πεδίο κειμένου.", {
      record: false
    });
  }

  function canUseMicButton() {
    return micMode === "dictation" || Boolean(speechUnavailableMessage);
  }

  function normalizeClientText(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ς/g, "σ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function resolveUrl(pathname) {
    try {
      return new URL(pathname, script?.src || window.location.href).toString();
    } catch {
      return pathname;
    }
  }

  function compactObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
  }
})();
