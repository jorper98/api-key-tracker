let vendorsTable, accountsTable, keysTable;
let vendors = [];
let accounts = [];
let keys = [];
let currentFile = null;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initFileSelector();
  initTabs();
  initVendorsTable();
  initAccountsTable();
  initKeysTable();
  initVendorModal();
  initAccountModal();
  initKeyModal();
  initKeyDetailModal();
  initFilters();
});

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
}

async function initFileSelector() {
  const res = await fetch('/api/files');
  const files = await res.json();
  
  const startupSelect = document.getElementById('startup-file-select');
  const headerSelect = document.getElementById('file-selector');
  
  const options = files.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
  startupSelect.innerHTML = options;
  headerSelect.innerHTML = options;
  
  const savedFile = localStorage.getItem('currentKeysFile');
  if (savedFile && files.some(f => f.name === savedFile)) {
    currentFile = savedFile;
  } else if (files.length > 0) {
    currentFile = files[0].name;
  }
  
  if (currentFile) {
    startupSelect.value = currentFile;
    headerSelect.value = currentFile;
    document.getElementById('file-select-modal').classList.remove('active');
    setFileHeader();
    loadAll();
  }
  
  document.getElementById('use-file-btn').addEventListener('click', () => {
    const selected = startupSelect.value;
    if (selected) {
      currentFile = selected;
      localStorage.setItem('currentKeysFile', selected);
      headerSelect.value = selected;
      document.getElementById('file-select-modal').classList.remove('active');
      setFileHeader();
      loadAll();
    }
  });
  
  document.getElementById('create-file-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-file-name').value.trim().toLowerCase();
    if (!name) return;
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      alert('Invalid file name. Use only letters, numbers, hyphens, and underscores.');
      return;
    }
    const createRes = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (createRes.ok) {
      currentFile = name;
      localStorage.setItem('currentKeysFile', name);
      const filesRes = await fetch('/api/files');
      const updatedFiles = await filesRes.json();
      const opts = updatedFiles.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
      startupSelect.innerHTML = opts;
      headerSelect.innerHTML = opts;
      startupSelect.value = name;
      headerSelect.value = name;
      document.getElementById('file-select-modal').classList.remove('active');
      setFileHeader();
      loadAll();
    } else {
      const err = await createRes.json();
      alert(err.error || 'Failed to create file');
    }
  });
  
  headerSelect.addEventListener('change', () => {
    currentFile = headerSelect.value;
    localStorage.setItem('currentKeysFile', currentFile);
    setFileHeader();
    loadAll();
  });
  
  document.getElementById('new-file-btn').addEventListener('click', () => {
    const name = prompt('Enter new file name (letters, numbers, hyphens, underscores only):');
    if (!name) return;
    const sanitizedName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!sanitizedName) {
      alert('Invalid file name');
      return;
    }
    fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sanitizedName })
    }).then(res => {
      if (res.ok) {
        currentFile = sanitizedName;
        localStorage.setItem('currentKeysFile', sanitizedName);
        headerSelect.value = sanitizedName;
        setFileHeader();
        loadAll();
      } else {
        return res.json().then(err => alert(err.error || 'Failed to create file'));
      }
    }).catch(err => alert('Failed to create file'));
  });
  
  document.getElementById('export-zip-btn').addEventListener('click', () => {
    if (!currentFile) {
      alert('No keys file selected');
      return;
    }
    const proceed = confirm('WARNING: The exported zip file will contain your API keys in unencrypted clear text.\n\nStore this file securely and delete it after use.\n\nDo you want to proceed?');
    if (!proceed) return;
    const link = document.createElement('a');
    link.href = `/api/export-zip?file=${currentFile}`;
    link.download = `${currentFile}-keys-export.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

function setFileHeader() {
  window.currentFileName = currentFile;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-keys-file': currentFile || ''
  };
}

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
    });
  });
}

async function loadAll() {
  await loadVendors();
  await loadAccounts();
  await loadKeys();
}

// ===== VENDORS =====
function initVendorsTable() {
  vendorsTable = $('#vendors-table').DataTable({
    columns: [
      { data: 'name' },
      { data: 'website', defaultContent: '', render: d => d ? `<a href="${d}" target="_blank" rel="noopener">${d}</a>` : '' },
      { 
        data: null, 
        orderable: false,
        className: 'actions-col',
        render: d => `
          <div class="actions-cell">
            <button class="icon-btn btn-edit" data-id="${d.id}" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn btn-delete" data-id="${d.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        `
      }
    ],
    order: [[0, 'asc']],
    pageLength: 25,
    language: { search: 'Search:' }
  });

  $('#vendor-search').on('keyup', function() {
    vendorsTable.search(this.value).draw();
  });

  $('#vendors-table tbody').on('click', '.btn-edit', (e) => {
    const btn = e.target.closest('.icon-btn');
    const vendor = vendors.find(v => v.id === btn.dataset.id);
    if (vendor) openVendorModal(vendor);
  });

  $('#vendors-table tbody').on('click', '.btn-delete', async (e) => {
    const btn = e.target.closest('.icon-btn');
    if (confirm('Delete this vendor and all associated accounts and keys?')) {
      await fetch(`/api/vendors/${btn.dataset.id}`, { method: 'DELETE', headers: getHeaders() });
      await loadAll();
    }
  });

  $('#vendors-table tbody').on('click', 'tr', (e) => {
    if (e.target.closest('.icon-btn')) return;
    const row = vendorsTable.row(e.currentTarget).data();
    if (!row) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="accounts"]').classList.add('active');
    document.getElementById('accounts-tab').classList.add('active');
    document.getElementById('filter-account-vendor').value = row.id;
    applyAccountFilters();
  });
}

async function loadVendors() {
  try {
    const res = await fetch('/api/vendors', { headers: getHeaders() });
    vendors = await res.json();
    vendorsTable.clear();
    vendorsTable.rows.add(vendors);
    vendorsTable.draw();
    updateVendorDropdowns();
  } catch (err) {
    console.error('Failed to load vendors:', err);
  }
}

// ===== ACCOUNTS =====
function initAccountsTable() {
  accountsTable = $('#accounts-table').DataTable({
    columns: [
      { data: 'accountName' },
      { data: 'vendorId', render: (d) => {
        const vendor = vendors.find(v => v.id === d);
        return vendor ? vendor.name : d;
      }},
      { data: 'accountEmail' },
      { data: 'vendorAccId', defaultContent: '' },
      { data: 'authType' },
      { data: 'billingSetup' },
      { data: 'notes', defaultContent: '', render: d => d ? d.substring(0, 40) + (d.length > 40 ? '...' : '') : '' },
      { 
        data: null, 
        orderable: false,
        className: 'actions-col',
        render: d => `
          <div class="actions-cell">
            <button class="icon-btn btn-edit" data-id="${d.id}" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn btn-delete" data-id="${d.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        `
      }
    ],
    order: [[1, 'asc']],
    pageLength: 25,
    language: { search: 'Search:' }
  });

  $('#account-search').on('keyup', function() {
    accountsTable.search(this.value).draw();
  });

  $('#accounts-table tbody').on('click', '.btn-edit', (e) => {
    const btn = e.target.closest('.icon-btn');
    const account = accounts.find(a => a.id === btn.dataset.id);
    if (account) openAccountModal(account);
  });

  $('#accounts-table tbody').on('click', '.btn-delete', async (e) => {
    const btn = e.target.closest('.icon-btn');
    if (confirm('Delete this account and all associated keys?')) {
      await fetch(`/api/accounts/${btn.dataset.id}`, { method: 'DELETE', headers: getHeaders() });
      await loadAll();
    }
  });

  $('#accounts-table tbody').on('click', 'tr', (e) => {
    if (e.target.closest('.icon-btn')) return;
    const row = accountsTable.row(e.currentTarget).data();
    if (!row) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="keys"]').classList.add('active');
    document.getElementById('keys-tab').classList.add('active');
    document.getElementById('filter-key-vendor').value = row.vendorId;
    document.getElementById('filter-key-account').value = row.id;
    applyKeyFilters();
  });
}

async function loadAccounts() {
  try {
    const res = await fetch('/api/accounts', { headers: getHeaders() });
    accounts = await res.json();
    accountsTable.clear();
    accountsTable.rows.add(accounts);
    accountsTable.draw();
    updateAccountDropdowns();
  } catch (err) {
    console.error('Failed to load accounts:', err);
  }
}

// ===== KEYS =====
function initKeysTable() {
  keysTable = $('#keys-table').DataTable({
    columns: [
      { 
        data: 'status',
        render: d => `<span class="status-badge status-${d.toLowerCase()}">${d}</span>`
      },
      { data: 'accountId', render: (d) => {
        const account = accounts.find(a => a.id === d);
        return account ? account.accountName : d;
      }},
      { data: 'project', defaultContent: '' },
      { data: 'dateCreated', defaultContent: '' },
      { 
        data: 'purpose',
        visible: false,
        searchable: true
      },
      { 
        data: 'apiKey',
        orderable: false,
        render: (d, type, row) => {
          if (type === 'display' || type === 'filter') {
            const keyVal = d || '';
            const masked = keyVal.length > 4 ? '••••' + keyVal.slice(-4) : '••••';
            return `
              <div class="key-cell">
                <span class="masked-key" id="key-display-${row.id}">${masked}</span>
                <button class="icon-btn btn-show" data-id="${row.id}" title="Show full key">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="icon-btn btn-copy" data-value="${keyVal}" data-id="${row.id}" title="Copy">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
              </div>
            `;
          }
          return d || '';
        }
      },
      { 
        data: null, 
        orderable: false,
        className: 'actions-col',
        render: d => `
          <div class="actions-cell">
            <button class="icon-btn btn-edit" data-id="${d.id}" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn btn-duplicate" data-id="${d.id}" title="Duplicate">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            </button>
            <button class="icon-btn btn-delete" data-id="${d.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        `
      }
    ],
    order: [[3, 'desc']],
    pageLength: 25,
    language: { search: 'Search:' }
  });

  $('#key-search').on('keyup', function() {
    keysTable.search(this.value).draw();
  });

  $('#keys-table tbody').on('click', '.btn-edit', (e) => {
    const btn = e.target.closest('.icon-btn');
    const key = keys.find(k => k.id === btn.dataset.id);
    if (key) openKeyModal(key);
  });

  $('#keys-table tbody').on('click', '.btn-delete', async (e) => {
    const btn = e.target.closest('.icon-btn');
    if (confirm('Delete this API key?')) {
      await fetch(`/api/keys/${btn.dataset.id}`, { method: 'DELETE', headers: getHeaders() });
      await loadKeys();
    }
  });

  $('#keys-table tbody').on('click', '.btn-duplicate', async (e) => {
    const btn = e.target.closest('.icon-btn');
    const original = keys.find(k => k.id === btn.dataset.id);
    if (!original) return;
    const duplicated = {
      status: original.status,
      accountId: original.accountId,
      project: original.project || '',
      name: (original.name || '') + ' (Copy)',
      dateCreated: new Date().toISOString().split('T')[0],
      purpose: original.purpose || '',
      apiKey: original.apiKey || ''
    };
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(duplicated)
    });
    if (res.ok) {
      const newKey = await res.json();
      newKey.apiKey = duplicated.apiKey;
      keys.push(newKey);
      keysTable.clear();
      keysTable.rows.add(keys);
      keysTable.draw();
      openKeyModal(newKey);
    }
  });

  $('#keys-table tbody').on('click', '.btn-show', (e) => {
    const btn = e.target.closest('.icon-btn');
    const key = keys.find(k => k.id === btn.dataset.id);
    if (key) openKeyDetailModal(key);
  });

  $('#keys-table tbody').on('click', '.btn-copy', async (e) => {
    const btn = e.target.closest('.icon-btn');
    const val = btn.dataset.value;
    if (val) {
      await navigator.clipboard.writeText(val);
      const orig = btn.innerHTML;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.classList.remove('copied');
      }, 1500);
    }
  });

  $('#keys-table tbody').on('click', 'tr', (e) => {
    if (e.target.closest('.icon-btn')) return;
    const row = keysTable.row(e.currentTarget).data();
    if (!row) return;
    const key = keys.find(k => k.id === row.id);
    if (key) openKeyModal(key);
  });
}

async function loadKeys() {
  try {
    const res = await fetch('/api/keys', { headers: getHeaders() });
    keys = await res.json();
    keysTable.clear();
    keysTable.rows.add(keys);
    keysTable.draw();
  } catch (err) {
    console.error('Failed to load keys:', err);
  }
}

// ===== DROPDOWNS =====
function updateVendorDropdowns() {
  const sorted = [...vendors].sort((a, b) => a.name.localeCompare(b.name));
  const options = '<option value="">-- Select Vendor --</option>' + 
    sorted.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
  document.getElementById('account-vendor').innerHTML = options;
  
  const filterOptions = '<option value="">All Vendors</option>' + 
    sorted.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
  document.getElementById('filter-account-vendor').innerHTML = filterOptions;
  document.getElementById('filter-key-vendor').innerHTML = filterOptions;
}

function updateAccountDropdowns() {
  const sorted = [...accounts].sort((a, b) => a.accountName.localeCompare(b.accountName));
  const options = '<option value="">-- Select Account --</option>' + 
    sorted.map(a => {
      const vendor = vendors.find(v => v.id === a.vendorId);
      const vendorName = vendor ? vendor.name : '';
      return `<option value="${a.id}">${a.accountName}${vendorName ? ' (' + vendorName + ')' : ''}</option>`;
    }).join('');
  document.getElementById('key-account').innerHTML = options;
  
  const filterOptions = '<option value="">All Accounts</option>' + 
    sorted.map(a => `<option value="${a.id}">${a.accountName}</option>`).join('');
  document.getElementById('filter-key-account').innerHTML = filterOptions;
}

// ===== VENDOR MODAL =====
function initVendorModal() {
  const modal = document.getElementById('vendor-modal');
  
  document.getElementById('add-vendor-btn').addEventListener('click', () => openVendorModal());
  
  modal.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.remove('active');
      document.getElementById('vendor-form').reset();
      document.getElementById('vendor-id').value = '';
    });
  });

  document.getElementById('vendor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('vendor-id').value;
    const data = {
      name: document.getElementById('vendor-name').value,
      website: document.getElementById('vendor-website').value
    };

    const url = id ? `/api/vendors/${id}` : '/api/vendors';
    const method = id ? 'PUT' : 'POST';
    
    await fetch(url, { method, headers: { ...getHeaders() }, body: JSON.stringify(data) });
    modal.classList.remove('active');
    document.getElementById('vendor-form').reset();
    document.getElementById('vendor-id').value = '';
    await loadAll();
  });
}

function openVendorModal(vendor = null) {
  const modal = document.getElementById('vendor-modal');
  document.getElementById('vendor-modal-title').textContent = vendor ? 'Edit Vendor' : 'Add Vendor';
  
  if (vendor) {
    document.getElementById('vendor-id').value = vendor.id;
    document.getElementById('vendor-name').value = vendor.name;
    document.getElementById('vendor-website').value = vendor.website || '';
  } else {
    document.getElementById('vendor-form').reset();
    document.getElementById('vendor-id').value = '';
  }
  
  modal.classList.add('active');
}

// ===== ACCOUNT MODAL =====
function initAccountModal() {
  const modal = document.getElementById('account-modal');
  
  document.getElementById('add-account-btn').addEventListener('click', () => openAccountModal());
  
  modal.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.remove('active');
      document.getElementById('account-form').reset();
      document.getElementById('account-id').value = '';
    });
  });

  document.getElementById('account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('account-id').value;
    const data = {
      vendorId: document.getElementById('account-vendor').value,
      accountName: document.getElementById('account-name').value,
      accountEmail: document.getElementById('account-email').value,
      vendorAccId: document.getElementById('account-acc-id').value,
      authType: document.getElementById('account-auth-type').value,
      billingSetup: document.getElementById('account-billing').value,
      notes: document.getElementById('account-notes').value
    };

    const url = id ? `/api/accounts/${id}` : '/api/accounts';
    const method = id ? 'PUT' : 'POST';
    
    await fetch(url, { method, headers: { ...getHeaders() }, body: JSON.stringify(data) });
    modal.classList.remove('active');
    document.getElementById('account-form').reset();
    document.getElementById('account-id').value = '';
    await loadAll();
  });
}

function openAccountModal(account = null) {
  const modal = document.getElementById('account-modal');
  document.getElementById('account-modal-title').textContent = account ? 'Edit Account' : 'Add Account';
  
  if (account) {
    document.getElementById('account-id').value = account.id;
    document.getElementById('account-vendor').value = account.vendorId;
    document.getElementById('account-name').value = account.accountName;
    document.getElementById('account-email').value = account.accountEmail;
    document.getElementById('account-acc-id').value = account.vendorAccId || '';
    document.getElementById('account-auth-type').value = account.authType;
    document.getElementById('account-billing').value = account.billingSetup;
    document.getElementById('account-notes').value = account.notes || '';
  } else {
    document.getElementById('account-form').reset();
    document.getElementById('account-id').value = '';
  }
  
  modal.classList.add('active');
}

// ===== KEY MODAL =====
function initKeyModal() {
  const modal = document.getElementById('key-modal');
  
  document.getElementById('add-key-btn').addEventListener('click', () => openKeyModal());

  document.getElementById('copy-new-key').addEventListener('click', async () => {
    const input = document.getElementById('key-value');
    if (input.value) {
      await navigator.clipboard.writeText(input.value);
      const btn = document.getElementById('copy-new-key');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 1500);
    }
  });

  modal.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.remove('active');
      document.getElementById('key-form').reset();
      document.getElementById('key-id').value = '';
      document.getElementById('key-encrypted').value = '';
      document.getElementById('key-date').value = new Date().toISOString().split('T')[0];
    });
  });

  document.getElementById('key-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('key-id').value;
    const data = {
      status: document.getElementById('key-status').value,
      accountId: document.getElementById('key-account').value,
      project: document.getElementById('key-project').value,
      name: document.getElementById('key-name').value,
      dateCreated: document.getElementById('key-date').value,
      purpose: document.getElementById('key-purpose').value,
      apiKey: document.getElementById('key-value').value
    };

    if (id) data.id = id;
    const url = id ? `/api/keys/${id}` : '/api/keys';
    const method = id ? 'PUT' : 'POST';
    
    await fetch(url, { method, headers: { ...getHeaders() }, body: JSON.stringify(data) });
    modal.classList.remove('active');
    document.getElementById('key-form').reset();
    document.getElementById('key-id').value = '';
    document.getElementById('key-date').value = new Date().toISOString().split('T')[0];
    await loadKeys();
  });
}

function openKeyModal(key = null) {
  const modal = document.getElementById('key-modal');
  document.getElementById('key-modal-title').textContent = key ? 'Edit API Key' : 'Add API Key';
  
  if (key) {
    document.getElementById('key-id').value = key.id;
    document.getElementById('key-encrypted').value = key.encryptedKey || '';
    document.getElementById('key-status').value = key.status;
    document.getElementById('key-account').value = key.accountId;
    document.getElementById('key-project').value = key.project || '';
    document.getElementById('key-name').value = key.name || '';
    document.getElementById('key-date').value = key.dateCreated || new Date().toISOString().split('T')[0];
    document.getElementById('key-purpose').value = key.purpose || '';
    document.getElementById('key-value').value = key.apiKey || '';
  } else {
    document.getElementById('key-form').reset();
    document.getElementById('key-id').value = '';
    document.getElementById('key-date').value = new Date().toISOString().split('T')[0];
  }
  
  modal.classList.add('active');
}

// ===== KEY DETAIL MODAL =====
function openKeyDetailModal(key) {
  const modal = document.getElementById('key-detail-modal');
  const account = accounts.find(a => a.id === key.accountId);
  const vendor = account ? vendors.find(v => v.id === account.vendorId) : null;
  const accountName = account ? account.accountName : '';
  const vendorName = vendor ? vendor.name : '';
  document.getElementById('key-detail-title').textContent = key.name ? `Key: ${key.name}` : 'API Key';
  document.getElementById('key-detail-value').value = key.apiKey || '';
  document.getElementById('key-detail-account').value = accountName + (vendorName ? ` (${vendorName})` : '');
  document.getElementById('key-detail-project').value = key.project || '';
  document.getElementById('key-detail-purpose').value = key.purpose || '';
  modal.classList.add('active');
}

function initKeyDetailModal() {
  const modal = document.getElementById('key-detail-modal');
  document.getElementById('key-detail-close').addEventListener('click', () => {
    modal.classList.remove('active');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
  document.getElementById('copy-detail-key').addEventListener('click', async () => {
    const val = document.getElementById('key-detail-value').value;
    if (val) {
      await navigator.clipboard.writeText(val);
      const btn = document.getElementById('copy-detail-key');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 1500);
    }
  });
}

// ===== FILTERS =====
function initFilters() {
  document.getElementById('filter-account-vendor').addEventListener('change', applyAccountFilters);
  document.getElementById('filter-key-vendor').addEventListener('change', applyKeyFilters);
  document.getElementById('filter-key-account').addEventListener('change', applyKeyFilters);
  document.getElementById('filter-status').addEventListener('change', applyKeyFilters);
  document.getElementById('filter-project').addEventListener('keyup', applyKeyFilters);
}

function applyAccountFilters() {
  const vendor = document.getElementById('filter-account-vendor').value;
  $.fn.dataTable.ext.search.push((settings, data, dataIndex) => {
    const row = accounts[dataIndex];
    if (!row) return true;
    if (vendor && row.vendorId !== vendor) return false;
    return true;
  });
  accountsTable.draw();
  $.fn.dataTable.ext.search.pop();
}

function applyKeyFilters() {
  const vendor = document.getElementById('filter-key-vendor').value;
  const account = document.getElementById('filter-key-account').value;
  const status = document.getElementById('filter-status').value;
  const project = document.getElementById('filter-project').value.toLowerCase();

  $.fn.dataTable.ext.search.push((settings, data, dataIndex) => {
    const row = keys[dataIndex];
    if (!row) return true;
    const rowAccount = accounts.find(a => a.id === row.accountId);
    if (vendor && rowAccount && rowAccount.vendorId !== vendor) return false;
    if (account && row.accountId !== account) return false;
    if (status && row.status !== status) return false;
    if (project && (!row.project || !row.project.toLowerCase().includes(project))) return false;
    return true;
  });

  keysTable.draw();
  $.fn.dataTable.ext.search.pop();
}
