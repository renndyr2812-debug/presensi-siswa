// Display Mode Controller (Projector & Big Screen)
// Opsi C: SSE → Smart Polling setiap 10 detik ke Apps Script
document.addEventListener('DOMContentLoaded', () => {
  const clockEl       = document.getElementById('digital-clock');
  const qrImgEl       = document.getElementById('rolling-qr-img');
  const qrLoadingEl   = document.getElementById('qr-loading-spinner');
  const circleEl      = document.getElementById('countdown-circle');
  const countdownTextEl = document.getElementById('countdown-text');
  const tickerEl      = document.getElementById('live-stream-ticker');

  const circumference = 2 * Math.PI * 44; // ~276.46
  let intervalSeconds = 10;
  let remainingSeconds = 10;
  let countdownTimer = null;
  let lastTickerTimestamp = '';

  // ─── 1. Digital Clock ───────────────────────────────────────
  function updateClock() {
    const now = new Date();
    clockEl.textContent = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join(':');
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ─── 2. Countdown Ring Animation ─────────────────────────────
  function startCountdown(seconds) {
    if (countdownTimer) clearInterval(countdownTimer);
    remainingSeconds = seconds;
    intervalSeconds = seconds;

    function renderStep() {
      countdownTextEl.textContent = `${Math.ceil(remainingSeconds)}s`;
      const offset = circumference - (remainingSeconds / intervalSeconds) * circumference;
      circleEl.style.strokeDashoffset = offset;
      circleEl.style.stroke = remainingSeconds <= 3 ? '#f59e0b' : '#3b82f6';
    }

    renderStep();
    const stepMs = 100;
    countdownTimer = setInterval(() => {
      remainingSeconds -= (stepMs / 1000);
      if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        renderStep();
        clearInterval(countdownTimer);
      } else {
        renderStep();
      }
    }, stepMs);
  }

  // ─── 3. QR Generator (client-side via qrcodejs) ───────────────
  function renderQR(rawPayload, expiresIn) {
    // Gunakan qrcode.js untuk generate QR di client
    const container = document.getElementById('qr-canvas-container');
    if (!container) return;
    container.innerHTML = ''; // Clear previous QR

    if (typeof QRCode !== 'undefined') {
      new QRCode(container, {
        text: rawPayload,
        width: 340,
        height: 340,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
      qrImgEl.style.display = 'none';
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
    } else {
      // Fallback: show token text
      container.textContent = 'Token: ' + rawPayload;
    }

    qrLoadingEl.style.display = 'none';
    startCountdown(expiresIn || intervalSeconds);
  }

  // ─── 4. Poll QR dari Apps Script setiap 10 detik ─────────────
  async function fetchAndRenderQR() {
    try {
      const data = await window.API.apiFetch({ action: 'getQR' });
      if (data.rawPayload) {
        renderQR(data.rawPayload, data.expiresIn);
        intervalSeconds = data.intervalSeconds || 10;
      }
    } catch (err) {
      console.warn('QR fetch error:', err.message);
      qrLoadingEl.textContent = '⚠️ Koneksi bermasalah... mencoba ulang';
    }
  }

  // ─── 5. Poll Live Attendance Ticker setiap 5 detik ───────────
  async function pollLiveTicker() {
    try {
      const data = await window.API.apiFetch({
        action: 'recentAttendance',
        since: lastTickerTimestamp
      });
      if (data.records && data.records.length > 0) {
        data.records.forEach(rec => {
          addTickerCard(rec);
          if (!lastTickerTimestamp || rec.scan_timestamp > lastTickerTimestamp) {
            lastTickerTimestamp = rec.scan_timestamp;
          }
        });
      }
    } catch (err) {
      // Silent — tidak ganggu layar proyektor
    }
  }

  // ─── 6. Live Attendance Ticker Card ──────────────────────────
  function addTickerCard(student) {
    const card = document.createElement('div');
    card.className = 'ticker-item';

    const isLate     = student.status === 'TERLAMBAT';
    const isOverride = String(student.status).includes('MANUAL');
    const badgeClass = isLate ? 'badge-warning' : (isOverride ? 'badge-info' : 'badge-success');
    const statusText = isLate ? 'TERLAMBAT' : (isOverride ? 'HADIR (GURU)' : 'HADIR');

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 14px;">
        <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; color: #fff;">
          ${student.name.charAt(0)}
        </div>
        <div>
          <div style="font-weight: 700; font-size: 1.05rem;">${student.name}</div>
          <div style="color: var(--text-secondary); font-size: 0.85rem;">Kelas: ${student.class_name} • ${student.time || 'Baru saja'}</div>
        </div>
      </div>
      <div><span class="badge ${badgeClass}">${statusText}</span></div>
    `;

    tickerEl.prepend(card);
    while (tickerEl.children.length > 4) tickerEl.removeChild(tickerEl.lastChild);

    setTimeout(() => {
      if (card.parentNode) {
        card.style.opacity = '0';
        card.style.transition = 'opacity 0.4s ease';
        setTimeout(() => card.remove(), 400);
      }
    }, 20000);
  }

  // ─── Boot Sequence ────────────────────────────────────────────
  if (window.API.APPS_SCRIPT_URL === 'PASTE_URL_APPS_SCRIPT_ANDA_DI_SINI') {
    qrLoadingEl.textContent = '⚠️ Setup belum selesai: Paste Apps Script URL di js/config.js';
    return;
  }

  // Fetch QR pertama kali
  fetchAndRenderQR();

  // Poll QR setiap 10 detik (selaras dengan TOTP window)
  setInterval(fetchAndRenderQR, 10000);

  // Poll ticker kehadiran setiap 5 detik
  setInterval(pollLiveTicker, 5000);
  setTimeout(pollLiveTicker, 2000);
});
