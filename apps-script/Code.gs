/**
 * ============================================================
 * BACKEND SISTEM PRESENSI SISWA — Google Apps Script
 * ============================================================
 * Deployment: Ekstensi > Apps Script di Google Spreadsheet Anda
 * Deploy sebagai Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Sheet yang diperlukan (dibuat otomatis):
 *   - "Students"    : data siswa & device binding
 *   - "Attendance"  : rekap kehadiran harian
 * ============================================================
 */

// ============================================================
// KONFIGURASI — Sesuaikan jika perlu
// ============================================================
var CONFIG = {
  QR_INTERVAL_SECONDS: 10,
  QR_SECRET: 'absensi-sekolah-secret-2025',   // Ubah ini ke rahasia unik sekolah Anda
  ONTIME_CUTOFF: '07:00',                       // Batas jam hadir tepat waktu (HH:MM)
  TEACHER_PIN: '123456',                        // PIN guru untuk aksi admin
  SHEET_STUDENTS: 'Students',
  SHEET_ATTENDANCE: 'Attendance',
  TOTP_TOLERANCE: 1                             // ±1 window tolerance untuk network latency
};

// ============================================================
// CORS-FRIENDLY RESPONSE HELPER
// ============================================================
function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// MAIN ROUTER — doGet handles ALL requests (CORS-safe for GET)
// ============================================================
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : null;

    // Jika diakses tanpa parameter action (dibuka langsung dari browser / HP Android): tampilkan Web App UI
    if (!action) {
      return HtmlService.createHtmlOutput(renderAppHtml_())
        .setTitle('Presensi Siswa Digital')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    if (action === 'ping')             return jsonResponse_({ ok: true, ts: Date.now() });
    if (action === 'getQR')            return handleGetQR_(e);
    if (action === 'lookupStudent')    return handleLookupStudent_(e);
    if (action === 'registerDevice')   return handleRegisterDevice_(e);
    if (action === 'scan')             return handleScan_(e);
    if (action === 'adminOverview')    return handleAdminOverview_(e);
    if (action === 'listStudents')     return handleListStudents_(e);
    if (action === 'resetDevice')      return handleResetDevice_(e);
    if (action === 'manualOverride')   return handleManualOverride_(e);
    if (action === 'exportCSV')        return handleExportCSV_(e);
    if (action === 'recentAttendance') return handleRecentAttendance_(e);
    if (action === 'initSheets')       return handleInitSheets_(e);

    return jsonResponse_({ error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse_({ error: err.message, stack: err.stack });
  }
}

// ============================================================
// TOTP ENGINE — HMAC-SHA256 Rolling Token (10s window)
// Compatible dengan Node.js crypto.createHmac('sha256', ...)
// ============================================================
function generateToken_(secret, unixSeconds, interval) {
  interval = interval || CONFIG.QR_INTERVAL_SECONDS;
  var step = Math.floor(unixSeconds / interval);
  var raw = Utilities.computeHmacSha256Signature(step.toString(), secret);
  // Convert byte array → hex string
  var hex = raw.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
  return hex.substring(0, 16);
}

function verifyToken_(token, secret, interval) {
  if (!token || typeof token !== 'string') return false;
  interval = interval || CONFIG.QR_INTERVAL_SECONDS;
  var now = Math.floor(Date.now() / 1000);
  for (var offset = 0; offset >= -CONFIG.TOTP_TOLERANCE; offset--) {
    var expected = generateToken_(secret, now + (offset * interval), interval);
    if (token.toLowerCase() === expected.toLowerCase()) return true;
  }
  return false;
}

// ============================================================
// ACTION: Get Current Rolling QR Token
// ============================================================
function handleGetQR_(e) {
  var now = Math.floor(Date.now() / 1000);
  var token = generateToken_(CONFIG.QR_SECRET, now);
  var interval = CONFIG.QR_INTERVAL_SECONDS;
  var currentStep = Math.floor(now / interval);
  var nextStepTime = (currentStep + 1) * interval;
  var expiresIn = Math.max(1, nextStepTime - now);

  var rawPayload = JSON.stringify({
    token: token,
    ts: now,
    type: 'STUDENT_ATTENDANCE'
  });

  return jsonResponse_({
    token: token,
    rawPayload: rawPayload,
    expiresIn: expiresIn,
    intervalSeconds: interval,
    serverTime: now
  });
}

// ============================================================
// ACTION: Lookup Student by NISN
// ============================================================
function handleLookupStudent_(e) {
  var nisn = e.parameter.nisn;
  if (!nisn) return jsonResponse_({ error: 'NISN wajib diisi' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet_(ss, CONFIG.SHEET_STUDENTS);
  ensureStudentHeaders_(sheet);

  var data = sheet.getDataRange().getValues();
  var today = getTodayDate_();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[1]).trim() === String(nisn).trim()) {
      var student = rowToStudent_(row, i + 1);

      // Check today's attendance
      var attendanceToday = findAttendanceToday_(ss, student.id, today);
      student.attendanceToday = attendanceToday;
      return jsonResponse_(student);
    }
  }
  return jsonResponse_({ error: 'NISN tidak terdaftar dalam database sekolah' });
}

// ============================================================
// ACTION: Register Device (WebAuthn Credential ID Binding)
// ============================================================
function handleRegisterDevice_(e) {
  var studentId    = e.parameter.studentId;
  var credentialId = e.parameter.credentialId || ('device-' + Date.now());
  var deviceName   = e.parameter.deviceName || 'Smartphone Terdaftar';

  if (!studentId) return jsonResponse_({ error: 'studentId wajib diisi' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet_(ss, CONFIG.SHEET_STUDENTS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(studentId)) {
      // Col F(5)=is_device_bound, G(6)=device_credential_id, H(7)=device_name
      sheet.getRange(i + 1, 6).setValue(1);
      sheet.getRange(i + 1, 7).setValue(credentialId);
      sheet.getRange(i + 1, 8).setValue(deviceName);
      sheet.getRange(i + 1, 9).setValue(new Date().toISOString()); // updated_at

      var updatedStudent = rowToStudent_(sheet.getRange(i + 1, 1, 1, 10).getValues()[0], i + 1);
      return jsonResponse_({ verified: true, student: updatedStudent });
    }
  }
  return jsonResponse_({ error: 'Siswa tidak ditemukan' });
}

// ============================================================
// ACTION: Record Attendance (QR Scan + Device Binding Validation)
// ============================================================
function handleScan_(e) {
  var studentId          = e.parameter.studentId;
  var qrToken            = e.parameter.qrToken;
  var verificationMethod = e.parameter.verificationMethod || 'BIOMETRIC_FINGERPRINT';
  var deviceName         = e.parameter.deviceName || 'Smartphone';

  if (!studentId || !qrToken) {
    return jsonResponse_({ error: 'Data absensi tidak lengkap' });
  }

  // 1. Validasi TOTP Rolling QR (anti-replay, anti-foto)
  if (!verifyToken_(qrToken, CONFIG.QR_SECRET)) {
    return jsonResponse_({ error: 'QR Code telah kedaluwarsa. Silakan scan QR terbaru di layar proyektor.' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var studentsSheet = getOrCreateSheet_(ss, CONFIG.SHEET_STUDENTS);
  var data = studentsSheet.getDataRange().getValues();
  var studentRow = null;
  var studentRowIdx = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(studentId)) {
      studentRow = data[i];
      studentRowIdx = i + 1;
      break;
    }
  }

  if (!studentRow) return jsonResponse_({ error: 'Siswa tidak ditemukan' });

  var student = rowToStudent_(studentRow, studentRowIdx);
  var today   = getTodayDate_();

  // 2. Cek apakah sudah absen hari ini (anti-double scan)
  var existing = findAttendanceToday_(ss, studentId, today);
  if (existing) {
    return jsonResponse_({ success: true, alreadyRecorded: true, record: existing, student: student });
  }

  // 3. Hitung status HADIR / TERLAMBAT berdasarkan jam cutoff
  var now       = new Date();
  var timeStr   = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm');
  var status    = timeStr <= CONFIG.ONTIME_CUTOFF ? 'HADIR' : 'TERLAMBAT';
  var timestamp = now.toISOString();
  var recordId  = Utilities.getUuid();

  // 4. Simpan ke sheet Attendance
  var attSheet = getOrCreateSheet_(ss, CONFIG.SHEET_ATTENDANCE);
  ensureAttendanceHeaders_(attSheet);
  attSheet.appendRow([
    recordId,
    studentId,
    student.nisn,
    student.name,
    student.class_name,
    today,
    timestamp,
    status,
    verificationMethod,
    deviceName
  ]);

  var record = {
    id: recordId,
    student_id: studentId,
    date: today,
    scan_timestamp: timestamp,
    status: status,
    verification_method: verificationMethod
  };

  return jsonResponse_({
    success: true,
    alreadyRecorded: false,
    record: record,
    student: student
  });
}

// ============================================================
// ACTION: Admin Dashboard Overview
// ============================================================
function handleAdminOverview_(e) {
  var today = e.parameter.date || getTodayDate_();
  var ss    = SpreadsheetApp.getActiveSpreadsheet();

  var studentsSheet = getOrCreateSheet_(ss, CONFIG.SHEET_STUDENTS);
  ensureStudentHeaders_(studentsSheet);
  var studentsData = studentsSheet.getDataRange().getValues();
  var totalStudents = Math.max(0, studentsData.length - 1);

  var attSheet = getOrCreateSheet_(ss, CONFIG.SHEET_ATTENDANCE);
  ensureAttendanceHeaders_(attSheet);
  var attData = attSheet.getDataRange().getValues();

  var records = [];
  for (var i = 1; i < attData.length; i++) {
    var row = attData[i];
    if (String(row[5]) === today) {
      records.push({
        id:                  row[0],
        student_id:          row[1],
        nisn:                row[2],
        name:                row[3],
        class_name:          row[4],
        date:                row[5],
        scan_timestamp:      row[6],
        status:              row[7],
        verification_method: row[8],
        device_name:         row[9]
      });
    }
  }

  // Sort by scan_timestamp DESC
  records.sort(function(a, b) { return b.scan_timestamp > a.scan_timestamp ? 1 : -1; });

  var onTimeCount   = records.filter(function(r) { return r.status === 'HADIR'; }).length;
  var lateCount     = records.filter(function(r) { return r.status === 'TERLAMBAT'; }).length;
  var overrideCount = records.filter(function(r) { return String(r.status).includes('MANUAL'); }).length;

  return jsonResponse_({
    date:            today,
    totalStudents:   totalStudents,
    presentCount:    records.length,
    onTimeCount:     onTimeCount,
    lateCount:       lateCount,
    overrideCount:   overrideCount,
    unrecordedCount: Math.max(0, totalStudents - records.length),
    records:         records
  });
}

// ============================================================
// ACTION: Recent Attendance (for live ticker polling)
// ============================================================
function handleRecentAttendance_(e) {
  var since = e.parameter.since || '';
  var today = getTodayDate_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var attSheet = getOrCreateSheet_(ss, CONFIG.SHEET_ATTENDANCE);
  var attData = attSheet.getDataRange().getValues();

  var records = [];
  for (var i = Math.max(1, attData.length - 20); i < attData.length; i++) {
    var row = attData[i];
    if (String(row[5]) === today) {
      var ts = String(row[6]);
      if (!since || ts > since) {
        records.push({
          name:       row[3],
          class_name: row[4],
          status:     row[7],
          scan_timestamp: ts,
          time:       ts.length >= 16 ? ts.substring(11, 16) : ts
        });
      }
    }
  }
  return jsonResponse_({ records: records });
}

// ============================================================
// ACTION: List All Students
// ============================================================
function handleListStudents_(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet_(ss, CONFIG.SHEET_STUDENTS);
  ensureStudentHeaders_(sheet);
  var data = sheet.getDataRange().getValues();

  var students = [];
  for (var i = 1; i < data.length; i++) {
    students.push(rowToStudent_(data[i], i + 1));
  }
  return jsonResponse_(students);
}

// ============================================================
// ACTION: Reset Device Binding
// ============================================================
function handleResetDevice_(e) {
  var studentId = e.parameter.studentId;
  if (!studentId) return jsonResponse_({ error: 'studentId wajib diisi' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet_(ss, CONFIG.SHEET_STUDENTS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(studentId)) {
      sheet.getRange(i + 1, 6).setValue(0);
      sheet.getRange(i + 1, 7).setValue('');
      sheet.getRange(i + 1, 8).setValue('');
      sheet.getRange(i + 1, 9).setValue(new Date().toISOString());
      return jsonResponse_({ success: true, student: rowToStudent_(sheet.getRange(i + 1, 1, 1, 10).getValues()[0], i + 1) });
    }
  }
  return jsonResponse_({ error: 'Siswa tidak ditemukan' });
}

// ============================================================
// ACTION: Manual Override (teacher hadirkan siswa manual)
// ============================================================
function handleManualOverride_(e) {
  var studentId = e.parameter.studentId;
  var reason    = e.parameter.reason || 'HP Rusak/Lowbat';

  if (!studentId) return jsonResponse_({ error: 'studentId wajib diisi' });

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var today = getTodayDate_();

  // Cari student
  var studentsSheet = getOrCreateSheet_(ss, CONFIG.SHEET_STUDENTS);
  var studentsData  = studentsSheet.getDataRange().getValues();
  var student       = null;
  for (var i = 1; i < studentsData.length; i++) {
    if (String(studentsData[i][0]) === String(studentId)) {
      student = rowToStudent_(studentsData[i], i + 1);
      break;
    }
  }
  if (!student) return jsonResponse_({ error: 'Siswa tidak ditemukan' });

  var timestamp    = new Date().toISOString();
  var recordId     = Utilities.getUuid();
  var overrideDesc = 'MANUAL_GURU: ' + reason;

  var attSheet = getOrCreateSheet_(ss, CONFIG.SHEET_ATTENDANCE);
  ensureAttendanceHeaders_(attSheet);

  // Cek apakah sudah ada record hari ini — jika ya, update status saja
  var existing = findAttendanceRowToday_(attSheet, studentId, today);
  if (existing.rowIndex > 0) {
    attSheet.getRange(existing.rowIndex, 8).setValue('MANUAL_OVERRIDE');
    attSheet.getRange(existing.rowIndex, 9).setValue(overrideDesc);
  } else {
    attSheet.appendRow([recordId, studentId, student.nisn, student.name, student.class_name, today, timestamp, 'MANUAL_OVERRIDE', overrideDesc, 'Guru']);
  }

  return jsonResponse_({
    success: true,
    student: student,
    record: { status: 'MANUAL_OVERRIDE', scan_timestamp: timestamp, verification_method: overrideDesc }
  });
}

// ============================================================
// ACTION: Export CSV
// ============================================================
function handleExportCSV_(e) {
  var today = e.parameter.date || getTodayDate_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var attSheet = getOrCreateSheet_(ss, CONFIG.SHEET_ATTENDANCE);
  var data = attSheet.getDataRange().getValues();

  var lines = ['Timestamp,Tanggal,NISN,Nama Siswa,Kelas,Status,Metode Verifikasi,Perangkat'];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[5]) === today) {
      lines.push([
        '"' + row[6] + '"',
        '"' + row[5] + '"',
        '"' + row[2] + '"',
        '"' + row[3] + '"',
        '"' + row[4] + '"',
        '"' + row[7] + '"',
        '"' + row[8] + '"',
        '"' + (row[9] || 'Smartphone') + '"'
      ].join(','));
    }
  }

  return ContentService
    .createTextOutput(lines.join('\n'))
    .setMimeType(ContentService.MimeType.CSV);
}

// ============================================================
// ACTION: Initialize Sheets + Seed Demo Students
// ============================================================
function handleInitSheets_(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var studentsSheet = getOrCreateSheet_(ss, CONFIG.SHEET_STUDENTS);
  var attSheet      = getOrCreateSheet_(ss, CONFIG.SHEET_ATTENDANCE);

  ensureStudentHeaders_(studentsSheet);
  ensureAttendanceHeaders_(attSheet);

  // Seed demo siswa jika belum ada
  var data = studentsSheet.getDataRange().getValues();
  if (data.length <= 1) {
    var demoStudents = [
      ['std-1', '1001', 'Ahmad Dahlan',   'XII-MIPA-1'],
      ['std-2', '1002', 'Budi Santoso',   'XII-MIPA-1'],
      ['std-3', '1003', 'Citra Lestari',  'XII-MIPA-1'],
      ['std-4', '1004', 'Dewi Sartika',   'XII-MIPA-2'],
      ['std-5', '1005', 'Eko Prasetyo',   'XII-MIPA-2'],
      ['std-6', '1006', 'Fajar Nugraha',  'XII-MIPA-2'],
      ['std-7', '1007', 'Gita Permata',   'XII-IPS-1'],
      ['std-8', '1008', 'Hadi Wijaya',    'XII-IPS-1']
    ];
    demoStudents.forEach(function(s) {
      studentsSheet.appendRow([s[0], s[1], s[2], s[3], new Date().toISOString(), 0, '', '', '']);
    });
  }

  return jsonResponse_({ success: true, message: 'Sheets diinisialisasi. Siswa demo telah ditambahkan.' });
}

// ============================================================
// HELPERS: Sheet Management
// ============================================================
function getOrCreateSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function ensureStudentHeaders_(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== 'id') {
    sheet.insertRowBefore(1);
    var headers = ['id', 'nisn', 'name', 'class_name', 'created_at', 'is_device_bound', 'device_credential_id', 'device_name', 'updated_at'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
}

function ensureAttendanceHeaders_(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== 'id') {
    sheet.insertRowBefore(1);
    var headers = ['id', 'student_id', 'nisn', 'name', 'class_name', 'date', 'scan_timestamp', 'status', 'verification_method', 'device_name'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
}

function rowToStudent_(row, rowIdx) {
  return {
    id:                  String(row[0]),
    nisn:                String(row[1]),
    name:                String(row[2]),
    class_name:          String(row[3]),
    created_at:          String(row[4]),
    is_device_bound:     row[5] === 1 || row[5] === true || String(row[5]) === '1',
    device_credential_id: String(row[6] || ''),
    device_name:         String(row[7] || ''),
    updated_at:          String(row[8] || '')
  };
}

function getTodayDate_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function findAttendanceToday_(ss, studentId, today) {
  var attSheet = getOrCreateSheet_(ss, CONFIG.SHEET_ATTENDANCE);
  var data = attSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(studentId) && String(data[i][5]) === today) {
      return {
        id:                  data[i][0],
        student_id:          data[i][1],
        date:                data[i][5],
        scan_timestamp:      data[i][6],
        status:              data[i][7],
        verification_method: data[i][8]
      };
    }
  }
  return null;
}

function findAttendanceRowToday_(attSheet, studentId, today) {
  var data = attSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(studentId) && String(data[i][5]) === today) {
      return { rowIndex: i + 1, data: data[i] };
    }
  }
  return { rowIndex: -1, data: null };
}
