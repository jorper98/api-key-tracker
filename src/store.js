const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');
const crypto = require('./crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ENV_FILE = path.join(__dirname, '..', '.env');
const SECRETS_FILE = path.join(DATA_DIR, '.secrets.json');
const KEYS_FILE_PATTERN = /-keys\.json$/;

function getDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  return DATA_DIR;
}

function loadSecrets() {
  try {
    if (fs.existsSync(SECRETS_FILE)) {
      const content = fs.readFileSync(SECRETS_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error loading secrets file:', err.message);
  }
  return {};
}

function saveSecrets(secrets) {
  try {
    getDataDir();
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2));
  } catch (err) {
    console.error('Failed to write secrets file:', err.message);
    throw new Error('Failed to update encryption key');
  }
}

function getEnvVar(name) {
  if (process.env[name]) return process.env[name];
  const secrets = loadSecrets();
  return secrets[name] || process.env[name];
}

function setSecret(name, value) {
  const secrets = loadSecrets();
  secrets[name] = value;
  saveSecrets(secrets);
  process.env[name] = value;
}

function getFileSecret(fileName) {
  const envName = `ENCRYPTION_SECRET_${fileName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  let secret = getEnvVar(envName);
  if (!secret) {
    secret = nodeCrypto.randomBytes(32).toString('hex');
    setSecret(envName, secret);
  }
  return secret;
}

function getSecret(fileName) {
  const legacySecret = getEnvVar('ENCRYPTION_SECRET');
  if (legacySecret && !fileName) return legacySecret;
  if (fileName) return getFileSecret(fileName);
  return legacySecret || getFileSecret('default');
}

function getDataFiles() {
  const dir = getDataDir();
  try {
    const files = fs.readdirSync(dir)
      .filter(f => KEYS_FILE_PATTERN.test(f) && f.endsWith('.json'))
      .map(f => ({
        filename: f,
        name: f.replace(KEYS_FILE_PATTERN, '')
      }));
    
    return files.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('Error listing data files:', err.message);
    return [];
  }
}

function getFilePath(name) {
  return path.join(getDataDir(), `${name}-keys.json`);
}

function getDefaultFilePath() {
  const files = getDataFiles();
  if (files.length > 0) {
    return getFilePath(files[0].name);
  }
  return getFilePath('default');
}

function loadData(fileName) {
  const filePath = fileName ? getFilePath(fileName) : getDefaultFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      getDataDir();
      const initialData = { vendors: [], accounts: [], keys: [] };
      fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading data:', err.message);
    return { vendors: [], accounts: [], keys: [] };
  }
}

function saveData(data, fileName) {
  const filePath = fileName ? getFilePath(fileName) : getDefaultFilePath();
  try {
    getDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving data:', err.message);
    throw new Error('Failed to save data');
  }
}

function createNewFile(name) {
  const filePath = getFilePath(name);
  if (fs.existsSync(filePath)) {
    return false;
  }
  const initialData = { vendors: [], accounts: [], keys: [] };
  getDataDir();
  fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
  getFileSecret(name);
  return true;
}

function deleteFile(name) {
  const filePath = getFilePath(name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    const envName = `ENCRYPTION_SECRET_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    const secrets = loadSecrets();
    if (secrets[envName]) {
      delete secrets[envName];
      saveSecrets(secrets);
    }
    delete process.env[envName];
    return true;
  }
  return false;
}

function encryptKeys(data, fileName) {
  const secret = getSecret(fileName);
  const encrypted = JSON.parse(JSON.stringify(data));
  encrypted.keys = encrypted.keys.map(k => ({
    ...k,
    encryptedKey: k.apiKey ? crypto.encrypt(k.apiKey, secret) : k.encryptedKey || '',
    apiKey: undefined
  }));
  return encrypted;
}

function decryptKeys(data, fileName) {
  const secret = getSecret(fileName);
  const decrypted = JSON.parse(JSON.stringify(data));
  decrypted.keys = decrypted.keys.map(k => ({
    ...k,
    apiKey: k.encryptedKey ? crypto.decrypt(k.encryptedKey, secret) : ''
  }));
  return decrypted;
}

function decryptSingleKey(encryptedKey, fileName) {
  const secret = getSecret(fileName);
  return crypto.decrypt(encryptedKey, secret);
}

function migrateOldFormat(data) {
  if (data.migrated || !data.vendors || data.vendors.length === 0) return data;
  
  const vendorNames = [...new Set(data.vendors.map(v => v.vendorName).filter(Boolean))];
  const vendors = vendorNames.map(name => ({
    id: 'v_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
    name: name,
    website: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  
  const vendorMap = {};
  vendors.forEach(v => { vendorMap[v.name] = v.id; });
  
  const accounts = data.vendors.map(oldV => ({
    id: oldV.id.startsWith('v_') ? oldV.id : 'a_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
    vendorId: vendorMap[oldV.vendorName] || '',
    accountName: oldV.accountName,
    accountEmail: oldV.accountEmail,
    vendorAccId: oldV.vendorAccId || '',
    authType: oldV.authType || 'Password',
    billingSetup: oldV.billingSetup || 'No Billing',
    notes: oldV.notes || '',
    createdAt: oldV.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  
  const keys = (data.keys || []).map(k => ({
    ...k,
    accountId: k.vendorAccountId || '',
    vendorAccountId: undefined
  }));
  
  return {
    vendors,
    accounts,
    keys,
    migrated: true
  };
}

module.exports = { loadData, saveData, encryptKeys, decryptKeys, decryptSingleKey, getSecret, migrateOldFormat, getDataFiles, createNewFile, deleteFile, getDefaultFilePath };
