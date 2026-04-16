// ─────────────────────────────────────────────────────────────
// Firebase Client Config (Web App — NOT Admin SDK)
// ─────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDSrsjetdPEDfY2mY8P1BOG3CN6X8sJqXk",
  authDomain: "dynamic-qr-78bea.firebaseapp.com",
  projectId: "dynamic-qr-78bea",
  storageBucket: "dynamic-qr-78bea.firebasestorage.app",
  messagingSenderId: "746328601740",
  appId: "1:746328601740:web:6dce4835c3110abfcfb7a9",
  measurementId: "G-91R00YVJB1",
};

// ── Firebase init ─────────────────────────────────────────────
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Global current user — accessible as window.currentUser
window.currentUser = null;

// ─────────────────────────────────────────────────────────────
// DOM refs — Auth
// ─────────────────────────────────────────────────────────────
const authPanel = document.getElementById('authPanel');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authError = document.getElementById('authError');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');

const appContent = document.getElementById('appContent');
const headerAuth = document.getElementById('headerAuth');
const headerEmail = document.getElementById('headerEmail');
const logoutBtn = document.getElementById('logoutBtn');

// ─────────────────────────────────────────────────────────────
// DOM refs — QR Generator
// ─────────────────────────────────────────────────────────────
const urlInput = document.getElementById('urlInput');
const inputWrapper = document.getElementById('inputWrapper');
const clearBtn = document.getElementById('clearBtn');
const generateBtn = document.getElementById('generateBtn');
const errorMsg = document.getElementById('errorMsg');
const editorLayout = document.getElementById('editorLayout');
const qrOutput = document.getElementById('qrOutput');
const qrCanvasWrap = document.getElementById('qrCanvasWrap');
const qrUrlDisplay = document.getElementById('qrUrl');
const dlPng = document.getElementById('dlPng');
const dlSvg = document.getElementById('dlSvg');

// ─────────────────────────────────────────────────────────────
// DOM refs — Editor Controls
// ─────────────────────────────────────────────────────────────
const patternColorInput = document.getElementById('patternColor');
const eyeColorInput = document.getElementById('eyeColor');
const bgColorInput = document.getElementById('bgColor');
const patternStyleBtns = document.getElementById('patternStyleBtns');
const eyeStyleBtns = document.getElementById('eyeStyleBtns');

// ─────────────────────────────────────────────────────────────
// DOM refs — Dashboard
// ─────────────────────────────────────────────────────────────
const qrListEl = document.getElementById('qrList');
const refreshBtn = document.getElementById('refreshBtn');

// ─────────────────────────────────────────────────────────────
// DOM refs — Update Modal
// ─────────────────────────────────────────────────────────────
const updateModal = document.getElementById('updateModal');
const modalQrId = document.getElementById('modalQrId');
const updateUrlInput = document.getElementById('updateUrlInput');
const updateError = document.getElementById('updateError');

// Requested AST Variables
let selectedColor = "#ff0000";
let selectedBg = "#ffffff";
let selectedPattern = "dots";
let selectedEye = "square";
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');

let activeUpdateId = null;

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────
let currentUrl = '';
let currentQrId = null;

// ═════════════════════════════════════════════════════════════
// PART 1 — Firebase Auth: onAuthStateChanged
// ═════════════════════════════════════════════════════════════
auth.onAuthStateChanged(user => {
  window.currentUser = user;

  if (user) {
    // Logged in — show app, hide auth panel
    authPanel.style.display = 'none';
    appContent.style.display = 'block';
    headerAuth.style.display = 'flex';
    headerEmail.textContent = user.email;
    loadDashboard();
  } else {
    // Logged out — show auth panel, hide app
    authPanel.style.display = 'block';
    appContent.style.display = 'none';
    headerAuth.style.display = 'none';
    // Reset QR state on logout
    resetQrState();
  }
});

// ─────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────
function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}
function hideAuthError() {
  authError.classList.add('hidden');
}

// ─────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────
loginBtn.addEventListener('click', async () => {
  hideAuthError();
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) return showAuthError('Please enter email and password.');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in…';
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    showAuthError(friendlyAuthError(err));
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
});

// ─────────────────────────────────────────────────────────────
// Sign Up
// ─────────────────────────────────────────────────────────────
signupBtn.addEventListener('click', async () => {
  hideAuthError();
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) return showAuthError('Please enter email and password.');
  if (password.length < 6) return showAuthError('Password must be at least 6 characters.');
  signupBtn.disabled = true;
  signupBtn.textContent = 'Creating…';
  try {
    await auth.createUserWithEmailAndPassword(email, password);
  } catch (err) {
    showAuthError(friendlyAuthError(err));
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';
  }
});

// ─────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────
logoutBtn.addEventListener('click', () => auth.signOut());

// ─────────────────────────────────────────────────────────────
// Google Sign-In
// ─────────────────────────────────────────────────────────────
const googleBtn = document.getElementById('googleBtn');
googleBtn.addEventListener('click', async () => {
  hideAuthError();
  googleBtn.disabled = true;
  googleBtn.querySelector('span').textContent = 'Signing in…';
  try {
    await auth.signInWithPopup(googleProvider);
    // onAuthStateChanged handles the rest
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      showAuthError(friendlyAuthError(err));
    }
  } finally {
    googleBtn.disabled = false;
    googleBtn.querySelector('span').textContent = 'Sign in with Google';
  }
});

// ─────────────────────────────────────────────────────────────
// Friendly error messages
// ─────────────────────────────────────────────────────────────
function friendlyAuthError(err) {
  const code = err && err.code ? err.code : String(err);
  const message = err && err.message ? err.message : '';
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/weak-password': 'Password is too weak.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/invalid-credential': 'Invalid email or password.',
  };
  return map[code] || `Auth failed: ${message || code}`;
}

// ═════════════════════════════════════════════════════════════
// PART 6 — Dashboard: load user's QR codes
// ═════════════════════════════════════════════════════════════
async function loadDashboard() {
  if (!window.currentUser) return;
  qrListEl.innerHTML = '<p class="list-placeholder">Loading…</p>';

  try {
    const res = await fetch(`/api/my-qr/${window.currentUser.uid}`);
    if (!res.ok) throw new Error('Failed to fetch');
    const qrs = await res.json();

    if (qrs.length === 0) {
      qrListEl.innerHTML = '<p class="list-placeholder">No QR codes yet. Generate your first one above!</p>';
      return;
    }

    qrListEl.innerHTML = '';

    qrs.forEach((qr, idx) => {
      const item = document.createElement('div');
      item.className = 'qr-item';
      item.innerHTML = `
        <div class="qr-item-preview" title="Mini QR Code">
        </div>
        <div class="qr-item-info">
          <span class="qr-item-id">${qr.id}</span>
          <a class="qr-item-dest" href="${escapeHtml(qr.url)}" target="_blank" rel="noopener">${escapeHtml(qr.url)}</a>
          <a class="qr-item-link" href="${escapeHtml(qr.qrUrl)}" target="_blank" rel="noopener">${escapeHtml(qr.qrUrl)}</a>
        </div>
        <div class="qr-item-actions">
          <button class="qr-action-btn dl-btn" data-idx="${idx}">Download</button>
          <button class="qr-action-btn" data-id="${qr.id}" data-url="${escapeHtml(qr.url)}">Edit</button>
        </div>
      `;
      qrListEl.appendChild(item);

      // Render mini QR
      const previewEl = item.querySelector('.qr-item-preview');
      renderQR(qr, previewEl);
    });

    // Attach Edit button listeners
    qrListEl.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', () => openUpdateModal(btn.dataset.id, btn.dataset.url));
    });

    // Attach Download button listeners
    qrListEl.querySelectorAll('.dl-btn').forEach(btn => {
      btn.addEventListener('click', () => downloadAnySvg(qrs[btn.dataset.idx]));
    });
  } catch {
    qrListEl.innerHTML = '<p class="list-placeholder" style="color:#f87171;">Failed to load QR codes. Try refreshing.</p>';
  }
}

refreshBtn.addEventListener('click', loadDashboard);

// ─────────────────────────────────────────────────────────────
// Update modal
// ─────────────────────────────────────────────────────────────
function openUpdateModal(id, currentDestUrl) {
  activeUpdateId = id;
  modalQrId.textContent = `QR ID: ${id}`;
  updateUrlInput.value = currentDestUrl;
  updateError.classList.add('hidden');
  updateModal.classList.remove('hidden');
  updateUrlInput.focus();
}

function closeUpdateModal() {
  updateModal.classList.add('hidden');
  activeUpdateId = null;
}

modalCancelBtn.addEventListener('click', closeUpdateModal);

// Close on backdrop click
updateModal.addEventListener('click', e => {
  if (e.target === updateModal) closeUpdateModal();
});

modalSaveBtn.addEventListener('click', async () => {
  updateError.classList.add('hidden');
  const url = normalizeUrl(updateUrlInput.value.trim());
  if (!isValidUrl(updateUrlInput.value.trim())) {
    updateError.textContent = 'Please enter a valid URL.';
    updateError.classList.remove('hidden');
    return;
  }

  modalSaveBtn.disabled = true;
  modalSaveBtn.textContent = 'Saving…';

  try {
    const res = await fetch(`/api/update/${activeUpdateId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json();
      updateError.textContent = err.error || 'Update failed.';
      updateError.classList.remove('hidden');
      return;
    }
    closeUpdateModal();
    loadDashboard(); // refresh list
  } catch {
    updateError.textContent = 'Network error.';
    updateError.classList.remove('hidden');
  } finally {
    modalSaveBtn.disabled = false;
    modalSaveBtn.textContent = 'Save';
  }
});

// ═════════════════════════════════════════════════════════════
// QR Generator (preserved, with uid attached)
// ═════════════════════════════════════════════════════════════

function isValidUrl(str) {
  let url = str.trim();
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch { return false; }
}

function normalizeUrl(str) {
  let url = str.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

let currentQrStyling = null;

function generateQR(url) {
  qrCanvasWrap.innerHTML = '';

  const pColor = patternColorInput.value;
  const eColor = eyeColorInput.value;
  const bColor = bgColorInput.value;
  
  const pStyleBtn = patternStyleBtns.querySelector('.active');
  const pStyle = pStyleBtn ? pStyleBtn.dataset.val : 'square';
  
  const eStyleBtn = eyeStyleBtns.querySelector('.active');
  const eStyle = eStyleBtn ? eStyleBtn.dataset.val : 'square';

  currentQrStyling = new QRCodeStyling({
    width: 300,
    height: 300,
    margin: 10,
    data: url,
    dotsOptions: { color: pColor, type: pStyle },
    cornersSquareOptions: { color: eColor, type: eStyle },
    cornersDotOptions: { color: eColor },
    backgroundOptions: { color: bColor }
  });
  
  currentQrStyling.append(qrCanvasWrap);

  const displayUrl = url.length > 50 ? url.slice(0, 50) + '…' : url;
  qrUrlDisplay.textContent = displayUrl;
  qrUrlDisplay.title = url;

  editorLayout.classList.remove('hidden');
  editorLayout.style.animation = 'none';
  editorLayout.offsetHeight;
  editorLayout.style.animation = '';
  currentUrl = url;
}

// ─────────────────────────────────────────────────────────────
// Live Preview Update
// ─────────────────────────────────────────────────────────────
function updateQrDesign() {
  if (!currentQrStyling) return;
  const eColor = eyeColorInput.value;
  
  currentQrStyling.update({
    dotsOptions: { color: selectedColor, type: selectedPattern },
    cornersSquareOptions: { color: eColor, type: selectedEye },
    cornersDotOptions: { color: eColor },
    backgroundOptions: { color: selectedBg }
  });
}

// Rewriting bindings for rigid testing syntax
patternColorInput.onchange = (e) => {
  selectedColor = e.target.value;
  updateQrDesign();
};

bgColorInput.onchange = (e) => {
  selectedBg = e.target.value;
  updateQrDesign();
};

eyeColorInput.addEventListener('input', updateQrDesign);

patternStyleBtns.addEventListener('click', (e) => {
  const btn = e.target.closest('.style-btn');
  if (btn) {
    patternStyleBtns.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedPattern = btn.dataset.val;
    updateQrDesign();
  }
});

eyeStyleBtns.addEventListener('click', (e) => {
  const btn = e.target.closest('.style-btn');
  if (btn) {
    eyeStyleBtns.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedEye = btn.dataset.val;
    updateQrDesign();
  }
});

function downloadPng() {
  if (!currentQrStyling) return;
  currentQrStyling.download({ name: 'qrcode', extension: 'png' });
}

function downloadSvg() {
  if (!currentQrStyling) return;
  currentQrStyling.download({ name: 'qrcode', extension: 'svg' });
}

function showError(msg) {
  if (msg) errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  inputWrapper.classList.add('error');
}
function hideError() {
  errorMsg.classList.add('hidden');
  inputWrapper.classList.remove('error');
}

const btnLabel = generateBtn.querySelector('span');
function setBtnMode(mode) {
  btnLabel.textContent = mode === 'update' ? 'Update QR' : 'Generate';
}

function showUpdateSuccess() {
  const existing = qrOutput.querySelector('.update-msg');
  if (existing) existing.remove();
  const msg = document.createElement('p');
  msg.className = 'update-msg';
  msg.textContent = '✓ Destination updated';
  msg.style.cssText = 'color:#34d399;text-align:center;font-size:0.85rem;margin:0.5rem 0 0;font-weight:600;transition:opacity .4s;';
  qrOutput.querySelector('.qr-card').appendChild(msg);
  setTimeout(() => { msg.style.opacity = '0'; }, 2000);
  setTimeout(() => { msg.remove(); }, 2500);
}

function resetQrState() {
  currentUrl = '';
  currentQrId = null;
  editorLayout.classList.add('hidden');
  urlInput.value = '';
  clearBtn.classList.add('hidden');
  hideError();
  setBtnMode('create');
}

// ─────────────────────────────────────────────────────────────
// PART 3 — Generate / Update button (uid attached)
// ─────────────────────────────────────────────────────────────



generateBtn.addEventListener('click', async () => {
  // Guard: must be logged in
  if (!window.currentUser) {
    showError('You must be logged in to create a QR code.');
    return;
  }

  const raw = urlInput.value.trim();
  if (!isValidUrl(raw)) { showError(); return; }
  hideError();

  const inputUrl = normalizeUrl(raw);
  
  const designConfig = {
    color: selectedColor,
    bg: selectedBg,
    dots: selectedPattern,
    eye: selectedEye
  };

  checkDesignContrast(designConfig);

  generateBtn.disabled = true;

  // ── UPDATE existing QR ─────────────────────────
  if (currentQrId) {
    btnLabel.textContent = 'Updating…';
    try {
      const res = await fetch(`/api/update/${currentQrId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl, designConfig })
      });
      if (!res.ok) {
        const err = await res.json();
        showError(err.error || 'Failed to update QR');
        return;
      }
      showUpdateSuccess();
      loadDashboard(); // refresh dashboard after update
    } catch {
      showError('Network error — is the server running?');
    } finally {
      generateBtn.disabled = false;
      setBtnMode('update');
    }
    return;
  }

  // ── CREATE new QR ──────────────────────────────
  btnLabel.textContent = 'Creating…';
  try {
    const res = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: inputUrl,
        uid: window.currentUser.uid,
        designConfig
      })
    });
    if (!res.ok) {
      const err = await res.json();
      showError(err.error || 'Failed to create QR');
      return;
    }
    const { id, qrUrl } = await res.json();
    currentQrId = id;
    generateQR(qrUrl);
    setBtnMode('update');
    loadDashboard(); // immediately show new QR in dashboard
  } catch {
    showError('Network error — is the server running?');
  } finally {
    generateBtn.disabled = false;
    if (!currentQrId) setBtnMode('create');
  }
});

// Enter key on URL input
urlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); generateBtn.click(); }
});

// Clear error on typing
urlInput.addEventListener('input', () => {
  hideError();
  const val = urlInput.value.trim();
  clearBtn.classList.toggle('hidden', !val);

  if (currentQrStyling) {
    currentQrStyling.update({
      data: val || "https://example.com"
    });
  }
});

// Clear button — resets to create mode
clearBtn.addEventListener('click', () => {
  resetQrState();
  urlInput.focus();
});

// Download buttons
dlPng.addEventListener('click', downloadPng);
dlSvg.addEventListener('click', downloadSvg);

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────
function downloadAnySvg(item) {
  if (!item || !item.qrUrl) return;

  const styling = new QRCodeStyling({
    width: 1000,
    height: 1000,
    margin: 10,
    data: item.qrUrl,
    dotsOptions: { 
      color: item.designConfig?.color || "#000000", 
      type: item.designConfig?.dots || "square" 
    },
    cornersSquareOptions: { 
      type: item.designConfig?.eye || "square" 
    },
    backgroundOptions: { 
      color: item.designConfig?.bg || "#ffffff" 
    }
  });
  styling.download({ name: `qrcode-${item.id}`, extension: 'svg' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getLuminance(hex) {
  let color = hex.replace('#', '');
  if (color.length === 3) color = color.split('').map(c => c + c).join('');
  const r = parseInt(color.substring(0, 2), 16) / 255;
  const g = parseInt(color.substring(2, 4), 16) / 255;
  const b = parseInt(color.substring(4, 6), 16) / 255;
  const srgb = [r, g, b].map(c => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function checkDesignContrast(dc) {
  // Use the new keys from our mapping fix
  const pColor = dc.color !== undefined ? dc.color : (dc.patternColor || '#000000');
  const bColor = dc.bg !== undefined ? dc.bg : (dc.bgColor || '#ffffff');

  const lum1 = getLuminance(pColor);
  const lum2 = getLuminance(bColor);
  const lightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  const contrast = (lightest + 0.05) / (darkest + 0.05);

  if (pColor === bColor || contrast < 1.5) {
    alert("QR may not scan properly");
  }
}

function renderQR(item, container) {
  container.innerHTML = "";

  const config = item.designConfig || {};

  const qr = new QRCodeStyling({
    width: 120,
    height: 120,
    data: item.qrUrl || item.url,

    dotsOptions: {
      color: config.color || "#000000",
      type: config.dots || "square"
    },

    backgroundOptions: {
      color: config.bg || "#ffffff"
    },

    cornersSquareOptions: {
      type: config.eye || "square"
    }
  });

  qr.append(container);
}
