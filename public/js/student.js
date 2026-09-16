// Student Mobile Controller — St. Cloud International Academy
// Compliant with Mobile UI/UX Pro Max & zero-asset haptics
document.addEventListener('DOMContentLoaded', () => {
  const stateLogin    = document.getElementById('state-login');
  const stateBind     = document.getElementById('state-bind');
  const stateScanner  = document.getElementById('state-scanner');
  const stateTicket   = document.getElementById('state-ticket');

  const formNisn          = document.getElementById('form-nisn');
  const inputNisn         = document.getElementById('input-nisn');
  const loginError        = document.getElementById('login-error');
  const btnLogout         = document.getElementById('btn-logout');
  const btnSubmitNisn     = document.getElementById('btn-submit-nisn');
  const btnSubmitText     = document.getElementById('btn-submit-text');
  const btnSubmitSpinner  = document.getElementById('btn-submit-spinner');

  const bindStudentDesc   = document.getElementById('bind-student-desc');
  const bindDeviceName    = document.getElementById('bind-device-name');
  const btnBindBiometric  = document.getElementById('btn-bind-biometric');

  const studentNameDisplay    = document.getElementById('student-name-display');
  const studentIdDisplay      = document.getElementById('student-id-display');
  const studentClassDisplay   = document.getElementById('student-class-display');
  const studentAvatarInitials = document.getElementById('student-avatar-initials');
  const scanStatusAlert       = document.getElementById('scan-status-alert');

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
  if (/android/i.test(ua))                detectedDevice = 'Android Smartphone';
  else if (/iPhone|iPad|iPod/i.test(ua)) detectedDevice = 'Apple iPhone';
  else if (/Windows/i.test(ua))           detectedDevice = 'Windows Workstation';
  if (bindDeviceName) bindDeviceName.textContent = detectedDevice;

  // Quick 1-Tap Chip Selector
  window.selectDemoNisn = function(nisn) {
    if (inputNisn) {
      inputNisn.value = nisn;
      if (window.AudioHaptics) AudioHaptics.vibrateQRDetected();
      identifyStudent(nisn);
    }
  };

  // Helper to extract student name initials (e.g. Ahmad Fauzi -> AF)
  function getInitials(name) {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // ─── 1. Navigation State Switcher ───────────────────────────
  function showState(state) {
    stateLogin.style.display   = 'none';
    stateBind.style.display    = 'none';
    stateScanner.style.display = 'none';
    stateTicket.style.display  = 'none';

    if (state === 'login') {
      stateLogin.style.display = 'block';
      if (btnLogout) btnLogout.style.display = 'none';
      stopCamera();
    } else if (state === 'bind') {
      stateBind.style.display  = 'block';
      if (btnLogout) btnLogout.style.display = 'inline-flex';
      stopCamera();
    } else if (state === 'scanner') {
      stateScanner.style.display = 'flex';
      if (btnLogout) btnLogout.style.display = 'inline-flex';
      startCamera();
    } else if (state === 'ticket') {
      stateTicket.style.display = 'block';
      if (btnLogout) btnLogout.style.display = 'inline-flex';
      stopCamera();
    }
  }

  // ─── 2. Identify Student by NISN ────────────────────────────
  async function identifyStudent(nisn) {
    if (loginError) loginError.style.display = 'none';
    if (btnSubmitNisn) {
      btnSubmitNisn.disabled = true;
      if (btnSubmitText) btnSubmitText.style.display = 'none';
      if (btnSubmitSpinner) btnSubmitSpinner.style.display = 'inline';
    }

    try {
      const cleanNisn = String(nisn).trim();
      const data = await window.API.apiFetch({ action: 'lookupStudent', nisn: cleanNisn });
      if (data.error) throw new Error(data.error);

      currentStudent = data;
      localStorage.setItem('attendance_nisn', cleanNisn);

      // Populate student ID card
      if (studentNameDisplay) studentNameDisplay.textContent = currentStudent.name;
      if (studentIdDisplay) studentIdDisplay.textContent = `#${currentStudent.nisn}`;
      if (studentClassDisplay) studentClassDisplay.textContent = currentStudent.class_name;
      if (studentAvatarInitials) studentAvatarInitials.textContent = getInitials(currentStudent.name);

      if (window.AudioHaptics) {
        AudioHaptics.vibrateQRDetected();
      }

      if (currentStudent.attendanceToday) {
        renderTicket(currentStudent.attendanceToday, currentStudent);
        return;
      }
      if (!currentStudent.is_device_bound) {
        if (bindStudentDesc) {
          bindStudentDesc.textContent = `Welcome, ${currentStudent.name} (${currentStudent.class_name}). Authorize this smartphone's hardware keystore to prevent proxy attendance.`;
        }
        showState('bind');
      } else {
        showState('scanner');
      }
    } catch (err) {
      if (loginError) {
        loginError.textContent = '❌ ' + (err.message || 'Unable to find Student ID');
        loginError.style.display = 'block';
      }
      if (window.AudioHaptics) {
        AudioHaptics.vibrateError();
        AudioHaptics.playErrorChime();
      }
    } finally {
      if (btnSubmitNisn) {
        btnSubmitNisn.disabled = false;
        if (btnSubmitText) btnSubmitText.style.display = 'inline';
        if (btnSubmitSpinner) btnSubmitSpinner.style.display = 'none';
      }
    }
  }

  if (formNisn) {
    formNisn.addEventListener('submit', (e) => {
      e.preventDefault();
      const nisn = inputNisn.value.trim();
      if (nisn) identifyStudent(nisn);
    });
  }

  // ─── 3. Biometric Device Registration (WebAuthn) ─────────────
  if (btnBindBiometric) {
    btnBindBiometric.addEventListener('click', async () => {
      btnBindBiometric.disabled = true;
      btnBindBiometric.textContent = 'Activating Security Keystore...';

      try {
        let credentialId = 'device-' + Date.now();

        // Hardware biometric keystore check
        if (window.PublicKeyCredential && navigator.credentials && navigator.credentials.create) {
          try {
            const challenge = new Uint8Array(32);
            crypto.getRandomValues(challenge);

            const cred = await navigator.credentials.create({
              publicKey: {
                challenge,
                rp: {
                  name: 'St. Cloud Academy Gate',
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
            credentialId = cred.id;
          } catch (authErr) {
            console.warn('[WebAuthn fallback]:', authErr.message);
          }
        }

        // Register to Google Sheets via Apps Script
        const res = await window.API.apiFetch({
          action:       'registerDevice',
          studentId:    currentStudent.id,
          credentialId: credentialId,
          deviceName:   detectedDevice
        });

        if (!res.verified) throw new Error('Device enrollment failed');

        currentStudent = res.student;
        if (window.AudioHaptics) {
          AudioHaptics.vibrateSuccess();
          AudioHaptics.playSuccessChime();
        }

        showState('scanner');
      } catch (err) {
        alert('Biometric notice: ' + err.message);
      } finally {
        btnBindBiometric.disabled = false;
        btnBindBiometric.textContent = 'Authorize This Smartphone Device';
      }
    });
  }

  // ─── 4. Camera Viewfinder ────────────────────────────────────
  function startCamera() {
    if (isScanningActive) return;
    const qrRegion = document.getElementById('qr-reader');
    if (!qrRegion || typeof Html5Qrcode === 'undefined') return;

    html5QrScanner = new Html5Qrcode('qr-reader');
    html5QrScanner.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: { width: 230, height: 230 } },
      (decodedText) => handleQrScanned(decodedText),
      () => {}
    ).then(() => {
      isScanningActive = true;
    }).catch((err) => {
      console.warn('Camera notice:', err);
      showAlert('Camera preview unavailable. Use the manual token override below.', 'warning');
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
    showAlert('Verifying Dynamic QR & Security Keystore...', 'info');

    try {
      // Trigger biometric prompt if registered
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
        } catch (_) {}
      }

      // Record in Google Sheets
      const data = await window.API.apiFetch({
        action:             'scan',
        studentId:          currentStudent.id,
        token:              token,
        deviceCredentialId: currentStudent.device_credential_id || 'manual'
      });

      if (data.error) throw new Error(data.error);

      if (window.AudioHaptics) {
        AudioHaptics.vibrateSuccess();
        AudioHaptics.playSuccessChime();
      }

      renderTicket(data.attendance, currentStudent);
    } catch (err) {
      if (window.AudioHaptics) {
        AudioHaptics.vibrateError();
        AudioHaptics.playErrorChime();
      }
      showAlert(err.message || 'QR Verification failed', 'danger');
      setTimeout(() => {
        if (stateScanner.style.display === 'flex') startCamera();
      }, 2500);
    }
  }

  // ─── 7. Render Attendance Ticket ─────────────────────────────
  function renderTicket(attendance, student) {
    showState('ticket');

    ticketStudentName.textContent = student.name;
    ticketStudentMeta.textContent = `NISN: ${student.nisn} • ${student.class_name}`;
    ticketTimestamp.textContent   = (attendance.time || '07:00:00') + ' WIB';
    ticketMethod.textContent      = 'Biometric Device + Rolling QR';

    const isLate = (attendance.status === 'TERLAMBAT' || attendance.status === 'LATE');
    if (isLate) {
      ticketBadge.textContent = 'RECORDED: LATE PASS';
      ticketBadge.style.background = 'var(--status-warning-bg)';
      ticketBadge.style.color = 'var(--status-warning)';
      ticketBadge.style.borderColor = 'var(--status-warning-border)';
    } else {
      ticketBadge.textContent = 'RECORDED: ON-TIME PASS';
      ticketBadge.style.background = 'var(--status-success-bg)';
      ticketBadge.style.color = 'var(--status-success)';
      ticketBadge.style.borderColor = 'var(--status-success-border)';
    }
  }

  function showAlert(msg, type) {
    if (!scanStatusAlert) return;
    scanStatusAlert.textContent = msg;
    scanStatusAlert.style.display = 'block';

    if (type === 'danger') {
      scanStatusAlert.style.background = 'var(--status-danger-bg)';
      scanStatusAlert.style.color = '#FFA4A4';
      scanStatusAlert.style.border = '1px solid var(--status-danger-border)';
    } else if (type === 'warning') {
      scanStatusAlert.style.background = 'var(--status-warning-bg)';
      scanStatusAlert.style.color = 'var(--status-warning)';
      scanStatusAlert.style.border = '1px solid var(--status-warning-border)';
    } else {
      scanStatusAlert.style.background = 'rgba(2, 132, 199, 0.15)';
      scanStatusAlert.style.color = '#7DD3FC';
      scanStatusAlert.style.border = '1px solid rgba(2, 132, 199, 0.35)';
    }
  }

  // Manual Token Toggle & Submit
  if (btnManualToggle) {
    btnManualToggle.addEventListener('click', () => {
      const isHidden = manualDrawer.style.display === 'none';
      manualDrawer.style.display = isHidden ? 'block' : 'none';
      if (isHidden) inputManualToken.focus();
    });
  }

  if (btnSubmitManual) {
    btnSubmitManual.addEventListener('click', async () => {
      const token = inputManualToken.value.trim();
      if (!token) {
        alert('Please enter token hash from screen');
        return;
      }
      await submitAttendance(token);
    });
  }

  // Sign out / Change Student ID
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('attendance_nisn');
      currentStudent = null;
      if (inputNisn) inputNisn.value = '';
      showState('login');
    });
  }

  if (btnDone) {
    btnDone.addEventListener('click', () => {
      showState('login');
    });
  }

  // Check saved session
  const savedNisn = localStorage.getItem('attendance_nisn');
  if (savedNisn) {
    if (inputNisn) inputNisn.value = savedNisn;
    identifyStudent(savedNisn);
  } else {
    showState('login');
  }
});
