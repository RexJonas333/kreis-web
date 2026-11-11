/* Vaultline – Chat-Logik (ohne Oberfläche, dadurch testbar).
 * Kontakte, Freundschaftsanfragen, 1:1-Chats, Gruppen, Server mit Kanälen, Rollen,
 * Nachrichten, Reaktionen, Bearbeiten, Löschen, Anpinnen, Umfragen, Lesebestätigungen,
 * selbstlöschende Nachrichten, Einladungslinks, Postausgang für offline, Backup.
 */
(function (G) {
  'use strict';
  const KC = G.KC || (typeof require !== 'undefined' ? require('./crypto.js') : null);
  const WEB = 'https://rexjonas333.github.io/kreis-web/';
  const now = () => Date.now();
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const boxesOf = (c) => (c && c.bs && c.bs.length ? c.bs : c ? [c.b] : []);
  const newer = (a, b) => ((a && a.t) || 0) >= ((b && b.t) || 0);
  // Nachrichtentypen, die von meinen eigenen anderen Geräten kommen dürfen
  const SELF = new Set(['msg', 'react', 'edit', 'del', 'pin', 'vote', 'read', 'ttl', 'gstate', 'gleave', 'join', 'state', 'snap', 'devhello', 'call', 'card']);
  const COLORS = ['#7C6CF2', '#2FB37A', '#E9893B', '#E25563', '#3BA4E9', '#C25BD8', '#D8B23B', '#4CC3B5'];

  const DEFAULTS = {
    readReceipts: true, typing: true, online: true, notify: true, sound: true,
    theme: 'dark', enterSends: true, compact: false, turn: '', pushToTalk: false, pttKey: 'KeyV',
    noise: true, echo: true, micId: '', camId: '', spkId: '',
  };

  class Kreis {
    constructor(store, net) {
      this.store = store; this.net = net; this.ev = {};
      this.contacts = {}; this.chats = {}; this.msgs = new Map(); this.outbox = []; this.seen = [];
      this.seenSet = new Set(); this.typingMap = {}; this.pendingJoins = {}; this.online = false;
      this.activeChat = null; this.activeCh = null; this.visible = true; this.timers = [];
      this.settings = Object.assign({}, DEFAULTS); this._saveT = {};
    }
    on(e, f) { (this.ev[e] = this.ev[e] || []).push(f); return () => { this.ev[e] = this.ev[e].filter((x) => x !== f); }; }
    emit(e, ...a) { for (const f of this.ev[e] || []) { try { f(...a); } catch (err) { console.error(err); } } if (e !== 'any') this.emit('any', e, ...a); }

    // ---------- Laden / Speichern ----------
    async init() {
      const raw = await this.store.get('kv', 'me');
      if (!raw) return false;
      this.meRaw = raw;
      this.me = await KC.loadIdentity(raw);
      this.profile = (await this.store.get('kv', 'profile')) || { name: 'Ich', color: COLORS[0] };
      this.contacts = (await this.store.get('kv', 'contacts')) || {};
      this.chats = (await this.store.get('kv', 'chats')) || {};
      this.settings = Object.assign({}, DEFAULTS, (await this.store.get('kv', 'settings')) || {});
      this.outbox = (await this.store.get('kv', 'outbox')) || [];
      this.seen = (await this.store.get('kv', 'seen')) || [];
      this.seenSet = new Set(this.seen);
      this.pendingJoins = (await this.store.get('kv', 'pendingJoins')) || {};
      this.acct = (await this.store.get('kv', 'acct')) || null;
      this.devices = [];
      this.msgs = new Map();
      for (const [k, v] of await this.store.all('msgs')) this.msgs.set(k, v);
      for (const m of this.msgs.values()) if (m.status === 'sending' && !this.outbox.some((o) => o.mid === m.chat + '|' + m.id)) m.status = 'failed';
      this.net.setMe(this.me.box, this.me.secret);
      this.net.onPing = () => this.sync();
      this.net.onLive = (env) => this._in(env, true);
      this.net.onStatus = (up) => { this.emit('status', up); if (up) this.flush(); };
      return true;
    }
    async setup(name, color) {
      if (!this.store.key) await this.store.create();
      const id = await KC.newIdentity();
      await this.store.put('kv', 'me', id);
      await this.store.put('kv', 'profile', { name: String(name || 'Ich').slice(0, 40), color: color || COLORS[KC.rand(1)[0] % COLORS.length], status: '', bio: '' });
      return this.init();
    }
    save(name) {
      clearTimeout(this._saveT[name]);
      this._saveT[name] = setTimeout(() => {
        const v = { contacts: this.contacts, chats: this.chats, settings: this.settings, outbox: this.outbox, seen: this.seen, profile: this.profile, pendingJoins: this.pendingJoins }[name];
        this.store.put('kv', name, v).catch((e) => console.error('save', name, e));
      }, 150);
    }
    async saveNow() {
      for (const n of Object.keys(this._saveT)) clearTimeout(this._saveT[n]);
      for (const n of ['contacts', 'chats', 'settings', 'outbox', 'seen', 'profile', 'pendingJoins']) await this.store.put('kv', n, this[n]);
    }
    putMsg(m) { this.msgs.set(m.chat + '|' + m.id, m); this.store.put('msgs', m.chat + '|' + m.id, m).catch(() => {}); }
    delMsg(key) { this.msgs.delete(key); this.store.del('msgs', key).catch(() => {}); this.store.del('files', key).catch(() => {}); }

    start() {
      this.net.connect();
      this.sync(); this.flush(); this.presence();
      const t = (f, ms) => this.timers.push(setInterval(f, ms));
      t(() => { if (!this.net.up || !this.visible) this.sync(); }, 5000);
      t(() => this.sync(), 30000);
      t(() => this.presence(), 45000);
      t(() => this.sweep(), 15000);
      t(() => this.flush(), 20000);
      if (this.acct) { setTimeout(() => this.accountRefresh(), 1500); t(() => this.accountRefresh(), 5 * 60000); }
    }
    stop() { for (const x of this.timers) clearInterval(x); this.timers = []; this.net.disconnect(); }

    // ---------- Identität ----------
    get id() { return this.me.id; }
    card() {
      const m = this.me;
      const c = { v: 1, id: m.id, e: m.encPub, s: m.sigPub, b: m.box, n: this.profile.name, c: this.profile.color };
      if (m.bs && m.bs.length) c.bs = m.bs.slice();
      if (this.acct) c.u = this.acct.u;
      if (m.ct) c.t = m.ct;
      if (m.csig) c.sg = m.csig;
      return c;
    }
    otherBoxes() { return boxesOf(this.card()).filter((b) => b !== this.me.box); }
    profileLite() { return { name: this.profile.name, color: this.profile.color, status: this.profile.status || '', bio: this.profile.bio || '', avatar: this.profile.avatar || '' }; }
    inviteCode() { return 'K1' + KC.b64(KC.te.encode(JSON.stringify(this.card()))); }
    inviteLink() { return WEB + '#add=' + this.inviteCode(); }
    parseCode(text) {
      text = String(text || '').trim();
      const m = text.match(/(K1[A-Za-z0-9_-]{40,})/);
      if (!m) return null;
      try {
        const c = JSON.parse(KC.td.decode(KC.ub64(m[1].slice(2))));
        if (c && c.v === 1 && c.id && c.e && c.s && c.b) return c;
      } catch (e) {}
      return null;
    }
    async setProfile(p) {
      Object.assign(this.profile, p, { upd: now() });
      this.syncSelf();
      this.save('profile'); this.emit('profile');
      await this._post(this.friendCards(), { t: 'prof', p: this.profileLite() });
      // Name in Gruppen aktualisieren
      for (const ch of Object.values(this.chats)) {
        if (ch.state && ch.state.members[this.id] && this.isAdmin(ch, this.id)) {
          const mine = ch.state.members[this.id];
          if (mine.n !== this.profile.name || mine.c !== this.profile.color) await this.updateGroup(ch.id, (s) => { s.members[this.id] = this.card(); });
        }
      }
    }
    async setSetting(k, v) { this.settings[k] = v; this.save('settings'); this.emit('settings'); }

    // ---------- Kontakte ----------
    friendCards() { return Object.values(this.contacts).filter((c) => c.status === 'friend').map((c) => c.card); }
    touch(c) { c.upd = now(); this.save('contacts'); this.emit('contacts'); this.syncSelf(); }
    contactName(id) {
      if (id === this.id) return this.profile.name;
      const c = this.contacts[id];
      if (c) return c.nick || (c.profile && c.profile.name) || c.card.n || 'Unbekannt';
      for (const ch of Object.values(this.chats)) if (ch.state && ch.state.members[id]) return ch.state.members[id].n || 'Mitglied';
      return 'Unbekannt';
    }
    contactColor(id) {
      if (id === this.id) return this.profile.color;
      const c = this.contacts[id];
      if (c) return (c.profile && c.profile.color) || c.card.c || COLORS[0];
      for (const ch of Object.values(this.chats)) if (ch.state && ch.state.members[id]) return ch.state.members[id].c || COLORS[1];
      return COLORS[parseInt(id.slice(0, 2), 16) % COLORS.length];
    }
    avatarOf(id) { if (id === this.id) return this.profile.avatar || ''; const c = this.contacts[id]; return (c && c.profile && c.profile.avatar) || ''; }
    isOnline(id) { const c = this.contacts[id]; return !!(c && c.seenAt && now() - c.seenAt < 75000); }
    async addContact(code) {
      let card = typeof code === 'string' ? this.parseCode(code) : code;
      if (!card && typeof code === 'string') {
        const u = Kreis.normUser(code);
        if (/^[a-z0-9_.]{3,20}$/.test(u)) {
          if (this.acct && u === this.acct.u) throw new Error('Das bist du selbst.');
          card = await this.net.acc('k_lookup', { p_user: u });
          if (!card) throw new Error('Niemand mit dem Benutzernamen @' + u + ' gefunden.');
          if (!(await KC.verifyCard(card))) throw new Error('Die Visitenkarte von @' + u + ' ist ungültig.');
        }
      }
      if (!card) throw new Error('Das ist weder ein gültiger Benutzername noch ein Einladungslink.');
      if (card.sg && !(await KC.verifyCard(card))) throw new Error('Der Code ist beschädigt.');
      if (card.id === this.id) throw new Error('Das ist dein eigener Code.');
      if ((await KC.idOf(card.s)) !== card.id) throw new Error('Der Code ist beschädigt.');
      const ex = this.contacts[card.id];
      if (ex && ex.status === 'friend') return ex;
      if (ex && ex.status === 'pending-in') { ex.card = card; return this.accept(card.id); }
      this.contacts[card.id] = Object.assign(ex || {}, { card, status: 'pending-out', added: now() });
      this.touch(this.contacts[card.id]);
      await this._post([card], { t: 'hello', p: this.profileLite() });
      return this.contacts[card.id];
    }
    async accept(id) {
      const c = this.contacts[id]; if (!c) return;
      c.status = 'friend'; c.since = now();
      this.touch(c);
      this.ensureDm(id);
      await this._post([c.card], { t: 'hello-ok', p: this.profileLite() });
      return c;
    }
    decline(id) { const c = this.contacts[id]; if (c) { c.status = 'removed'; this.touch(c); } }
    block(id) { const c = this.contacts[id]; if (c) { c.status = 'blocked'; this.touch(c); } }
    unblock(id) { const c = this.contacts[id]; if (c) { c.status = 'friend'; this.touch(c); } }
    removeContact(id) { const c = this.contacts[id]; if (c) { c.status = 'removed'; this.touch(c); } }
    setNick(id, nick) { const c = this.contacts[id]; if (c) { c.nick = nick; this.touch(c); } }
    async markVerified(id, v) { const c = this.contacts[id]; if (c) { c.verified = !!v; this.touch(c); } }
    safetyNumber(id) { const c = this.contacts[id] || { card: this.memberCard(id) }; return KC.safetyNumber(this.me.sigPub, c.card.s); }

    // ---------- Chats ----------
    ensureDm(id) {
      const key = 'd:' + id;
      if (!this.chats[key]) { this.chats[key] = { id: key, kind: 'dm', peer: id, unread: 0, created: now(), ttl: 0, reads: {} }; this.save('chats'); this.emit('chats'); }
      return this.chats[key];
    }
    chatTitle(ch) { return ch.kind === 'dm' ? this.contactName(ch.peer) : ch.state.name; }
    members(ch) {
      if (!ch) return [];
      if (ch.kind === 'dm') { const c = this.contacts[ch.peer]; return c && c.status !== 'blocked' && c.status !== 'removed' ? [c.card] : []; }
      if (ch.left) return [];
      return Object.values(ch.state.members).filter((c) => c.id !== this.id && !(this.contacts[c.id] && this.contacts[c.id].status === 'blocked'));
    }
    memberCard(id) { for (const ch of Object.values(this.chats)) if (ch.state && ch.state.members[id]) return ch.state.members[id]; return null; }
    isAdmin(ch, uid) { return !!(ch && ch.state && (ch.state.owner === uid || (ch.state.admins || []).includes(uid))); }
    chatMsgs(chatId, ch) {
      const out = [];
      for (const m of this.msgs.values()) if (m.chat === chatId && (ch === undefined || (m.ch || null) === (ch || null))) out.push(m);
      return out.sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
    }
    sortedChats(filter) {
      return Object.values(this.chats).filter((c) => (filter === 'archived' ? c.archived : !c.archived))
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.lastTs || b.created || 0) - (a.lastTs || a.created || 0));
    }
    chatFlag(chatId, k, v) { const c = this.chats[chatId]; if (c) { c[k] = v; c.fupd = now(); this.save('chats'); this.emit('chats'); this.syncSelf(); } }
    open(chatId, ch) {
      this.activeChat = chatId; this.activeCh = ch || null;
      const c = this.chats[chatId];
      if (c) {
        if (ch && c.unreadCh) { c.unread = Math.max(0, (c.unread || 0) - (c.unreadCh[ch] || 0)); c.unreadCh[ch] = 0; }
        else if (!ch) { c.unread = 0; c.unreadCh = {}; }
        c.mention = false; this.save('chats'); this.emit('chats');
        this.markRead(chatId);
      }
    }
    async markRead(chatId) {
      const c = this.chats[chatId]; if (!c) return;
      const ms = this.chatMsgs(chatId).filter((m) => m.from !== this.id);
      if (!ms.length) return;
      const ts = ms[ms.length - 1].ts;
      if ((c.readSent || 0) >= ts) return;
      c.readSent = ts; this.save('chats');
      const p = Object.assign({ t: 'read', ts }, this._ctx(c));
      await this._post(this.settings.readReceipts ? this.members(c) : [], p);
    }
    deleteChat(chatId) {
      for (const k of Array.from(this.msgs.keys())) if (k.startsWith(chatId + '|')) this.delMsg(k);
      delete this.chats[chatId]; this.save('chats'); this.emit('chats');
    }
    clearChat(chatId) { for (const k of Array.from(this.msgs.keys())) if (k.startsWith(chatId + '|')) this.delMsg(k); const c = this.chats[chatId]; if (c) { c.lastText = ''; this.save('chats'); } this.emit('chats'); this.emit('msgs', chatId); }

    // ---------- Senden ----------
    async _post(cards, payload, opt = {}) {
      const to = cards.filter((c) => c && c.e && c.b && c.id !== this.id);
      // Kopie an meine anderen Geräte (bei Echtzeit-Signalen nur auf Wunsch)
      const self = opt.self === false || (opt.live && !opt.self) ? [] : this.otherBoxes();
      if (!to.length && !self.length) { if (opt.mid) this._status(opt.mid, 'sent'); return; }
      const encs = to.map((c) => ({ e: c.e }));
      if (self.length) encs.push({ e: this.me.encPub });
      const env = await KC.seal(this.me, encs, payload, this.card());
      const boxes = to.flatMap(boxesOf).concat(self);
      if (opt.live) return this.net.live(boxes, env).catch(() => {});
      if (env.length > 390000) throw new Error('Nachricht zu groß');
      this.outbox.push({ boxes, env, days: opt.days || 30, mid: opt.mid || null, at: now() });
      this.save('outbox');
      await this.flush();
    }
    sendLive(cards, payload, self) { return this._post(cards, payload, { live: true, self: !!self }); }
    async flush() {
      if (this.flushing) return; this.flushing = true;
      try {
        while (this.outbox.length) {
          const o = this.outbox[0];
          try { await this.net.send(o.boxes, o.env, o.days); }
          catch (e) { this.setOnline(false); break; }
          this.outbox.shift(); this.save('outbox'); this.setOnline(true);
          if (o.mid) this._status(o.mid, 'sent');
        }
      } finally { this.flushing = false; }
    }
    _status(key, st) { const m = this.msgs.get(key); if (m && m.status !== st) { m.status = st; this.putMsg(m); this.emit('msg', m); } }
    setOnline(v) { if (this.online !== v) { this.online = v; this.emit('online', v); } }
    retry(key) { const m = this.msgs.get(key); if (m && m.status === 'failed') { m.status = 'sending'; this.putMsg(m); this.flush(); } }

    _ctx(ch) { return ch.kind === 'dm' ? { d: ch.peer } : { g: ch.state.gid }; }
    async send(chatId, f) {
      const ch = this.chats[chatId]; if (!ch) throw new Error('Chat fehlt');
      if (ch.left) throw new Error('Du bist nicht mehr in dieser Gruppe.');
      if (ch.kind === 'dm') { const c = this.contacts[ch.peer]; if (c && c.status === 'blocked') throw new Error('Kontakt ist blockiert.'); }
      const id = KC.rid(12), ts = now();
      const ttl = ch.kind === 'dm' ? ch.ttl : ch.state.ttl;
      const body = {};
      for (const k of ['text', 'file', 'reply', 'poll', 'fwd', 'ch', 'sticker']) if (f[k] != null && f[k] !== '') body[k] = f[k];
      if (body.text) body.text = String(body.text).slice(0, 8000);
      const m = Object.assign({ id, chat: chatId, from: this.id, ts, status: 'sending', reactions: {} }, body);
      if (ttl) m.exp = ts + ttl * 1000;
      this.putMsg(m);
      this._touch(ch, m, true);
      this.emit('msg', m);
      const p = Object.assign({ t: 'msg', id, ts }, this._ctx(ch), body);
      if (m.exp) p.exp = m.exp;
      try { await this._post(this.members(ch), p, { mid: chatId + '|' + id }); } catch (e) { m.status = 'failed'; this.putMsg(m); this.emit('msg', m); throw e; }
      return m;
    }
    _touch(ch, m, mine) {
      ch.lastTs = m.ts;
      ch.lastText = this.preview(m);
      ch.lastFrom = m.from;
      if (!mine) {
        const isActive = this.activeChat === ch.id && this.visible && (!ch.state || ch.kind !== 'server' || (this.activeCh || null) === (m.ch || null));
        if (!isActive) {
          ch.unread = (ch.unread || 0) + 1;
          if (m.ch) { ch.unreadCh = ch.unreadCh || {}; ch.unreadCh[m.ch] = (ch.unreadCh[m.ch] || 0) + 1; }
        }
      }
      this.save('chats'); this.emit('chats');
    }
    preview(m) {
      if (m.deleted) return 'Nachricht gelöscht';
      if (m.poll) return 'Umfrage: ' + m.poll.q;
      if (m.sticker) return 'Sticker';
      if (m.file) return ({ image: 'Foto', video: 'Video', voice: 'Sprachnachricht', audio: 'Audio' }[m.file.kind] || 'Datei') + (m.text ? ': ' + m.text : '');
      return (m.text || '').replace(/```|\*\*|__|~~|\|\||`/g, '').replace(/\s+/g, ' ').slice(0, 120);
    }
    async sendFile(chatId, bytes, meta, extra = {}, onProgress) {
      if (bytes.length > 50 * 1024 * 1024) throw new Error('Dateien dürfen höchstens 50 MB groß sein.');
      const enc = await KC.encryptBytes(bytes);
      const url = await this.net.upload(enc.data, onProgress);
      const file = Object.assign({ u: url, k: enc.key, iv: enc.iv, z: bytes.length }, meta);
      const m = await this.send(chatId, Object.assign({}, extra, { file }));
      this.store.put('files', m.chat + '|' + m.id, KC.b64(bytes)).catch(() => {});
      return m;
    }
    async loadFile(m, onProgress) {
      const key = m.chat + '|' + m.id;
      const cached = await this.store.get('files', key).catch(() => null);
      if (cached) return KC.ub64(cached);
      const data = await this.net.download(m.file.u, onProgress);
      const plain = await KC.decryptBytes(data, m.file.k, m.file.iv);
      if (plain.length < 30 * 1024 * 1024) this.store.put('files', key, KC.b64(plain)).catch(() => {});
      return plain;
    }
    async action(chatId, msgId, p) {
      const ch = this.chats[chatId]; if (!ch) return;
      const full = Object.assign({}, p, { id: msgId }, this._ctx(ch));
      this._apply(chatId, this.id, full);
      await this._post(this.members(ch), full);
    }
    react(chatId, id, e) {
      const m = this.msgs.get(chatId + '|' + id); if (!m) return;
      const on = !((m.reactions || {})[e] || []).includes(this.id);
      return this.action(chatId, id, { t: 'react', e, on });
    }
    edit(chatId, id, text) { return this.action(chatId, id, { t: 'edit', text: String(text).slice(0, 8000) }); }
    remove(chatId, id) { return this.action(chatId, id, { t: 'del' }); }
    deleteForMe(chatId, id) { this.delMsg(chatId + '|' + id); this.emit('msgs', chatId); }
    pin(chatId, id, on) { return this.action(chatId, id, { t: 'pin', on }); }
    vote(chatId, id, o) {
      const m = this.msgs.get(chatId + '|' + id); if (!m || !m.poll) return;
      const on = !((m.votes || {})[o] || []).includes(this.id);
      return this.action(chatId, id, { t: 'vote', o, on });
    }
    async setTtl(chatId, secs) {
      const ch = this.chats[chatId]; if (!ch) return;
      if (ch.kind === 'dm') { ch.ttl = secs; this.save('chats'); this.emit('chats'); await this._post(this.members(ch), { t: 'ttl', s: secs }); }
      else await this.updateGroup(chatId, (s) => { s.ttl = secs; });
    }
    typing(chatId, chId) {
      if (!this.settings.typing) return;
      const ch = this.chats[chatId]; if (!ch) return;
      const k = chatId + (chId || '');
      if (this._typingAt && this._typingAt[k] && now() - this._typingAt[k] < 3000) return;
      (this._typingAt = this._typingAt || {})[k] = now();
      const p = Object.assign({ t: 'typing', ch: chId || undefined }, this._ctx(ch));
      this.sendLive(this.members(ch), p);
    }
    presence() {
      if (!this.settings.online || !this.visible || !this.me) return;
      const cards = this.friendCards();
      if (cards.length) this.sendLive(cards, { t: 'on' });
    }
    typers(chatId, chId) {
      const t = this.typingMap[chatId + (chId || '')] || {};
      return Object.keys(t).filter((id) => now() - t[id] < 5000);
    }
    sweep() {
      const t = now(); const touched = new Set();
      for (const [k, m] of this.msgs) if (m.exp && m.exp < t) { this.delMsg(k); touched.add(m.chat); }
      for (const c of touched) this.emit('msgs', c);
    }
    search(q, chatId) {
      q = String(q || '').toLowerCase().trim(); if (!q) return [];
      const out = [];
      for (const m of this.msgs.values()) {
        if (chatId && m.chat !== chatId) continue;
        if (m.deleted) continue;
        const hay = ((m.text || '') + ' ' + ((m.file && m.file.n) || '') + ' ' + ((m.poll && m.poll.q) || '')).toLowerCase();
        if (hay.includes(q)) out.push(m);
      }
      return out.sort((a, b) => b.ts - a.ts).slice(0, 200);
    }

    // ---------- Gruppen & Server ----------
    async createGroup(name, memberIds, kind = 'group') {
      const gid = KC.rid(12);
      const members = { [this.id]: this.card() };
      for (const id of memberIds) { const c = this.contacts[id]; if (c && c.status === 'friend') members[id] = c.card; }
      const state = {
        gid, kind, name: String(name).slice(0, 60), color: COLORS[KC.rand(1)[0] % COLORS.length], desc: '',
        owner: this.id, admins: [this.id], members, v: 1, ttl: 0, created: now(),
        channels: kind === 'server' ? [
          { id: 'allgemein', name: 'allgemein', type: 'text', cat: 'Textkanäle' },
          { id: 'zocken', name: 'zocken', type: 'text', cat: 'Textkanäle' },
          { id: 'lounge', name: 'Lounge', type: 'voice', cat: 'Sprachkanäle' },
        ] : [],
        roles: [], memberRoles: {}, bans: [], invites: {},
      };
      const key = 'g:' + gid;
      this.chats[key] = { id: key, kind, state, unread: 0, unreadCh: {}, created: now(), reads: {} };
      this.save('chats'); this.emit('chats');
      await this._post(Object.values(members), { t: 'gstate', s: state });
      return this.chats[key];
    }
    async updateGroup(chatId, fn, extraTo = []) {
      const ch = this.chats[chatId];
      if (!ch || !ch.state) return;
      if (!this.isAdmin(ch, this.id)) throw new Error('Nur Admins dürfen das.');
      const before = Object.values(ch.state.members);
      const s = clone(ch.state);
      fn(s);
      if (s.members[this.id]) s.members[this.id] = this.card();
      this._freshMembers(s, ch.state);
      s.v = ch.state.v + 1;
      s.admins = (s.admins || []).filter((a) => s.members[a]);
      if (!s.admins.includes(s.owner) && s.members[s.owner]) s.admins.unshift(s.owner);
      ch.state = s;
      this.save('chats'); this.emit('chats'); this.emit('group', chatId);
      const to = new Map(); for (const c of before.concat(Object.values(s.members), extraTo)) to.set(c.id, c);
      await this._post(Array.from(to.values()), { t: 'gstate', s });
    }
    addMembers(chatId, ids) { return this.updateGroup(chatId, (s) => { for (const id of ids) { const c = this.contacts[id]; if (c && !s.bans.includes(id)) s.members[id] = c.card; } }); }
    kick(chatId, id, ban) { return this.updateGroup(chatId, (s) => { if (id === s.owner) return; delete s.members[id]; s.admins = s.admins.filter((a) => a !== id); if (ban && !s.bans.includes(id)) s.bans.push(id); }); }
    unban(chatId, id) { return this.updateGroup(chatId, (s) => { s.bans = s.bans.filter((b) => b !== id); }); }
    setAdmin(chatId, id, on) { return this.updateGroup(chatId, (s) => { s.admins = s.admins.filter((a) => a !== id); if (on) s.admins.push(id); }); }
    addChannel(chatId, name, type, cat) {
      const id = (String(name).toLowerCase().replace(/[^a-z0-9äöüß-]+/g, '-').replace(/^-+|-+$/g, '') || 'kanal') + '-' + KC.rid(2);
      return this.updateGroup(chatId, (s) => { s.channels.push({ id, name: String(name).slice(0, 40), type: type === 'voice' ? 'voice' : 'text', cat: cat || (type === 'voice' ? 'Sprachkanäle' : 'Textkanäle') }); });
    }
    renameChannel(chatId, chId, name) { return this.updateGroup(chatId, (s) => { const c = s.channels.find((x) => x.id === chId); if (c) c.name = String(name).slice(0, 40); }); }
    removeChannel(chatId, chId) { return this.updateGroup(chatId, (s) => { s.channels = s.channels.filter((x) => x.id !== chId); }); }
    addRole(chatId, name, color) { return this.updateGroup(chatId, (s) => { s.roles.push({ id: KC.rid(4), name: String(name).slice(0, 30), color: color || COLORS[0] }); }); }
    removeRole(chatId, rid) { return this.updateGroup(chatId, (s) => { s.roles = s.roles.filter((r) => r.id !== rid); for (const k in s.memberRoles) s.memberRoles[k] = s.memberRoles[k].filter((r) => r !== rid); }); }
    toggleRole(chatId, uid, rid) { return this.updateGroup(chatId, (s) => { const l = s.memberRoles[uid] || []; s.memberRoles[uid] = l.includes(rid) ? l.filter((r) => r !== rid) : l.concat(rid); }); }
    roleOf(ch, uid) { if (!ch || !ch.state) return null; const ids = (ch.state.memberRoles || {})[uid] || []; return ch.state.roles.find((r) => ids.includes(r.id)) || null; }
    async makeInvite(chatId, hours) {
      const ch = this.chats[chatId];
      const t = KC.rid(8), x = hours ? now() + hours * 3600000 : 0;
      await this.updateGroup(chatId, (s) => {
        for (const k in s.invites) if (s.invites[k].x && s.invites[k].x < now()) delete s.invites[k];
        s.invites[t] = { x, by: this.id };
      });
      const data = { g: ch.state.gid, n: ch.state.name, k: ch.state.kind, t, x, c: this.card() };
      return WEB + '#join=J1' + KC.b64(KC.te.encode(JSON.stringify(data)));
    }
    parseInvite(text) {
      const m = String(text || '').match(/J1([A-Za-z0-9_-]{40,})/); if (!m) return null;
      try { const d = JSON.parse(KC.td.decode(KC.ub64(m[1]))); if (d.g && d.t && d.c && d.c.e) return d; } catch (e) {}
      return null;
    }
    async joinByInvite(text) {
      const d = this.parseInvite(text);
      if (!d) throw new Error('Der Einladungslink ist ungültig.');
      if (d.x && d.x < now()) throw new Error('Der Einladungslink ist abgelaufen.');
      if (this.chats['g:' + d.g] && !this.chats['g:' + d.g].left) throw new Error('Du bist schon drin.');
      this.pendingJoins[d.g] = { at: now(), n: d.n, by: d.c.id }; this.save('pendingJoins'); this.syncSelf();
      await this._post([d.c], { t: 'join', g: d.g, n: d.n, tok: d.t, p: this.profileLite() });
      this.emit('chats');
      return d;
    }
    async leaveGroup(chatId) {
      const ch = this.chats[chatId]; if (!ch || !ch.state) return;
      if (ch.state.owner === this.id) {
        const others = Object.keys(ch.state.members).filter((i) => i !== this.id);
        const heir = ch.state.admins.find((a) => a !== this.id) || others[0];
        if (heir) await this.updateGroup(chatId, (s) => { s.owner = heir; if (!s.admins.includes(heir)) s.admins.push(heir); delete s.members[this.id]; });
      } else {
        await this._post(this.members(ch), { t: 'gleave', g: ch.state.gid });
      }
      ch.left = true; this.save('chats'); this.emit('chats');
    }
    async editGroupInfo(chatId, info) { return this.updateGroup(chatId, (s) => { for (const k of ['name', 'desc', 'color', 'icon']) if (info[k] != null) s[k] = info[k]; }); }

    // ---------- Empfangen ----------
    async sync() {
      if (!this.me) return;
      if (this.syncing) { this.syncAgain = true; return; }
      this.syncing = true;
      try {
        do {
          this.syncAgain = false;
          const rows = await this.net.fetchMail();
          let max = 0;
          for (const r of rows) { max = Math.max(max, r.id); await this._in(r.data, false); }
          if (max) await this.net.ack(max);
          if (rows.length >= 300) this.syncAgain = true;
        } while (this.syncAgain);
        this.setOnline(true);
      } catch (e) { this.setOnline(false); }
      finally { this.syncing = false; }
    }
    _lookup(id) {
      const c = this.contacts[id]; if (c) return c.card.s;
      const m = this.memberCard(id); return m ? m.s : null;
    }
    _isMember(gid, id) { const ch = this.chats['g:' + gid]; return !!(ch && ch.state.members[id]); }
    async _in(env, live) {
      let r;
      try { r = await KC.open(this.me, env, (id) => this._lookup(id)); } catch (e) { return; }
      const from = r.from, p = r.payload;
      if (!p || typeof p.t !== 'string') return;
      const mine = from === this.id;
      if (mine && !SELF.has(p.t)) return;
      const c = this.contacts[from];
      if (c && c.status === 'blocked') return;
      if (!live) {
        const key = KC.b64(await KC.sha256(env)).slice(0, 16);
        if (this.seenSet.has(key)) return;
        this.seenSet.add(key); this.seen.push(key);
        if (this.seen.length > 4000) { const drop = this.seen.splice(0, 1000); for (const d of drop) this.seenSet.delete(d); }
        this.save('seen');
      }
      // signierte Visitenkarte aktualisiert Briefkasten/Name
      if (r.card && mine) await this._adoptMyCard(r.card);
      else if (r.card) {
        if (c && newer(r.card, c.card) && JSON.stringify(c.card) !== JSON.stringify(r.card)) { c.card = r.card; this.save('contacts'); }
        for (const ch of Object.values(this.chats)) if (ch.state && ch.state.members[from]) { const old = ch.state.members[from]; if (newer(r.card, old) && JSON.stringify(old) !== JSON.stringify(r.card)) { ch.state.members[from] = r.card; this.save('chats'); } }
      }
      const H = this['_h_' + p.t.replace(/-/g, '_')];
      if (!H) return;
      try { await H.call(this, from, p, r, live); } catch (e) { console.error('handle', p.t, e); }
    }
    _chatFor(from, p) {
      if (p.g) { const ch = this.chats['g:' + p.g]; return ch && !ch.left && (from === this.id || ch.state.members[from]) ? ch : null; }
      if (from === this.id) return p.d && p.d !== this.id ? this.ensureDm(p.d) : null;
      const c = this.contacts[from];
      if (!c || c.status === 'blocked' || c.status === 'removed') return null;
      return this.ensureDm(from);
    }

    async _h_hello(from, p, r) {
      const c = this.contacts[from];
      if (c && (c.status === 'pending-out' || c.status === 'friend')) {
        const was = c.status;
        if (c.status !== 'friend') c.upd = now();
        c.status = 'friend'; c.profile = p.p; c.since = c.since || now();
        this.save('contacts'); this.ensureDm(from); this.emit('contacts');
        await this._post([c.card], { t: 'hello-ok', p: this.profileLite() });
        if (was === 'pending-out') this.emit('notify', { kind: 'friend', id: from, title: this.contactName(from), body: 'ist jetzt dein Freund.' });
        return;
      }
      if (!r.card) return;
      this.contacts[from] = { card: r.card, status: 'pending-in', profile: p.p, added: now(), upd: now() };
      this.save('contacts'); this.emit('contacts');
      this.emit('notify', { kind: 'request', id: from, title: 'Freundschaftsanfrage', body: ((p.p && p.p.name) || r.card.n || 'Jemand') + ' möchte dich hinzufügen.' });
    }
    async _h_hello_ok(from, p) {
      const c = this.contacts[from]; if (!c) return;
      const was = c.status;
      if (c.status === 'pending-out') { c.status = 'friend'; c.since = now(); c.upd = now(); }
      c.profile = p.p; this.save('contacts'); this.emit('contacts');
      if (c.status === 'friend') this.ensureDm(from);
      if (was === 'pending-out') this.emit('notify', { kind: 'friend', id: from, title: this.contactName(from), body: 'hat deine Anfrage angenommen.' });
    }
    async _h_prof(from, p) { const c = this.contacts[from]; if (!c) return; c.profile = p.p; this.save('contacts'); this.emit('contacts'); }
    async _h_msg(from, p) {
      const ch = this._chatFor(from, p); if (!ch) return;
      if (!p.id) return;
      const key = ch.id + '|' + p.id;
      if (this.msgs.has(key)) return;
      const ts = Math.min(Number(p.ts) || now(), now() + 60000);
      const m = { id: p.id, chat: ch.id, from, ts, reactions: {}, rcv: now() };
      for (const k of ['text', 'file', 'reply', 'poll', 'fwd', 'ch', 'sticker', 'exp']) if (p[k] != null) m[k] = p[k];
      if (m.exp && m.exp < now()) return;
      if (from === this.id) { m.status = 'sent'; this.putMsg(m); this._touch(ch, m, true); this.emit('msg', m); return; }
      this.putMsg(m);
      this._touch(ch, m, false);
      this.emit('msg', m);
      const mentioned = !!(m.text && this.profile.name && new RegExp('@' + this.profile.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(m.text)) || /@(alle|everyone)\b/i.test(m.text || '');
      if (mentioned) { ch.mention = true; this.save('chats'); }
      const active = this.activeChat === ch.id && this.visible;
      if (!active && (!ch.muted || mentioned) && this.settings.notify) {
        const title = ch.kind === 'dm' ? this.contactName(from) : ch.state.name + (m.ch ? ' #' + ((ch.state.channels.find((x) => x.id === m.ch) || {}).name || '') : '');
        this.emit('notify', { kind: 'msg', chat: ch.id, ch: m.ch, title, body: (ch.kind === 'dm' ? '' : this.contactName(from) + ': ') + this.preview(m) });
      }
      if (active) this.markRead(ch.id);
    }
    _apply(chatId, from, p) {
      const m = this.msgs.get(chatId + '|' + p.id); if (!m) return;
      const ch = this.chats[chatId];
      const own = m.from === from;
      if (p.t === 'react') {
        const e = String(p.e || '').slice(0, 16); if (!e) return;
        m.reactions = m.reactions || {};
        const l = (m.reactions[e] || []).filter((x) => x !== from);
        if (p.on) l.push(from);
        if (l.length) m.reactions[e] = l; else delete m.reactions[e];
      } else if (p.t === 'edit') { if (!own || m.deleted) return; m.text = p.text; m.edited = now(); }
      else if (p.t === 'del') {
        if (!own && !(ch && this.isAdmin(ch, from))) return;
        m.deleted = true; delete m.text; delete m.file; delete m.poll; delete m.sticker; m.reactions = {};
        this.store.del('files', chatId + '|' + p.id).catch(() => {});
      } else if (p.t === 'pin') { m.pinned = !!p.on; }
      else if (p.t === 'vote') {
        if (!m.poll) return;
        const o = Number(p.o); if (!(o >= 0 && o < m.poll.opts.length)) return;
        m.votes = m.votes || {};
        if (!m.poll.multi && p.on) for (const k in m.votes) m.votes[k] = m.votes[k].filter((x) => x !== from);
        const l = (m.votes[o] || []).filter((x) => x !== from);
        if (p.on) l.push(from);
        m.votes[o] = l;
      } else return;
      this.putMsg(m); this.emit('msg', m);
      if (ch && ch.lastTs === m.ts) { ch.lastText = this.preview(m); this.save('chats'); this.emit('chats'); }
    }
    async _h_react(from, p) { const ch = this._chatFor(from, p); if (ch) this._apply(ch.id, from, p); }
    async _h_edit(from, p) { return this._h_react(from, p); }
    async _h_del(from, p) { return this._h_react(from, p); }
    async _h_pin(from, p) { return this._h_react(from, p); }
    async _h_vote(from, p) { return this._h_react(from, p); }
    async _h_read(from, p) {
      const ch = this._chatFor(from, p); if (!ch) return;
      if (from === this.id) {
        // auf einem anderen Gerät gelesen
        ch.readSent = Math.max(ch.readSent || 0, Number(p.ts) || 0);
        const unread = this.chatMsgs(ch.id).filter((m) => m.from !== this.id && m.ts > ch.readSent).length;
        ch.unread = unread; if (!unread) { ch.unreadCh = {}; ch.mention = false; }
        this.save('chats'); this.emit('chats'); return;
      }
      ch.reads = ch.reads || {};
      ch.reads[from] = Math.max(ch.reads[from] || 0, Number(p.ts) || 0);
      this.save('chats'); this.emit('reads', ch.id);
    }
    async _h_ttl(from, p) {
      const ch = this._chatFor(from, p); if (!ch || ch.kind !== 'dm') return;
      ch.ttl = Math.max(0, Number(p.s) || 0); this.save('chats'); this.emit('chats');
      if (from === this.id) return;
      this._sys(ch, from, p.s ? 'hat selbstlöschende Nachrichten eingeschaltet (' + Kreis.ttlLabel(p.s) + ').' : 'hat selbstlöschende Nachrichten ausgeschaltet.');
    }
    _sys(ch, from, text) {
      const m = { id: KC.rid(8), chat: ch.id, from, ts: now(), sys: true, text, reactions: {} };
      this.putMsg(m); this.emit('msg', m);
    }
    _validState(s) {
      return s && typeof s.gid === 'string' && s.members && typeof s.members === 'object' && typeof s.owner === 'string' && Array.isArray(s.admins) && Array.isArray(s.channels) && Number.isFinite(s.v);
    }
    async _h_gstate(from, p) {
      const s = p.s; if (!this._validState(s)) return;
      const key = 'g:' + s.gid;
      const ch = this.chats[key];
      const adm = (st, uid) => uid === this.id || st.owner === uid || (st.admins || []).includes(uid);
      for (const id in s.members) { const c = s.members[id]; if (!c || c.id !== id || !c.e || !c.b || !c.s) return; }
      if (!ch || ch.left) {
        if (!s.members[this.id] || !adm(s, from)) return;
        const fr = this.contacts[from] && this.contacts[from].status === 'friend';
        if (from !== this.id && !fr && !this.pendingJoins[s.gid]) return;
        if (ch && ch.left && s.v <= ch.state.v) return;
        this._freshMembers(s, ch && ch.state);
        this.chats[key] = Object.assign(ch || { id: key, unread: 0, unreadCh: {}, created: now(), reads: {} }, { kind: s.kind || 'group', state: s, left: false });
        delete this.pendingJoins[s.gid]; this.save('pendingJoins');
        this.save('chats'); this.emit('chats'); this.emit('group', key);
        if (from !== this.id) this.emit('notify', { kind: 'group', chat: key, title: s.name, body: this.contactName(from) + ' hat dich hinzugefügt.' });
        return;
      }
      if (s.v <= ch.state.v) return;
      if (!adm(ch.state, from)) return;
      if (s.owner !== ch.state.owner && from !== ch.state.owner) return;
      this._freshMembers(s, ch.state);
      ch.state = s;
      if (!s.members[this.id]) { ch.left = true; this._sys(ch, from, 'hat dich aus der Gruppe entfernt.'); }
      this.save('chats'); this.emit('chats'); this.emit('group', key);
    }
    async _h_gleave(from, p) {
      const ch = this.chats['g:' + p.g]; if (!ch) return;
      if (from === this.id) { ch.left = true; this.save('chats'); this.emit('chats'); return; }
      if (!ch.state.members[from]) return;
      this._sys(ch, from, 'hat die Gruppe verlassen.');
      if (this.isAdmin(ch, this.id)) await this.updateGroup(ch.id, (s) => { delete s.members[from]; });
      else { delete ch.state.members[from]; this.save('chats'); this.emit('chats'); }
    }
    async _h_join(from, p, r) {
      if (from === this.id) { if (!this.chats['g:' + p.g]) { this.pendingJoins[p.g] = { at: now(), n: p.n || '' }; this.save('pendingJoins'); this.emit('chats'); } return; }
      const ch = this.chats['g:' + p.g]; if (!ch || ch.left || !this.isAdmin(ch, this.id) || !r.card) return;
      const inv = ch.state.invites[p.tok];
      if (!inv || (inv.x && inv.x < now()) || ch.state.bans.includes(from)) return;
      if (ch.state.members[from]) { await this._post([r.card], { t: 'gstate', s: ch.state }); return; }
      await this.updateGroup(ch.id, (s) => { s.members[from] = r.card; });
      this._sys(ch, from, 'ist über einen Einladungslink beigetreten.');
    }
    async _h_typing(from, p) {
      const ch = this._chatFor(from, p); if (!ch) return;
      const k = ch.id + (p.ch || '');
      (this.typingMap[k] = this.typingMap[k] || {})[from] = now();
      this.emit('typing', ch.id, p.ch || null);
      setTimeout(() => this.emit('typing', ch.id, p.ch || null), 5200);
    }
    async _h_on(from) { const c = this.contacts[from]; if (!c || c.status !== 'friend') return; const was = this.isOnline(from); c.seenAt = now(); if (!was) this.emit('presence', from); }
    // Anrufe: Signalisierung geht an call.js
    async _h_call(from, p) {
      if (from === this.id) { this.emit('callself', p); return; }
      const ch = p.g ? this.chats['g:' + p.g] : this.chats['d:' + from];
      if (p.g && (!ch || !ch.state.members[from])) return;
      if (!p.g && (!this.contacts[from] || this.contacts[from].status !== 'friend')) return;
      this.emit('call', from, p);
    }

    // ---------- Mehrere Geräte & Konto ----------
    _freshMembers(s, old) {
      for (const id in s.members) {
        const known = id === this.id ? this.card() : (this.contacts[id] && this.contacts[id].card) || (old && old.members[id]);
        if (known && known.id === id && known.e && known.b && known.s && ((known.t || 0) > (s.members[id].t || 0))) s.members[id] = known;
      }
    }
    async _adoptMyCard(card) {
      if (!card || card.id !== this.id || !card.bs || !((card.t || 0) > (this.me.ct || 0))) return;
      this.me.bs = card.bs.slice(); this.me.ct = card.t; this.me.csig = card.sg || null;
      if (!this.me.bs.includes(this.me.box)) this.me.bs.push(this.me.box);
      await this.saveMe();
      this.emit('account');
    }
    async _signedCard() { const c = this.card(); delete c.sg; await KC.signCard(this.me, c); this.me.csig = c.sg; return c; }
    async saveMe() { const raw = {}; for (const k in this.me) if (k[0] !== '_') raw[k] = this.me[k]; this.meRaw = raw; await this.store.put('kv', 'me', raw); }
    async broadcastCard() {
      const m = new Map();
      for (const c of Object.values(this.contacts)) if (c.status !== 'removed' && c.status !== 'blocked') m.set(c.card.id, c.card);
      for (const ch of Object.values(this.chats)) if (ch.state && !ch.left) for (const c of Object.values(ch.state.members)) if (c.id !== this.id) m.set(c.id, c);
      if (m.size) await this._post(Array.from(m.values()), { t: 'card' }, { self: false });
    }
    async _h_card() { /* die neue Visitenkarte wurde schon in _in übernommen */ }
    syncSelf() {
      if (!this.me) return;
      clearTimeout(this._syncT);
      this._syncT = setTimeout(async () => {
        if (this.otherBoxes().length) await this._post([], { t: 'state', s: this.myState(), pr: this.profile }).catch(() => {});
        if (this.acct) await this.accountUpdate().catch(() => {});
      }, 2500);
    }
    myState() {
      const contacts = {};
      for (const [id, c] of Object.entries(this.contacts)) {
        const x = Object.assign({}, c); delete x.seenAt;
        if (x.profile) { x.profile = Object.assign({}, x.profile); delete x.profile.avatar; }
        contacts[id] = x;
      }
      const groups = {}, flags = {};
      for (const ch of Object.values(this.chats)) {
        if (ch.state) groups[ch.id] = { s: ch.state, left: !!ch.left };
        if (ch.fupd) flags[ch.id] = { muted: !!ch.muted, pinned: !!ch.pinned, archived: !!ch.archived, upd: ch.fupd };
      }
      return { contacts, groups, flags, pj: Object.assign({}, this.pendingJoins) };
    }
    mergeState(a, b) {
      const out = { contacts: {}, groups: {}, flags: {}, pj: {} };
      for (const src of [a || {}, b || {}]) {
        for (const [id, c] of Object.entries(src.contacts || {})) { const o = out.contacts[id]; if (!o || (c.upd || 0) > (o.upd || 0)) out.contacts[id] = c; }
        for (const [id, g] of Object.entries(src.groups || {})) { const o = out.groups[id]; if (!o || g.s.v > o.s.v || (g.s.v === o.s.v && g.left && !o.left)) out.groups[id] = g; }
        for (const [id, f] of Object.entries(src.flags || {})) { const o = out.flags[id]; if (!o || (f.upd || 0) > (o.upd || 0)) out.flags[id] = f; }
        Object.assign(out.pj, src.pj || {});
      }
      for (const id in out.groups) delete out.pj[id.slice(2)];
      return out;
    }
    applyState(st) {
      let changed = false;
      for (const [id, c] of Object.entries(st.contacts || {})) {
        if (id === this.id || !c || !c.card) continue;
        const l = this.contacts[id];
        if (!l || (c.upd || 0) > (l.upd || 0)) {
          const n = Object.assign({}, c);
          if (l) { n.seenAt = l.seenAt; if (l.profile && l.profile.avatar) n.profile = Object.assign({}, c.profile || {}, { avatar: l.profile.avatar }); if (newer(l.card, c.card)) n.card = l.card; }
          this.contacts[id] = n;
          if (n.status === 'friend') this.ensureDm(id);
          changed = true;
        } else if (newer(c.card, l.card) && JSON.stringify(c.card) !== JSON.stringify(l.card)) { l.card = c.card; changed = true; }
      }
      for (const [id, g] of Object.entries(st.groups || {})) {
        if (!g || !this._validState(g.s)) continue;
        const l = this.chats[id];
        if (!l) { this.chats[id] = { id, kind: g.s.kind || 'group', state: g.s, left: !!g.left, unread: 0, unreadCh: {}, created: now(), reads: {} }; changed = true; }
        else if (l.state && (g.s.v > l.state.v || (g.s.v === l.state.v && g.left && !l.left))) { this._freshMembers(g.s, l.state); l.state = g.s; l.left = !!g.left; changed = true; }
      }
      for (const [id, f] of Object.entries(st.flags || {})) { const l = this.chats[id]; if (l && (f.upd || 0) > (l.fupd || 0)) { l.muted = f.muted; l.pinned = f.pinned; l.archived = f.archived; l.fupd = f.upd; changed = true; } }
      for (const [g, d] of Object.entries(st.pj || {})) if (!this.pendingJoins[g] && !this.chats['g:' + g]) { this.pendingJoins[g] = d; this.save('pendingJoins'); changed = true; }
      if (changed) { this.save('contacts'); this.save('chats'); this.emit('contacts'); this.emit('chats'); }
      return changed;
    }
    async _h_state(from, p) {
      if (from !== this.id || !p.s) return;
      this.applyState(p.s);
      if (p.pr && (p.pr.upd || 0) > (this.profile.upd || 0)) { this.profile = p.pr; this.save('profile'); this.emit('profile'); }
    }
    async _sendSnapshot() {
      let msgs = Array.from(this.msgs.values()).filter((m) => !m.exp || m.exp > now()).sort((a, b) => a.ts - b.ts).slice(-5000);
      const chats = {};
      for (const [id, c] of Object.entries(this.chats)) { const x = Object.assign({}, c); delete x.drafts; chats[id] = x; }
      let bytes;
      for (;;) {
        bytes = KC.te.encode(JSON.stringify({ v: 1, chats, msgs, state: this.myState(), profile: this.profile }));
        if (bytes.length < 40 * 1048576 || msgs.length < 100) break;
        msgs = msgs.slice(Math.floor(msgs.length / 2));
      }
      const enc = await KC.encryptBytes(bytes);
      const url = await this.net.upload(enc.data);
      await this._post([], { t: 'snap', f: { u: url, k: enc.key, iv: enc.iv } });
    }
    async _h_snap(from, p) {
      if (from !== this.id || !p.f) return;
      const data = JSON.parse(KC.td.decode(await KC.decryptBytes(await this.net.download(p.f.u), p.f.k, p.f.iv)));
      this.applyState(data.state || {});
      if (data.profile && (data.profile.upd || 0) > (this.profile.upd || 0)) { this.profile = data.profile; this.save('profile'); this.emit('profile'); }
      for (const [id, c] of Object.entries(data.chats || {})) {
        const l = this.chats[id];
        if (!l) { const x = Object.assign({}, c, { unread: 0, unreadCh: {}, mention: false }); this.chats[id] = x; continue; }
        if ((c.lastTs || 0) > (l.lastTs || 0)) { l.lastTs = c.lastTs; l.lastText = c.lastText; l.lastFrom = c.lastFrom; }
        if (c.ttl && !l.ttl) l.ttl = c.ttl;
        l.reads = Object.assign({}, c.reads || {}, l.reads || {});
        if ((c.readSent || 0) > (l.readSent || 0)) l.readSent = c.readSent;
      }
      let n = 0;
      for (const m of data.msgs || []) {
        if (!this.chats[m.chat]) continue;
        const k = m.chat + '|' + m.id;
        if (this.msgs.has(k)) continue;
        if (m.status === 'sending' || m.status === 'failed') m.status = 'sent';
        this.putMsg(m); n++;
      }
      this.save('chats'); this.emit('chats'); this.emit('contacts');
      for (const id of Object.keys(this.chats)) this.emit('msgs', id);
      this.emit('synced', n);
    }
    async _h_devhello(from, p) {
      if (from !== this.id || !p.box || p.box === this.me.box) return;
      const bs = this.me.bs && this.me.bs.length ? this.me.bs : [this.me.box];
      if (!bs.includes(p.box)) { this.me.bs = bs.concat(p.box); this.me.ct = now(); await this._signedCard(); await this.saveMe(); }
      this.emit('notify', { kind: 'device', title: 'Neues Gerät angemeldet', body: (p.n || 'Ein Gerät') + ' ist jetzt mit deinem Konto verbunden.' });
      await this._sendSnapshot().catch((e) => console.error('snap', e));
      await this.broadcastCard();
    }

    static normUser(u) { return String(u || '').trim().toLowerCase().replace(/^@/, ''); }
    _keys() { const m = this.me; return { id: m.id, encPub: m.encPub, sigPub: m.sigPub, encPriv: m.encPriv, sigPriv: m.sigPriv }; }
    async createAccount(username, pass) {
      const u = Kreis.normUser(username);
      if (!/^[a-z0-9_.]{3,20}$/.test(u)) throw new Error('Benutzername: 3–20 Zeichen, nur a–z, 0–9, Punkt und Unterstrich.');
      if (String(pass).length < 8) throw new Error('Das Passwort muss mindestens 8 Zeichen haben.');
      if (this.acct) throw new Error('Du hast schon ein Konto.');
      const salt = KC.b64(KC.rand(16));
      const d = await KC.passDerive(pass, salt);
      const before = { bs: this.me.bs, ct: this.me.ct, csig: this.me.csig };
      this.acct = { u, auth: d.auth, enc: d.enc, salt };
      this.me.bs = [this.me.box]; this.me.ct = now();
      const card = await this._signedCard();
      this.profile.upd = this.profile.upd || now();
      const blob = { v: 1, keys: this._keys(), profile: this.profile, devices: [{ b: this.me.box, n: this.deviceName || 'Gerät', at: now() }], state: this.myState(), upd: now() };
      let ok = false;
      try { ok = await this.net.acc('k_register', { p_user: u, p_auth: d.auth, p_salt: salt, p_blob: await KC.encJSON(await KC.aesKey(KC.ub64(d.enc)), blob), p_card: card }); }
      catch (e) { ok = false; this._accErr = e; }
      if (!ok) { this.acct = null; Object.assign(this.me, before); throw new Error(this._accErr ? 'Keine Verbindung zum Server.' : 'Der Benutzername @' + u + ' ist schon vergeben.'); }
      this.devices = blob.devices;
      await this.store.put('kv', 'acct', this.acct); await this.saveMe(); this.save('profile');
      this.emit('account');
      this.broadcastCard().catch(() => {});
      return u;
    }
    async login(username, pass) {
      const u = Kreis.normUser(username);
      const salt = await this.net.acc('k_salt', { p_user: u });
      if (!salt) throw new Error('Den Benutzernamen @' + u + ' gibt es nicht.');
      const d = await KC.passDerive(pass, salt);
      const r = await this.net.acc('k_login', { p_user: u, p_auth: d.auth });
      if (r.locked) throw new Error('Zu viele falsche Versuche. Warte 15 Minuten.');
      if (!r.ok) throw new Error('Falsches Passwort.');
      const blob = await KC.decJSON(await KC.aesKey(KC.ub64(d.enc)), r.blob);
      const secret = KC.b64(KC.rand(32));
      const box = await KC.boxOf(secret);
      const raw = Object.assign({ v: 1, created: now() }, blob.keys, { secret, box, bs: boxesOf(r.card).concat(box), ct: (r.card.t || 0) });
      if (!this.store.key) await this.store.create();
      await this.store.put('kv', 'me', raw);
      await this.store.put('kv', 'profile', blob.profile || { name: u, color: COLORS[0] });
      await this.store.put('kv', 'acct', { u, auth: d.auth, enc: d.enc, salt });
      await this.init();
      this.applyState(blob.state || {});
      await this.accountUpdate((b) => { b.devices = (b.devices || []).filter((x) => x.b !== box).concat({ b: box, n: this.deviceName || 'Gerät', at: now() }); }, true);
      await this._post([], { t: 'devhello', box, n: this.deviceName || 'Gerät' });
      await this.broadcastCard();
      return true;
    }
    async accountUpdate(fn, allowMissing) {
      if (!this.acct) return null;
      const key = await KC.aesKey(KC.ub64(this.acct.enc));
      for (let i = 0; i < 6; i++) {
        const r = await this.net.acc('k_login', { p_user: this.acct.u, p_auth: this.acct.auth });
        if (!r.ok) { if (!r.locked) this.emit('loggedOut', 'pass'); throw new Error(r.locked ? 'Konto vorübergehend gesperrt.' : 'Bitte neu anmelden.'); }
        const blob = await KC.decJSON(key, r.blob);
        blob.devices = blob.devices || [];
        if (fn) fn(blob);
        if (!allowMissing && !blob.devices.some((x) => x.b === this.me.box)) { this.emit('loggedOut', 'removed'); return null; }
        blob.state = this.mergeState(blob.state, this.myState());
        this.applyState(blob.state);
        if (blob.profile && (blob.profile.upd || 0) > (this.profile.upd || 0)) { this.profile = blob.profile; this.save('profile'); this.emit('profile'); }
        else blob.profile = this.profile;
        const bs = blob.devices.map((x) => x.b);
        if (JSON.stringify(bs) !== JSON.stringify(this.me.bs || [])) { this.me.bs = bs; this.me.ct = Math.max(now(), (r.card.t || 0) + 1); }
        const card = await this._signedCard();
        blob.upd = now();
        const res = await this.net.acc('k_update', { p_user: this.acct.u, p_auth: this.acct.auth, p_ver: r.ver, p_blob: await KC.encJSON(key, blob), p_card: card, p_newauth: null, p_newsalt: null });
        if (res.ok) { await this.saveMe(); this.devices = blob.devices; this.emit('account'); return blob; }
        if (!res.conflict) throw new Error('Konto konnte nicht gespeichert werden.');
        await new Promise((ok) => setTimeout(ok, 150 + Math.random() * 400));
      }
      throw new Error('Das Konto ist gerade beschäftigt – versuch es gleich nochmal.');
    }
    async accountRefresh() {
      if (!this.acct) return;
      try {
        const r = await this.net.acc('k_login', { p_user: this.acct.u, p_auth: this.acct.auth });
        if (!r.ok) { if (!r.locked) this.emit('loggedOut', 'pass'); return; }
        const blob = await KC.decJSON(await KC.aesKey(KC.ub64(this.acct.enc)), r.blob);
        this.devices = blob.devices || [];
        if (!this.devices.some((x) => x.b === this.me.box)) { this.emit('loggedOut', 'removed'); return; }
        if (r.card && r.card.id === this.id && (r.card.t || 0) > (this.me.ct || 0) && (await KC.verifyCard(r.card))) {
          this.me.bs = boxesOf(r.card); this.me.ct = r.card.t; this.me.csig = r.card.sg; await this.saveMe();
        }
        this.applyState(blob.state || {});
        if (blob.profile && (blob.profile.upd || 0) > (this.profile.upd || 0)) { this.profile = blob.profile; this.save('profile'); this.emit('profile'); }
        this.emit('account');
      } catch (e) { /* offline – später nochmal */ }
    }
    async removeDevice(box) {
      if (box === this.me.box) return this.logoutHere();
      await this.accountUpdate((b) => { b.devices = b.devices.filter((x) => x.b !== box); });
      await this.broadcastCard();
    }
    async renameDevice(box, name) { await this.accountUpdate((b) => { const d = b.devices.find((x) => x.b === box); if (d) d.n = String(name).slice(0, 40); }); }
    async logoutHere() {
      if (this.acct) {
        await this.accountUpdate((b) => { b.devices = b.devices.filter((x) => x.b !== this.me.box); }, true).catch(() => {});
        await this.broadcastCard().catch(() => {});
      }
      this.stop();
      await this.store.wipe();
    }
    async changePassword(oldPass, newPass) {
      if (!this.acct) throw new Error('Kein Konto.');
      if (String(newPass).length < 8) throw new Error('Das neue Passwort muss mindestens 8 Zeichen haben.');
      const chk = await KC.passDerive(oldPass, this.acct.salt);
      if (chk.auth !== this.acct.auth) throw new Error('Das alte Passwort stimmt nicht.');
      const salt = KC.b64(KC.rand(16));
      const d = await KC.passDerive(newPass, salt);
      const oldKey = await KC.aesKey(KC.ub64(this.acct.enc)), newKey = await KC.aesKey(KC.ub64(d.enc));
      for (let i = 0; i < 5; i++) {
        const r = await this.net.acc('k_login', { p_user: this.acct.u, p_auth: this.acct.auth });
        if (!r.ok) throw new Error('Anmeldung fehlgeschlagen.');
        const blob = await KC.decJSON(oldKey, r.blob);
        blob.upd = now();
        const res = await this.net.acc('k_update', { p_user: this.acct.u, p_auth: this.acct.auth, p_ver: r.ver, p_blob: await KC.encJSON(newKey, blob), p_card: r.card, p_newauth: d.auth, p_newsalt: salt });
        if (res.ok) { this.acct = { u: this.acct.u, auth: d.auth, enc: d.enc, salt }; await this.store.put('kv', 'acct', this.acct); return true; }
        if (!res.conflict) throw new Error('Passwort konnte nicht geändert werden.');
      }
      throw new Error('Bitte gleich nochmal versuchen.');
    }

    // ---------- Backup ----------
    async exportBackup(pass) {
      await this.saveNow();
      const files = await this.store.all('files');
      const data = { v: 1, at: now(), me: this.meRaw, profile: this.profile, contacts: this.contacts, chats: this.chats, settings: this.settings, msgs: Array.from(this.msgs.values()), files: files.slice(0, 200) };
      return JSON.stringify({ kreisBackup: 1, lock: await KC.lockWithPass(pass, data) });
    }
    async importBackup(text, pass) {
      const o = JSON.parse(text);
      if (!o.kreisBackup) throw new Error('Das ist keine Vaultline-Sicherung.');
      let d; try { d = await KC.unlockWithPass(pass, o.lock); } catch (e) { throw new Error('Falsches Passwort.'); }
      if (!this.store.key) await this.store.create();
      await this.store.put('kv', 'me', d.me);
      await this.store.put('kv', 'profile', d.profile);
      await this.store.put('kv', 'contacts', d.contacts);
      await this.store.put('kv', 'chats', d.chats);
      await this.store.put('kv', 'settings', d.settings);
      for (const m of d.msgs) await this.store.put('msgs', m.chat + '|' + m.id, m);
      for (const [k, v] of d.files || []) await this.store.put('files', k, v);
      return this.init();
    }
    static ttlLabel(s) { return s >= 604800 ? Math.round(s / 604800) + ' Woche(n)' : s >= 86400 ? Math.round(s / 86400) + ' Tag(e)' : s >= 3600 ? Math.round(s / 3600) + ' Std.' : Math.round(s / 60) + ' Min.'; }
  }
  Kreis.COLORS = COLORS;
  Kreis.WEB = WEB;

  G.Kreis = Kreis;
  if (typeof module !== 'undefined') module.exports = Kreis;
})(typeof window !== 'undefined' ? window : globalThis);
