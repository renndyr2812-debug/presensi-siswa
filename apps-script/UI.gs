/**
 * UI.gs — Frontend Mobile Web App Renderer untuk Google Apps Script
 * Menghasilkan antarmuka PWA lengkap yang terpasang di Android dan browser
 */

function renderAppHtml_() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#1e40af">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Presensi Siswa Digital</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

  <style>
    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --success: #16a34a;
      --warning: #ca8a04;
      --danger: #dc2626;
      --bg: #f8fafc;
      --surface: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --radius: 16px;
      --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body { background-color: var(--bg); color: var(--text); padding-bottom: 80px; }

    header {
      background: linear-gradient(135deg, #1e3a8a, #2563eb);
      color: white;
      padding: 20px 16px;
      text-align: center;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
    }
    header h1 { font-size: 1.25rem; font-weight: 800; letter-spacing: -0.02em; }
    header p { font-size: 0.8rem; opacity: 0.9; margin-top: 4px; }

    .nav-tabs {
      display: flex;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 73px;
      z-index: 90;
    }
    .tab-btn {
      flex: 1;
      padding: 12px 8px;
      background: none;
      border: none;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
    }
    .tab-btn.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
      background: rgba(37, 99, 235, 0.04);
    }

    .container { max-width: 500px; margin: 0 auto; padding: 16px; }
    .tab-content { display: none; }
    .tab-content.active { display: block; animation: fadeIn 0.3s ease; }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    .card {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 20px;
      box-shadow: var(--shadow);
      margin-bottom: 16px;
      border: 1px solid var(--border);
    }
    .card-title { font-size: 1rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }

    .input-group { margin-bottom: 14px; }
    .input-group label { display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
    .input-group input, .input-group select {
      width: 100%;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--border);
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    .input-group input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 13px;
      border-radius: 12px;
      background: var(--primary);
      color: white;
      font-size: 0.95rem;
      font-weight: 700;
      border: none;
      cursor: pointer;
      gap: 8px;
      transition: all 0.2s;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
    }
    .btn:active { transform: scale(0.98); }
    .btn-success { background: var(--success); box-shadow: 0 4px 10px rgba(22, 163, 74, 0.25); }
    .btn-danger { background: var(--danger); }
    .btn-secondary { background: #64748b; }

    #reader { width: 100%; border-radius: 14px; overflow: hidden; margin-bottom: 14px; border: 2px dashed var(--border); }

    .qr-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0; }
    #qrcode { padding: 16px; background: white; border-radius: 16px; box-shadow: var(--shadow); }
    .timer-badge {
      display: inline-block;
      margin-top: 14px;
      padding: 6px 16px;
      border-radius: 20px;
      background: #eff6ff;
      color: var(--primary);
      font-weight: 700;
      font-size: 0.85rem;
    }

    .status-box {
      padding: 14px;
      border-radius: 12px;
      margin-top: 14px;
      font-size: 0.85rem;
      font-weight: 600;
      display: none;
    }
    .status-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .status-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .status-info { background: #e0f2fe; color: #075985; border: 1px solid #bae6fd; }

    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .stat-card { background: #f8fafc; padding: 12px; border-radius: 12px; text-align: center; border: 1px solid var(--border); }
    .stat-num { font-size: 1.3rem; font-weight: 800; color: var(--primary); }
    .stat-label { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; margin-top: 2px; }

    .install-banner {
      background: linear-gradient(135deg, #1e293b, #0f172a);
      color: white;
      padding: 16px;
      border-radius: var(--radius);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .install-banner p { font-size: 0.8rem; opacity: 0.9; }
    .install-banner .btn-install {
      background: #38bdf8;
      color: #0f172a;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 700;
      border: none;
      cursor: pointer;
      white-space: nowrap;
    }

    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid var(--border); }
    th { color: var(--text-muted); font-weight: 700; }
  </style>
</head>
<body>

  <header>
    <h1>🎒 Presensi Siswa Digital</h1>
    <p>Terintegrasi Google Sheets & Google Drive</p>
  </header>

  <nav class="nav-tabs">
    <button class="tab-btn active" onclick="switchTab('tab-siswa')">📱 Siswa</button>
    <button class="tab-btn" onclick="switchTab('tab-display')">🖥️ QR Layar</button>
    <button class="tab-btn" onclick="switchTab('tab-admin')">📊 Guru/Admin</button>
  </nav>

  <div class="container">
    
    <!-- Banner Install PWA di Android -->
    <div id="install-banner" class="install-banner">
      <div>
        <strong>📱 Pasang di Layar HP</strong>
        <p>Buka seperti aplikasi Android asli tanpa kuota browser!</p>
      </div>
      <button class="btn-install" onclick="promptInstall()">Install</button>
    </div>

    <!-- TAB 1: SISWA -->
    <div id="tab-siswa" class="tab-content active">
      <div class="card">
        <div class="card-title">👤 Identitas Siswa</div>
        <div class="input-group">
          <label for="nis-input">Nomor Induk Siswa (NIS)</label>
          <input type="text" id="nis-input" placeholder="Contoh: 1001" autocomplete="off">
        </div>
        <button class="btn" onclick="checkStudent()">Periksa Siswa</button>
        <div id="student-info" style="margin-top: 12px; display: none;">
          <p><strong>Nama:</strong> <span id="student-name">-</span></p>
          <p><strong>Kelas:</strong> <span id="student-class">-</span></p>
          <p><strong>Status Device:</strong> <span id="student-device-badge">-</span></p>
        </div>
      </div>

      <div class="card" id="scanner-card" style="display: none;">
        <div class="card-title">📷 Scan QR Code Kelas</div>
        <div id="reader"></div>
        <button class="btn btn-secondary" id="camera-btn" onclick="toggleCamera()">Aktifkan Kamera</button>
        <div id="scan-status" class="status-box"></div>
      </div>
    </div>

    <!-- TAB 2: DISPLAY KELAS -->
    <div id="tab-display" class="tab-content">
      <div class="card" style="text-align: center;">
        <div class="card-title" style="justify-content: center;">🕒 QR Code Presensi Dinamis</div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">QR Code otomatis berganti setiap 10 detik (Anti-Screenshot)</p>
        <div class="qr-container">
          <div id="qrcode"></div>
          <div class="timer-badge" id="qr-timer">Menghubungkan...</div>
        </div>
      </div>
    </div>

    <!-- TAB 3: ADMIN / GURU -->
    <div id="tab-admin" class="tab-content">
      <div id="admin-login-card" class="card">
        <div class="card-title">🔒 Akses Guru & Admin</div>
        <div class="input-group">
          <label for="admin-pin">Masukkan PIN Guru</label>
          <input type="password" id="admin-pin" placeholder="Default: 123456">
        </div>
        <button class="btn" onclick="loginAdmin()">Masuk Dashboard</button>
      </div>

      <div id="admin-panel" style="display: none;">
        <div class="card">
          <div class="card-title">📈 Rekap Hari Ini</div>
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-num" id="stat-total">0</div>
              <div class="stat-label">Total Hadir</div>
            </div>
            <div class="stat-card">
              <div class="stat-num" id="stat-ontime" style="color: var(--success);">0</div>
              <div class="stat-label">Tepat Waktu</div>
            </div>
            <div class="stat-card">
              <div class="stat-num" id="stat-late" style="color: var(--warning);">0</div>
              <div class="stat-label">Terlambat</div>
            </div>
          </div>
          <button class="btn btn-success" onclick="refreshAdmin()">🔄 Segarkan Data</button>
        </div>

        <div class="card">
          <div class="card-title">👥 Daftar Hadir Terbaru</div>
          <div style="overflow-x: auto;">
            <table id="attendance-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Nama</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="attendance-tbody">
                <tr><td colspan="3" style="text-align:center;">Memuat data...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

  </div>

  <script>
    // Tab Navigator
    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      const idx = tabId === 'tab-siswa' ? 0 : (tabId === 'tab-display' ? 1 : 2);
      document.querySelectorAll('.tab-btn')[idx].classList.add('active');
      document.getElementById(tabId).classList.add('active');

      if (tabId === 'tab-display') startDisplayLoop();
      else stopDisplayLoop();
    }

    // Device Fingerprint Generator
    function getDeviceId() {
      let id = localStorage.getItem('app_device_id');
      if (!id) {
        id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
        localStorage.setItem('app_device_id', id);
      }
      return id;
    }

    // API Caller via Google Apps Script doGet URL
    async function callApi(params) {
      const url = new URL(window.location.href);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      url.searchParams.set('_t', Date.now());
      const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
      return res.json();
    }

    // SISWA LOGIC
    let currentStudent = null;
    let html5QrCode = null;

    async function checkStudent() {
      const nis = document.getElementById('nis-input').value.trim();
      if (!nis) return alert('Masukkan NIS siswa!');

      try {
        const res = await callApi({ action: 'lookupStudent', nis: nis });
        if (res.error) return alert('Error: ' + res.error);
        if (!res.found) return alert('Siswa dengan NIS ' + nis + ' tidak ditemukan di Google Sheets!');

        currentStudent = res.student;
        document.getElementById('student-name').textContent = currentStudent.name;
        document.getElementById('student-class').textContent = currentStudent.class;
        
        const myDev = getDeviceId();
        const badge = document.getElementById('student-device-badge');
        if (!currentStudent.deviceId) {
          badge.textContent = 'Belum Terikat (Akan diikat ke HP ini)';
          badge.style.color = 'var(--warning)';
        } else if (currentStudent.deviceId === myDev) {
          badge.textContent = 'Terikat ke HP Ini ✅';
          badge.style.color = 'var(--success)';
        } else {
          badge.textContent = 'Terikat ke HP Lain ❌';
          badge.style.color = 'var(--danger)';
        }

        document.getElementById('student-info').style.display = 'block';
        document.getElementById('scanner-card').style.display = 'block';
      } catch (err) {
        alert('Gagal menghubungi backend: ' + err.message);
      }
    }

    function toggleCamera() {
      const btn = document.getElementById('camera-btn');
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          btn.textContent = 'Aktifkan Kamera';
          btn.className = 'btn btn-secondary';
        });
      } else {
        html5QrCode = new Html5Qrcode("reader");
        html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScanSuccess,
          () => {}
        ).then(() => {
          btn.textContent = 'Matikan Kamera';
          btn.className = 'btn btn-danger';
        }).catch(err => {
          alert('Tidak dapat membuka kamera: ' + err);
        });
      }
    }

    async function onScanSuccess(decodedText) {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop();
        document.getElementById('camera-btn').textContent = 'Aktifkan Kamera';
        document.getElementById('camera-btn').className = 'btn btn-secondary';
      }

      const statusBox = document.getElementById('scan-status');
      statusBox.style.display = 'block';
      statusBox.className = 'status-box status-info';
      statusBox.textContent = 'Memverifikasi presensi ke Google Sheets...';

      try {
        const res = await callApi({
          action: 'scan',
          token: decodedText,
          nis: currentStudent.nis,
          deviceId: getDeviceId(),
          deviceModel: navigator.userAgent
        });

        if (res.ok) {
          statusBox.className = 'status-box status-success';
          statusBox.textContent = '✅ ' + res.message;
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        } else {
          statusBox.className = 'status-box status-error';
          statusBox.textContent = '❌ ' + (res.error || 'Presensi gagal');
          if (navigator.vibrate) navigator.vibrate(300);
        }
      } catch (err) {
        statusBox.className = 'status-box status-error';
        statusBox.textContent = '❌ Error server: ' + err.message;
      }
    }

    // DISPLAY LOGIC
    let displayTimer = null;
    let qrGenerator = null;

    function startDisplayLoop() {
      if (displayTimer) clearInterval(displayTimer);
      updateQR();
      displayTimer = setInterval(updateQR, 10000);
    }

    function stopDisplayLoop() {
      if (displayTimer) clearInterval(displayTimer);
    }

    async function updateQR() {
      try {
        const res = await callApi({ action: 'getQR' });
        if (res.token) {
          const qrDiv = document.getElementById('qrcode');
          qrDiv.innerHTML = '';
          qrGenerator = new QRCode(qrDiv, {
            text: res.token,
            width: 220,
            height: 220,
            colorDark: "#0f172a",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
          });
          document.getElementById('qr-timer').textContent = 'Berganti dalam 10s • Token: ' + res.token.substring(0, 8) + '...';
        }
      } catch (e) {
        document.getElementById('qr-timer').textContent = 'Menghubungkan ke server...';
      }
    }

    // ADMIN LOGIC
    function loginAdmin() {
      const pin = document.getElementById('admin-pin').value;
      if (pin === '123456') {
        document.getElementById('admin-login-card').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        refreshAdmin();
      } else {
        alert('PIN Guru salah!');
      }
    }

    async function refreshAdmin() {
      try {
        const res = await callApi({ action: 'adminOverview' });
        if (res.stats) {
          document.getElementById('stat-total').textContent = res.stats.totalHadir || 0;
          document.getElementById('stat-ontime').textContent = res.stats.tepatWaktu || 0;
          document.getElementById('stat-late').textContent = res.stats.terlambat || 0;
        }

        const tbody = document.getElementById('attendance-tbody');
        tbody.innerHTML = '';
        if (res.recent && res.recent.length > 0) {
          res.recent.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td>' + r.waktu + '</td><td><strong>' + r.nama + '</strong><br><small>' + r.kelas + '</small></td><td><span style="color:' + (r.status === 'TEPAT_WAKTU' ? 'var(--success)' : 'var(--warning)') + ';">' + r.status + '</span></td>';
            tbody.appendChild(tr);
          });
        } else {
          tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Belum ada presensi hari ini</td></tr>';
        }
      } catch (err) {
        alert('Gagal memuat rekap: ' + err.message);
      }
    }

    // PWA Install Prompt
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      document.getElementById('install-banner').style.display = 'flex';
    });

    function promptInstall() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            document.getElementById('install-banner').style.display = 'none';
          }
          deferredPrompt = null;
        });
      } else {
        alert('Untuk memasang di HP Android:\\n1. Tekan tombol titik tiga di kanan atas Chrome\\n2. Pilih \\"Tambahkan ke Layar Utama\\" atau \\"Install Aplikasi\\"');
      }
    }
  </script>
</body>
</html>`;
}
