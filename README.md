# HTIC Marathon – Intra Club Progress Tracker

A lightweight React + Tailwind web app to track weekly objectives for the HTIC Charity Marathon. Students update status, add notes/evidence, and log extra contributions; admins manage objectives, students, and exports.

## Quick Start (Local)

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Create a new repo on GitHub (e.g., `htic-marathon`).
2. **Upload the UNZIPPED contents** of this folder to the repo.
3. On Vercel: **Add New → Project** → pick your GitHub repo → Deploy.
   - Framework: **Vite**
   - Build Command: `npm run build` (auto)
   - Output Dir: `dist` (auto)

## Notes
- Admin passcode defaults to `admin123` (change in Settings).
- Data saves to your browser `localStorage`; use **Export JSON**/**Import JSON** for backup.
- Use **Export CSV** to share progress.

---

Made for St. Tom’s Catholic International College – HTIC Charity Marathon.
