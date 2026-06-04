/**
 * マイシン工業 — 入口ロック（index ログイン + 各画面のセッション確認）
 */
(function (global) {
  const PW_KEY = 'maishin_app_pw';
  const LEGACY_KEYS = ['genba_pw', 'taskManager_pw'];
  const SESSION_KEY = 'maishin_session';
  const SESSION_MS = 8 * 60 * 60 * 1000;
  const MAX_FAILS = 5;
  const LOCK_MS = 60 * 1000;

  let lockFailCount = 0;
  let lockUntil = 0;

  function hashPwLegacyIndex(pw) {
    let h = 0;
    for (let i = 0; i < pw.length; i++) {
      h = Math.imul(31, h) + pw.charCodeAt(i) | 0;
    }
    return h.toString(36) + '_' + pw.length;
  }

  function hashPwLegacyKakou(pw) {
    let h = 5381;
    for (let i = 0; i < pw.length; i++) {
      h = ((h << 5) + h) ^ pw.charCodeAt(i);
    }
    return (h >>> 0).toString(36);
  }

  async function hashPw(pw) {
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('maishin-v1:' + pw)
    );
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return 's256:' + hex;
  }

  function getStoredHashRaw() {
    let s = localStorage.getItem(PW_KEY);
    if (s) return s;
    for (const k of LEGACY_KEYS) {
      s = localStorage.getItem(k);
      if (s) return s;
    }
    return null;
  }

  function isLegacyHash(stored) {
    return stored && !stored.startsWith('s256:');
  }

  async function verifyPassword(pw, stored) {
    const target = stored || hashPwLegacyIndex('1234');
    if (stored && stored.startsWith('s256:')) {
      return (await hashPw(pw)) === stored;
    }
    if (stored) {
      return (
        hashPwLegacyIndex(pw) === stored || hashPwLegacyKakou(pw) === stored
      );
    }
    return (
      hashPwLegacyIndex(pw) === target ||
      hashPwLegacyKakou(pw) === target ||
      (await hashPw(pw)) === (await hashPw('1234'))
    );
  }

  async function upgradeStoredHash(pw) {
    const next = await hashPw(pw);
    localStorage.setItem(PW_KEY, next);
    for (const k of LEGACY_KEYS) {
      localStorage.removeItem(k);
    }
    return next;
  }

  function setSession() {
    sessionStorage.setItem(SESSION_KEY, String(Date.now()));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function isSessionValid() {
    const t = parseInt(sessionStorage.getItem(SESSION_KEY) || '0', 10);
    return t > 0 && Date.now() - t < SESSION_MS;
  }

  /** 今開いているフォルダの index.html（base タグに依存しない） */
  function loginPageUrl() {
    return new URL('index.html', global.location.href).href;
  }

  function goLogin(clear) {
    if (clear !== false) clearSession();
    global.location.href = loginPageUrl();
  }

  function requireAuth() {
    if (!isSessionValid()) {
      global.location.replace(loginPageUrl());
      return false;
    }
    return true;
  }

  function applyHomeLinks() {
    const url = loginPageUrl();
    global.document.querySelectorAll('[data-maishin-home]').forEach((el) => {
      if (el.tagName === 'A') el.href = url;
    });
    const gateLink = global.document.getElementById('maishinAuthGateLink');
    if (gateLink) gateLink.href = url;
  }

  function showAuthGate() {
    global.document.body.classList.add('maishin-auth-pending');
    const el = global.document.getElementById('maishinAuthGate');
    if (el) el.style.display = 'flex';
  }

  /** head 直後などで呼ぶ：未ログインならログイン画面へ */
  function bootPage() {
    if (isSessionValid()) {
      global.document.body.classList.remove('maishin-auth-pending');
      applyHomeLinks();
      return true;
    }
    showAuthGate();
    applyHomeLinks();
    global.location.replace(loginPageUrl());
    return false;
  }

  function guard(fn) {
    if (!requireAuth()) return;
    if (typeof fn === 'function') fn();
  }

  function lockRemainingSec() {
    return Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
  }

  async function tryUnlock(getPw, onSuccess, onError) {
    const now = Date.now();
    if (lockUntil > now) {
      onError('ロック中です。' + lockRemainingSec() + '秒後に再試行してください。');
      return false;
    }
    const pw = (getPw() || '').trim();
    if (!pw) {
      onError('パスワードを入力してください');
      return false;
    }
    const stored = getStoredHashRaw();
    if (await verifyPassword(pw, stored)) {
      lockFailCount = 0;
      lockUntil = 0;
      if (!stored || isLegacyHash(stored)) {
        await upgradeStoredHash(pw);
      }
      setSession();
      onSuccess();
      return true;
    }
    lockFailCount++;
    if (lockFailCount >= MAX_FAILS) {
      lockUntil = Date.now() + LOCK_MS;
      onError('試行回数超過。' + Math.ceil(LOCK_MS / 1000) + '秒後に再試行してください。');
    } else {
      onError('パスワードが違います（残り' + (MAX_FAILS - lockFailCount) + '回）');
    }
    return false;
  }

  async function changePassword() {
    const current = prompt('現在のパスワードを入力してください');
    if (current === null) return;
    const stored = getStoredHashRaw();
    if (!(await verifyPassword(current, stored))) {
      alert('現在のパスワードが違います');
      return;
    }
    const next = prompt('新しいパスワード（6文字以上）');
    if (next === null) return;
    if (next.length < 6) {
      alert('6文字以上で設定してください');
      return;
    }
    const confirm2 = prompt('新しいパスワードを再入力してください');
    if (next !== confirm2) {
      alert('パスワードが一致しません');
      return;
    }
    await upgradeStoredHash(next);
    setSession();
    alert('パスワードを変更しました');
  }

  function needsInitialSetup() {
    return !getStoredHashRaw();
  }

  global.MaishinAuth = {
    PW_KEY,
    SESSION_MS,
    hashPw,
    verifyPassword,
    getStoredHashRaw,
    setSession,
    clearSession,
    isSessionValid,
    loginPageUrl,
    goLogin,
    requireAuth,
    guard,
    bootPage,
    applyHomeLinks,
    tryUnlock,
    changePassword,
    needsInitialSetup,
    lockRemainingSec,
  };
})(typeof window !== 'undefined' ? window : globalThis);
