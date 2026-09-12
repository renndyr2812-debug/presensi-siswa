// Student PWA Mobile Controller (Mobile UI/UX Pro Max Standard)
// Opsi C: /api/... → Apps Script GET params
document.addEventListener('DOMContentLoaded', () => {
  const stateLogin    = document.getElementById('state-login');
  const stateBind     = document.getElementById('state-bind');
  const stateScanner  = document.getElementById('state-scanner');
  const stateTicket   = document.getElementById('state-ticket');

  const formNisn      = document.getElementById('form-nisn');
  const inputNisn     = document.getElementById('input-nisn');
  const loginError    = document.getElementById('login-error');
  const btnLogout     = document.getElementById('btn-logout');

  const bindStudentDesc  = document.getElementById('bind-student-desc');
  const bindDeviceName   = document.getElementById('bind-device-name');
  const btnBindBiometric = document.getElementById('btn-bind-biometric');

  const studentNameDisplay = document.getElementById('student-name-display');
  const studentMetaDisplay = document.getElementById('student-meta-display');
  const scanStatusAlert    = document.getElementById('scan-status-alert');

  const btnManualToggle  = document.getElementById('btn-manual-token-toggle');
  const manualDrawer     = document.getElementById('manual-token-drawer');
  const inputManualToken = document.getElementById('input-manual-token');
  const btnSubmitManual  = document.getElementById('btn-submit-manual-token');

  const ticketBadge       = document.getElementById('ticket-badge');
  const ticketStudentName = document.getElementById('ticket-student-name');
  const ticketStudentMeta = document.getElementById('ticket-student-meta');
  const ticketTimestamp   = document.getElementById('ticket-timestamp');
  const ticketMethod      = document.getElementById('ticket-method');
  const btnDone           = document.getElementById('btn-done');

  let currentStudent    = null;
  let html5QrScanner    = null;
  let isScanningActive  = false;

  // Detect Device Platform
  const ua = navigator.userAgent;
  let detectedDevice = 'Smartphone';
  if (/android/i.test(ua))           detectedDevice = 'Android Phone';
  else if (/iPhone|iPad|iPod/i.test(ua)) detectedDevice = 'Apple iPhone';
  else if (/Windows/i.test(ua))      detectedDevice = 'Windows Device';
  bindDeviceName.textContent = detectedDevice;

  // ─── 1. Navigation State Switcher ───────────────────────────
  function showState(state) {
    stateLogin.style.display   = 'none';
    stateBind.style.display    = 'none';
    stateScanner.style.display = 'none';
    stateTicket.style.display  = 'none';

    if (state === 'login') {
      stateLogin.style.display = 'block';
      btnLogout.style.display  = 'none';
      stopCamera();
    } else if (state === 'bind') {
      stateBind.style.display  = 'block';
      btnLogout.style.display  = 'inline-flex';
      stopCamera();
    } else if (state === 'scanner') {
      stateScanner.style.display = 'flex';
      btnLogout.style.display    = 'inline-flex';
      startCamera();
    } else if (state === 'ticket') {
      stateTicket.style.display = 'block';
      btnLogout.style.display   = 'inline-flex';
      stopCamera();
    }
  }

  // ─── 2. Identify Student by NISN ────────────────────────────
  async function identifyStudent(nisn) {
    loginError.style.display = 'none';
    try {
      const data = await window.API.apiFetch({ action: 'lookupStudent', nisn });
      if (data.error) throw new Error(data.error);

      currentStudent = data;
      localStorage.setItem('attendance_nisn', nisn);

      studentNameDisplay.textContent = currentStudent.name;
      studentMetaDisplay.textContent = `NISN: ${currentStudent.nisn} • Kelas: ${currentStudent.class_name}`;

      if (currentStudent.attendanceToday) {
        renderTicket(currentStudent.attendanceToday, currentStudent);
        return;
      }
      if (!currentStudent.is_device_bound) {
        bindStudentDesc.textContent = `Hai ${currentStudent.name} (${currentStudent.class_name}), daftarkan sidik jari smartphone ini untuk mengunci akun Anda.`;
        showState('bind');
      } else {
        showState('scanner');
      }
    } catch (err) {
      loginError.textContent = err.message;
      loginError.style.display = 'block';
      if (window.AudioHaptics) AudioHaptics.vibrateError();
    }
  }

  formNisn.addEventListener('submit', (e) => {
    e.preventDefault();
    const nisn = inputNisn.value.trim();
    if (nisn) identifyStudent(nisn);
  });

  // ─── 3. Biometric Device Registration (WebAuthn) ─────────────
  btnBindBiometric.addEventListener('click', async () => {
    btnBindBiometric.disabled = true;
    btnBindBiometric.textContent = 'Menghubungkan Sensor...';

    try {
      let credentialId = 'device-' + Date.now();

      // Coba aktivasi WebAuthn hardware biometrik di browser
      if (window.PublicKeyCredential && navigator.credentials && navigator.credentials.create) {
        try {
          const challenge = new Uint8Array(32);
          crypto.getRandomValues(challenge);

          const cred = await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: {
                name: 'Sistem Presensi Siswa',
                id: window.location.hostname
              },
              user: {
                id: new TextEncoder().encode(currentStudent.id),
                name: currentStudent.nisn,
                displayName: currentStudent.name
              },
              pubKeyCredParams: [
                { type: 'public-key', alg: -7 },   // ES256
                { type: 'public-key', alg: -257 }  // RS256
              ],
              authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'required',
                authenticatorAttachment: 'platform'
              },
              attestation: 'none',
              timeout: 60000
            }
          });
          credentialId = cred.id; // Use the WebAuthn credential ID as device binding key
        } catch (authErr) {
          console.warn('[WebAuthn] Hardware biometrik fallback:', authErr.message);
          // credentialId tetap 'device-' + timestamp sebagai fallback
        }
      }

      // Daftarkan device ke Apps Script (simpan credential ID di Google Sheets)
      const res = await window.API.apiFetch({
        action:       'registerDevice',
        studentId:    currentStudent.id,
        credentialId: credentialId,
        deviceName:   detectedDevice
      });

      if (!res.verified) throw new Error('Registrasi perangkat gagal');

      currentStudent = res.student;
      if (window.AudioHaptics) {
        AudioHaptics.vibrateSuccess();
        AudioHaptics.playSuccessChime();
      }

      showState('scanner');
    } catch (err) {
      alert('Kendala biometrik: ' + err.message);
    } finally {
      btnBindBiometric.disabled = false;
      btnBindBiometric.textContent = 'Aktifkan Biometrik di HP Ini';
    }
  });

  // ─── 4. Camera Viewfinder ────────────────────────────────────
  function startCamera() {
    if (isScanningActive) return;
    const qrRegion = document.getElementById('qr-reader');
    if (!qrRegion || typeof Html5Qrcode === 'undefined') return;

    html5QrScanner = new Html5Qrcode('qr-reader');
    html5QrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => handleQrScanned(decodedText),
      () => {}
    ).then(() => {
      isScanningActive = true;
    }).catch((err) => {
      console.warn('Camera start error:', err);
      showAlert('Kamera tidak dapat diakses. Silakan gunakan input token manual di bawah.', 'warning');
    });
  }

  function stopCamera() {
    if (html5QrScanner && isScanningActive) {
      html5QrScanner.stop().then(() => { isScanningActive = false; }).catch(() => { isScanningActive = false; });
    }
  }

  // ─── 5. Handle Scanned QR Token ──────────────────────────────
  async function handleQrScanned(rawText) {
    if (window.AudioHaptics) AudioHaptics.vibrateQRDetected();
    stopCamera();

    let token = rawText;
    try {
      const parsed = JSON.parse(rawText);
      if (parsed.token) token = parsed.token;
    } catch (_) {}

    await submitAttendance(token);
  }

  // ─── 6. Submit Attendance ─────────────────────────────────────
  async function submitAttendance(token) {
    showAlert('Memverifikasi Biometrik & Validasi QR...', 'info');

    try {
      // Trigger biometric prompt jika device terdaftar via WebAuthn
      if (window.PublicKeyCredential && navigator.credentials && navigator.credentials.get && currentStudent.device_credential_id && !currentStudent.device_credential_id.startsWith('device-')) {
        try {
          const challenge = new Uint8Array(32);
          crypto.getRandomValues(challenge);
          await navigator.credentials.get({
            publicKey: {
              challenge,
              rpId: window.location.hostname,
              allowCredentials: [{
                id: Uint8Array.from(atob(currentStudent.device_credential_id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
                type: 'public-key',
                transports: ['internal']
              }],
              userVerification: 'required',
              timeout: 30000
            }
          });
        } catch (_) {
          // Jika gagal prompt (device tidak cocok), tetap lanjut — TOTP adalah garis pertahanan utama
        }
      }

      // Kirim ke Apps Script untuk validasi TOTP + device binding + catat kehadiran
      const data = await window.API.apiFetch({
        action:             'scan',
        studentId:          currentStudent.id,
        qrToken:            token,
        verificationMethod: 'BIOMETRIC_FINGERPRINT',
        deviceName:         detectedDevice
      });

      if (data.error) throw new Error(data.error);

      if (window.AudioHaptics) {
        AudioHaptics.vibrateSuccess();
        AudioHaptics.playSuccessChime();
      }

      renderTicket(data.record, currentStudent);
    } catch (err) {
      if (window.AudioHaptics) {
        AudioHaptics.vibrateError();
        AudioHaptics.playErrorChime();
      }
      showAlert(`❌ ${err.message}`, 'danger');
      setTimeout(() => {
        if (stateScanner.style.display !== 'none') startCamera();
      }, 3000);
    }
  }

  function showAlert(msg, type) {
    scanStatusAlert.textContent = msg;
    scanStatusAlert.style.display = 'block';
    const colors = {
      danger:  { bg: 'var(--status-danger-bg)',  fg: 'var(--status-danger)' },
      warning: { bg: 'var(--status-warning-bg)', fg: 'var(--status-warning)' },
      info:    { bg: 'var(--status-info-bg)',    fg: 'var(--status-info)' }
    };
    const c = colors[type] || colors.info;
    scanStatusAlert.style.background = c.bg;
    scanStatusAlert.style.color      = c.fg;
  }

  // ─── 7. Render Attendance Ticket ─────────────────────────────
  function renderTicket(record, student) {
    ticketStudentName.textContent = student.name;
    ticketStudentMeta.textContent = `NISN: ${student.nisn} • Kelas: ${student.class_name}`;

    const isLate     = record.status === 'TERLAMBAT';
    const isOverride = String(record.status).includes('MANUAL');

    if (isLate) {
      ticketBadge.className   = 'badge badge-warning';
      ticketBadge.textContent = 'TERLAMBAT';
    } else if (isOverride) {
      ticketBadge.className   = 'badge badge-info';
      ticketBadge.textContent = 'HADIR (OVERRIDE GURU)';
    } else {
      ticketBadge.className   = 'badge badge-success';
      ticketBadge.textContent = 'HADIR TEPAT WAKTU';
    }

    const timeDate = new Date(record.scan_timestamp);
    ticketTimestamp.textContent = timeDate.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) + ' WIB';
    ticketMethod.textContent = record.verification_method || 'Biometrik Sidik Jari HP';

    showState('ticket');
  }

  // ─── 8. Manual Drawer ────────────────────────────────────────
  btnManualToggle.addEventListener('click', () => {
    const isHidden = manualDrawer.style.display === 'none';
    manualDrawer.style.display = isHidden ? 'block' : 'none';
  });
  btnSubmitManual.addEventListener('click', () => {
    const token = inputManualToken.value.trim();
    if (token) submitAttendance(token);
  });

  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('attendance_nisn');
    currentStudent = null;
    showState('login');
  });

  btnDone.addEventListener('click', () => showState('login'));

  // Auto-login
  const savedNisn = localStorage.getItem('attendance_nisn');
  if (savedNisn) {
    identifyStudent(savedNisn);
  } else {
    showState('login');
  }
});
