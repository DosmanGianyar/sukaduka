// Main JavaScript Application for Suka Duka Web App

let currentUser = null;
let currentGridData = null;
let currentTab = 'dashboard';

// Helper: Format Rupiah
function formatRp(val) {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return parseInt(val).toLocaleString('id-ID');
}

// Helper: Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-red-600' : 'bg-slate-800');
  toast.className = `${bg} text-white text-xs px-4 py-3 rounded-xl shadow-lg transform transition-all duration-300 translate-y-2 opacity-0 flex items-center space-x-2 pointer-events-auto`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Helper: Fetch with Auth headers
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('sukaduka_token');
  const headers = options.headers || {};
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  options.headers = headers;

  const res = await fetch(url, options);
  if (res.status === 401) {
    handleLogout();
    throw new Error('Sesi telah berakhir, silakan login kembali');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Terjadi kesalahan pada server');
  }
  return data;
}

// ================= AUTHENTICATION =================

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal');

    localStorage.setItem('sukaduka_token', data.token);
    currentUser = data.user;
    showToast('Selamat datang, ' + currentUser.full_name);
    initApp();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

function handleLogout() {
  localStorage.removeItem('sukaduka_token');
  currentUser = null;
  document.getElementById('authView').classList.remove('hidden');
  document.getElementById('mainAppView').classList.add('hidden');
  showToast('Anda telah keluar dari aplikasi', 'info');
}

async function checkAuth() {
  const token = localStorage.getItem('sukaduka_token');
  if (!token) {
    document.getElementById('authView').classList.remove('hidden');
    document.getElementById('mainAppView').classList.add('hidden');
    return false;
  }

  try {
    const data = await apiFetch('/api/auth/me');
    currentUser = data.user;
    initApp();
    return true;
  } catch (err) {
    handleLogout();
    return false;
  }
}

function initApp() {
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('mainAppView').classList.remove('hidden');

  if (currentUser) {
    document.getElementById('userFullName').innerText = currentUser.full_name;
    document.getElementById('userRoleBadge').innerText = currentUser.role;
    if (document.getElementById('profileFullName')) {
      document.getElementById('profileFullName').value = currentUser.full_name;
    }
  }

  // Load active tab
  switchTab(currentTab || 'dashboard');
  lucide.createIcons();
}

// ================= NAVIGATION =================

function switchTab(tab) {
  currentTab = tab;
  const tabs = ['dashboard', 'contributions', 'expenses', 'members', 'reports', 'logs', 'reconciliation', 'settings'];

  tabs.forEach(t => {
    const btn = document.getElementById(`nav-${t}`);
    const content = document.getElementById(`tab-${t}-content`);
    if (btn && content) {
      if (t === tab) {
        btn.className = 'tab-btn px-3 py-2 rounded-lg text-emerald-700 bg-emerald-50 font-semibold flex items-center space-x-1.5 whitespace-nowrap shadow-sm';
        content.classList.remove('hidden');
      } else {
        btn.className = 'tab-btn px-3 py-2 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-slate-50 flex items-center space-x-1.5 whitespace-nowrap';
        content.classList.add('hidden');
      }
    }
  });

  lucide.createIcons();

  if (tab === 'dashboard') loadDashboard();
  if (tab === 'contributions') loadGrid();
  if (tab === 'expenses') loadExpenses();
  if (tab === 'members') loadMembers();
  if (tab === 'reports') loadReportPreview();
  if (tab === 'logs') loadLogs(1);
  if (tab === 'reconciliation') loadReconciliation();
  if (tab === 'settings') loadSettings();
}

// Modal helper
function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

// ================= 1. DASHBOARD =================

async function loadDashboard(selectedYear) {
  try {
    const year = selectedYear || document.getElementById('dashYearSelect')?.value || 2026;
    const data = await apiFetch('/api/summary?year=' + year);

    // Bind stats
    document.getElementById('dashSaldo').innerText = 'Rp ' + formatRp(data.grandTotals.balance);
    const elSaldoAwal = document.getElementById('dashSaldoAwal');
    if (elSaldoAwal) elSaldoAwal.innerText = 'Rp ' + formatRp(data.grandTotals.initialBalance || 32425000);
    document.getElementById('dashPemasukan').innerText = 'Rp ' + formatRp(data.grandTotals.totalIncome);
    document.getElementById('dashPengeluaran').innerText = 'Rp ' + formatRp(data.grandTotals.totalExpense);

    document.getElementById('dashAnggota').innerText = data.memberStats.total + ' Orang';
    document.getElementById('dashAnggotaAktif').innerText = data.memberStats.active + ' Aktif';
    document.getElementById('dashAnggotaPensiun').innerText = data.memberStats.retired + ' Pensiun';

    document.querySelectorAll('.currentYearText').forEach(el => el.innerText = year);

    // Monthly Table
    const tbody = document.getElementById('dashMonthlyTableBody');
    tbody.innerHTML = '';

    data.monthlyData.forEach(m => {
      const tr = document.createElement('tr');
      const netColor = m.net >= 0 ? 'text-emerald-700' : 'text-red-600';
      tr.innerHTML = `
        <td class="py-2.5 font-medium">${m.monthName}</td>
        <td class="py-2.5 text-right font-medium text-emerald-700">Rp ${formatRp(m.income)}</td>
        <td class="py-2.5 text-right font-medium text-red-600">Rp ${formatRp(m.expense)}</td>
        <td class="py-2.5 text-right font-bold ${netColor}">Rp ${formatRp(m.net)}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= 2. CONTRIBUTIONS (GRID) =================

async function loadGrid(selectedYear) {
  try {
    const year = selectedYear || document.getElementById('gridYearSelect').value;
    const status = document.getElementById('gridStatusSelect').value;
    document.querySelectorAll('.currentGridYearText').forEach(el => el.innerText = year);
    const data = await apiFetch(`/api/contributions/grid?year=${year}&status=${status}`);
    currentGridData = data;

    renderGrid(data);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderGrid(data) {
  const tbody = document.getElementById('gridTableBody');
  const tfoot = document.getElementById('gridTableFoot');
  tbody.innerHTML = '';

  const monthNamesIndo = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  // Pisahkan secara tegas 100%: Anggota Aktif di atas, Anggota Pensiun di bawah
  const activeMembers = data.grid.filter(m => m.status !== 'PENSIUN');
  const retiredMembers = data.grid.filter(m => m.status === 'PENSIUN');

  function buildMemberRow(m, isPensiun) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 transition member-row' + (isPensiun ? ' bg-amber-50/30' : '');
    tr.dataset.name = m.name.toLowerCase();

    let monthCells = '';
    for (let month = 1; month <= 12; month++) {
      const cell = m.months[month];
      let badgeClass = 'badge-belum';
      let text = '-';
      let clickAttr = `onclick="quickTogglePay(${m.id}, ${data.year}, ${month})" oncontextmenu="event.preventDefault(); openCellModal(${m.id}, ${data.year}, ${month}, '${m.name.replace(/'/g, "\\'")}', ${cell.amount}, '${cell.status}', '${cell.notes || ''}')"`;
      let titleAttr = `Klik kiri: Toggle Lunas (50k) | Klik kanan: Atur Nominal`;

      if (cell.status === 'BELUM_MASUK') {
        badgeClass = 'bg-slate-100 text-slate-400 border border-slate-200 opacity-50 cursor-not-allowed';
        text = '—';
        clickAttr = `onclick="showToast('${m.name.replace(/'/g, "\\'")} baru mulai bergabung pada bulan ${m.join_month || 1}/${m.join_year || 2026}', 'info')" oncontextmenu="event.preventDefault(); showToast('${m.name.replace(/'/g, "\\'")} belum bergabung pada periode ini', 'info')"`;
        titleAttr = `Belum bergabung (Mulai masuk: ${m.join_month || 1}/${m.join_year || 2026})`;
      } else if (cell.status === 'LUNAS' && cell.amount > 0) {
        badgeClass = 'badge-lunas font-semibold';
        text = (cell.amount / 1000) + 'k';
      } else if (cell.status === 'PENSIUN') {
        badgeClass = 'badge-pensiun font-semibold';
        text = 'PENSIUN';
      }

      monthCells += `
        <td class="py-2 px-1 text-center">
          <div
            ${clickAttr}
            title="${titleAttr}"
            class="table-cell-pay text-[11px] py-1 px-1 rounded-lg ${badgeClass}">
            ${text}
          </div>
        </td>
      `;
    }

    let subInfo = `<div class="text-[10px] text-slate-400 font-normal">${m.nip ? 'NIP: ' + m.nip : m.type}</div>`;
    if (isPensiun) {
      subInfo = `<div class="text-[10px] text-amber-700 font-medium">Pensiun sejak ${monthNamesIndo[m.pensiun_month || 1]} ${m.pensiun_year || 2023}</div>`;
    } else if (m.join_year && m.join_year >= 2023) {
      subInfo = `<div class="text-[10px] text-emerald-700 font-medium">Masuk ${monthNamesIndo[m.join_month || 1]} ${m.join_year}</div>`;
    }

    // Tampilkan penanda jabatan dan status Bebas untuk Ketua, Bendahara, dan Sekretaris
    const isOfficer = ['KETUA', 'BENDAHARA', 'SEKRETARIS'].includes(m.officer_role);
    let officerBadge = '';
    let bebasBadge = '';

    if (isOfficer) {
      let roleClass = 'badge-officer-ketua';
      if (m.officer_role === 'BENDAHARA') roleClass = 'badge-officer-bendahara';
      else if (m.officer_role === 'SEKRETARIS') roleClass = 'badge-officer-sekretaris';

      officerBadge = `<span class="badge-officer ${roleClass}">${m.officer_role}</span>`;
      bebasBadge = `<span class="badge-bebas">Bebas</span>`;
    }

    tr.innerHTML = `
      <td class="py-2 px-3 text-center font-medium ${isPensiun ? 'text-amber-800 font-bold' : 'text-slate-500'}">${m.member_no}</td>
      <td class="py-2 px-3 font-semibold text-slate-800">
        <div class="flex items-center flex-wrap gap-1">${m.name}${officerBadge}</div>
        ${subInfo}
      </td>
      ${monthCells}
      <td class="py-2 px-3 text-right font-bold text-slate-900 bg-slate-100/60 text-xs whitespace-nowrap">
        <span>Rp ${formatRp(m.total)}</span>${bebasBadge}
      </td>
    `;
    return tr;
  }

  // 1. Render seluruh anggota aktif di bagian atas
  activeMembers.forEach(m => {
    tbody.appendChild(buildMemberRow(m, false));
  });

  // 2. Render seluruh anggota pensiun di bagian paling bawah dengan banner pemisah
  if (retiredMembers.length > 0) {
    const sepTr = document.createElement('tr');
    sepTr.className = 'bg-amber-100/90 border-y-2 border-amber-300 font-bold text-amber-900';
    sepTr.innerHTML = `
      <td colspan="15" class="py-2.5 px-4 text-xs tracking-wider uppercase">
        <div class="flex justify-between items-center">
          <span class="flex items-center gap-1.5">
            🏆 DAFTAR ANGGOTA PURNA TUGAS / PENSIUN (${retiredMembers.length} Orang)
          </span>
          <span class="text-[10px] font-normal text-amber-800">Dikelompokkan otomatis di bagian paling bawah</span>
        </div>
      </td>
    `;
    tbody.appendChild(sepTr);

    retiredMembers.forEach(m => {
      tbody.appendChild(buildMemberRow(m, true));
    });
  }

  // Footer totals
  let footMonths = '';
  for (let month = 1; month <= 12; month++) {
    footMonths += `<td class="py-3 px-1 text-center font-bold text-emerald-800 text-[11px]">${formatRp(data.monthlyTotals[month] / 1000)}k</td>`;
  }

  tfoot.innerHTML = `
    <tr>
      <td colspan="2" class="py-3 px-3 uppercase tracking-wider text-xs font-bold text-slate-700">Total Bulanan</td>
      ${footMonths}
      <td class="py-3 px-3 text-right font-extrabold text-emerald-900 text-xs bg-emerald-100/50">
        Rp ${formatRp(data.grandTotal)}
      </td>
    </tr>
  `;
}

function filterGridRows() {
  const q = document.getElementById('gridSearchInput').value.toLowerCase().trim();
  const rows = document.querySelectorAll('.member-row');
  rows.forEach(r => {
    const name = r.dataset.name || '';
    r.style.display = name.includes(q) ? '' : 'none';
  });
}

async function quickTogglePay(memberId, year, month) {
  try {
    const res = await apiFetch('/api/contributions/quick-pay', {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId, year, month })
    });
    showToast(res.status === 'LUNAS' ? 'Iuran diset LUNAS' : 'Iuran diset BELUM');
    loadGrid(year);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openCellModal(memberId, year, month, name, amount, status, notes) {
  document.getElementById('modalCellTitle').innerText = name;
  const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  document.getElementById('modalCellSubtitle').innerText = `Bulan ${monthNames[month]} ${year}`;

  document.getElementById('cellMemberId').value = memberId;
  document.getElementById('cellYear').value = year;
  document.getElementById('cellMonth').value = month;
  document.getElementById('cellStatus').value = status || 'LUNAS';
  document.getElementById('cellAmount').value = amount > 0 ? amount : 50000;
  document.getElementById('cellNotes').value = notes || '';

  openModal('modalCellPay');
}

document.getElementById('formCellPay')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const member_id = document.getElementById('cellMemberId').value;
  const year = document.getElementById('cellYear').value;
  const month = document.getElementById('cellMonth').value;
  const status = document.getElementById('cellStatus').value;
  const amount = document.getElementById('cellAmount').value;
  const notes = document.getElementById('cellNotes').value;

  try {
    await apiFetch('/api/contributions/cell', {
      method: 'POST',
      body: JSON.stringify({ member_id, year, month, status, amount, notes })
    });
    closeModal('modalCellPay');
    showToast('Iuran berhasil diperbarui');
    loadGrid(year);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

function openBatchMonthModal() {
  const currentMonth = new Date().getMonth() + 1;
  document.getElementById('batchMonthSelect').value = currentMonth;
  openModal('modalBatchMonth');
}

document.getElementById('formBatchMonth')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const year = document.getElementById('gridYearSelect').value;
  const month = document.getElementById('batchMonthSelect').value;
  const amount = document.getElementById('batchAmount').value;

  if (!confirm(`Apakah Anda yakin ingin menandai LUNAS iuran bulan ke-${month} tahun ${year} untuk SELURUH anggota aktif?`)) {
    return;
  }

  try {
    const res = await apiFetch('/api/contributions/batch-month', {
      method: 'POST',
      body: JSON.stringify({ year, month, amount })
    });
    closeModal('modalBatchMonth');
    showToast(res.message);
    loadGrid(year);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ================= 3. EXPENSES (PENGELUARAN SANTUNAN) =================

async function loadExpenses() {
  try {
    const year = document.getElementById('expenseYearFilter').value;
    const category = document.getElementById('expenseCategoryFilter').value;
    const search = document.getElementById('expenseSearchInput').value;

    const data = await apiFetch(`/api/expenses?year=${year}&category=${category}&search=${encodeURIComponent(search)}`);
    document.getElementById('expenseTotalSumLabel').innerText = 'Total: Rp ' + formatRp(data.totalAmount);

    const tbody = document.getElementById('expensesTableBody');
    tbody.innerHTML = '';

    if (data.expenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">Belum ada catatan pengeluaran santunan untuk filter ini</td></tr>`;
      return;
    }

    data.expenses.forEach((e, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';
      tr.innerHTML = `
        <td class="py-2.5 px-3 text-center text-slate-500 font-medium">${e.expense_no || (idx + 1)}</td>
        <td class="py-2.5 px-3 text-slate-600 font-medium">${e.period_label || e.date}</td>
        <td class="py-2.5 px-3 font-semibold text-slate-800">${e.recipient_name}</td>
        <td class="py-2.5 px-3">
          <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
            ${e.category}
          </span>
        </td>
        <td class="py-2.5 px-3 text-right font-bold text-red-700">Rp ${formatRp(e.amount)}</td>
        <td class="py-2.5 px-3 text-slate-500">${e.notes || '-'}</td>
        <td class="py-2.5 px-3 text-center">
          <div class="flex items-center justify-center space-x-1">
            <button onclick="editExpense(${JSON.stringify(e).replace(/"/g, '&quot;')})" title="Edit" class="p-1 text-slate-400 hover:text-blue-600 rounded">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="deleteExpense(${e.id})" title="Hapus" class="p-1 text-slate-400 hover:text-red-600 rounded">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

let cachedMemberList = [];

async function ensureMembersLoaded() {
  if (cachedMemberList.length === 0) {
    try {
      const data = await apiFetch('/api/members?status=SEMUA&type=SEMUA');
      cachedMemberList = data.members || [];
    } catch (err) {
      console.error('Gagal memuat list anggota:', err);
    }
  }
}

async function showRecipientDropdown() {
  await ensureMembersLoaded();
  const query = document.getElementById('expenseFormRecipient')?.value || '';
  filterRecipientDropdown(query);
  document.getElementById('recipientDropdown')?.classList.remove('hidden');
}

function toggleRecipientDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('recipientDropdown');
  if (dropdown?.classList.contains('hidden')) {
    showRecipientDropdown();
  } else {
    dropdown?.classList.add('hidden');
  }
}

function filterRecipientDropdown(query) {
  const dropdown = document.getElementById('recipientDropdown');
  if (!dropdown) return;

  const q = String(query || '').toLowerCase().trim();
  const filtered = cachedMemberList.filter(m => {
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || (m.nip && m.nip.includes(q));
  });

  if (filtered.length === 0) {
    dropdown.innerHTML = `
      <div class="p-3 text-center text-slate-500 text-xs">
        <div class="font-medium">Tidak ada data guru yang cocok</div>
        <div class="text-[10px] text-slate-400 mt-0.5">Nama "${query}" akan tetap dicatat manual</div>
      </div>
    `;
    dropdown.classList.remove('hidden');
    return;
  }

  let html = '';
  filtered.slice(0, 30).forEach(m => {
    const isPensiun = m.status === 'PENSIUN';
    const badge = isPensiun
      ? '<span class="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-800 rounded font-semibold">Pensiun</span>'
      : '<span class="px-1.5 py-0.5 text-[9px] bg-emerald-100 text-emerald-800 rounded font-semibold">Aktif</span>';

    html += `
      <div
        onclick="selectRecipient(${m.id}, '${m.name.replace(/'/g, "\\'")}')"
        class="p-2.5 hover:bg-emerald-50 cursor-pointer flex justify-between items-center transition">
        <div>
          <div class="font-semibold text-slate-800 text-xs">${m.name}</div>
          <div class="text-[10px] text-slate-400">${m.nip ? 'NIP: ' + m.nip : m.type}</div>
        </div>
        <div>${badge}</div>
      </div>
    `;
  });

  dropdown.innerHTML = html;
  dropdown.classList.remove('hidden');
}

function selectRecipient(memberId, memberName) {
  const input = document.getElementById('expenseFormRecipient');
  const hiddenId = document.getElementById('expenseFormMemberId');
  if (input) input.value = memberName;
  if (hiddenId) hiddenId.value = memberId;
  document.getElementById('recipientDropdown')?.classList.add('hidden');
}

// Tutup dropdown saat klik di luar
document.addEventListener('click', (e) => {
  const input = document.getElementById('expenseFormRecipient');
  const dropdown = document.getElementById('recipientDropdown');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!dropdown.contains(e.target) && e.target !== input) {
      dropdown.classList.add('hidden');
    }
  }
});

function openExpenseModal() {
  document.getElementById('modalExpenseTitle').innerText = 'Catat Pengeluaran Santunan';
  document.getElementById('expenseFormId').value = '';
  document.getElementById('expenseFormMemberId').value = '';
  document.getElementById('expenseFormDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('expenseFormRecipient').value = '';
  document.getElementById('expenseFormCategory').value = 'Sakit';
  document.getElementById('expenseFormAmount').value = '750000';
  document.getElementById('expenseFormNotes').value = '';
  document.getElementById('recipientDropdown')?.classList.add('hidden');
  openModal('modalExpense');
}

function editExpense(e) {
  document.getElementById('modalExpenseTitle').innerText = 'Edit Pengeluaran Santunan';
  document.getElementById('expenseFormId').value = e.id;
  document.getElementById('expenseFormMemberId').value = e.member_id || '';
  document.getElementById('expenseFormDate').value = e.date;
  document.getElementById('expenseFormRecipient').value = e.recipient_name;
  document.getElementById('expenseFormCategory').value = e.category;
  document.getElementById('expenseFormAmount').value = e.amount;
  document.getElementById('expenseFormNotes').value = e.notes || '';
  document.getElementById('recipientDropdown')?.classList.add('hidden');
  openModal('modalExpense');
}

document.getElementById('formExpense')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('expenseFormId').value;
  const member_id = document.getElementById('expenseFormMemberId').value || null;
  const date = document.getElementById('expenseFormDate').value;
  const recipient_name = document.getElementById('expenseFormRecipient').value;
  const category = document.getElementById('expenseFormCategory').value;
  const amount = document.getElementById('expenseFormAmount').value;
  const notes = document.getElementById('expenseFormNotes').value;

  try {
    if (id) {
      await apiFetch('/api/expenses/' + id, {
        method: 'PUT',
        body: JSON.stringify({ date, recipient_name, member_id, category, amount, notes })
      });
      showToast('Pengeluaran berhasil diperbarui');
    } else {
      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({ date, recipient_name, member_id, category, amount, notes })
      });
      showToast('Pengeluaran berhasil dicatat');
    }
    closeModal('modalExpense');
    loadExpenses();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function deleteExpense(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus catatan pengeluaran ini?')) return;
  try {
    await apiFetch('/api/expenses/' + id, { method: 'DELETE' });
    showToast('Pengeluaran berhasil dihapus');
    loadExpenses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= 4. MEMBERS (MASTER ANGGOTA) =================

async function loadMembers() {
  try {
    const status = document.getElementById('memberStatusFilter').value;
    const type = document.getElementById('memberTypeFilter').value;
    const search = document.getElementById('memberSearchInput').value;

    const data = await apiFetch(`/api/members?status=${status}&type=${type}&search=${encodeURIComponent(search)}`);
    document.getElementById('memberCountBadge').innerText = data.members.length + ' Anggota';

    const tbody = document.getElementById('membersTableBody');
    tbody.innerHTML = '';

    data.members.forEach(m => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';

      let officerBadge = '';
      if (m.officer_role) {
        let roleClass = 'badge-officer-ketua';
        if (m.officer_role === 'BENDAHARA') roleClass = 'badge-officer-bendahara';
        else if (m.officer_role === 'SEKRETARIS') roleClass = 'badge-officer-sekretaris';
        officerBadge = `<span class="badge-officer ${roleClass}">${m.officer_role}</span>`;
      }

      tr.innerHTML = `
        <td class="py-2.5 px-3 text-center text-slate-500 font-medium">${m.member_no}</td>
        <td class="py-2.5 px-4 font-semibold text-slate-800">
          <div class="flex items-center flex-wrap gap-1">${m.name}${officerBadge}</div>
          <div class="text-[10px] text-slate-400 font-normal">
            ${m.status === 'PENSIUN' ? `Pensiun sejak ${m.pensiun_month || 1}/${m.pensiun_year || 2023}` : `Masuk sejak ${m.join_month || 1}/${m.join_year || 2022}`}
          </div>
        </td>
        <td class="py-2.5 px-4 font-mono text-slate-600">${m.nip || '-'}</td>
        <td class="py-2.5 px-3 text-center">
          <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${m.type === 'GURU' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}">
            ${m.type}
          </span>
        </td>
        <td class="py-2.5 px-3 text-center">
          <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${m.status === 'AKTIF' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
            ${m.status === 'PENSIUN' ? `PENSIUN (${m.pensiun_month || 1}/${m.pensiun_year || 2023})` : m.status}
          </span>
        </td>
        <td class="py-2.5 px-3 text-slate-500">${m.notes || '-'}</td>
        <td class="py-2.5 px-3 text-center">
          <div class="flex items-center justify-center space-x-1">
            <button onclick="editMember(${JSON.stringify(m).replace(/"/g, '&quot;')})" title="Edit" class="p-1 text-slate-400 hover:text-blue-600 rounded">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="deleteMember(${m.id})" title="Hapus" class="p-1 text-slate-400 hover:text-red-600 rounded">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function togglePensiunFields(status) {
  const container = document.getElementById('pensiunDetailContainer');
  if (status === 'PENSIUN') {
    container?.classList.remove('hidden');
  } else {
    container?.classList.add('hidden');
  }
}

function openMemberModal() {
  document.getElementById('modalMemberTitle').innerText = 'Tambah Anggota Baru';
  document.getElementById('memberFormId').value = '';
  document.getElementById('memberFormNo').value = '';
  document.getElementById('memberFormNip').value = '';
  document.getElementById('memberFormName').value = '';
  document.getElementById('memberFormType').value = 'GURU';
  document.getElementById('memberFormStatus').value = 'AKTIF';
  const now = new Date();
  document.getElementById('memberFormJoinMonth').value = now.getMonth() + 1;
  document.getElementById('memberFormJoinYear').value = now.getFullYear();
  document.getElementById('memberFormPensiunMonth').value = '1';
  document.getElementById('memberFormPensiunYear').value = now.getFullYear();
  document.getElementById('memberFormNotes').value = '';
  togglePensiunFields('AKTIF');
  openModal('modalMember');
}

function editMember(m) {
  document.getElementById('modalMemberTitle').innerText = 'Edit Data Anggota';
  document.getElementById('memberFormId').value = m.id;
  document.getElementById('memberFormNo').value = m.member_no;
  document.getElementById('memberFormNip').value = m.nip || '';
  document.getElementById('memberFormName').value = m.name;
  document.getElementById('memberFormType').value = m.type;
  document.getElementById('memberFormStatus').value = m.status;
  document.getElementById('memberFormJoinMonth').value = m.join_month || 1;
  document.getElementById('memberFormJoinYear').value = m.join_year || 2022;
  document.getElementById('memberFormPensiunMonth').value = m.pensiun_month || 1;
  document.getElementById('memberFormPensiunYear').value = m.pensiun_year || 2025;
  document.getElementById('memberFormNotes').value = m.notes || '';
  togglePensiunFields(m.status);
  openModal('modalMember');
}

document.getElementById('formMember')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('memberFormId').value;
  const member_no = document.getElementById('memberFormNo').value;
  const nip = document.getElementById('memberFormNip').value;
  const name = document.getElementById('memberFormName').value;
  const type = document.getElementById('memberFormType').value;
  const status = document.getElementById('memberFormStatus').value;
  const join_year = document.getElementById('memberFormJoinYear').value;
  const join_month = document.getElementById('memberFormJoinMonth').value;
  const pensiun_year = status === 'PENSIUN' ? document.getElementById('memberFormPensiunYear').value : null;
  const pensiun_month = status === 'PENSIUN' ? document.getElementById('memberFormPensiunMonth').value : null;
  const notes = document.getElementById('memberFormNotes').value;

  try {
    if (id) {
      await apiFetch('/api/members/' + id, {
        method: 'PUT',
        body: JSON.stringify({ member_no, nip, name, type, status, join_year, join_month, pensiun_year, pensiun_month, notes })
      });
      showToast('Data anggota berhasil diperbarui');
    } else {
      await apiFetch('/api/members', {
        method: 'POST',
        body: JSON.stringify({ member_no, nip, name, type, status, join_year, join_month, pensiun_year, pensiun_month, notes })
      });
      showToast('Anggota baru berhasil ditambahkan');
    }
    cachedMemberList = [];
    closeModal('modalMember');
    loadMembers();
    if (currentTab === 'contributions') loadGrid();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function deleteMember(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus anggota ini beserta riwayat iurannya?')) return;
  try {
    await apiFetch('/api/members/' + id, { method: 'DELETE' });
    cachedMemberList = [];
    showToast('Anggota berhasil dihapus');
    loadMembers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= 5. REPORTS & LANDSCAPE PREVIEW =================

async function loadReportPreview(selectedYear) {
  try {
    const year = selectedYear || document.getElementById('reportYearSelect').value || 2026;
    const data = await apiFetch('/api/reports/landscape-data?year=' + year);

    if (data.isAllYears) {
      document.getElementById('prevYear').innerText = 'SELURUH TAHUN (' + data.years[0] + ' - ' + data.years[data.years.length - 1] + ')';
      const now = new Date();
      document.getElementById('prevDateToday').innerText = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      // Settings
      const s = data.settings || {};
      if (s.school_name) {
        document.getElementById('prevSchool').innerText = s.school_name;
        document.getElementById('appSchoolSubtitle').innerText = s.school_name;
      }
      if (s.leader_name) document.getElementById('prevNameKetua').innerText = s.leader_name;
      if (s.leader_title) document.getElementById('prevTitleKetua').innerText = s.leader_title;
      if (s.treasurer_name) document.getElementById('prevNameBendahara').innerText = s.treasurer_name;
      if (s.treasurer_title) document.getElementById('prevTitleBendahara').innerText = s.treasurer_title;
      if (s.secretary_name) document.getElementById('prevNameSekretaris').innerText = s.secretary_name;
      if (s.secretary_title) document.getElementById('prevTitleSekretaris').innerText = s.secretary_title;

      let grandIncome = 0;
      let grandExpense = 0;
      let summaryRows = '';

      data.reports.forEach(r => {
        grandIncome += r.totalIncomeYear;
        grandExpense += r.totalExpenseYear;
        summaryRows += `
          <tr class="hover:bg-slate-50 transition">
            <td class="p-2.5 font-bold text-center border border-slate-300 text-slate-800">${r.year}</td>
            <td class="p-2.5 text-right border border-slate-300">${formatRp(r.saldoAwal)}</td>
            <td class="p-2.5 text-right border border-slate-300 text-emerald-700 font-semibold">+ ${formatRp(r.totalIncomeYear)}</td>
            <td class="p-2.5 text-right border border-slate-300 text-red-700 font-semibold">- ${formatRp(r.totalExpenseYear)}</td>
            <td class="p-2.5 text-right border border-slate-300 font-bold text-slate-900">${formatRp(r.saldoAkhir)}</td>
            <td class="p-2.5 text-center border border-slate-300">${r.expenses ? r.expenses.length : 0} Kasus</td>
          </tr>
        `;
      });

      const lastRep = data.reports[data.reports.length - 1];
      const container = document.getElementById('prevTableContainer');
      container.innerHTML = `
        <div class="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3">
          <div>
            <h4 class="font-bold text-emerald-900 text-sm">Mode Pratinjau Rekapitulasi Seluruh Tahun (${data.years[0]} - ${data.years[data.years.length - 1]})</h4>
            <p class="text-xs text-emerald-700">Semua halaman siap dicetak otomatis dalam format landscape dengan pemisahan halaman resmi (page-break) per tahun.</p>
          </div>
          <button onclick="openPrintLandscape('ALL')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition">
            <i data-lucide="printer" class="w-4 h-4"></i> Cetak Seluruh Tahun Sekarang
          </button>
        </div>
        <table class="w-full text-xs border-collapse border border-slate-300">
          <thead class="bg-slate-100 font-bold text-slate-800">
            <tr>
              <th class="border border-slate-300 p-2 text-center">TAHUN</th>
              <th class="border border-slate-300 p-2 text-right">SALDO AWAL</th>
              <th class="border border-slate-300 p-2 text-right">PEMASUKAN IURAN</th>
              <th class="border border-slate-300 p-2 text-right">PENGELUARAN SANTUNAN</th>
              <th class="border border-slate-300 p-2 text-right">SALDO AKHIR</th>
              <th class="border border-slate-300 p-2 text-center">SANTUNAN</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows}
          </tbody>
          <tfoot class="bg-slate-100 font-bold border-t-2 border-slate-400">
            <tr>
              <td class="p-2 text-center">TOTAL KESELURUHAN</td>
              <td class="p-2 text-right">-</td>
              <td class="p-2 text-right text-emerald-800">Rp ${formatRp(grandIncome)}</td>
              <td class="p-2 text-right text-red-800">Rp ${formatRp(grandExpense)}</td>
              <td class="p-2 text-right text-blue-900">Rp ${formatRp(lastRep.saldoAkhir)}</td>
              <td class="p-2 text-center">-</td>
            </tr>
          </tfoot>
        </table>
      `;

      // Saldo box
      document.getElementById('prevSaldoAwal').innerText = 'Rp ' + formatRp(data.reports[0].saldoAwal);
      document.getElementById('prevTotalIncome').innerText = '+ Rp ' + formatRp(grandIncome);
      document.getElementById('prevTotalExpense').innerText = '- Rp ' + formatRp(grandExpense);
      document.getElementById('prevSaldoAkhir').innerText = 'Rp ' + formatRp(lastRep.saldoAkhir);
      if (window.lucide) lucide.createIcons();
      return;
    }

    document.getElementById('prevYear').innerText = year;
    const now = new Date();
    document.getElementById('prevDateToday').innerText = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Settings
    const s = data.settings || {};
    if (s.school_name) {
      document.getElementById('prevSchool').innerText = s.school_name;
      document.getElementById('appSchoolSubtitle').innerText = s.school_name;
    }
    if (s.leader_name) document.getElementById('prevNameKetua').innerText = s.leader_name;
    if (s.leader_title) document.getElementById('prevTitleKetua').innerText = s.leader_title;
    if (s.treasurer_name) document.getElementById('prevNameBendahara').innerText = s.treasurer_name;
    if (s.treasurer_title) document.getElementById('prevTitleBendahara').innerText = s.treasurer_title;
    if (s.secretary_name) document.getElementById('prevNameSekretaris').innerText = s.secretary_name;
    if (s.secretary_title) document.getElementById('prevTitleSekretaris').innerText = s.secretary_title;

    // Table
    const container = document.getElementById('prevTableContainer');
    let rowsHtml = '';

    const activeRows = data.rows.filter(r => r.status !== 'PENSIUN');
    const retiredRows = data.rows.filter(r => r.status === 'PENSIUN');

    function buildReportTr(r, isPensiun) {
      let cells = '';
      for (let m = 1; m <= 12; m++) {
        const val = r.months[m];
        if (typeof val === 'number') {
          cells += `<td class="text-right">${formatRp(val)}</td>`;
        } else if (val === 'PENSIUN') {
          cells += `<td class="text-center font-bold text-amber-700 text-[10px]">PENSIUN</td>`;
        } else {
          cells += `<td class="text-center text-slate-300">-</td>`;
        }
      }
      return `
        <tr class="${isPensiun ? 'bg-amber-50/40' : ''}">
          <td class="text-center">${r.no}</td>
          <td class="text-left font-medium">${r.name}</td>
          <td class="text-center text-slate-500 font-mono">${r.nip}</td>
          ${cells}
          <td class="text-right font-bold">${formatRp(r.total)}</td>
        </tr>
      `;
    }

    activeRows.forEach(r => {
      rowsHtml += buildReportTr(r, false);
    });

    if (retiredRows.length > 0) {
      rowsHtml += `
        <tr class="bg-amber-100 font-bold text-amber-900">
          <td colspan="16" class="border border-slate-300 p-1.5 text-left uppercase text-[10px]">
            🏆 DAFTAR ANGGOTA PURNA TUGAS / PENSIUN (${retiredRows.length} Orang)
          </td>
        </tr>
      `;
      retiredRows.forEach(r => {
        rowsHtml += buildReportTr(r, true);
      });
    }

    let footCells = '';
    for (let m = 1; m <= 12; m++) {
      footCells += `<td class="text-right">${formatRp(data.monthlyTotals[m])}</td>`;
    }

    container.innerHTML = `
      <table class="w-full text-xs border-collapse border border-slate-300 print-table">
        <thead class="bg-slate-100 font-bold text-slate-800">
          <tr>
            <th class="border border-slate-300 p-1 w-8">NO</th>
            <th class="border border-slate-300 p-1 text-left min-w-[160px]">NAMA</th>
            <th class="border border-slate-300 p-1 w-28">NIP</th>
            <th class="border border-slate-300 p-1">Jan</th>
            <th class="border border-slate-300 p-1">Feb</th>
            <th class="border border-slate-300 p-1">Mar</th>
            <th class="border border-slate-300 p-1">Apr</th>
            <th class="border border-slate-300 p-1">Mei</th>
            <th class="border border-slate-300 p-1">Jun</th>
            <th class="border border-slate-300 p-1">Jul</th>
            <th class="border border-slate-300 p-1">Agu</th>
            <th class="border border-slate-300 p-1">Sep</th>
            <th class="border border-slate-300 p-1">Okt</th>
            <th class="border border-slate-300 p-1">Nov</th>
            <th class="border border-slate-300 p-1">Des</th>
            <th class="border border-slate-300 p-1 text-right">JUMLAH</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${rowsHtml}
        </tbody>
        <tfoot class="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-400">
          <tr>
            <td colspan="3" class="text-center p-1 uppercase">TOTAL PER BULAN</td>
            ${footCells}
            <td class="text-right p-1 text-emerald-800">Rp ${formatRp(data.totalIncomeYear)}</td>
          </tr>
        </tfoot>
      </table>
    `;

    // Saldo box
    document.getElementById('prevSaldoAwal').innerText = 'Rp ' + formatRp(data.saldoAwal);
    document.getElementById('prevTotalIncome').innerText = '+ Rp ' + formatRp(data.totalIncomeYear);
    document.getElementById('prevTotalExpense').innerText = '- Rp ' + formatRp(data.totalExpenseYear);
    document.getElementById('prevSaldoAkhir').innerText = 'Rp ' + formatRp(data.saldoAkhir);

  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openPrintLandscape(paramYear) {
  let year = paramYear;
  if (!year) {
    year = document.getElementById('reportYearSelect')?.value || document.getElementById('gridYearSelect')?.value || 2026;
  }
  window.open(`/print.html?year=${year}`, '_blank');
}

function exportExcel(paramYear) {
  let year = paramYear;
  if (!year) {
    year = document.getElementById('reportYearSelect')?.value || document.getElementById('gridYearSelect')?.value || 2026;
  }
  window.location.href = `/api/reports/export-excel?year=${year}`;
}

// Dropdown Menus for Export & Print
function toggleExcelDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('dropdownExcelMenu');
  const printMenu = document.getElementById('dropdownPrintMenu');
  if (printMenu) printMenu.classList.add('hidden');
  if (menu) menu.classList.toggle('hidden');
}

function togglePrintDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('dropdownPrintMenu');
  const excelMenu = document.getElementById('dropdownExcelMenu');
  if (excelMenu) excelMenu.classList.add('hidden');
  if (menu) menu.classList.toggle('hidden');
}

function hideExportDropdowns() {
  document.getElementById('dropdownExcelMenu')?.classList.add('hidden');
  document.getElementById('dropdownPrintMenu')?.classList.add('hidden');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#dropdownExcelWrapper') && !e.target.closest('#dropdownPrintWrapper')) {
    hideExportDropdowns();
  }
});

// ================= 6. SETTINGS & USERS =================

async function loadSettings() {
  try {
    const data = await apiFetch('/api/settings');
    const s = data.settings || {};

    if (s.school_name) document.getElementById('setSchoolName').value = s.school_name;
    if (s.leader_name) document.getElementById('setLeaderName').value = s.leader_name;
    if (s.leader_title) document.getElementById('setLeaderTitle').value = s.leader_title;
    if (s.treasurer_name) document.getElementById('setTreasurerName').value = s.treasurer_name;
    if (s.treasurer_title) document.getElementById('setTreasurerTitle').value = s.treasurer_title;
    if (s.secretary_name) document.getElementById('setSecretaryName').value = s.secretary_name;
    if (s.secretary_title) document.getElementById('setSecretaryTitle').value = s.secretary_title;
    if (s.default_dues_amount) document.getElementById('setDefaultDues').value = s.default_dues_amount;

    // Load users
    loadUserList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadUserList() {
  try {
    const data = await apiFetch('/api/auth/users');
    const tbody = document.getElementById('userListTableBody');
    tbody.innerHTML = '';

    data.users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2 px-2 font-mono font-medium">${u.username}</td>
        <td class="py-2 px-2">${u.full_name}</td>
        <td class="py-2 px-2 text-center">
          <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-800">
            ${u.role}
          </span>
        </td>
        <td class="py-2 px-2 text-center">
          ${currentUser && currentUser.id !== u.id ? `
            <button onclick="deleteUser(${u.id})" class="text-red-500 hover:text-red-700">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          ` : '<span class="text-slate-400 text-[10px]">Aktif</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });

    lucide.createIcons();
  } catch (err) {
    // Non-admin might get forbidden
  }
}

document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const school_name = document.getElementById('setSchoolName').value;
  const leader_name = document.getElementById('setLeaderName').value;
  const leader_title = document.getElementById('setLeaderTitle').value;
  const treasurer_name = document.getElementById('setTreasurerName').value;
  const treasurer_title = document.getElementById('setTreasurerTitle').value;
  const secretary_name = document.getElementById('setSecretaryName').value;
  const secretary_title = document.getElementById('setSecretaryTitle').value;
  const default_dues_amount = document.getElementById('setDefaultDues').value;

  try {
    await apiFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        school_name,
        leader_name,
        leader_title,
        treasurer_name,
        treasurer_title,
        secretary_name,
        secretary_title,
        default_dues_amount
      })
    });
    showToast('Pengaturan pejabat berhasil disimpan');
    loadSettings();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const full_name = document.getElementById('profileFullName').value;
  const current_password = document.getElementById('currentPassword').value;
  const new_password = document.getElementById('newPassword').value;

  try {
    await apiFetch('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ full_name, current_password, new_password })
    });
    showToast('Profil & Password berhasil diperbarui');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
  } catch (err) {
    showToast(err.message, 'error');
  }
});

function openUserModal() {
  document.getElementById('userFormUsername').value = '';
  document.getElementById('userFormFullName').value = '';
  document.getElementById('userFormPassword').value = '';
  document.getElementById('userFormRole').value = 'pengurus';
  openModal('modalUser');
}

document.getElementById('formUser')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('userFormUsername').value;
  const full_name = document.getElementById('userFormFullName').value;
  const password = document.getElementById('userFormPassword').value;
  const role = document.getElementById('userFormRole').value;

  try {
    await apiFetch('/api/auth/users', {
      method: 'POST',
      body: JSON.stringify({ username, full_name, password, role })
    });
    closeModal('modalUser');
    showToast('User pengurus berhasil ditambahkan');
    loadUserList();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function deleteUser(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus akun user ini?')) return;
  try {
    await apiFetch('/api/auth/users/' + id, { method: 'DELETE' });
    showToast('User berhasil dihapus');
    loadUserList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= 7. LOG AKTIVITAS / AUDIT TRAIL =================
let currentLogPage = 1;
let logSearchDebounce = null;

function debounceLogSearch() {
  clearTimeout(logSearchDebounce);
  logSearchDebounce = setTimeout(() => {
    loadLogs(1);
  }, 350);
}

async function loadLogs(page = 1) {
  currentLogPage = page;
  const module = document.getElementById('logFilterModule')?.value || 'ALL';
  const date_filter = document.getElementById('logFilterDate')?.value || 'ALL';
  const search = document.getElementById('logSearchInput')?.value || '';

  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="py-8 text-center text-slate-400">
        <div class="inline-block animate-spin w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full mb-1"></div>
        <p class="text-xs">Memuat catatan log aktivitas...</p>
      </td>
    </tr>
  `;

  try {
    const [data, stats] = await Promise.all([
      apiFetch(`/api/logs?page=${page}&limit=50&module=${module}&date_filter=${date_filter}&search=${encodeURIComponent(search)}`),
      apiFetch('/api/logs/stats')
    ]);

    // Update stats cards
    if (stats) {
      if (document.getElementById('logStatTodayCount')) {
        document.getElementById('logStatTodayCount').innerText = (stats.todayCount || 0) + ' aksi';
      }
      if (document.getElementById('logStatTodayIncome')) {
        document.getElementById('logStatTodayIncome').innerText = 'Rp ' + (stats.todayIncomeChange || 0).toLocaleString('id-ID');
      }
      if (document.getElementById('logStatTodayExpense')) {
        document.getElementById('logStatTodayExpense').innerText = 'Rp ' + (stats.todayExpenseChange || 0).toLocaleString('id-ID');
      }
      if (document.getElementById('logStatActiveUser')) {
        document.getElementById('logStatActiveUser').innerText = stats.activeUser || '-';
      }
    }

    if (!data.logs || data.logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-slate-400">
            <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
            <p class="font-medium text-slate-600 text-sm">Belum ada riwayat aktivitas yang tercatat</p>
            <p class="text-xs text-slate-400 mt-1">Setiap klik bayar, ubah iuran, atau input pengeluaran akan otomatis tercatat di sini.</p>
          </td>
        </tr>
      `;
      lucide.createIcons();
      if (document.getElementById('logPaginationInfo')) {
        document.getElementById('logPaginationInfo').innerText = 'Menampilkan 0 catatan';
      }
      if (document.getElementById('logPaginationButtons')) {
        document.getElementById('logPaginationButtons').innerHTML = '';
      }
      return;
    }

    tbody.innerHTML = data.logs.map(log => {
      // Badge Modul
      let moduleBadge = '';
      if (log.module === 'IURAN') {
        moduleBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Iuran</span>';
      } else if (log.module === 'PENGELUARAN') {
        moduleBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Pengeluaran</span>';
      } else if (log.module === 'ANGGOTA') {
        moduleBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">Anggota</span>';
      } else if (log.module === 'AUTH') {
        moduleBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">Sesi Login</span>';
      } else {
        moduleBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">${log.module}</span>`;
      }

      // Format nominal
      let amountHtml = '-';
      if (log.amount && log.amount > 0) {
        if (log.module === 'IURAN') {
          amountHtml = `<span class="font-bold text-emerald-600">+Rp ${log.amount.toLocaleString('id-ID')}</span>`;
        } else if (log.module === 'PENGELUARAN') {
          amountHtml = `<span class="font-bold text-amber-600">-Rp ${log.amount.toLocaleString('id-ID')}</span>`;
        } else {
          amountHtml = `<span class="font-medium text-slate-700">Rp ${log.amount.toLocaleString('id-ID')}</span>`;
        }
      }

      // Format waktu
      let timeFormatted = log.created_at || '';
      try {
        const d = new Date(log.created_at.replace(' ', 'T'));
        if (!isNaN(d.getTime())) {
          timeFormatted = d.toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          });
        }
      } catch (e) {}

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap text-[11px]">
            <i data-lucide="clock" class="w-3 h-3 inline mr-1 text-slate-400"></i>${timeFormatted}
          </td>
          <td class="py-2.5 px-4 font-medium text-slate-800">
            <div class="font-semibold text-slate-900">${log.user_name || 'Sistem'}</div>
            <div class="text-[10px] text-slate-400 uppercase font-mono">${log.user_role || '-'} (${log.username || '-'})</div>
          </td>
          <td class="py-2.5 px-3 text-center whitespace-nowrap">
            ${moduleBadge}
          </td>
          <td class="py-2.5 px-4 font-medium text-slate-800">
            <span class="text-slate-900 font-semibold">${log.target_name || '-'}</span>
            ${log.period ? `<span class="block text-[10px] text-slate-400 font-normal">${log.period}</span>` : ''}
          </td>
          <td class="py-2.5 px-4 text-slate-700 leading-relaxed text-xs">
            ${log.description}
          </td>
          <td class="py-2.5 px-4 text-right whitespace-nowrap">
            ${amountHtml}
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();

    // Render pagination
    const { total, page: curP, totalPages, limit: curL } = data.pagination;
    const startNum = total === 0 ? 0 : (curP - 1) * curL + 1;
    const endNum = Math.min(curP * curL, total);
    if (document.getElementById('logPaginationInfo')) {
      document.getElementById('logPaginationInfo').innerText = `Menampilkan ${startNum} - ${endNum} dari total ${total} catatan aktivitas`;
    }

    let paginationBtns = '';
    if (totalPages > 1) {
      if (curP > 1) {
        paginationBtns += `<button onclick="loadLogs(${curP - 1})" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700">Prev</button>`;
      }
      paginationBtns += `<span class="px-3 py-1 font-semibold text-slate-700">Hal ${curP} / ${totalPages}</span>`;
      if (curP < totalPages) {
        paginationBtns += `<button onclick="loadLogs(${curP + 1})" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700">Next</button>`;
      }
    }
    if (document.getElementById('logPaginationButtons')) {
      document.getElementById('logPaginationButtons').innerHTML = paginationBtns;
    }

  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-red-500">
          <i data-lucide="alert-circle" class="w-6 h-6 mx-auto mb-2"></i>
          <span>Gagal memuat log aktivitas: ${err.message}</span>
        </td>
      </tr>
    `;
    lucide.createIcons();
  }
}

// ================= 8. RECONCILIATION / RINCIAN KAS =================

async function loadReconciliation() {
  try {
    const data = await apiFetch('/api/summary/reconciliation');
    const s = data.summary;

    // 1. Bind Summary Cards
    document.getElementById('recSaldoAwal').innerText = 'Rp ' + formatRp(s.saldoAwalExcel);
    document.getElementById('recIncomeToday').innerText = '+ Rp ' + formatRp(s.totalIncomeToday);
    document.getElementById('recExpenseToday').innerText = '- Rp ' + formatRp(s.totalExpenseToday);
    document.getElementById('recBalanceFinal').innerText = 'Rp ' + formatRp(s.balanceExcel);
    const elRecTotal = document.getElementById('recSummaryTotal');
    if (elRecTotal) elRecTotal.innerText = 'Rp ' + formatRp(s.balanceExcel);

    // 2. Render Tabel Penerimaan Baru Hari Ini
    const tbodyIncome = document.getElementById('recIncomeTableBody');
    tbodyIncome.innerHTML = '';
    data.todayIncome.members.forEach((m, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
      const periodsText = m.items.map(it => `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 mr-1 mb-1">${it.period}</span>`).join('');
      tr.innerHTML = `
        <td class="p-2.5 text-center text-slate-500 font-medium">${idx + 1}</td>
        <td class="p-2.5 font-semibold text-slate-800">
          <div>${m.name}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">${m.items.length} bulan dilunasi</div>
        </td>
        <td class="p-2.5">
          <div class="flex flex-wrap">${periodsText}</div>
        </td>
        <td class="p-2.5 text-right font-bold text-emerald-700 whitespace-nowrap">
          + Rp ${formatRp(m.total)}
        </td>
      `;
      tbodyIncome.appendChild(tr);
    });
    document.getElementById('recIncomeCount').innerText = `${data.todayIncome.countMembers} Orang Pelunasan Tunggakan`;
    document.getElementById('recIncomeSum').innerText = '+ Rp ' + formatRp(data.todayIncome.total);

    // 3. Render Tabel Pengeluaran Baru Hari Ini (Tahun 2026)
    const tbodyExp = document.getElementById('recExpenseTableBody');
    tbodyExp.innerHTML = '';
    data.todayExpenses.items.forEach((e, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
      tr.innerHTML = `
        <td class="p-2.5 text-center text-slate-500 font-medium">${idx + 1}</td>
        <td class="p-2.5 font-medium text-slate-600 whitespace-nowrap text-xs">${e.date}</td>
        <td class="p-2.5 font-semibold text-slate-800">
          <div>${e.recipient_name}</div>
          <div class="text-[10px] text-slate-400">${e.notes || '-'}</div>
        </td>
        <td class="p-2.5 text-center">
          <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
            ${e.category}
          </span>
        </td>
        <td class="p-2.5 text-right font-bold text-red-600 whitespace-nowrap">
          - Rp ${formatRp(e.amount)}
        </td>
      `;
      tbodyExp.appendChild(tr);
    });
    document.getElementById('recExpenseCount').innerText = `${data.todayExpenses.count} Kasus Santunan 2026`;
    document.getElementById('recExpenseSum').innerText = '- Rp ' + formatRp(data.todayExpenses.total);

    lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Start app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

