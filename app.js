(() => {
  'use strict';

  // ── DOM refs ──────────────────────────────────
  const urlInput      = document.getElementById('urlInput');
  const inputWrapper  = document.getElementById('inputWrapper');
  const clearBtn      = document.getElementById('clearBtn');
  const generateBtn   = document.getElementById('generateBtn');
  const errorMsg      = document.getElementById('errorMsg');
  const qrOutput      = document.getElementById('qrOutput');
  const qrCanvasWrap  = document.getElementById('qrCanvasWrap');
  const qrUrlDisplay  = document.getElementById('qrUrl');
  const dlPng         = document.getElementById('dlPng');
  const dlSvg         = document.getElementById('dlSvg');

  let currentUrl = '';
  let currentQrId = null;

  // ── URL validation ────────────────────────────
  function isValidUrl(str) {
    // Accept URLs with or without protocol
    let url = str.trim();
    if (!url) return false;
    // Auto-prefix https:// if missing protocol
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function normalizeUrl(str) {
    let url = str.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  }

  // ── QR generation ─────────────────────────────
  function generateQR(url) {
    // qrcode-generator library
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();

    // Clear previous QR
    qrCanvasWrap.innerHTML = '';

    // Create canvas for PNG with proper sizing
    const moduleCount = qr.getModuleCount();
    const cellSize = Math.max(Math.floor(800 / moduleCount), 4);
    const totalSize = moduleCount * cellSize;

    const canvas = document.createElement('canvas');
    canvas.width = totalSize;
    canvas.height = totalSize;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalSize, totalSize);

    // Draw QR modules
    ctx.fillStyle = '#000000';
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    qrCanvasWrap.appendChild(canvas);

    // Truncate display URL
    const displayUrl = url.length > 50 ? url.slice(0, 50) + '…' : url;
    qrUrlDisplay.textContent = displayUrl;
    qrUrlDisplay.title = url;

    // Show output
    qrOutput.classList.remove('hidden');

    // Re-trigger animation
    qrOutput.style.animation = 'none';
    qrOutput.offsetHeight; // force reflow
    qrOutput.style.animation = '';

    currentUrl = url;
  }

  // ── Download PNG ──────────────────────────────
  function downloadPng() {
    const canvas = qrCanvasWrap.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'qrcode.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  // ── Download SVG ──────────────────────────────
  function downloadSvg() {
    if (!currentUrl) return;

    const qr = qrcode(0, 'M');
    qr.addData(currentUrl);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const cellSize = 10;
    const size = moduleCount * cellSize;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
    svg += `<rect width="${size}" height="${size}" fill="#ffffff"/>`;

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          svg += `<rect x="${col * cellSize}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="#000000"/>`;
        }
      }
    }
    svg += '</svg>';

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = 'qrcode.svg';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ── Show/hide error ───────────────────────────
  function showError() {
    errorMsg.classList.remove('hidden');
    inputWrapper.classList.add('error');
  }

  function hideError() {
    errorMsg.classList.add('hidden');
    inputWrapper.classList.remove('error');
  }

  // ── Event handlers ────────────────────────────

  const btnLabel = generateBtn.querySelector('span');

  /**
   * Set button mode: 'create' shows "Generate", 'update' shows "Update QR".
   */
  function setBtnMode(mode) {
    btnLabel.textContent = mode === 'update' ? 'Update QR' : 'Generate';
  }

  /**
   * Brief success flash under the QR after an update.
   */
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

  // Generate or Update on button click
  generateBtn.addEventListener('click', async () => {
    const raw = urlInput.value.trim();
    if (!isValidUrl(raw)) {
      showError();
      return;
    }
    hideError();

    const normalizedUrl = normalizeUrl(raw);
    generateBtn.disabled = true;

    // ── UPDATE existing QR ───────────────────────
    if (currentQrId) {
      btnLabel.textContent = 'Updating…';
      try {
        const res = await fetch(`/api/update/${currentQrId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalizedUrl }),
        });

        if (!res.ok) {
          const err = await res.json();
          errorMsg.textContent = err.error || 'Failed to update QR';
          showError();
          return;
        }

        showUpdateSuccess();
      } catch {
        errorMsg.textContent = 'Network error — is the server running?';
        showError();
      } finally {
        generateBtn.disabled = false;
        setBtnMode('update');
      }
      return;
    }

    // ── CREATE new QR ────────────────────────────
    btnLabel.textContent = 'Creating…';
    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      if (!res.ok) {
        const err = await res.json();
        errorMsg.textContent = err.error || 'Failed to create QR';
        showError();
        return;
      }

      const { id, qrUrl } = await res.json();
      currentQrId = id;
      generateQR(qrUrl);
      setBtnMode('update');
    } catch {
      errorMsg.textContent = 'Network error — is the server running?';
      showError();
    } finally {
      generateBtn.disabled = false;
      if (!currentQrId) setBtnMode('create');
    }
  });

  // Generate on Enter key
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generateBtn.click();
    }
  });

  // Clear error on typing
  urlInput.addEventListener('input', () => {
    hideError();
    clearBtn.classList.toggle('hidden', !urlInput.value);
  });

  // Clear button — resets to create mode
  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearBtn.classList.add('hidden');
    hideError();
    qrOutput.classList.add('hidden');
    currentUrl = '';
    currentQrId = null;
    setBtnMode('create');
    urlInput.focus();
  });

  // Download buttons
  dlPng.addEventListener('click', downloadPng);
  dlSvg.addEventListener('click', downloadSvg);

  // Focus input on load
  urlInput.focus();
})();
