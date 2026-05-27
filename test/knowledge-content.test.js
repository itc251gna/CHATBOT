import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createChatEngine } from "../src/chat-engine.js";
import { loadKnowledgeFromDirectory } from "../src/knowledge-base.js";

const knowledgeDirectory = fileURLToPath(new URL("../knowledge", import.meta.url));

test("real knowledge base handles broad IT problem words", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("βλάβη στον υπολογιστή");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Γενικό IT πρόβλημα");
});

test("real knowledge base maps patient application to Medico", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν ανοίγει η εφαρμογή ασθενών");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Medico / εφαρμογή ασθενών δεν ανοίγει");
  assert.ok(response.answer.includes("Medico"));
  assert.ok(!response.answer.toLowerCase().includes("browser"));
  assert.ok(!response.actions.join(" ").toLowerCase().includes("browser"));
  assert.ok(!response.actions.join(" ").toLowerCase().includes("ctrl+f5"));
});

test("real knowledge base uses host application context for vague Medico launch failures", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν ανοίγει", { applicationContext: "medico" });
  const search = engine.search("δεν ανοίγει", { applicationContext: "medico", limit: 2 });

  assert.equal(response.type, "match");
  assert.equal(response.title, "Medico / εφαρμογή ασθενών δεν ανοίγει");
  assert.equal(search.results[0].title, "Medico / εφαρμογή ασθενών δεν ανοίγει");
});

test("real knowledge base asks for clarification on ambiguous network", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("έχω πρόβλημα με το δίκτυο");

  assert.equal(response.type, "clarification");
  assert.equal(response.title, "Ποιο δίκτυο αφορά;");
  assert.ok(!response.ticketPayload);
  assert.ok(response.suggestions.some((suggestion) => suggestion.id === "network-internet"));
});

test("real knowledge base routes FILIPPOS wired network explicitly", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν έχει δίκτυο ΦΙΛΙΠΠΟΣ στο ethernet");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Ενσύρματο δίκτυο ΦΙΛΙΠΠΟΣ");
});

test("real knowledge base routes MIS network explicitly", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("πρόβλημα στο δίκτυο MIS");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Διαβαθμισμένο δίκτυο MIS");
});

test("real knowledge base routes Internet network explicitly", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν ανοίγει το internet σε εξωτερικές ιστοσελίδες");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Δίκτυο Internet ή πρόσβαση σε εξωτερικές ιστοσελίδες");
});

test("portal search preview does not expose delayed ticket wording", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.search("αργό internet", { limit: 2 });

  assert.equal(response.results[0].title, "Το Internet είναι αργό");
  assert.ok(!response.results[0].answerPreview.includes("αίτημα"));
  assert.ok(!response.results[0].actionsPreview.join(" ").includes("αίτημα"));
});

test("real knowledge base handles blocked external website", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("η ιστοσελίδα βγάζει access denied και certificate error");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Συγκεκριμένη ιστοσελίδα δεν ανοίγει ή εμφανίζει αποκλεισμό");
});

test("real knowledge base continues Internet troubleshooting by step", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const first = engine.answer("δεν ανοίγει το internet σε εξωτερικές ιστοσελίδες");
  const followup = engine.answer("κόλλησα στο βήμα 5", {
    conversationState: first.conversationState
  });

  assert.equal(followup.type, "followup");
  assert.equal(followup.title, "Δίκτυο Internet ή πρόσβαση σε εξωτερικές ιστοσελίδες - βήμα 5");
  assert.ok(followup.answer.includes("proxy"));
  assert.equal(followup.conversationState.lastStep, 5);
});

test("real knowledge base keeps printer context for natural step references", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const first = engine.answer("δεν δουλεύει ο εκτυπωτής");
  const followup = engine.answer("μάλλον φταίει το 2 αλλά δεν ξέρω τι άλλο να κάνω", {
    conversationState: first.conversationState
  });

  assert.equal(first.type, "match");
  assert.equal(first.title, "Εκτυπωτής δεν τυπώνει");
  assert.equal(followup.type, "followup");
  assert.equal(followup.title, "Εκτυπωτής δεν τυπώνει - βήμα 2");
  assert.ok(followup.answer.includes("εμπλοκή χαρτιού"));
  assert.equal(followup.conversationState.lastStep, 2);
});

test("real knowledge base maps imaging system to AGFA RIS/PACS", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν ανοίγει το απεικονιστικό σύστημα");

  assert.equal(response.type, "match");
  assert.equal(response.title, "AGFA RIS/PACS ή απεικονιστικό σύστημα δεν ανοίγει");
  assert.ok(response.answer.includes("AGFA RIS/PACS"));
});

test("real knowledge base keeps PACS launch separate from CD/DVD writing", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν ανοίγει το pacs");

  assert.equal(response.type, "match");
  assert.equal(response.title, "AGFA RIS/PACS ή απεικονιστικό σύστημα δεν ανοίγει");
});

test("real knowledge base routes suspicious email to phishing guidance", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("ύποπτο email με περίεργο link");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Ύποπτο email ή πιθανό phishing");
});

test("real knowledge base handles Medico stuck session safely", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("το medico κόλλησε και δεν κάνει logoff");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Medico κόλλησε ή δεν κάνει logoff");
  assert.equal(response.escalationDelayed, true);
  assert.ok(response.answer.includes("Κάντε τους παραπάνω ελέγχους"));
  assert.ok(!response.answer.includes("helpdesk"));
  assert.ok(!response.answer.includes("αίτημα"));
  assert.ok(!response.ticketPayload);
});

test("real knowledge base stays in Q&A mode after repeated attempts", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("το medico κόλλησε και δεν κάνει logoff", { interactionCount: 3 });

  assert.equal(response.type, "match");
  assert.equal(response.title, "Medico κόλλησε ή δεν κάνει logoff");
  assert.equal(response.escalationDelayed, true);
  assert.ok(response.answer.includes("Κάντε τους παραπάνω ελέγχους"));
  assert.ok(!response.answer.includes("αίτημα"));
  assert.ok(!response.ticketPayload);
});

test("real knowledge base handles Medico referral validation", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("σφάλμα στο παραπεμπτικό εξετάσεων");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Σφάλμα σε παραπεμπτικό εξετάσεων στο Medico");
});

test("real knowledge base handles LIS results visibility", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν εμφανίζονται εργαστηριακά αποτελέσματα στο medico");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Εργαστηριακά αποτελέσματα δεν εμφανίζονται στο Medico");
});

test("real knowledge base handles SAP order visibility", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("μη εμφάνιση παραγγελίας στο SAP");

  assert.equal(response.type, "match");
  assert.equal(response.title, "SAP ή ΜΗΣΠΥ παραγγελίες δεν εμφανίζονται");
});

test("real knowledge base handles SAP MM inventory and reservation topics", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("πρόβλημα με το transaction mb21 στην παρακολούθηση αποθεμάτων");

  assert.equal(response.type, "match");
  assert.equal(response.title, "SAP MM αποθέματα, κρατήσεις και κινήσεις υλικών");
});

test("real knowledge base refocuses SAP order context to SAP inventory when corrected", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const first = engine.answer("μη εμφάνιση παραγγελίας στο SAP");
  const next = engine.answer("δεν αφορά πρόβλημα παραγγελίας, πρόβλημα στην παρακολούθηση αποθεμάτων", {
    conversationState: first.conversationState
  });

  assert.equal(first.type, "match");
  assert.equal(first.title, "SAP ή ΜΗΣΠΥ παραγγελίες δεν εμφανίζονται");
  assert.equal(next.type, "match");
  assert.equal(next.title, "SAP MM αποθέματα, κρατήσεις και κινήσεις υλικών");
});

test("real knowledge base keeps broad SAP problem generic until the user specifies flow", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("πρόβλημα στο sap");
  const refined = engine.answer("πρόβλημα με το transaction mb21", {
    conversationState: response.conversationState
  });

  assert.equal(response.type, "match");
  assert.equal(response.title, "Γενικό πρόβλημα SAP ή συναλλαγή SAP");
  assert.equal(refined.type, "match");
  assert.equal(refined.title, "SAP MM αποθέματα, κρατήσεις και κινήσεις υλικών");
});

test("real knowledge base handles SAP FI budget manuals", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("πρόβλημα με FI_BUG_01 στον προϋπολογισμό SAP");

  assert.equal(response.type, "match");
  assert.equal(response.title, "SAP FI προϋπολογισμός, ΚΑΕ και απολογισμός");
});

test("real knowledge base handles SAP FI commitments", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("πρόβλημα με δέσμευση στο SAP");

  assert.equal(response.type, "match");
  assert.equal(response.title, "SAP FI δεσμεύσεις και αναφορές δεσμεύσεων");
});

test("real knowledge base handles SAP FI general ledger and cash topics without falling back to generic SAP", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const ledger = engine.answer("πρόβλημα με γενικό καθολικό SAP");
  const cash = engine.answer("πρόβλημα με χρηματικό ένταλμα sap");

  assert.equal(ledger.type, "match");
  assert.equal(ledger.title, "SAP FI λογαριασμοί γενικής λογιστικής και καθολικά");
  assert.equal(cash.type, "match");
  assert.equal(cash.title, "SAP FI ταμείο, χρηματικά εντάλματα και τραπεζικές κινήσεις");
});

test("real knowledge base handles SAP FI supplier and customer reports", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν εμφανίζεται καρτέλα προμηθευτή στο SAP");

  assert.equal(response.type, "match");
  assert.equal(response.title, "SAP FI προμηθευτές, πελάτες και υπόλοιπα");
});

test("real knowledge base refocuses broad SAP context to SAP FI when corrected", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const first = engine.answer("πρόβλημα στο sap");
  const next = engine.answer("δεν αφορά αποθέματα, αφορά δέσμευση FI_DESM_03", {
    conversationState: first.conversationState
  });

  assert.equal(first.type, "match");
  assert.equal(first.title, "Γενικό πρόβλημα SAP ή συναλλαγή SAP");
  assert.equal(next.type, "match");
  assert.equal(next.title, "SAP FI δεσμεύσεις και αναφορές δεσμεύσεων");
});

test("real knowledge base prefers pharmacy order guidance when pharmacy is explicit", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("μη εμφάνιση παραγγελίας στο φαρμακείο");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Δεν γίνεται παραγγελία φαρμάκων σε ασθενή");
});

test("real knowledge base handles MIS account access", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("χρειάζεται reset MIS και δεν έχω πρόσβαση στο MIS");

  assert.equal(response.type, "match");
  assert.equal(response.title, "MIS λογαριασμός, πρόσβαση ή φάκελος");
});

test("real knowledge base handles cross-network file transfers safely", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("μεταφορά αρχείου από internet σε MIS");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Μεταφορά αρχείων μεταξύ ΦΙΛΙΠΠΟΣ, MIS και Internet");
  assert.ok(response.answer.includes("εγκεκριμένη διαδικασία"));
});

test("real knowledge base keeps file transfer separate from MIS account access", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("μεταφορά αρχείων σε MIS");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Μεταφορά αρχείων μεταξύ ΦΙΛΙΠΠΟΣ, MIS και Internet");
});

test("real knowledge base handles network socket activation", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("ενεργοποίηση πρίζας δικτύου internet σε μπριζάκι");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Ενεργοποίηση ή αλλαγή δικτυακής πρίζας");
});

test("real knowledge base keeps account issues separate from generic IT problems", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("πρόβλημα σε λογαριασμό στον ΦΙΛΙΠΠΟ");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Αδυναμία σύνδεσης χρήστη");
});

test("real knowledge base keeps shared folder access separate from generic MIS access", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("αδυναμία πρόσβασης σε κοινόχρηστο φάκελο");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Πρόβλημα πρόσβασης σε κοινόχρηστο φάκελο");
});

test("real knowledge base handles service email and Outlook", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("ενεργοποίηση Outlook και πρόβλημα στο HAF mail");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Υπηρεσιακό email, Outlook ή HAF/Gmail");
});

test("real knowledge base handles workstation setup", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("αρχική εγκατάσταση υπολογιστή και διαμόρφωση η/υ");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Έλεγχος ή αρχική εγκατάσταση υπολογιστή");
});

test("real knowledge base handles printer quality and half-page printing", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("ο εκτυπωτής εκτυπώνει μισή σελίδα και έχει λάθος μέγεθος χαρτιού");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Εκτυπωτής τυπώνει λάθος, μισή σελίδα ή με κακή ποιότητα");
});

test("real knowledge base handles printer installation separately from printer faults", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("σύνδεση νέου εκτυπωτή και εγκατάσταση driver εκτυπωτή");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Σύνδεση, μετακίνηση ή εγκατάσταση εκτυπωτή");
});

test("real knowledge base handles Office document problems", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν ανοίγει αρχείο Word από τον κοινόχρηστο");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Πρόβλημα Word, Excel, PDF ή αρχείου Office");
});

test("real knowledge base handles missing or inactive Office installations", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δε βρίσκει τα Office και ζητά administrator κωδικούς");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Office ή LibreOffice λείπει, ζητά ενεργοποίηση ή δεν ανοίγει");
});

test("real knowledge base handles display and monitor problems", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν ανοίγει η οθόνη και τα γράμματα είναι πολύ μικρά");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Οθόνη, ανάλυση ή δεύτερη οθόνη δεν λειτουργεί");
});

test("real knowledge base handles keyboard mouse and KVM problems", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν δουλεύει το KVM και δεν λειτουργεί το πληκτρολόγιο");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Πληκτρολόγιο, ποντίκι, KVM ή περιφερειακά δεν λειτουργούν");
});

test("real knowledge base handles stuck or slow workstations", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("ο υπολογιστής κολλάει και δεν ανταποκρίνεται");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Υπολογιστής αργεί, κολλάει, σβήνει ή δεν ανοίγει");
});

test("real knowledge base handles lost or deleted files safely", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("διέγραψε αρχείο από τον κοινόχρηστο και θέλει επαναφορά");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Χαμένο, διαγραμμένο ή μη διαθέσιμο αρχείο");
});

test("real knowledge base handles browser popup and Firefox issues", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("το pop up δεν εμφανίζεται στον Firefox");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Pop-up, Firefox, browser ή μήνυμα εφαρμογής δεν εμφανίζεται σωστά");
});

test("real knowledge base handles VPN firewall and certificate issues safely", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("το FortiClient VPN βγάζει certificate και δεν με αφήνει να μπω");

  assert.equal(response.type, "match");
  assert.equal(response.title, "VPN, FortiClient, firewall ή πιστοποιητικό εμποδίζει πρόσβαση");
});

test("real knowledge base handles third-party hospital apps", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν μπορώ να μπω στο ΙΡΙΔΑ και δεν βλέπω HRM");

  assert.equal(response.type, "match");
  assert.equal(response.title, "ΙΡΙΔΑ, HRM, Πάνδωρα, Αίγλη ή τρίτη εφαρμογή δεν ανοίγει");
});

test("real knowledge base handles OPSYED and electronic prescription issues", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν μπορώ να συνδεθώ στο ΟΠΣΥΕΔ για ηλεκτρονική συνταγογράφηση");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Ηλεκτρονική συνταγογράφηση, e-prescription ή ΟΠΣΥΕΔ δεν λειτουργεί");
});

test("real knowledge base handles presentation and audio equipment", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("στο αμφιθέατρο δεν λειτουργεί το laser pointer και ο ήχος");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Ήχος, ηχεία, projector ή εξοπλισμός παρουσίασης δεν λειτουργεί");
});

test("real knowledge base handles amphitheater display routing", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("στο πόντιουμ δεν βγαίνει εικόνα στην τηλεόραση φουαγιέ από το splitter HDMI");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Ήχος, ηχεία, projector ή εξοπλισμός παρουσίασης δεν λειτουργεί");
});

test("real knowledge base handles UPS USB and disk issues", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("το UPS έχει κόκκινη ένδειξη και ο σκληρός δίσκος δεν αναγνωρίζεται");

  assert.equal(response.type, "match");
  assert.equal(response.title, "UPS, USB, σκληρός δίσκος ή αποθηκευτικό μέσο έχει πρόβλημα");
});

test("real knowledge base handles antivirus and software license warnings", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("το αντιϊκό γράφει πρόβλημα με licence και ζητά admin κωδικούς");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Antivirus, άδεια λογισμικού ή ενημέρωση ζητά ενέργεια");
});

test("real knowledge base handles Medico order cancellation safely", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("ακύρωση βιοψίας και λάθος παραγγελία στο Medico");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Ακύρωση ή διόρθωση παραγγελίας, βιοψίας ή εξέτασης στο Medico");
});

test("real knowledge base handles Medico language problems", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("στο Medico έχει λάθος γλώσσα και δεν γράφει ελληνικά");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Medico εμφανίζει λάθος γλώσσα");
});

test("real knowledge base handles patient card and doctor corrections safely", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("συγχώνευση καρτέλας ασθενή και αλλαγή γιατρού");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Αλλαγή γιατρού, εξιτηρίου ή στοιχείων ασθενή στο Medico");
});

test("real knowledge base handles account deactivation and transfers", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("αναχώρηση διαγραφή χρήστη λόγω μετάθεσης");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Διαγραφή, απενεργοποίηση ή μετακίνηση λογαριασμού χρήστη");
});

test("real knowledge base handles missing shortcuts and application rights", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("δεν υπάρχει το εικονίδιο της εφαρμογής και λείπει η συντόμευση");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Λείπει εικονίδιο, συντόμευση ή δικαίωμα πρόσβασης εφαρμογής");
});

test("real knowledge base handles admin tooling requests safely", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("join unjoin υπολογιστή και εγκατάσταση DameWare");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Join, unjoin, DameWare ή εγκατάσταση προγράμματος ζητά τεχνική ενέργεια");
});

test("real knowledge base handles medical equipment connectivity safely", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("τηλεμετρίες και σπιρόμετρο έχουν πρόβλημα σύνδεσης");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Τηλεμετρία, σπιρόμετρο ή ιατρικό μηχάνημα έχει πρόβλημα σύνδεσης");
});

test("real knowledge base asks for specifics on information-only requests", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("πληροφορίες");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Πληροφορίες ή ασαφές αίτημα χωρίς συγκεκριμένο πρόβλημα");
});

test("real knowledge base prefers barcode printer guidance over generic printer guidance", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("barcode δεν τυπώνει");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Barcode printer δεν τυπώνει σωστά");
});

test("real knowledge base uses Lansweeper KB derived safe topics", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const cases = [
    ["δεν εκτυπώνουν από RDP Internet", "Εκτύπωση από Medico ή RDP δεν λειτουργεί"],
    ["δεν εμφανίζει το σωστό τμήμα παροχής στο ημερολόγιο πόρων", "ΤΕΠ δεν εμφανίζεται ασθενής σε Ημερολόγιο Πόρων ή Λίστα Παραγγελιών"],
    ["χρειάζομαι μεταφορά αρχείων στο GEA FTP του MIS", "Μεταφορά αρχείων μεταξύ ΦΙΛΙΠΠΟΣ, MIS και Internet"],
    ["η βάση Access στον κοινόχρηστο δεν ανοίγει", "Βάση Access ή κοινόχρηστη εφαρμογή δεν ανοίγει"],
    ["δεν ανοίγει το HAF μέσω portal από ΦΙΛΙΠΠΟΣ", "Υπηρεσιακό email, Outlook ή HAF/Gmail"],
    ["δεν ανοίγει η ΗΛΙΔΑ Megatron", "ΙΡΙΔΑ, HRM, Πάνδωρα, Αίγλη ή τρίτη εφαρμογή δεν ανοίγει"]
  ];

  for (const [message, title] of cases) {
    const response = engine.answer(message);
    assert.equal(response.type, "match");
    assert.equal(response.title, title);
  }
});

test("real knowledge base routes water leaks to facilities guidance", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("διαρροή νερού στον διάδρομο");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Διαρροή νερού ή υδραυλικό πρόβλημα");
});

test("real knowledge base routes elevator issues to facilities guidance", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("κόλλησε το ασανσέρ στον τρίτο όροφο");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Ανελκυστήρας έχει βλάβη");
});

test("real knowledge base routes power outlet issues to facilities guidance", async () => {
  const engine = createChatEngine(await loadKnowledgeFromDirectory(knowledgeDirectory));
  const response = engine.answer("η πρίζα μυρίζει καμένο και δεν έχει ρεύμα");

  assert.equal(response.type, "match");
  assert.equal(response.title, "Διακοπή ρεύματος ή πρόβλημα πρίζας");
});
