/* Vaultline – Verschlüsselung
 * Nur eingebaute, geprüfte WebCrypto-Bausteine (ECDH P-256, ECDSA P-256, HKDF-SHA256, AES-256-GCM, PBKDF2).
 * Umschlag: Inhalt mit Zufallsschlüssel K verschlüsselt, K für jeden Empfänger einzeln eingepackt
 * (ECDH mit Wegwerf-Schlüssel -> HKDF -> AES-GCM). Absender und Signatur liegen IM verschlüsselten Teil,
 * der Server sieht also weder wer schreibt noch an wen (außer den Briefkasten-Nummern).
 */
(function (G) {
  'use strict';
  const C = G.crypto, S = C.subtle;
  const te = new TextEncoder(), td = new TextDecoder();

  const b64 = (buf) => {
    const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const ub64 = (s) => {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const b = atob(s), u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  };
  const hex = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
  const rand = (n) => C.getRandomValues(new Uint8Array(n));
  const rid = (n = 12) => hex(rand(n));
  const sha256 = async (data) => new Uint8Array(await S.digest('SHA-256', typeof data === 'string' ? te.encode(data) : data));
  const cat = (...parts) => {
    const arrs = parts.map((p) => (typeof p === 'string' ? te.encode(p) : p));
    const out = new Uint8Array(arrs.reduce((a, b) => a + b.length, 0));
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  };

  const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
  const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };
  const SIGN = { name: 'ECDSA', hash: 'SHA-256' };

  async function boxOf(secret) { return hex(await sha256(secret)); }
  async function idOf(sigPubB64) { return hex(await sha256(ub64(sigPubB64))).slice(0, 32); }

  async function newIdentity() {
    const enc = await S.generateKey(ECDH, true, ['deriveBits']);
    const sig = await S.generateKey(ECDSA, true, ['sign', 'verify']);
    const encPub = b64(await S.exportKey('raw', enc.publicKey));
    const sigPub = b64(await S.exportKey('raw', sig.publicKey));
    const secret = b64(rand(32));
    return {
      v: 1,
      id: await idOf(sigPub),
      encPub, sigPub,
      encPriv: await S.exportKey('jwk', enc.privateKey),
      sigPriv: await S.exportKey('jwk', sig.privateKey),
      secret,
      box: await boxOf(secret),
      created: Date.now(),
    };
  }

  // gespeicherte Identität -> CryptoKeys
  async function loadIdentity(st) {
    return Object.assign({}, st, {
      _enc: await S.importKey('jwk', st.encPriv, ECDH, false, ['deriveBits']),
      _sig: await S.importKey('jwk', st.sigPriv, ECDSA, false, ['sign']),
    });
  }

  const pubCache = new Map();
  async function encKey(b) {
    const k = 'e' + b;
    if (!pubCache.has(k)) pubCache.set(k, await S.importKey('raw', ub64(b), ECDH, false, []));
    return pubCache.get(k);
  }
  async function sigKey(b) {
    const k = 's' + b;
    if (!pubCache.has(k)) pubCache.set(k, await S.importKey('raw', ub64(b), ECDSA, false, ['verify']));
    return pubCache.get(k);
  }

  async function wrapKey(privKey, pubKey, ephPubRaw, recipientEncPub) {
    const bits = await S.deriveBits({ name: 'ECDH', public: pubKey }, privKey, 256);
    const hk = await S.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
    return S.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: ephPubRaw, info: te.encode('kreis-wrap-v1|' + recipientEncPub) },
      hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /** Umschlag zuschnüren.
   * me: geladene Identität, to: [{e: encPub}], payload: Objekt, card: optional eigene Visitenkarte (für Fremde)
   */
  async function seal(me, to, payload, card) {
    if (!to.length) throw new Error('keine Empfänger');
    const K = rand(32);
    const kKey = await S.importKey('raw', K, 'AES-GCM', false, ['encrypt']);
    const eph = await S.generateKey(ECDH, true, ['deriveBits']);
    const ephRaw = new Uint8Array(await S.exportKey('raw', eph.publicKey));
    const E = b64(ephRaw);
    const wraps = [];
    const seen = new Set();
    for (const r of to) {
      if (!r || !r.e || seen.has(r.e)) continue;
      seen.add(r.e);
      const w = await wrapKey(eph.privateKey, await encKey(r.e), ephRaw, r.e);
      const iv = rand(12);
      wraps.push(b64(iv) + '.' + b64(await S.encrypt({ name: 'AES-GCM', iv }, w, K)));
    }
    // Reihenfolge mischen, damit nichts über die Gruppe verraten wird
    for (let i = wraps.length - 1; i > 0; i--) { const j = rand(1)[0] % (i + 1); [wraps[i], wraps[j]] = [wraps[j], wraps[i]]; }
    const P = JSON.stringify(payload);
    const C = card ? JSON.stringify(card) : '';
    const sig = b64(await S.sign(SIGN, me._sig, cat('kreis1|', E, '|', wraps.join(','), '|', P, '|', C)));
    const inner = JSON.stringify({ f: me.id, s: C || undefined, p: P, g: sig });
    const iv = rand(12);
    const ct = await S.encrypt({ name: 'AES-GCM', iv }, kKey, te.encode(inner));
    return JSON.stringify({ v: 1, E, k: wraps, i: b64(iv), c: b64(ct) });
  }

  /** Umschlag öffnen. lookup(id) -> sigPub (b64) des bekannten Kontakts oder null.
   * Liefert {from, payload, card, known} oder wirft einen Fehler.
   */
  async function open(me, envStr, lookup) {
    const env = JSON.parse(envStr);
    if (env.v !== 1) throw new Error('version');
    const ephRaw = ub64(env.E);
    const w = await wrapKey(me._enc, await encKey(env.E), ephRaw, me.encPub);
    let K = null;
    for (const item of env.k) {
      const [iv, data] = item.split('.');
      try { K = await S.decrypt({ name: 'AES-GCM', iv: ub64(iv) }, w, ub64(data)); break; } catch (e) { /* nicht für uns */ }
    }
    if (!K) throw new Error('nicht für mich');
    const kKey = await S.importKey('raw', K, 'AES-GCM', false, ['decrypt']);
    const inner = JSON.parse(td.decode(await S.decrypt({ name: 'AES-GCM', iv: ub64(env.i) }, kKey, ub64(env.c))));
    const cardStr = typeof inner.s === 'string' ? inner.s : '';
    const card = cardStr ? JSON.parse(cardStr) : null;
    let spub = lookup(inner.f);
    const known = !!spub;
    if (!spub) {
      if (!card || !card.s) throw new Error('unbekannter Absender');
      spub = card.s;
    }
    if (card && ((await idOf(card.s)) !== inner.f || card.id !== inner.f)) throw new Error('Karte passt nicht');
    const ok = await S.verify(SIGN, await sigKey(spub), ub64(inner.g), cat('kreis1|', env.E, '|', env.k.join(','), '|', inner.p, '|', cardStr));
    if (!ok) throw new Error('Signatur falsch');
    return { from: inner.f, payload: JSON.parse(inner.p), card, known };
  }

  // Dateien: eigener Zufallsschlüssel pro Datei
  async function encryptBytes(bytes) {
    const key = rand(32), iv = rand(12);
    const k = await S.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
    const data = new Uint8Array(await S.encrypt({ name: 'AES-GCM', iv }, k, bytes));
    return { key: b64(key), iv: b64(iv), data };
  }
  async function decryptBytes(data, keyB64, ivB64) {
    const k = await S.importKey('raw', ub64(keyB64), 'AES-GCM', false, ['decrypt']);
    return new Uint8Array(await S.decrypt({ name: 'AES-GCM', iv: ub64(ivB64) }, k, data));
  }

  // Sicherheitsnummer zum Vergleichen (wie bei Signal): 12 Blöcke à 5 Ziffern
  async function safetyNumber(sigA, sigB) {
    const [x, y] = [sigA, sigB].sort();
    let h = await sha256(cat('kreis-safety|', ub64(x), ub64(y)));
    for (let i = 0; i < 1000; i++) h = await sha256(h);
    const h2 = await sha256(cat(h, 'b'));
    const all = cat(h, h2);
    const blocks = [];
    for (let i = 0; i < 12; i++) {
      const n = ((all[i * 5] << 24) | (all[i * 5 + 1] << 16) | (all[i * 5 + 2] << 8) | all[i * 5 + 3]) >>> 0;
      blocks.push(String(n % 100000).padStart(5, '0'));
    }
    return blocks;
  }

  // Schlüssel aus PIN/Passwort (App-Sperre, Backup)
  async function passKey(pass, salt, iter = 310000) {
    const base = await S.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return S.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function aesKey(raw) { return S.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); }
  async function encJSON(key, obj) {
    const iv = rand(12);
    const ct = await S.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
    return b64(iv) + '.' + b64(ct);
  }
  async function decJSON(key, s) {
    const [iv, ct] = s.split('.');
    return JSON.parse(td.decode(await S.decrypt({ name: 'AES-GCM', iv: ub64(iv) }, key, ub64(ct))));
  }
  async function lockWithPass(pass, obj) {
    const salt = rand(16);
    const key = await passKey(pass, salt);
    return { salt: b64(salt), data: await encJSON(key, obj) };
  }
  async function unlockWithPass(pass, locked) {
    const key = await passKey(pass, ub64(locked.salt));
    return decJSON(key, locked.data);
  }

  // Visitenkarte unterschreiben (für Verzeichnis und Einladungslinks). Name/Farbe sind nur Anzeige.
  const cardMsg = (c) => te.encode(JSON.stringify(['kreis-card1', c.id, c.e, c.s, (c.bs && c.bs.length ? c.bs : [c.b]), c.u || '', c.t || 0]));
  async function signCard(me, card) { card.sg = b64(await S.sign(SIGN, me._sig, cardMsg(card))); return card; }
  async function verifyCard(card) {
    try { if (!card || !card.sg || !card.s || (await idOf(card.s)) !== card.id) return false; return await S.verify(SIGN, await sigKey(card.s), ub64(card.sg), cardMsg(card)); }
    catch (e) { return false; }
  }
  // Aus dem Passwort zwei Schlüssel ableiten: einen zum Anmelden (geht an den Server, dort nur als Hash),
  // einen zum Verschlüsseln der Konto-Schlüssel (verlässt nie das Gerät).
  async function passDerive(pass, saltB64, iter = 600000) {
    const base = await S.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await S.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: ub64(saltB64), iterations: iter }, base, 512));
    return { auth: b64(bits.slice(0, 32)), enc: b64(bits.slice(32)) };
  }

  const KC = { signCard, verifyCard, passDerive, b64, ub64, hex, rand, rid, sha256, boxOf, idOf, newIdentity, loadIdentity, seal, open, encryptBytes, decryptBytes, safetyNumber, passKey, aesKey, encJSON, decJSON, lockWithPass, unlockWithPass, te, td };
  G.KC = KC;
  if (typeof module !== 'undefined') module.exports = KC;
})(typeof window !== 'undefined' ? window : globalThis);
