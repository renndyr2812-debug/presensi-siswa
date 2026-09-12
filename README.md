---
title: Student Attendance Firebase
emoji: 🎒
colorFrom: blue
colorTo: indigo
pinned: false
---

# Sistem Presensi Digital Siswa — Firebase Hosting Edition

Arsitektur Opsi C: **Firebase Hosting (UI) + Google Apps Script (Backend) + Google Sheets (Database)**

Tidak ada server yang perlu menyala 24 jam. Tidak ada biaya server. Tidak ada kartu kredit.

## Setup
1. Pasang `apps-script/Code.gs` di Google Spreadsheet Anda (Ekstensi > Apps Script)
2. Deploy sebagai Web App → salin URL
3. Paste URL ke `public/js/config.js`
4. Deploy ke Firebase Hosting: `firebase deploy --only hosting`
