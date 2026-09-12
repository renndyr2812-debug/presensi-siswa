// Teacher & Admin Dashboard Controller
// Opsi C: /api/... → Apps Script GET params
document.addEventListener('DOMContentLoaded', () => {
  const statTotal        = document.getElementById('stat-total');
  const statOntime       = document.getElementById('stat-ontime');
  const statLate         = document.getElementById('stat-late');
  const statOverride     = document.getElementById('stat-override');
  const statUnrecorded   = document.getElementById('stat-unrecorded');
  const currentDateLabel = document.getElementById('current-date-label');
  const attendanceTbody  = document.getElementById('attendance-tbody');
  const sheetsDetails    = document.getElementById('sheets-details');
  const btnRefresh       = document.getElementById('btn-refresh');
  const searchInput      = document.getElementById('search-input');
  const filterClass      = document.getElementById('filter-class');

  const modalOverride       = document.getElementById('modal-override');
  const btnOpenOverrideModal = document.getElementById('btn-open-override-modal');
  const btnCloseModal       = document.getElementById('btn-close-modal');
  const formOverride        = document.getElementById('form-override');
  const selectStudentOverride = document.getElementById('select-student-override');
  const selectReasonOverride  = document.getElementById('select-reason-override');

  let allRecords  = [];
  let allStudents = [];

  // ─── Setup Check ─────────────────────────────────────────────
  if (window.API.APPS_SCRIPT_URL === 'PASTE_URL_APPS_SCRIPT_ANDA_DI_SINI') {
    if (sheetsDetails) sheetsDetails.innerHTML = '⚠️ <strong>Setup belum selesai:</strong> Paste URL Apps Script di <code>js/config.js</code>';
  }

  // ─── 1. Fetch Dashboard Overview ─────────────────────────────
  async function loadDashboard() {
    try {
      const data = await window.API.apiFetch({ action: 'adminOverview' });
      if (data.error) throw new Error(data.error);

      statTotal.textContent      = data.totalStudents;
      statOntime.textContent     = data.onTimeCount;
      statLate.textContent       = data.lateCount;
      statOverride.textContent   = data.overrideCount;
      statUnrecorded.textContent = data.unrecordedCount;
      currentDateLabel.textContent = data.date;

      allRecords = data.records;
      renderTable();

      // Update sheets status
      if (sheetsDetails) {
        sheetsDetails.innerHTML = `Status: <span style="color: var(--status-success); font-weight: 700;">🟢 Terhubung ke Google Sheets</span> • ${data.presentCount} hadir dari ${data.totalStudents} siswa hari ini`;
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    }
  }

  // ─── 2. Fetch All Students for Override Select ────────────────
  async function loadStudentsList() {
    try {
      const data = await window.API.apiFetch({ action: 'listStudents' });
      if (!Array.isArray(data)) return;
      allStudents = data;
      selectStudentOverride.innerHTML = '<option value="">-- Pilih Siswa --</option>';
      allStudents.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.nisn} - ${s.class_name})`;
        selectStudentOverride.appendChild(opt);
      });
    } catch (err) {
      console.error('Error loading students:', err);
    }
  }

  // ─── 3. Render Table with Search & Filter ─────────────────────
  function renderTable() {
    const searchTerm    = searchInput.value.toLowerCase().trim();
    const selectedClass = filterClass.value;

    const filtered = allRecords.filter(r => {
      const matchSearch = r.name.toLowerCase().includes(searchTerm) || r.nisn.includes(searchTerm);
      const matchClass  = selectedClass === 'ALL' || r.class_name === selectedClass;
      return matchSearch && matchClass;
    });

    if (filtered.length === 0) {
      attendanceTbody.innerHTML = `
        <tr>
          <td colspan="8" style="padding: 32px; text-align: center; color: var(--text-muted);">
            Tidak ada catatan presensi yang sesuai kriteria pencarian.
          </td>
        </tr>
      `;
      return;
    }

    attendanceTbody.innerHTML = '';
    filtered.forEach(r => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-subtle)';

      const isLate     = r.status === 'TERLAMBAT';
      const isOverride = String(r.status).includes('MANUAL');
      const badgeClass = isLate ? 'badge-warning' : (isOverride ? 'badge-info' : 'badge-success');
      const statusText = isLate ? 'TERLAMBAT' : (isOverride ? 'OVERRIDE GURU' : 'HADIR');

      const timeOnly = new Date(r.scan_timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      tr.innerHTML = `
        <td style="padding: 14px; font-variant-numeric: tabular-nums; font-weight: 600;">${timeOnly}</td>
        <td style="padding: 14px; font-family: monospace;">${r.nisn}</td>
        <td style="padding: 14px; font-weight: 700;">${r.name}</td>
        <td style="padding: 14px;">${r.class_name}</td>
        <td style="padding: 14px;"><span class="badge ${badgeClass}">${statusText}</span></td>
        <td style="padding: 14px; font-size: 0.85rem; color: var(--text-secondary);">${r.verification_method}</td>
        <td style="padding: 14px; font-size: 0.85rem; color: var(--text-secondary);">${r.device_name || 'Terdaftar'}</td>
        <td style="padding: 14px; text-align: center;">
          <button class="btn btn-secondary btn-reset-device" data-id="${r.student_id}" data-name="${r.name}" style="min-height: 32px; padding: 4px 10px; font-size: 0.8rem;" title="Reset Device Binding jika siswa ganti HP">
            🔒 Reset HP
          </button>
        </td>
      `;
      attendanceTbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-reset-device').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const studentId   = e.currentTarget.dataset.id;
        const studentName = e.currentTarget.dataset.name;
        if (confirm(`Reset binding perangkat untuk siswa: ${studentName}? Siswa dapat mendaftarkan HP barunya pada absensi berikutnya.`)) {
          await resetStudentDevice(studentId);
        }
      });
    });
  }

  // ─── 4. Reset Student Device ──────────────────────────────────
  async function resetStudentDevice(studentId) {
    try {
      const data = await window.API.apiFetch({ action: 'resetDevice', studentId });
      if (data.success) {
        alert('Berhasil: Kunci biometrik perangkat siswa telah di-reset.');
        loadDashboard();
      }
    } catch (err) {
      alert('Gagal reset perangkat: ' + err.message);
    }
  }

  // ─── 5. Export CSV ─────────────────────────────────────────────
  const btnExportCsv = document.getElementById('btn-export-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
      const csvUrl = window.API.APPS_SCRIPT_URL + '?action=exportCSV&date=' + today;
      window.open(csvUrl, '_blank');
    });
  }

  // ─── 6. Manual Override Modal ─────────────────────────────────
  btnOpenOverrideModal.addEventListener('click', () => {
    loadStudentsList();
    modalOverride.style.display = 'flex';
  });
  btnCloseModal.addEventListener('click', () => {
    modalOverride.style.display = 'none';
  });

  formOverride.addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = selectStudentOverride.value;
    const reason    = selectReasonOverride.value;
    if (!studentId) return;

    try {
      const data = await window.API.apiFetch({
        action: 'manualOverride',
        studentId,
        reason
      });
      if (data.success) {
        alert(`Berhasil: ${data.student.name} telah dicatat hadir secara manual.`);
        modalOverride.style.display = 'none';
        loadDashboard();
      } else {
        alert('Gagal: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Gagal hadirkan manual: ' + err.message);
    }
  });

  // ─── 7. Google Sheets Setup Drawer ────────────────────────────
  // Di arsitektur Opsi C, Google Sheets ADALAH database utama.
  // Tombol "Hubungkan Google" menampilkan petunjuk setup saja.
  const btnToggleGoogleSetup = document.getElementById('btn-toggle-google-setup');
  const boxGoogleSetup       = document.getElementById('box-google-setup');
  if (btnToggleGoogleSetup && boxGoogleSetup) {
    btnToggleGoogleSetup.addEventListener('click', () => {
      const isHidden = boxGoogleSetup.style.display === 'none';
      boxGoogleSetup.style.display = isHidden ? 'block' : 'none';
    });
  }

  // ─── 8. Force Init Sheets (seed demo data) ───────────────────
  const btnForceSync = document.getElementById('btn-force-sync');
  if (btnForceSync) {
    btnForceSync.addEventListener('click', async () => {
      btnForceSync.disabled = true;
      btnForceSync.textContent = 'Menginisialisasi...';
      try {
        const data = await window.API.apiFetch({ action: 'initSheets' });
        if (data.success) {
          alert('✅ ' + data.message);
          loadDashboard();
        }
      } catch (err) {
        alert('Gagal: ' + err.message);
      } finally {
        btnForceSync.disabled = false;
        btnForceSync.textContent = '⚡ Init & Seed Demo Data';
      }
    });
    // Ubah label tombol agar sesuai konteks baru
    btnForceSync.textContent = '⚡ Init & Seed Demo Data';
  }

  // ─── Listeners ────────────────────────────────────────────────
  searchInput.addEventListener('input', renderTable);
  filterClass.addEventListener('change', renderTable);
  btnRefresh.addEventListener('click', loadDashboard);

  // Auto-refresh setiap 6 detik
  setInterval(loadDashboard, 6000);

  // Initial load
  loadDashboard();
  loadStudentsList();
});
