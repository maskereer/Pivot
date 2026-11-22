# Institutional Radar — GitHub Setup (v4.8)

Αυτό το πακέτο περιέχει όσα χρειάζεσαι για να τρέχεις το radar από το **Samsung Galaxy Ultra** με υποστήριξη **GitHub** και **GitHub Actions**.

## Δομή αρχείων
- `institutional-radar-v4.8.html`: Το dashboard (με διόρθωση HL funding ×8, προσθήκη Binance COIN-M/USDC & OKX USD swaps στο OI, και fallback snapshot για whales).
- `.github/workflows/collect.yml`: Αυτόματο cron κάθε 15 λεπτά που μαζεύει δεδομένα και ενημερώνει το `radar-snapshot.json` + ιστορικό στο φάκελο `history/`.
- `scripts/collect.mjs`: Το script συλλογής δεδομένων (Node.js 20+).
- `radar-snapshot.json`: Το πιο πρόσφατο συγκεντρωτικό snapshot.

## Βήματα στο GitHub
1. Δημιούργησε ένα νέο repository στο GitHub (π.χ. `institutional-radar`).
2. Ανέβασε τα αρχεία κρατώντας τη δομή τους (`institutional-radar-v4.8.html`, `radar-snapshot.json`, `scripts/collect.mjs`, `.github/workflows/collect.yml`).
3. Στο repo πήγαινε **Settings → Actions → General → Workflow permissions** και επέλεξε **Read and write permissions**.
4. Ενεργοποίησε το **GitHub Pages** (από το branch `main` / root) ώστε να ανοίγεις εύκολα το `institutional-radar-v4.8.html` από τον browser του κινητού.
5. Πήγαινε στην καρτέλα **Actions** και πάτα **Run workflow** για τον πρώτο έλεγχο.
