import { normalizeText, tokenize } from "./text-normalizer.js";

const HELP_PATTERNS = [
  "βοηθεια",
  "help",
  "τι μπορω να κανω",
  "τι μπορεισ να κανεισ",
  "τι μπορει να κανει",
  "θεματα",
  "μενου",
  "menu"
];

const STOPWORDS = new Set([
  "ο",
  "η",
  "το",
  "οι",
  "τα",
  "τι",
  "να",
  "σε",
  "με",
  "απο",
  "από",
  "ή",
  "η",
  "που",
  "πως",
  "πώς",
  "αλλά",
  "αλλα",
  "άλλο",
  "αλλο",
  "είναι",
  "ειναι",
  "κάνω",
  "κανω",
  "και",
  "για",
  "στο",
  "στη",
  "στην",
  "στον",
  "των",
  "την",
  "τον",
  "μια",
  "ενα",
  "ένα",
  "δεν",
  "μου",
  "μασ",
  "σασ",
  "the",
  "and",
  "for"
].map(normalizeText));

const ESCALATION_PATTERNS = [
  "helpdesk",
  "ticket",
  "αίτημα",
  "αιτημα",
  "ανοίξτε αίτημα",
  "ανοιξτε αιτημα",
  "επικοινωνήστε",
  "επικοινωνηστε",
  "ενημερώστε",
  "ενημερωστε",
  "ειδοποιήστε",
  "ειδοποιηστε",
  "υποστήριξη",
  "υποστηριξη"
].map(normalizeText);

const IMMEDIATE_ESCALATION_PATTERNS = [
  "άμεσος κίνδυνος",
  "αμεσος κινδυνος",
  "κίνδυνος",
  "κινδυνος",
  "ασφάλεια ασθενών",
  "ασφαλεια ασθενων",
  "ασθενή ή ενεργή θεραπεία",
  "ασθενη η ενεργη θεραπεια",
  "μεταφορά ασθενών",
  "μεταφορα ασθενων",
  "κλινική λειτουργία",
  "κλινικη λειτουργια",
  "πολλοί χρήστες",
  "πολλοι χρηστες",
  "πολλούς χρήστες",
  "πολλουσ χρηστεσ",
  "σπινθήρας",
  "σπινθηρας",
  "καπνός",
  "καπνοσ",
  "καμένη",
  "καμενη",
  "εγκλωβισ",
  "οξυγόνο",
  "οξυγονο",
  "ιατρικά αέρια",
  "ιατρικα αερια",
  "ρεύμα",
  "ρευμα",
  "διαρροή",
  "διαρροη",
  "ανελκυστήρας",
  "ανελκυστηρας",
  "ασανσέρ",
  "ασανσερ",
  "φάρμακα",
  "φαρμακα",
  "εμβόλια",
  "εμβολια",
  "δείγματα",
  "δειγματα",
  "κρίσιμο",
  "κρισιμο"
].map(normalizeText);

const FOLLOWUP_PATTERNS = [
  "κόλλησα",
  "κολλησα",
  "κόλλησα στο",
  "κολλησα στο",
  "βήμα",
  "βημα",
  "step",
  "δεν μπορώ",
  "δεν μπορω",
  "δεν βρίσκω",
  "δεν βρισκω",
  "δεν εμφανίζεται",
  "δεν εμφανιζεται",
  "μου βγάζει",
  "μου βγαζει",
  "σφάλμα",
  "σφαλμα",
  "error",
  "το έκανα",
  "το εκανα",
  "το δοκίμασα",
  "το δοκιμασα",
  "δεν άλλαξε",
  "δεν αλλαξε",
  "δεν έγινε",
  "δεν εγινε",
  "δεν διορθώθηκε",
  "δεν διορθωθηκε",
  "δεν διορθώθικε",
  "δεν διορθωθικε",
  "δεν λύθηκε",
  "δεν λυθηκε",
  "δεν λύνεται",
  "δεν λυνεται",
  "δεν έφτιαξε",
  "δεν εφτιαξε",
  "δεν βοήθησε",
  "δεν βοηθησε",
  "ακόμα",
  "ακομα",
  "εξακολουθεί",
  "εξακολουθει",
  "παραμένει",
  "παραμενει",
  "δεν ξέρω",
  "δεν ξερω",
  "τι άλλο",
  "τι αλλο",
  "τι να κάνω",
  "τι να κανω",
  "τι κάνω",
  "τι κανω",
  "φταίει",
  "φταιει",
  "μάλλον",
  "μαλλον",
  "μετά τι",
  "μετα τι",
  "συνέχεια",
  "συνεχεια",
  "επόμενο",
  "επομενο"
].map(normalizeText);

const CONTEXT_SWITCH_PATTERNS = [
  "αλλαγή θέματος",
  "αλλαγη θεματος",
  "άλλαξε θέμα",
  "αλλαξε θεμα",
  "αλλάζω θέμα",
  "αλλαζω θεμα",
  "θέλω άλλο θέμα",
  "θελω αλλο θεμα",
  "θέλω να αλλάξω θέμα",
  "θελω να αλλαξω θεμα",
  "νέο θέμα",
  "νεο θεμα",
  "άλλο πρόβλημα",
  "αλλο προβλημα",
  "άλλη ερώτηση",
  "αλλη ερωτηση",
  "αλλαγή context",
  "αλλαγη context",
  "change context",
  "new topic",
  "reset context",
  "ξεκινάμε από την αρχή",
  "ξεκιναμε απο την αρχη"
].map(normalizeText);

const CONTEXT_REFOCUS_PATTERNS = [
  "δεν αφορά",
  "δεν αφορα",
  "δεν είναι αυτό",
  "δεν ειναι αυτο",
  "δεν εννοώ αυτό",
  "δεν εννοω αυτο",
  "όχι αυτό",
  "οχι αυτο",
  "άλλο εννοώ",
  "αλλο εννοω",
  "λάθος θέμα",
  "λαθοσ θεμα",
  "λάθος κατηγορία",
  "λαθοσ κατηγορια",
  "αφορά αποθέματα",
  "αφορα αποθεματα",
  "αφορά κρατήσεις",
  "αφορα κρατησεις",
  "αφορά τιμολόγιο",
  "αφορα τιμολογιο",
  "αφορά αγορά",
  "αφορα αγορα",
  "αφορά προϋπολογισμό",
  "αφορα προυπολογισμο",
  "αφορά δεσμεύσεις",
  "αφορα δεσμευσεις",
  "αφορά δέσμευση",
  "αφορα δεσμευση",
  "αφορά γενική λογιστική",
  "αφορα γενικη λογιστικη",
  "αφορά προμηθευτές",
  "αφορα προμηθευτες",
  "αφορά πελάτες",
  "αφορα πελατες",
  "αφορά ταμείο",
  "αφορα ταμειο",
  "αφορά εντάλματα",
  "αφορα ενταλματα"
].map(normalizeText);

const SPECIFIC_REFOCUS_CODE_PATTERN =
  /\b(?:migo|miro|mmpv|mb\d+[a-zα-ω]?|μβ\d+[a-zα-ω]?|mm\d+|μμ\d+|mmbe|μμβε|me\d+[a-zα-ω]?|με\d+[a-zα-ω]?|mr8m|μr8m|fi\s+(?:bugr?|desmr?|glm|glr|apr|arr|tamr?|archr|αρχr)\s*\d+)\b/u;

const KNOWLEDGE_FAMILY_PROFILES = [
  {
    id: "sap",
    tokens: [
      "sap",
      "μησπυ",
      "mispy",
      "mb21",
      "μβ21",
      "mb22",
      "mb23",
      "mb25",
      "mb51",
      "migo",
      "miro",
      "mr8m",
      "mmpv",
      "mmbe",
      "me51n",
      "me21n",
      "αποθεμα",
      "αποθεματα",
      "κρατηση",
      "υλικο",
      "υλικα",
      "αγορα",
      "τιμολογιο",
      "fi",
      "bug",
      "bugr",
      "desm",
      "desmr",
      "glm",
      "glr",
      "apr",
      "arr",
      "tam",
      "tamr",
      "προυπολογισμοσ",
      "δεσμευση",
      "λογιστικη",
      "καθολικο",
      "καε",
      "προμηθευτησ",
      "πελατησ",
      "ταμειο",
      "ενταλμα"
    ]
  },
  {
    id: "medico",
    tokens: ["medico", "ασθενων", "παραπεμπτικο", "βιοψια", "καρτελα", "εξιτηριο"]
  },
  {
    id: "lis",
    tokens: ["lis", "tdlab", "εργαστηριο", "εργαστηριακα"]
  },
  {
    id: "pacs",
    tokens: ["pacs", "ris", "agfa", "απεικονιστικο", "ακτινολογικο"]
  },
  {
    id: "printer",
    tokens: ["εκτυπωτησ", "printer", "εκτυπωση", "barcode", "toner"]
  },
  {
    id: "network",
    tokens: ["δικτυο", "φιλιπποσ", "filippos", "mis", "internet", "ethernet", "lan"]
  },
  {
    id: "facilities",
    tokens: ["ρευμα", "διαρροη", "φωτισμοσ", "ανελκυστηρασ", "κλιματισμοσ"]
  }
].map((profile) => ({
  ...profile,
  tokens: profile.tokens.flatMap((token) => tokenize(token))
}));

const CONVERSATION_CONTROL_INTENTS = [
  {
    action: "end",
    title: "Τέλος συνομιλίας",
    exact: [
      "τέλος",
      "τελος",
      "τέλος συνομιλίας",
      "τελος συνομιλιας",
      "λήξη συνομιλίας",
      "ληξη συνομιλιας",
      "τερματισμός συνομιλίας",
      "τερματισμος συνομιλιας",
      "τέλος chat",
      "τελος chat",
      "κλείσιμο chat",
      "κλεισιμο chat",
      "τέρμα",
      "τερμα",
      "έξοδος",
      "εξοδοσ",
      "bye",
      "goodbye",
      "exit",
      "quit",
      "ευχαριστώ",
      "ευχαριστω",
      "ευχαριστώ πολύ",
      "ευχαριστω πολυ",
      "οκ ευχαριστώ",
      "οκ ευχαριστω"
    ],
    phrases: [
      "κλείσε τη συνομιλία",
      "κλεισε τη συνομιλια",
      "κλείσε το chat",
      "κλεισε το chat",
      "κλείσε το παράθυρο",
      "κλεισε το παραθυρο",
      "τερμάτισε τη συνομιλία",
      "τερματισε τη συνομιλια",
      "ολοκλήρωση συνομιλίας",
      "ολοκληρωση συνομιλιας",
      "δεν χρειάζομαι κάτι άλλο",
      "δεν χρειαζομαι κατι αλλο",
      "ευχαριστώ δεν χρειάζομαι",
      "ευχαριστω δεν χρειαζομαι",
      "thanks bye",
      "thank you bye"
    ],
    answer: "Η συνομιλία ολοκληρώθηκε. Δεν θα συνεχίσω στο προηγούμενο θέμα. Αν χρειαστείτε κάτι άλλο, γράψτε νέο πρόβλημα ή ανοίξτε ξανά το chat.",
    actions: []
  },
  {
    action: "cancel",
    title: "Ακύρωση συνομιλίας",
    exact: [
      "άκυρο",
      "ακυρο",
      "cancel",
      "cancel chat",
      "άστο",
      "αστο",
      "άστο καλύτερα",
      "αστο καλυτερα",
      "stop",
      "stop chat",
      "σταμάτα",
      "σταματα"
    ],
    phrases: [
      "ακύρωση συνομιλίας",
      "ακυρωση συνομιλιας",
      "ακύρωσε τη συνομιλία",
      "ακυρωσε τη συνομιλια",
      "ακύρωσε το chat",
      "ακυρωσε το chat",
      "σταμάτα τη συνομιλία",
      "σταματα τη συνομιλια",
      "σταμάτα το chat",
      "σταματα το chat",
      "σταματάμε εδώ",
      "σταματαμε εδω",
      "δεν θέλω να συνεχίσω",
      "δεν θελω να συνεχισω",
      "forget it"
    ],
    answer: "Ακύρωσα την τρέχουσα συνομιλία και καθάρισα το ενεργό θέμα. Μπορείτε να ξεκινήσετε από την αρχή με νέο πρόβλημα.",
    actions: []
  },
  {
    action: "reset",
    title: "Νέα συνομιλία",
    exact: [
      "reset",
      "restart",
      "new chat",
      "νέα συνομιλία",
      "νεα συνομιλια",
      "νέο chat",
      "νεο chat",
      "νέο ερώτημα",
      "νεο ερωτημα",
      "άλλη απορία",
      "αλλη απορια",
      "καθάρισε",
      "καθαρισε"
    ],
    phrases: [
      "ξεκίνα από την αρχή",
      "ξεκινα απο την αρχη",
      "ξεκινάμε από την αρχή",
      "ξεκιναμε απο την αρχη",
      "ξεκίνα νέα συνομιλία",
      "ξεκινα νεα συνομιλια",
      "ξεκινάμε νέο θέμα",
      "ξεκιναμε νεο θεμα",
      "καθάρισε τη συνομιλία",
      "καθαρισε τη συνομιλια",
      "καθάρισε το context",
      "καθαρισε το context",
      "μηδένισε το context",
      "μηδενισε το context",
      "clear chat",
      "clear conversation",
      "start over"
    ],
    answer: "Ξεκινάμε από την αρχή. Γράψτε το νέο πρόβλημα με 2-3 συγκεκριμένες λέξεις, την εφαρμογή ή συσκευή που αφορά και το μήνυμα που εμφανίζεται.",
    actions: []
  }
].map((intent) => ({
  ...intent,
  exact: new Set(intent.exact.map(normalizeText)),
  phrases: intent.phrases.map(normalizeText)
}));

const STEP_WORDS = new Map(
  [
    ["ένα", 1],
    ["ενα", 1],
    ["πρώτο", 1],
    ["πρωτο", 1],
    ["πρώτη", 1],
    ["πρωτη", 1],
    ["δύο", 2],
    ["δυο", 2],
    ["δεύτερο", 2],
    ["δευτερο", 2],
    ["δεύτερη", 2],
    ["δευτερη", 2],
    ["τρία", 3],
    ["τρια", 3],
    ["τρίτο", 3],
    ["τριτο", 3],
    ["τρίτη", 3],
    ["τριτη", 3],
    ["τέσσερα", 4],
    ["τεσσερα", 4],
    ["τέταρτο", 4],
    ["τεταρτο", 4],
    ["τέταρτη", 4],
    ["τεταρτη", 4],
    ["πέντε", 5],
    ["πεντε", 5],
    ["πέμπτο", 5],
    ["πεμπτο", 5],
    ["πέμπτη", 5],
    ["πεμπτη", 5],
    ["έξι", 6],
    ["εξι", 6],
    ["έκτο", 6],
    ["εκτο", 6],
    ["επτά", 7],
    ["επτα", 7],
    ["έβδομο", 7],
    ["εβδομο", 7],
    ["οκτώ", 8],
    ["οκτω", 8],
    ["όγδοο", 8],
    ["ογδοο", 8],
    ["εννιά", 9],
    ["εννια", 9],
    ["ένατο", 9],
    ["ενατο", 9],
    ["δέκα", 10],
    ["δεκα", 10],
    ["δέκατο", 10],
    ["δεκατο", 10]
  ].map(([word, step]) => [normalizeText(word), step])
);

const NETWORK_AMBIGUITY_PATTERNS = [
  "δίκτυο",
  "δικτυο",
  "network",
  "intranet",
  "internet",
  "δεν έχει δίκτυο",
  "δεν εχει δικτυο",
  "πρόβλημα δικτύου",
  "προβλημα δικτυου"
].map(normalizeText);

const NETWORK_CONTEXT_PATTERNS = [
  "φιλιππος",
  "filippos",
  "mis",
  "διαβαθμισ",
  "αεροπορ",
  "εσωτερικο",
  "νοσοκομειακο",
  "ενσυρματο",
  "ethernet",
  "lan",
  "internet",
  "ιντερνετ",
  "ίντερνετ",
  "διαδικτυο",
  "διαδίκτυο",
  "web",
  "browser",
  "chrome",
  "edge",
  "ιστοσελιδα",
  "ιστοσελίδα",
  "site",
  "καλωδιο",
  "πριζα δικτυου",
  "link",
  "medico",
  "εφαρμογη ασθενων",
  "lis",
  "tdlab",
  "ris",
  "pacs",
  "agfa",
  "απεικονιστικο",
  "εκτυπωτη",
  "printer",
  "scanner"
].map(normalizeText);

const SEMANTIC_NOISE_TOKENS = new Set(
  [
    "προβλημα",
    "βλαβη",
    "θεμα",
    "λαθοσ",
    "σφαλμα",
    "δεν",
    "δουλευει",
    "λειτουργει",
    "ανοιγει",
    "κανει",
    "υπαρχει",
    "χρειαζεται",
    "help",
    "ticket"
  ].map(normalizeText)
);

const SEMANTIC_SYNONYM_GROUPS = [
  ["medico", "εφαρμογη", "ασθενων", "ασθενη", "παραγγελια", "παραπεμπτικο"],
  ["agfa", "ris", "pacs", "απεικονιστικο", "απεικονιστικοσ", "ακτινολογικο", "εικονα"],
  ["filippos", "φιλιπποσ", "εσωτερικο", "ενσυρματο", "lan", "ethernet", "πριζα", "καλωδιο"],
  ["mis", "διαβαθμισμενο", "αεροπορια", "haf", "gea"],
  ["internet", "ιντερνετ", "διαδικτυο", "web", "ιστοσελιδα", "browser", "site"],
  ["printer", "εκτυπωτησ", "εκτυπωση", "τυπωνει", "χαρτι", "toner"],
  ["scanner", "σαρωση", "scan", "ψηφιοποιηση"],
  ["email", "mail", "outlook", "gmail", "haf"],
  ["λογαριασμοσ", "χρηστησ", "login", "password", "προσβαση", "δικαιωμα"],
  ["word", "excel", "pdf", "office", "εγγραφο", "αρχειο"],
  ["οθονη", "monitor", "display", "αναλυση"],
  ["πληκτρολογιο", "ποντικι", "mouse", "keyboard", "kvm"],
  ["ρευμα", "πριζα", "φωτισμοσ", "λαμπα", "ups"],
  ["διαρροη", "νερο", "υδραυλικο"],
  ["κλιματισμοσ", "aircondition", "ac", "θερμανση", "ψυξη"],
  ["ανελκυστηρασ", "ασανσερ", "elevator"]
].map((group) => group.map(normalizeText));

const SEMANTIC_SYNONYMS = buildSemanticSynonyms(SEMANTIC_SYNONYM_GROUPS);

const APPLICATION_CONTEXT_PROFILES = [
  {
    id: "medico",
    aliases: ["medico", "εφαρμογη ασθενων", "ασθενων", "clinical", "patient"],
    tokens: ["medico", "εφαρμογη", "ασθενων", "παραγγελια", "παραπεμπτικο", "εξεταση"]
  },
  {
    id: "pacs",
    aliases: ["pacs", "ris", "agfa", "απεικονιστικο", "imaging"],
    tokens: ["pacs", "ris", "agfa", "απεικονιστικο", "ακτινολογικο"]
  },
  {
    id: "internet",
    aliases: ["internet", "web", "browser", "ιντερνετ"],
    tokens: ["internet", "ιντερνετ", "ιστοσελιδα", "browser", "web"]
  },
  {
    id: "network",
    aliases: ["network", "filippos", "φιλιππος", "lan", "δικτυο"],
    tokens: ["δικτυο", "φιλιππος", "filippos", "lan", "ethernet", "πριζα"]
  },
  {
    id: "mis",
    aliases: ["mis", "διαβαθμισμενο", "haf"],
    tokens: ["mis", "διαβαθμισμενο", "αεροπορια", "haf"]
  },
  {
    id: "sap",
    aliases: ["sap", "sap-mm", "sap-fi", "mm", "fi", "mmpv", "migo", "miro"],
    tokens: [
      "sap",
      "μησπυ",
      "mispy",
      "αποθεματα",
      "κρατηση",
      "υλικα",
      "αγορα",
      "τιμολογιο",
      "προυπολογισμοσ",
      "δεσμευση",
      "λογιστικη",
      "καθολικο",
      "καε",
      "προμηθευτησ",
      "πελατησ",
      "ταμειο",
      "ενταλμα"
    ]
  },
  {
    id: "facilities",
    aliases: ["facilities", "εγκαταστασεις", "building"],
    tokens: ["ρευμα", "διαρροη", "φωτισμοσ", "ανελκυστηρασ", "κλιματισμοσ", "υδραυλικο"]
  }
].map((profile) => ({
  ...profile,
  aliases: profile.aliases.map(normalizeText),
  tokens: profile.tokens.flatMap((token) => tokenize(token))
}));

const LOW_SPECIFICITY_CONTEXT_PHRASES = [
  "δεν ανοίγει",
  "δεν δουλεύει",
  "δεν λειτουργεί",
  "δεν μπαίνει",
  "δεν φορτώνει",
  "κολλάει",
  "αργεί",
  "σφάλμα",
  "πρόβλημα"
].map(normalizeText);

const COMPETING_CONTEXT_TOKEN_GROUPS = [
  { id: "computer", tokens: ["υπολογιστής", "ηυ", "pc", "laptop", "σταθμός εργασίας"] },
  { id: "printer", tokens: ["εκτυπωτής", "printer", "εκτύπωση", "toner", "χαρτί"] },
  { id: "pacs", tokens: ["pacs", "ris", "agfa", "απεικονιστικό", "ακτινολογικό"] },
  { id: "internet", tokens: ["internet", "ίντερνετ", "διαδίκτυο", "web", "browser", "ιστοσελίδα"] },
  { id: "network", tokens: ["δίκτυο", "φιλιππος", "filippos", "lan", "ethernet", "καλώδιο"] },
  { id: "mis", tokens: ["mis", "διαβαθμισμένο", "αεροπορία", "haf"] },
  { id: "facilities", tokens: ["ρεύμα", "διαρροή", "φωτισμός", "ανελκυστήρας", "κλιματισμός"] }
].map((group) => ({
  id: group.id,
  tokens: group.tokens.flatMap((token) => tokenize(token))
}));

export function createChatEngine(entries, options = {}) {
  const preparedEntries = prepareEntries(entries);
  const minimumScore = options.minimumScore ?? 6;

  return {
    answer(message, context = {}) {
      return answerMessage(preparedEntries, message, minimumScore, context);
    },
    search(message, searchOptions = {}) {
      return searchKnowledge(preparedEntries, message, {
        minimumScore,
        ...searchOptions
      });
    },
    topics(limit = 8) {
      return preparedEntries.slice(0, limit).map(toTopic);
    },
    entries: preparedEntries
  };
}

export function findMatches(entries, message, limit = 3) {
  const preparedEntries = entries[0]?.search ? entries : prepareEntries(entries);
  const query = prepareQuery(message);

  if (!query.normalized) {
    return [];
  }

  return preparedEntries
    .map((entry) => scoreEntry(entry, query, { applicationContext: null }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.priority - a.entry.priority)
    .slice(0, limit);
}

export function searchKnowledge(entries, message, options = {}) {
  const preparedEntries = entries[0]?.search ? entries : prepareEntries(entries);
  const query = prepareQuery(message);
  const limit = Number.parseInt(options.limit ?? "8", 10) || 8;
  const minimumSearchScore = Number(options.minimumSearchScore ?? 3.5);
  const searchContext = {
    applicationContext: options.applicationContext ?? options.appContext ?? options.departmentContext ?? null
  };

  if (!query.normalized) {
    return {
      query: String(message ?? ""),
      normalizedQuery: "",
      results: [],
      requiresDisambiguation: false,
      suggestions: preparedEntries.slice(0, limit).map(toTopic)
    };
  }

  const bm25Stats = buildBm25Stats(preparedEntries);
  const results = preparedEntries
    .map((entry) => {
      const lexical = scoreEntry(entry, query, searchContext);
      const semantic = scoreSemanticEntry(entry, query);
      const bm25 = scoreBm25Entry(entry, query, bm25Stats);
      const primaryScore = Math.max(lexical.score, semantic.score, bm25.score);
      const secondaryScore = [lexical.score, semantic.score, bm25.score]
        .sort((a, b) => b - a)
        .at(1) ?? 0;
      const score = primaryScore + secondaryScore * 0.12;
      return toSearchResult(entry, lexical, semantic, bm25, score);
    })
    .filter((result) => result.score >= minimumSearchScore)
    .sort((a, b) => b.score - a.score || b.priority - a.priority || a.title.localeCompare(b.title, "el"))
    .slice(0, limit)
    .map((result, index, allResults) => ({
      ...result,
      rank: index + 1,
      confidence: calculateSearchConfidence(result.score, allResults[index + 1]?.score ?? 0)
    }));

  return {
    query: String(message ?? ""),
    normalizedQuery: query.normalized,
    results,
    requiresDisambiguation: searchNeedsDisambiguation(results),
    suggestions: results.slice(0, 6).map((result) => ({
      id: result.entryId,
      title: result.title,
      keywords: result.matchedKeywords
    }))
  };
}

function answerMessage(entries, message, minimumScore, context = {}) {
  const query = prepareQuery(message);
  const topics = entries.slice(0, 6).map(toTopic);
  const activeEntry = resolveActiveEntry(entries, context);
  const conversationControl = detectConversationControl(query.normalized);
  const wantsContextSwitch = isContextSwitchQuery(query.normalized);
  const matches = findMatchesWithContext(entries, message, 4, context);
  const best = matches[0];
  const activeMatch = activeEntry ? scoreEntry(activeEntry, query, context) : null;
  const wantsContextRefocus = isContextRefocusQuery(query.normalized);
  const refocusMatch = findRefocusMatch(activeEntry, matches, activeMatch, query, minimumScore);

  if (!query.normalized) {
    return {
      type: "help",
      answer: "Μπορώ να σε καθοδηγήσω βήμα-βήμα. Διάλεξε θέμα ή γράψε τι βλέπεις, τι δοκίμασες ήδη και αν επηρεάζεται ένας ή περισσότεροι χρήστες.",
      actions: [],
      suggestions: topics,
      matchedKeywords: [],
      confidence: 1
    };
  }

  if (conversationControl) {
    return shapeConversationControlResponse(conversationControl, topics);
  }

  if (activeEntry && wantsContextSwitch && (!best || best.score < minimumScore)) {
    return {
      type: "help",
      answer: "Οκ, αφήνουμε το προηγούμενο θέμα. Γράψτε το νέο πρόβλημα με την εφαρμογή ή συσκευή που αφορά, τι μήνυμα εμφανίζεται και τι δοκιμάσατε ήδη.",
      actions: [],
      suggestions: topics,
      matchedKeywords: [],
      confidence: 1,
      conversationState: null
    };
  }

  if (activeEntry && wantsContextRefocus && (!best || best.score < minimumScore)) {
    return shapeContextRefocusHelpResponse(activeEntry, topics);
  }

  if (activeEntry && refocusMatch) {
    return shapeMatchedResponse(refocusMatch, matches, { refocusedFrom: activeEntry });
  }

  if (activeEntry && !wantsContextSwitch) {
    return shapeFollowUpResponse(activeEntry, query, context);
  }

  if (isHelpQuery(query.normalized)) {
    return {
      type: "help",
      answer: "Μπορώ να σε καθοδηγήσω βήμα-βήμα. Διάλεξε θέμα ή γράψε τι βλέπεις, τι δοκίμασες ήδη και αν επηρεάζεται ένας ή περισσότεροι χρήστες.",
      actions: [],
      suggestions: topics,
      matchedKeywords: [],
      confidence: 1
    };
  }

  if (isAmbiguousNetworkQuery(query.normalized)) {
    return {
      type: "clarification",
      title: "Ποιο δίκτυο αφορά;",
      answer: "Όταν λέμε δίκτυο στο νοσοκομείο μπορεί να εννοούμε το εσωτερικό δίκτυο ΦΙΛΙΠΠΟΣ, το διαβαθμισμένο δίκτυο αεροπορίας MIS ή το δίκτυο Internet για πρόσβαση σε εξωτερικές ιστοσελίδες. Πριν προτείνω βήματα, διάλεξε ποιο από τα τρία αφορά ή γράψε το μαζί με τον χώρο και τον σταθμό εργασίας.",
      actions: [
        "Αν αφορά καθημερινές νοσοκομειακές εφαρμογές, γράψτε: ΦΙΛΙΠΠΟΣ.",
        "Αν αφορά διαβαθμισμένο/αεροπορικό περιβάλλον, γράψτε: MIS.",
        "Αν αφορά πρόσβαση σε εξωτερικές ιστοσελίδες ή web υπηρεσίες, γράψτε: Internet.",
        "Αν δεν είστε σίγουρος, αναφέρετε την εφαρμογή ή ιστοσελίδα που δεν ανοίγει και αν ο σταθμός έχει καλώδιο δικτύου."
      ],
      suggestions: [
        {
          id: "network-filippos",
          title: "Ενσύρματο δίκτυο ΦΙΛΙΠΠΟΣ",
          keywords: ["ΦΙΛΙΠΠΟΣ", "ενσύρματο", "εσωτερικό δίκτυο"]
        },
        {
          id: "network-mis",
          title: "Διαβαθμισμένο δίκτυο MIS",
          keywords: ["MIS", "διαβαθμισμένο", "δίκτυο αεροπορίας"]
        },
        {
          id: "network-internet",
          title: "Δίκτυο Internet",
          keywords: ["Internet", "ίντερνετ", "εξωτερικές ιστοσελίδες"]
        }
      ],
      matchedKeywords: [],
      confidence: 0,
      conversationState: buildConversationState(activeEntry, {
        activeTitle: "Διευκρίνιση δικτύου"
      })
    };
  }

  if (shouldClarifyBetweenMatches(matches, minimumScore, query)) {
    return shapeDisambiguationResponse(matches, query);
  }

  if (!best || best.score < minimumScore) {
    const semanticCandidate = findSemanticFallback(entries, message, minimumScore);
    if (semanticCandidate) {
      return shapeMatchedResponse(
        {
          entry: semanticCandidate.entry,
          score: semanticCandidate.score,
          matchedKeywords: semanticCandidate.matchedKeywords
        },
        semanticCandidate.alternatives
      );
    }

    return {
      type: "fallback",
      answer: "Δεν βρήκα ακόμη ακριβή οδηγία. Δώσε μου πιο συγκεκριμένη περιγραφή: ποια εφαρμογή ή χώρος επηρεάζεται, τι μήνυμα εμφανίζεται, τι δοκίμασες ήδη και αν συμβαίνει σε άλλον χρήστη ή σταθμό.",
      actions: [
        "Ξαναγράψτε το πρόβλημα με 2-3 συγκεκριμένες λέξεις-κλειδιά.",
        "Προσθέστε τι δοκιμάσατε ήδη και τι αποτέλεσμα πήρατε.",
        "Αναφέρετε αν το πρόβλημα αφορά έναν χρήστη/χώρο ή είναι γενικό."
      ],
      suggestions: topics,
      matchedKeywords: [],
      confidence: 0,
      conversationState: buildConversationState(activeEntry, {
        activeTitle: "Ασαφές τεχνικό θέμα"
      })
    };
  }

  const response = shapeMatchedResponse(best, matches);

  return response;
}

function shapeMatchedResponse(best, matches, options = {}) {
  const isImmediate = containsImmediateEscalation(best.entry);
  const baseAnswer = isImmediate
    ? best.entry.answer
    : appendActivationPrompt(stripEscalationSentences(best.entry.answer));
  const actions = isImmediate
    ? best.entry.actions
    : delayEscalationActions(best.entry.actions);
  const answer = options.refocusedFrom
    ? `Οκ, διορθώνω το ενεργό θέμα από "${options.refocusedFrom.title}" σε "${best.entry.title}".\n\n${baseAnswer}`
    : baseAnswer;

  return {
    type: "match",
    entryId: best.entry.id,
    title: best.entry.title,
    answer,
    actions,
    suggestions: buildMatchedSuggestions(best.entry, matches),
    matchedKeywords: best.matchedKeywords,
    confidence: Math.min(1, Number((best.score / 12).toFixed(2))),
    source: best.entry.source,
    escalationDelayed: !isImmediate,
    conversationState: buildConversationState(best.entry)
  };
}

function shapeContextRefocusHelpResponse(activeEntry, topics) {
  return {
    type: "help",
    title: "Αλλαγή υπο-θέματος",
    answer: `Κατάλαβα ότι δεν αφορά πλέον ακριβώς το θέμα "${activeEntry.title}". Γράψτε το νέο υπο-θέμα με συγκεκριμένες λέξεις, εφαρμογή ή συναλλαγή, και το μήνυμα που εμφανίζεται, ώστε να κλειδώσω στο σωστό πεδίο γνώσης.`,
    actions: [
      "Γράψτε την εφαρμογή ή τη συναλλαγή, π.χ. SAP MB21, MIGO, MIRO ή Medico.",
      "Προσθέστε τι βλέπετε στην οθόνη και τι δοκιμάσατε ήδη.",
      "Μην στέλνετε προσωπικά, οικονομικά ή κλινικά δεδομένα."
    ],
    suggestions: topics,
    matchedKeywords: [],
    confidence: 1,
    conversationState: null,
    shouldResetConversation: true
  };
}

function buildMatchedSuggestions(entry, matches) {
  return uniqueTopics([
    ...buildStepSuggestions(entry, null).slice(0, 3),
    ...matches.slice(1, 4).map((match) => toTopic(match.entry))
  ]);
}

function shapeConversationControlResponse(intent, topics) {
  const suggestions = intent.action === "reset" ? topics : [];
  return {
    type: "control",
    controlAction: intent.action,
    title: intent.title,
    answer: intent.answer,
    actions: intent.actions,
    suggestions,
    matchedKeywords: [intent.matchedText],
    confidence: 1,
    conversationState: null,
    shouldResetConversation: true
  };
}

function shapeDisambiguationResponse(matches, query) {
  const suggestions = matches.slice(0, 4).map((match) => toTopic(match.entry));
  const names = suggestions.map((suggestion) => suggestion.title).join(", ");

  return {
    type: "clarification",
    title: "Χρειάζεται διευκρίνιση",
    answer: `Βρήκα περισσότερες από μία πιθανές οδηγίες για αυτό που γράψατε: ${names}. Για να μείνουμε στο σωστό πεδίο γνώσης, γράψτε ποιο από αυτά αφορά ή προσθέστε την εφαρμογή, τη συσκευή ή τον χώρο.`,
    actions: [
      "Αν αφορά συγκεκριμένη εφαρμογή, γράψτε το όνομά της.",
      "Αν αφορά συσκευή ή χώρο, γράψτε συσκευή και τμήμα.",
      "Αν θέλετε να ξεκινήσουμε νέο θέμα, γράψτε: αλλαγή θέματος: και μετά το νέο πρόβλημα."
    ],
    suggestions,
    matchedKeywords: uniqueList(matches.flatMap((match) => match.matchedKeywords)),
    confidence: 0.5,
    conversationState: {
      activeEntryId: null,
      activeTitle: "Διευκρίνιση θέματος",
      actionCount: 0,
      lastStep: null,
      candidateEntryIds: matches.slice(0, 4).map((match) => match.entry.id),
      candidateTitles: suggestions.map((suggestion) => suggestion.title),
      disambiguationQuery: query.raw
    }
  };
}

function shapeFollowUpResponse(entry, query, context) {
  const requestedStep = extractStepReference(query, entry.actions.length);
  const followup = findFollowup(entry, query, requestedStep);
  const step = requestedStep ?? followup?.step ?? context?.conversationState?.lastStep ?? null;
  const action = step ? entry.actions[step - 1] : null;
  const suggestions = buildStepSuggestions(entry, step);

  if (followup) {
    const actions = withContextSwitchAction(followup.actions.length > 0 ? followup.actions : buildFollowUpActions(entry, step, action));
    return {
      type: "followup",
      entryId: entry.id,
      title: step ? `${entry.title} - βήμα ${step}` : `${entry.title} - συνέχεια`,
      answer: `Μένουμε στο ίδιο θέμα: ${entry.title}.\n\n${followup.answer}`,
      actions,
      suggestions,
      matchedKeywords: followup.keywords,
      confidence: 1,
      source: entry.source,
      escalationDelayed: !containsImmediateEscalation(entry),
      conversationState: buildConversationState(entry, {
        lastStep: step
      })
    };
  }

  if (step && action) {
    return {
      type: "followup",
      entryId: entry.id,
      title: `${entry.title} - βοήθεια στο βήμα ${step}`,
      answer: `Μένουμε στο ίδιο θέμα: ${entry.title}.\n\nΤο βήμα ${step} είναι: "${action}". Αν κολλήσατε εδώ, μην αλλάξετε προχωρημένες ρυθμίσεις. Πείτε μου τι ακριβώς βλέπετε ή ποιο μήνυμα εμφανίζεται, ώστε να συνεχίσουμε από αυτό το σημείο.`,
      actions: withContextSwitchAction(buildFollowUpActions(entry, step, action)),
      suggestions,
      matchedKeywords: [],
      confidence: 0.86,
      source: entry.source,
      escalationDelayed: !containsImmediateEscalation(entry),
      conversationState: buildConversationState(entry, {
        lastStep: step
      })
    };
  }

  if (step && !action) {
    return {
      type: "followup",
      entryId: entry.id,
      title: `${entry.title} - συνέχεια`,
      answer: `Για αυτό το θέμα έχω ${entry.actions.length} βήματα. Δεν βρίσκω βήμα ${step}. Γράψτε μου σε ποιο από τα διαθέσιμα βήματα κολλήσατε ή τι μήνυμα βλέπετε στην οθόνη.`,
      actions: withContextSwitchAction(entry.actions),
      suggestions,
      matchedKeywords: [],
      confidence: 0.72,
      source: entry.source,
      escalationDelayed: true,
      conversationState: buildConversationState(entry)
    };
  }

  return {
    type: "followup",
    entryId: entry.id,
    title: `${entry.title} - συνέχεια`,
    answer: `Μένουμε στο ίδιο θέμα: ${entry.title}. Γράψτε μου τι ακριβώς δεν διορθώθηκε, σε ποιο βήμα κολλήσατε ή ποιο μήνυμα εμφανίζεται, χωρίς προσωπικά δεδομένα.`,
    actions: withContextSwitchAction(entry.actions),
    suggestions,
    matchedKeywords: [],
    confidence: 0.7,
    source: entry.source,
    escalationDelayed: true,
    conversationState: buildConversationState(entry)
  };
}

function buildFollowUpActions(entry, step, action) {
  const actions = [];
  if (action) {
    actions.push(`Επιβεβαιώστε ότι βρίσκεστε στο βήμα ${step}: ${action}`);
  }
  actions.push("Γράψτε μου τι ακριβώς βλέπετε στην οθόνη ή ποιο μήνυμα εμφανίζεται.");
  actions.push("Αν δεν βρίσκετε την επιλογή, περιγράψτε σε ποιο παράθυρο ή εφαρμογή βρίσκεστε.");

  if (containsImmediateEscalation(entry)) {
    actions.push("Αν υπάρχει κίνδυνος για ασφάλεια, κλινική λειτουργία ή εγκατάσταση, ενημερώστε άμεσα το αρμόδιο τμήμα.");
  } else {
    actions.push("Αν το βήμα δεν μπορεί να ολοκληρωθεί, γράψτε τι δοκιμάσατε ώστε να συνεχίσουμε από το επόμενο ασφαλές σημείο.");
  }

  return uniqueList(actions);
}

function withContextSwitchAction(actions) {
  return uniqueList([
    ...actions,
    "Αν θέλετε να αλλάξουμε θέμα, γράψτε: αλλαγή θέματος: και μετά το νέο πρόβλημα."
  ]);
}

function buildStepSuggestions(entry, activeStep) {
  const suggestions = [];
  for (let index = 0; index < Math.min(entry.actions.length, 4); index += 1) {
    const step = index + 1;
    if (step === activeStep) {
      continue;
    }
    suggestions.push({
      id: `${entry.id}-step-${step}`,
      title: `Κόλλησα στο βήμα ${step}`,
      keywords: [entry.actions[index]]
    });
  }
  return suggestions;
}

function uniqueTopics(items) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = item.id || item.title;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function findFollowup(entry, query, step) {
  const followups = Array.isArray(entry.followups) ? entry.followups : [];
  if (step) {
    const exactStep = followups.find((followup) => followup.step === step);
    if (exactStep) {
      return exactStep;
    }
  }

  return followups
    .map((followup) => ({
      followup,
      score: scoreFollowup(followup, query)
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .at(0)?.followup ?? null;
}

function shouldClarifyBetweenMatches(matches, minimumScore, query) {
  if (matches.length < 2 || query.tokens.length > 4) {
    return false;
  }

  const [first, second] = matches;
  if (first.score < minimumScore || second.score < minimumScore) {
    return false;
  }

  const closeGap = Math.abs(first.score - second.score) <= 0.05;
  if (!closeGap) {
    return false;
  }

  return !hasSpecificPhraseMatch(first) && !hasSpecificPhraseMatch(second);
}

function hasSpecificPhraseMatch(match) {
  return match.matchedKeywords.some((keyword) => usableTokens(keyword).length >= 2);
}

function findSemanticFallback(entries, message, minimumScore) {
  const search = searchKnowledge(entries, message, {
    limit: 4,
    minimumSearchScore: minimumScore
  });
  const candidate = search.results.find((result) => {
    return (
      result.matchType !== "lexical" &&
      result.lexicalScore < minimumScore &&
      result.semanticScore >= 8.5 &&
      result.confidence >= 0.72
    );
  });

  if (!candidate) {
    return null;
  }

  const entry = entries.find((item) => item.id === candidate.entryId);
  if (!entry) {
    return null;
  }

  const alternatives = search.results
    .map((result) => ({
      entry: entries.find((item) => item.id === result.entryId),
      score: result.score,
      matchedKeywords: result.matchedKeywords
    }))
    .filter((result) => result.entry);

  return {
    entry,
    score: candidate.score,
    matchedKeywords: candidate.matchedKeywords,
    alternatives
  };
}

function scoreFollowup(followup, query) {
  let score = 0;
  for (const keyword of followup.keywords ?? []) {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedKeyword && query.normalized.includes(normalizedKeyword)) {
      score += 8;
      continue;
    }

    const keywordTokens = usableTokens(keyword);
    const matchedTokens = keywordTokens.filter((token) =>
      query.tokens.some((queryToken) => tokensMatch(queryToken, token))
    );
    score += matchedTokens.length;
  }

  return score;
}

function isFollowUpQuery(query, context) {
  if (extractStepReference(query, context?.conversationState?.actionCount) !== null) {
    return true;
  }

  return containsAny(query.normalized, FOLLOWUP_PATTERNS);
}

function isContextSwitchQuery(normalizedMessage) {
  return containsAny(normalizedMessage, CONTEXT_SWITCH_PATTERNS);
}

function isContextRefocusQuery(normalizedMessage) {
  return containsAny(normalizedMessage, CONTEXT_REFOCUS_PATTERNS);
}

function findRefocusMatch(activeEntry, matches, activeMatch, query, minimumScore) {
  if (!activeEntry || !Array.isArray(matches)) {
    return null;
  }

  const candidates = matches.filter((match) => match.entry.id !== activeEntry.id && match.score >= minimumScore);
  if (candidates.length === 0) {
    return null;
  }

  const refocusPhrase = isContextRefocusQuery(query.normalized);
  const specificRefinement = isSpecificRefinementQuery(query);
  const activeScore = activeMatch?.score ?? 0;
  const activeIsGeneric = isGenericKnowledgeEntry(activeEntry);

  for (const candidate of candidates) {
    const sameFamily = shareKnowledgeFamily(activeEntry, candidate.entry);

    if (refocusPhrase && (sameFamily || candidate.score >= minimumScore + 2)) {
      if (activeIsGeneric || candidate.score >= Math.max(minimumScore, activeScore + 0.75)) {
        return candidate;
      }
    }

    if (sameFamily && specificRefinement) {
      if (activeIsGeneric || candidate.score >= Math.max(minimumScore, activeScore + 1.5)) {
        return candidate;
      }
    }
  }

  return null;
}

function isSpecificRefinementQuery(query) {
  if (!query?.normalized) {
    return false;
  }

  return (
    SPECIFIC_REFOCUS_CODE_PATTERN.test(query.normalized) ||
    query.normalized.includes("transaction") ||
    query.normalized.includes("συναλλαγη") ||
    query.normalized.includes("κωδικο συναλλαγησ") ||
    query.normalized.includes("κωδικοσ συναλλαγησ")
  );
}

function shareKnowledgeFamily(firstEntry, secondEntry) {
  const firstFamilies = knowledgeFamiliesForEntry(firstEntry);
  if (firstFamilies.size === 0) {
    return false;
  }

  const secondFamilies = knowledgeFamiliesForEntry(secondEntry);
  return [...firstFamilies].some((family) => secondFamilies.has(family));
}

function isGenericKnowledgeEntry(entry) {
  const normalized = normalizeText([entry?.title, entry?.category, entry?.domain].join(" "));
  return (
    normalized.includes("γενικο") ||
    normalized.includes("general") ||
    normalized.includes("triage") ||
    normalized.includes("sap general") ||
    normalized.includes("sap-general")
  );
}

function knowledgeFamiliesForEntry(entry) {
  const combined = normalizeText([
    entry?.title,
    ...(entry?.keywords ?? []),
    entry?.domain,
    entry?.category
  ].join(" "));

  const families = new Set();
  for (const profile of KNOWLEDGE_FAMILY_PROFILES) {
    if (profile.tokens.some((token) => combined.includes(token))) {
      families.add(profile.id);
    }
  }

  return families;
}

function detectConversationControl(normalizedMessage) {
  if (!normalizedMessage) {
    return null;
  }

  for (const intent of CONVERSATION_CONTROL_INTENTS) {
    if (intent.exact.has(normalizedMessage)) {
      return {
        ...intent,
        matchedText: normalizedMessage
      };
    }

    const matchedPhrase = intent.phrases.find((phrase) => normalizedMessage.includes(phrase));
    if (matchedPhrase) {
      return {
        ...intent,
        matchedText: matchedPhrase
      };
    }
  }

  return null;
}

function extractStepReference(query, actionCount = 0) {
  const normalized = typeof query === "string" ? query : query.normalized;
  const trimmed = normalized.trim();
  const directNumber = trimmed.match(/^\d{1,2}$/);
  if (directNumber) {
    return normalizeStepNumber(Number.parseInt(directNumber[0], 10), actionCount);
  }

  const digitMatch = normalized.match(
    /(?:στο\s+βημα|στο\s+step|βημα|step|νουμερο|αριθμοσ|αριθμος|στο|στον|στην|στη|το|τη|την|#)\s*#?\s*(\d{1,2})/
  );
  if (digitMatch) {
    return normalizeStepNumber(Number.parseInt(digitMatch[1], 10), actionCount);
  }

  for (const [word, step] of STEP_WORDS) {
    if (
      trimmed === word ||
      normalized.includes(`βημα ${word}`) ||
      normalized.includes(`step ${word}`) ||
      normalized.includes(`στο ${word}`) ||
      normalized.includes(`στον ${word}`) ||
      normalized.includes(`στη ${word}`) ||
      normalized.includes(`στην ${word}`) ||
      normalized.includes(`το ${word}`) ||
      normalized.includes(`τη ${word}`) ||
      normalized.includes(`την ${word}`)
    ) {
      return normalizeStepNumber(step, actionCount);
    }
  }

  return null;
}

function normalizeStepNumber(step, actionCount = 0) {
  if (!Number.isInteger(step) || step < 1) {
    return null;
  }

  if (actionCount && step > Math.max(actionCount, 10)) {
    return null;
  }

  return step;
}

function resolveActiveEntry(entries, context) {
  const activeEntryId = context?.conversationState?.activeEntryId ?? context?.activeEntryId;
  if (!activeEntryId) {
    return null;
  }

  return entries.find((entry) => entry.id === activeEntryId) ?? null;
}

function buildConversationState(entry, overrides = {}) {
  return {
    activeEntryId: entry?.id ?? overrides.activeEntryId ?? null,
    activeTitle: entry?.title ?? overrides.activeTitle ?? "",
    actionCount: entry?.actions?.length ?? overrides.actionCount ?? 0,
    lastStep: overrides.lastStep ?? null,
    source: entry?.source ?? overrides.source ?? "",
    priority: entry?.priority ?? overrides.priority ?? 0,
    domain: entry?.domain ?? overrides.domain ?? "",
    category: entry?.category ?? overrides.category ?? "",
    riskLevel: entry?.riskLevel ?? overrides.riskLevel ?? ""
  };
}

function stripEscalationSentences(answer) {
  return String(answer ?? "")
    .split(/(?<=[.!;;;])\s+|(?<=\.)\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => !isDeferrableEscalationText(sentence))
    .join(" ");
}

function delayEscalationActions(actions) {
  const filteredActions = actions.filter((action) => !isDeferrableEscalationText(action));
  filteredActions.push(buildActivationAction());
  return uniqueList(filteredActions);
}

function appendActivationPrompt(answer) {
  const base = answer || "Βρήκα σχετικό θέμα στη γνωσιακή βάση.";
  return `${base}\n\nΚάντε τους παραπάνω ελέγχους και γράψτε μου τι έγινε: ποιο βήμα απέτυχε, ποιο μήνυμα εμφανίστηκε και αν επηρεάζεται άλλος χρήστης ή σταθμός.`;
}

function buildActivationAction() {
  return "Μετά τους ελέγχους, γράψτε μου τι αποτέλεσμα πήρατε και ποιο στοιχείο άλλαξε ή παρέμεινε ίδιο.";
}

function isDeferrableEscalationText(value) {
  const normalized = normalizeText(value);
  if (!normalized || containsAny(normalized, IMMEDIATE_ESCALATION_PATTERNS)) {
    return false;
  }

  if (normalized.includes("μην") && normalized.includes("αιτημ")) {
    return false;
  }

  return containsAny(normalized, ESCALATION_PATTERNS);
}

function containsImmediateEscalation(entry) {
  const combined = [entry.title, entry.answer, ...entry.actions].join(" ");
  return containsAny(normalizeText(combined), IMMEDIATE_ESCALATION_PATTERNS);
}

function containsAny(value, patterns) {
  return patterns.some((pattern) => value.includes(pattern));
}

function uniqueList(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function prepareEntries(entries) {
  return entries
    .map((entry) => {
      const followups = Array.isArray(entry.followups) ? entry.followups : [];
      return {
        ...entry,
        followups,
        search: {
          titleTokens: usableTokens(entry.title),
          keywordTokens: normalizedKeywordTokens(entry.keywords),
          semanticTokens: semanticTokensForEntry(entry),
          bm25Tokens: bm25TokensForEntry(entry)
        }
      };
    })
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title, "el"));
}

function normalizedKeywordTokens(keywords) {
  const seen = new Set();
  const variants = [];

  for (const keyword of keywords) {
    const normalized = normalizeText(keyword);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    const keywordTokens = usableTokens(keyword);
    if (keywordTokens.length === 0 || hasEquivalentKeywordVariant(variants, keywordTokens)) {
      continue;
    }

    seen.add(normalized);
    variants.push({
      original: keyword,
      normalized,
      tokens: keywordTokens
    });
  }

  return variants;
}

function hasEquivalentKeywordVariant(variants, keywordTokens) {
  const signature = keywordTokens.map(canonicalKeywordToken).join(" ");

  return variants.some((variant) => {
    return signature === variant.tokens.map(canonicalKeywordToken).join(" ");
  });
}

function canonicalKeywordToken(token) {
  if (/^[a-z0-9]+$/.test(token)) {
    return token.replace(/s$/, "");
  }

  return token;
}

function prepareQuery(message) {
  const normalized = normalizeText(message);
  const tokens = usableTokens(message);
  return {
    raw: String(message ?? ""),
    normalized,
    tokens,
    tokenSet: new Set(tokens)
  };
}

function findMatchesWithContext(entries, message, limit = 3, context = {}) {
  const preparedEntries = entries[0]?.search ? entries : prepareEntries(entries);
  const query = prepareQuery(message);

  if (!query.normalized) {
    return [];
  }

  return preparedEntries
    .map((entry) => scoreEntry(entry, query, context))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.priority - a.entry.priority)
    .slice(0, limit);
}

function scoreEntry(entry, query, context = {}) {
  let score = 0;
  const matchedKeywords = new Set();
  const countedTokens = new Set();

  for (const keyword of entry.search.keywordTokens) {
    if (!keyword.normalized) {
      continue;
    }

    if (isDirectKeywordMatch(keyword, query)) {
      const newTokens = keyword.tokens.filter((token) => !hasCountedToken(countedTokens, token));
      if (newTokens.length === 0) {
        continue;
      }

      score += 8 + newTokens.length * 2;
      matchedKeywords.add(keyword.original);
      markCountedTokens(countedTokens, newTokens);
      continue;
    }

    const matchedTokens = keyword.tokens.filter((token) =>
      query.tokens.some((queryToken) => tokensMatch(queryToken, token))
    );
    const matchedTokenCount = matchedTokens.length;

    if (matchedTokenCount === keyword.tokens.length && matchedTokenCount > 0) {
      score += 4 + matchedTokenCount;
      matchedKeywords.add(keyword.original);
      markCountedTokens(countedTokens, matchedTokens);
    } else if (matchedTokenCount > 0) {
      const newTokens = matchedTokens.filter((token) => !hasCountedToken(countedTokens, token));
      score += newTokens.length;
      markCountedTokens(countedTokens, newTokens);
    }
  }

  const titleOverlap = entry.search.titleTokens.filter((token) =>
    query.tokens.some((queryToken) => tokensMatch(queryToken, token))
  ).length;
  score += titleOverlap * 0.5;
  const contextScore = scoreApplicationContext(entry, context, query);
  score += contextScore;
  score += Math.max(0, entry.priority) * 0.1;

  return {
    entry,
    score,
    matchedKeywords: [...matchedKeywords],
    contextScore
  };
}

function scoreApplicationContext(entry, context = {}, query = null) {
  const profile = resolveApplicationContextProfile(context.applicationContext ?? context.appContext ?? context.departmentContext);
  if (!profile) {
    return 0;
  }

  const combinedTokens = [
    ...(entry.search.titleTokens ?? []),
    ...((entry.search.keywordTokens ?? []).flatMap((keyword) => keyword.tokens)),
    ...tokenize(entry.domain ?? ""),
    ...tokenize(entry.category ?? "")
  ];
  const matchCount = profile.tokens.filter((profileToken) =>
    combinedTokens.some((entryToken) => tokensMatch(entryToken, profileToken))
  ).length;

  if (matchCount === 0) {
    return 0;
  }

  const baseScore = Math.min(3.2, 1.2 + matchCount * 0.45);
  if (isLowSpecificityHostContextQuery(query, profile)) {
    return baseScore + 7.5;
  }

  return baseScore;
}

function resolveApplicationContextProfile(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  return APPLICATION_CONTEXT_PROFILES.find((profile) =>
    profile.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))
  ) ?? null;
}

function isLowSpecificityHostContextQuery(query, profile) {
  if (!query?.normalized || query.tokens.length === 0) {
    return false;
  }

  const hasGenericProblemPhrase = LOW_SPECIFICITY_CONTEXT_PHRASES.some((phrase) => query.normalized.includes(phrase));
  if (!hasGenericProblemPhrase || query.tokens.length > 4) {
    return false;
  }

  return !queryMentionsCompetingContext(query, profile);
}

function queryMentionsCompetingContext(query, profile) {
  return COMPETING_CONTEXT_TOKEN_GROUPS.some((group) => {
    if (group.id === profile.id) {
      return false;
    }

    return group.tokens.some((groupToken) =>
      query.tokens.some((queryToken) => tokensMatch(queryToken, groupToken))
    );
  });
}

function scoreSemanticEntry(entry, query) {
  const semanticTokens = entry.search.semanticTokens ?? [];
  if (semanticTokens.length === 0 || query.tokens.length === 0) {
    return {
      score: 0,
      matchedTokens: []
    };
  }

  const expandedQueryTokens = expandSemanticTokens(query.tokens).filter((token) => !SEMANTIC_NOISE_TOKENS.has(token));
  if (expandedQueryTokens.length === 0) {
    return {
      score: 0,
      matchedTokens: []
    };
  }

  const matchedTokens = uniqueList(
    expandedQueryTokens.filter((queryToken) => semanticTokens.some((entryToken) => tokensMatch(queryToken, entryToken)))
  );
  if (matchedTokens.length === 0) {
    return {
      score: 0,
      matchedTokens: []
    };
  }

  const coverage = matchedTokens.length / Math.max(1, new Set(expandedQueryTokens).size);
  const density = matchedTokens.length / Math.sqrt(Math.max(semanticTokens.length, 1));
  const score = matchedTokens.length * 1.35 + coverage * 5.5 + Math.min(2.5, density * 2);

  return {
    score,
    matchedTokens
  };
}

function scoreBm25Entry(entry, query, stats) {
  const queryTokens = uniqueList(query.tokens.filter((token) => !SEMANTIC_NOISE_TOKENS.has(token)));
  const documentTokens = entry.search.bm25Tokens ?? [];
  if (queryTokens.length === 0 || documentTokens.length === 0) {
    return {
      score: 0,
      matchedTokens: []
    };
  }

  const termFrequencies = countTokens(documentTokens);
  const k1 = 1.2;
  const b = 0.75;
  let rawScore = 0;
  const matchedTokens = [];

  for (const token of queryTokens) {
    const matchingDocumentToken = [...termFrequencies.keys()].find((documentToken) => tokensMatch(documentToken, token));
    if (!matchingDocumentToken) {
      continue;
    }

    const frequency = termFrequencies.get(matchingDocumentToken);
    const documentFrequency = stats.documentFrequency.get(matchingDocumentToken) ?? 1;
    const idf = Math.log(1 + (stats.documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5));
    const denominator = frequency + k1 * (1 - b + b * (documentTokens.length / stats.averageDocumentLength));
    rawScore += idf * ((frequency * (k1 + 1)) / denominator);
    matchedTokens.push(token);
  }

  return {
    score: Number((rawScore * 2.8).toFixed(2)),
    matchedTokens: uniqueList(matchedTokens)
  };
}

function semanticTokensForEntry(entry) {
  return uniqueList(
    expandSemanticTokens(
      usableTokens(
        [
          entry.title,
          ...(entry.keywords ?? []),
          ...(entry.examples ?? []),
          entry.answer,
          ...(entry.actions ?? [])
        ].join(" ")
      ).filter((token) => !SEMANTIC_NOISE_TOKENS.has(token))
    )
  );
}

function bm25TokensForEntry(entry) {
  return usableTokens(
    [
      entry.title,
      ...(entry.keywords ?? []),
      ...(entry.examples ?? []),
      entry.answer,
      ...(entry.actions ?? [])
    ].join(" ")
  ).filter((token) => !SEMANTIC_NOISE_TOKENS.has(token));
}

function buildBm25Stats(entries) {
  const documentFrequency = new Map();
  let totalLength = 0;

  for (const entry of entries) {
    const tokens = entry.search?.bm25Tokens ?? [];
    totalLength += tokens.length;
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  return {
    documentCount: Math.max(1, entries.length),
    averageDocumentLength: Math.max(1, totalLength / Math.max(1, entries.length)),
    documentFrequency
  };
}

function countTokens(tokens) {
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function expandSemanticTokens(tokens) {
  const expanded = [];
  for (const token of tokens) {
    expanded.push(token);
    const synonyms = SEMANTIC_SYNONYMS.get(token);
    if (synonyms) {
      expanded.push(...synonyms);
    }
  }

  return uniqueList(expanded);
}

function buildSemanticSynonyms(groups) {
  const synonyms = new Map();
  for (const group of groups) {
    const tokens = uniqueList(group.flatMap((item) => tokenize(item)));
    for (const token of tokens) {
      synonyms.set(token, uniqueList([...(synonyms.get(token) ?? []), ...tokens.filter((item) => item !== token)]));
    }
  }

  return synonyms;
}

function toSearchResult(entry, lexical, semantic, bm25, score) {
  const matchedKeywords = lexical.matchedKeywords.length > 0
    ? lexical.matchedKeywords
    : uniqueList([...semantic.matchedTokens, ...bm25.matchedTokens]);
  const matchType =
    [lexical.score, semantic.score, bm25.score].filter((value) => value > 0).length >= 2
      ? "hybrid"
      : bm25.score > Math.max(lexical.score, semantic.score)
        ? "bm25"
        : semantic.score > lexical.score
        ? "semantic"
        : "lexical";
  const immediate = containsImmediateEscalation(entry);
  const answerPreview = immediate ? entry.answer : stripEscalationSentences(entry.answer);
  const actionsPreview = immediate ? entry.actions ?? [] : (entry.actions ?? []).filter((action) => !isDeferrableEscalationText(action));

  return {
    entryId: entry.id,
    title: entry.title,
    source: entry.source,
    priority: entry.priority,
    score: Number(score.toFixed(2)),
    lexicalScore: Number(lexical.score.toFixed(2)),
    semanticScore: Number(semantic.score.toFixed(2)),
    bm25Score: Number(bm25.score.toFixed(2)),
    matchType,
    matchedKeywords: uniqueList(matchedKeywords).slice(0, 8),
    answerPreview: truncateForSearch(answerPreview, 360),
    actionsPreview: actionsPreview.slice(0, 4),
    metadata: {
      owner: entry.owner || "",
      domain: entry.domain || "",
      category: entry.category || "",
      riskLevel: entry.riskLevel || "",
      lastReviewed: entry.lastReviewed || "",
      userSafe: entry.userSafe !== false,
      adminOnly: entry.adminOnly === true
    }
  };
}

function calculateSearchConfidence(score, nextScore) {
  const base = Math.min(0.96, score / 16);
  const separation = nextScore > 0 ? Math.min(0.18, Math.max(0, score - nextScore) / 18) : 0.12;
  return Number(Math.max(0.08, Math.min(0.99, base + separation)).toFixed(2));
}

function searchNeedsDisambiguation(results) {
  if (results.length < 2) {
    return false;
  }

  const [first, second] = results;
  if (first.confidence < 0.72) {
    return true;
  }

  const topHasSpecificPhrase = first.matchedKeywords.some((keyword) => usableTokens(keyword).length >= 2);
  return !topHasSpecificPhrase && first.score - second.score <= Math.max(0.5, first.score * 0.05);
}

function truncateForSearch(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function isDirectKeywordMatch(keyword, query) {
  if (keyword.tokens.length > 1) {
    return query.normalized.includes(keyword.normalized);
  }

  const [keywordToken] = keyword.tokens;
  return query.tokens.some((queryToken) => tokensMatch(queryToken, keywordToken));
}

function markCountedTokens(countedTokens, tokens) {
  for (const token of tokens) {
    countedTokens.add(token);
  }
}

function hasCountedToken(countedTokens, token) {
  return [...countedTokens].some((countedToken) => tokensMatch(countedToken, token));
}

function isHelpQuery(normalizedMessage) {
  return HELP_PATTERNS.some((pattern) => normalizedMessage.includes(normalizeText(pattern)));
}

function isAmbiguousNetworkQuery(normalizedMessage) {
  const mentionsNetwork = NETWORK_AMBIGUITY_PATTERNS.some((pattern) => normalizedMessage.includes(pattern));
  if (!mentionsNetwork) {
    return false;
  }

  return !NETWORK_CONTEXT_PATTERNS.some((pattern) => normalizedMessage.includes(pattern));
}

function usableTokens(value) {
  return tokenize(value).filter((token) => !STOPWORDS.has(token));
}

function tokensMatch(queryToken, keywordToken) {
  if (queryToken === keywordToken) {
    return true;
  }

  const shorter = queryToken.length <= keywordToken.length ? queryToken : keywordToken;
  const longer = queryToken.length > keywordToken.length ? queryToken : keywordToken;

  if (shorter.length >= 5 && longer.startsWith(shorter.slice(0, -1))) {
    return true;
  }

  return commonPrefixLength(queryToken, keywordToken) >= 5 && Math.abs(queryToken.length - keywordToken.length) <= 3;
}

function commonPrefixLength(a, b) {
  let count = 0;
  const max = Math.min(a.length, b.length);

  while (count < max && a[count] === b[count]) {
    count += 1;
  }

  return count;
}

function toTopic(entry) {
  return {
    id: entry.id,
    title: entry.title,
    keywords: entry.keywords.slice(0, 4)
  };
}
