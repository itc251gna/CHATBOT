# Προτάσεις μελλοντικών βελτιώσεων

## Υλοποιήθηκε στην έξυπνη έκδοση Portal Search

- Smart Portal Search με `/api/search`, confidence, alternatives και τοπικό semantic fallback.
- Read-only Knowledge Review με `/api/knowledge/audit`.
- CLI audit με `npm run kb:analyze`.
- Δομημένο termination signal v2 με `handoff`.
- Εμπλουτισμένο learning report με review queue και regression candidates.
- Backwards-compatible metadata πεδία στη γνωσιακή βάση.

## Προτεραιότητα 1: Διαχειριστικό περιβάλλον γνώσης

Σήμερα η γνώση συντηρείται σε `.txt` αρχεία. Επόμενο βήμα:

- web UI για προσθήκη/επεξεργασία εγγραφών,
- validation πριν από αποθήκευση,
- preview matching,
- ιστορικό αλλαγών,
- ρόλοι συντάκτη/ελεγκτή.

## Προτεραιότητα 2: Approval workflow γνώσης

Επειδή η γνώση προέρχεται από admin manuals αλλά προβάλλεται σε απλούς χρήστες, χρειάζεται διαδικασία έγκρισης:

- draft εγγραφή,
- έλεγχος από IT/Εγκαταστάσεις,
- έλεγχος για προσωπικά δεδομένα,
- publish.

## Προτεραιότητα 3: Καλύτερο conflict detection

Να προστεθεί εργαλείο:

```powershell
npm run knowledge:audit
```

Που να εντοπίζει:

- ίδια keywords σε πολλές εγγραφές,
- πολύ γενικά keywords σε υψηλό priority,
- εγγραφές χωρίς priority,
- εγγραφές που κερδίζουν άθελά τους σε test queries.

## Προτεραιότητα 4: Test set πραγματικών ερωτήσεων

Δημιουργία αρχείου:

```text
test/fixtures/queries.json
```

Με παραδείγματα:

```json
[
  {
    "message": "δεν ανοίγει η εφαρμογή ασθενών",
    "expectedTitle": "Medico / εφαρμογή ασθενών δεν ανοίγει"
  }
]
```

Έτσι κάθε αλλαγή γνώσης θα ελέγχεται με πραγματικές φράσεις χρηστών.

## Προτεραιότητα 5: Περιορισμένο telemetry χωρίς προσωπικά δεδομένα

Προαιρετικά να καταγράφονται μόνο ανώνυμα metrics:

- πόσες φορές εμφανίστηκε κάθε topic,
- πόσα fallback,
- πόσα clarification για ΦΙΛΙΠΠΟΣ/MIS,
- χρόνος απόκρισης API.

Να μην αποθηκεύεται ελεύθερο κείμενο χρήστη χωρίς ξεκάθαρη πολιτική.

## Προτεραιότητα 6: Role-aware απαντήσεις

Σήμερα οι απαντήσεις είναι για απλό χρήστη. Μελλοντικά μπορεί να υπάρχει mode:

- `user`: ασφαλείς βασικοί έλεγχοι,
- `helpdesk`: περισσότερα στοιχεία διάγνωσης,
- `admin`: μόνο για εξουσιοδοτημένους, με authentication.

Το `admin` mode πρέπει να είναι ξεχωριστό και προστατευμένο.

## Προτεραιότητα 7: Καλύτερη αναζήτηση χωρίς cloud

Πιθανές επιλογές:

- BM25 search τοπικά,
- SQLite FTS5,
- μικρό local embedding model μόνο εντός δικτύου,
- synonym dictionary ανά τμήμα.

Η προτεραιότητα παραμένει: predictable, auditable answers.

## Προτεραιότητα 8: Integration με εξωτερικές ροές

Η τρέχουσα αρχιτεκτονική σταματά στο termination signal. Μελλοντικά, ξεχωριστή host εφαρμογή μπορεί να αξιοποιεί το signal για:

- ανακατεύθυνση σε υπάρχουσα φόρμα,
- άνοιγμα modal με περίληψη,
- κλήση δικού της API,
- δρομολόγηση ανά εφαρμογή ή τμήμα.

Η λογική αυτή πρέπει να μείνει εκτός chat engine και εκτός knowledge base.

## Προτεραιότητα 9: Multi-tenant γνώση ανά εφαρμογή

Οι εφαρμογές μπορούν να περνούν context:

```html
<script
  src="https://chatty.251gh.local/chatbot-widget.js"
  data-app-context="medico"
></script>
```

Μελλοντικά το API μπορεί να προτιμά topics ανά εφαρμογή.

## Προτεραιότητα 10: Accessibility και UX

Προτάσεις:

- πλήρης keyboard navigation,
- ARIA improvements,
- high contrast mode,
- μεγαλύτερες γραμματοσειρές για σταθμούς εργασίας με παλιές οθόνες,
- δυνατότητα εκτύπωσης οδηγιών.

## Προτεραιότητα 11: Production hardening

- structured logs,
- request IDs,
- rate limiting,
- reverse proxy authentication,
- security headers,
- CI pipeline για tests,
- signed releases.

## Προτεραιότητα 12: Knowledge governance

Να οριστεί ιδιοκτήτης ανά αρχείο:

- `it-knowledge.txt`: Τμήμα Μηχανοργάνωσης / IT.
- `facilities-issues.txt`: Τμήμα Εγκαταστάσεων.

Κάθε αλλαγή γνώσης να έχει:

- ημερομηνία,
- συντάκτη,
- εγκριτή,
- λόγο αλλαγής,
- test queries.
