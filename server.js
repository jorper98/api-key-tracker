require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const store = require('./src/store');

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = '1.1.4';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data is migrated on startup
let data = store.loadData();
if (!data.migrated) {
  data = store.migrateOldFormat(data);
  store.saveData(store.encryptKeys(data));
  console.log('Auto-migrated data to new format');
}

// Middleware to get current file name from header
function getFileName(req) {
  return req.headers['x-keys-file'] || req.query.file || store.getDataFiles()[0]?.name;
}

// ===== FILE MANAGEMENT =====
app.get('/api/files', (req, res) => {
  try {
    const files = store.getDataFiles();
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/files', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'File name is required' });
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid file name. Use only letters, numbers, hyphens, and underscores.' });
    }
    const success = store.createNewFile(name.toLowerCase());
    if (!success) {
      return res.status(409).json({ error: 'File already exists' });
    }
    res.status(201).json({ name: name.toLowerCase(), success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/files/:name', (req, res) => {
  try {
    const files = store.getDataFiles();
    if (files.length <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last file' });
    }
    const success = store.deleteFile(req.params.name);
    if (!success) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== VENDORS =====
app.get('/api/vendors', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.loadData(fileName);
    res.json(data.vendors || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vendors', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.loadData(fileName);
    const vendor = {
      id: 'v_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.vendors.push(vendor);
    store.saveData(data, fileName);
    res.status(201).json(vendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vendors/:id', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.loadData(fileName);
    const idx = data.vendors.findIndex(v => v.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Vendor not found' });
    data.vendors[idx] = { ...data.vendors[idx], ...req.body, updatedAt: new Date().toISOString() };
    store.saveData(data, fileName);
    res.json(data.vendors[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vendors/:id', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.loadData(fileName);
    const accounts = data.accounts.filter(a => a.vendorId !== req.params.id);
    const accountIds = accounts.map(a => a.id);
    data.accounts = accounts;
    data.keys = data.keys.filter(k => !accountIds.includes(k.accountId));
    data.vendors = data.vendors.filter(v => v.id !== req.params.id);
    store.saveData(store.encryptKeys(data), fileName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ACCOUNTS =====
app.get('/api/accounts', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.loadData(fileName);
    res.json(data.accounts || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.loadData(fileName);
    const vendor = data.vendors.find(v => v.id === req.body.vendorId);
    const defaultName = vendor ? `${vendor.name} (${req.body.accountEmail})` : req.body.accountName;
    const account = {
      id: 'a_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
      vendorId: req.body.vendorId || '',
      accountName: req.body.accountName || defaultName,
      accountEmail: req.body.accountEmail || '',
      vendorAccId: req.body.vendorAccId || '',
      authType: req.body.authType || 'Password',
      billingSetup: req.body.billingSetup || 'No Billing',
      notes: req.body.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.accounts.push(account);
    store.saveData(data, fileName);
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/accounts/:id', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.loadData(fileName);
    const idx = data.accounts.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Account not found' });
    const vendor = data.vendors.find(v => v.id === req.body.vendorId);
    const defaultName = vendor ? `${vendor.name} (${req.body.accountEmail})` : req.body.accountName;
    data.accounts[idx] = {
      ...data.accounts[idx],
      ...req.body,
      accountName: req.body.accountName || defaultName,
      updatedAt: new Date().toISOString()
    };
    store.saveData(data, fileName);
    res.json(data.accounts[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/accounts/:id', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.loadData(fileName);
    data.accounts = data.accounts.filter(a => a.id !== req.params.id);
    data.keys = data.keys.filter(k => k.accountId !== req.params.id);
    store.saveData(data, fileName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== KEYS =====
app.get('/api/keys', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.decryptKeys(store.loadData(fileName), fileName);
    res.json(data.keys || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/keys', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.loadData(fileName);
    const key = {
      id: 'k_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.keys.push(key);
    const saved = store.encryptKeys(data, fileName);
    store.saveData(saved, fileName);
    res.status(201).json({ ...key, encryptedKey: saved.keys[saved.keys.length - 1].encryptedKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/keys/:id', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.loadData(fileName);
    const idx = data.keys.findIndex(k => k.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Key not found' });
    data.keys[idx] = { ...data.keys[idx], ...req.body, updatedAt: new Date().toISOString() };
    const saved = store.encryptKeys(data, fileName);
    store.saveData(saved, fileName);
    res.json({ ...data.keys[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/keys/:id', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.loadData(fileName);
    data.keys = data.keys.filter(k => k.id !== req.params.id);
    store.saveData(data, fileName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/decrypt', (req, res) => {
  try {
    const { encryptedKey } = req.body;
    if (!encryptedKey) return res.status(400).json({ error: 'encryptedKey is required' });
    const fileName = getFileName(req);
    const decrypted = store.decryptSingleKey(encryptedKey, fileName);
    res.json({ decrypted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decrypt key' });
  }
});

app.get('/api/export', (req, res) => {
  try {
    const fileName = getFileName(req);
    const data = store.decryptKeys(store.loadData(fileName), fileName);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export-zip', (req, res) => {
  try {
    const fileName = getFileName(req);
    if (!fileName) return res.status(400).json({ error: 'No keys file selected' });

    const data = store.decryptKeys(store.loadData(fileName), fileName);
    const secretName = `ENCRYPTION_SECRET_${fileName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    const secrets = store.loadSecrets();
    const secret = secrets[secretName] || process.env[secretName] || '';

    const archive = new archiver.ZipArchive({ zlib: { level: 9 } });

    archive.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    archive.on('warning', (err) => {
      console.error('Archive warning:', err.message);
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}-keys-export.zip"`);

    archive.pipe(res);

    archive.append(JSON.stringify(data, null, 2), { name: `${fileName}-keys.json` });
    archive.append(`# Encryption Secret for ${fileName}-keys.json\n# Keep this file secure!\n${secretName}=${secret}\n`, { name: `${fileName}-secret.env` });

    archive.finalize();
  } catch (err) {
    console.error('Export zip error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post('/api/import', (req, res) => {
  try {
    const fileName = getFileName(req);
    const imported = req.body;
    if (!imported.vendors || !imported.accounts || !imported.keys) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    const encrypted = store.encryptKeys(imported, fileName);
    store.saveData(encrypted, fileName);
    res.json({ success: true, vendors: imported.vendors.length, accounts: imported.accounts.length, keys: imported.keys.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  const files = store.getDataFiles();
  console.log('='.repeat(50));
  console.log('  API Key Tracker');
  console.log(`  Version: v${VERSION}`);
  console.log(`  Available keys files: ${files.map(f => f.name).join(', ') || 'none'}`);
  console.log(`  Server running at http://localhost:${PORT}`);
  console.log('='.repeat(50));
});

module.exports = app;
