/* Vaultline – Netzwerk. Briefkasten (Supabase-Datenbank), Echtzeit-Klingel (Supabase Realtime)
 * und verschlüsselte Dateien (Supabase Storage). Der Server bekommt nur verschlüsselte Daten.
 */
(function (G) {
  'use strict';
  const KC = G.KC || (typeof require !== 'undefined' ? require('./crypto.js') : null);

  class Net {
    constructor(cfg) {
      this.url = cfg.url; this.key = cfg.key; this.box = null; this.secret = null;
      this.onPing = () => {}; this.onLive = () => {}; this.onStatus = () => {};
      this.ws = null; this.ref = 1; this.hb = null; this.retry = 0; this.up = false; this.stopped = false;
    }
    setMe(box, secret) { this.box = box; this.secret = secret; }
    headers(extra) { return Object.assign({ apikey: this.key, Authorization: 'Bearer ' + this.key }, extra || {}); }

    async rpc(name, body) {
      const r = await fetch(this.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: this.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      if (!r.ok) throw new Error('Server ' + r.status + ': ' + (await r.text()).slice(0, 200));
      return r.json();
    }
    async send(boxes, env, days) {
      boxes = Array.from(new Set(boxes)).filter(Boolean);
      if (!boxes.length) return 0;
      const n = await this.rpc('k_send', { p_boxes: boxes, p_data: env, p_days: days || 30 });
      this.broadcast(boxes, 'p', {}).catch(() => {});
      return n;
    }
    acc(name, body) { return this.rpc(name, body); }
    fetchMail() { return this.rpc('k_fetch', { p_secret: this.secret, p_after: 0 }); }
    ack(upto) { return this.rpc('k_ack', { p_secret: this.secret, p_upto: upto }); }
    live(boxes, env) { return this.broadcast(Array.from(new Set(boxes)).filter(Boolean), 'l', { d: env }); }
    async broadcast(boxes, event, payload) {
      if (!boxes.length) return;
      const r = await fetch(this.url + '/realtime/v1/api/broadcast', {
        method: 'POST', headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ messages: boxes.map((b) => ({ topic: 'k:' + b, event, payload, private: false })) }),
      });
      if (!r.ok && r.status !== 202) throw new Error('broadcast ' + r.status);
    }

    // verschlüsselte Datei hochladen (mit Fortschritt)
    upload(bytes, onProgress) {
      const name = KC.rid(24);
      const url = this.url + '/storage/v1/object/kreis/' + name;
      return new Promise((res, rej) => {
        const x = new XMLHttpRequest();
        x.open('POST', url);
        const h = this.headers({ 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' });
        for (const k in h) x.setRequestHeader(k, h[k]);
        x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
        x.onload = () => (x.status >= 200 && x.status < 300 ? res(this.url + '/storage/v1/object/public/kreis/' + name) : rej(new Error('Upload ' + x.status + ' ' + x.responseText.slice(0, 200))));
        x.onerror = () => rej(new Error('Upload fehlgeschlagen'));
        x.send(new Blob([bytes]));
      });
    }
    async download(url, onProgress) {
      if (!url.startsWith(this.url + '/storage/v1/object/public/kreis/')) throw new Error('fremde Adresse');
      const r = await fetch(url);
      if (!r.ok) throw new Error('Download ' + r.status);
      const total = +r.headers.get('content-length') || 0;
      if (!r.body || !total || !onProgress) return new Uint8Array(await r.arrayBuffer());
      const rd = r.body.getReader(), parts = []; let got = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onProgress(got / total); }
      const out = new Uint8Array(got); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
      return out;
    }

    // Echtzeit: eigener Kanal "k:<briefkasten>"
    connect() {
      this.stopped = false;
      if (this.ws || !this.box) return;
      const wsUrl = this.url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(this.key) + '&vsn=1.0.0';
      let ws;
      try { ws = new WebSocket(wsUrl); } catch (e) { return this.later(); }
      this.ws = ws;
      const topic = 'realtime:k:' + this.box;
      ws.onopen = () => {
        const ref = String(this.ref++);
        this.joinRef = ref;
        ws.send(JSON.stringify({ topic, event: 'phx_join', ref, join_ref: ref, payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '', enabled: false }, postgres_changes: [], private: false }, access_token: this.key } }));
        clearInterval(this.hb);
        this.hb = setInterval(() => { try { ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(this.ref++) })); } catch (e) {} }, 25000);
      };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.event === 'phx_reply' && m.topic === topic && m.payload && m.payload.status === 'ok' && !this.up) { this.up = true; this.retry = 0; this.onStatus(true); this.onPing(); }
        if (m.event === 'broadcast' && m.payload) {
          if (m.payload.event === 'p') this.onPing();
          else if (m.payload.event === 'l' && m.payload.payload && m.payload.payload.d) this.onLive(m.payload.payload.d);
        }
        if (m.event === 'phx_error' || m.event === 'phx_close') { try { ws.close(); } catch (e) {} }
      };
      ws.onclose = () => { clearInterval(this.hb); this.ws = null; if (this.up) { this.up = false; this.onStatus(false); } this.later(); };
      ws.onerror = () => {};
    }
    later() { if (this.stopped) return; const d = Math.min(30000, 1000 * Math.pow(2, this.retry++)); setTimeout(() => this.connect(), d); }
    disconnect() { this.stopped = true; if (this.ws) try { this.ws.close(); } catch (e) {} }
  }

  // Für Tests: Briefkasten im Speicher
  class MemNet {
    constructor(hub) { this.hub = hub; this.box = null; this.secret = null; this.onPing = () => {}; this.onLive = () => {}; this.onStatus = () => {}; this.up = true; }
    setMe(box, secret) { this.box = box; this.secret = secret; this.hub.nodes.set(box, this); }
    async send(boxes, env) { for (const b of new Set(boxes)) { this.hub.mail.push({ id: ++this.hub.seq, box: b, data: env }); const n = this.hub.nodes.get(b); if (n) setTimeout(() => n.onPing(), 0); } return boxes.length; }
    async fetchMail() { const box = await KC.boxOf(this.secret); return this.hub.mail.filter((m) => m.box === box).map((m) => ({ id: m.id, data: m.data })); }
    async ack(upto) { const box = await KC.boxOf(this.secret); this.hub.mail = this.hub.mail.filter((m) => !(m.box === box && m.id <= upto)); }
    async live(boxes, env) { for (const b of new Set(boxes)) { const n = this.hub.nodes.get(b); if (n) setTimeout(() => n.onLive(env), 0); } }
    async upload(bytes) { const name = KC.rid(24); this.hub.files.set(name, bytes); return 'mem://' + name; }
    async download(url) { return this.hub.files.get(url.slice(6)); }
    // Konten wie auf dem Server (k_register, k_salt, k_login, k_update, k_lookup, k_unregister)
    async acc(name, b) {
      const A = this.hub.accounts, h = async (x) => KC.hex(await KC.sha256(x));
      const u = String(b.p_user || '').toLowerCase().replace(/^@/, '');
      const a = A.get(u);
      if (name === 'k_register') { if (!/^[a-z0-9_.]{3,20}$/.test(u)) throw new Error('ungültig'); if (a) return false; A.set(u, { auth: await h(b.p_auth), salt: b.p_salt, blob: b.p_blob, card: b.p_card, ver: 1, fails: 0, locked: 0 }); return true; }
      if (name === 'k_salt') return a ? a.salt : null;
      if (name === 'k_lookup') return a ? JSON.parse(JSON.stringify(a.card)) : null;
      if (name === 'k_login') {
        if (!a) return { ok: false };
        if (a.locked > Date.now()) return { ok: false, locked: true };
        if (a.auth !== await h(b.p_auth)) { a.fails++; if (a.fails >= 5) { a.fails = 0; a.locked = Date.now() + 900000; } return { ok: false }; }
        a.fails = 0; return { ok: true, blob: a.blob, card: JSON.parse(JSON.stringify(a.card)), ver: a.ver };
      }
      if (name === 'k_update') {
        if (!a || a.auth !== await h(b.p_auth)) return { ok: false };
        if (a.ver !== b.p_ver) return { ok: false, conflict: true };
        a.blob = b.p_blob; a.card = b.p_card; a.ver++;
        if (b.p_newauth) a.auth = await h(b.p_newauth); if (b.p_newsalt) a.salt = b.p_newsalt;
        return { ok: true, ver: a.ver };
      }
      if (name === 'k_unregister') { if (a && a.auth === await h(b.p_auth)) { A.delete(u); return true; } return false; }
      throw new Error('unbekannt ' + name);
    }
    connect() {} disconnect() {}
  }
  MemNet.hub = () => ({ mail: [], seq: 0, nodes: new Map(), files: new Map(), accounts: new Map() });

  G.KNet = Net; G.KMemNet = MemNet;
  if (typeof module !== 'undefined') module.exports = { Net, MemNet };
})(typeof window !== 'undefined' ? window : globalThis);
