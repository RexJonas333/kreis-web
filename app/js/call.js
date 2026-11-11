/* Vaultline – Anrufe & Sprachkanäle. Direkt zwischen den Geräten (WebRTC, DTLS-SRTP verschlüsselt).
 * Die Verbindungsdaten (SDP/ICE) laufen Ende-zu-Ende-verschlüsselt über Vaultline selbst.
 * Gruppen: jeder mit jedem (Mesh) – gut für bis zu ca. 6–8 Personen.
 */
(function (G) {
  'use strict';
  const { ic, esc, $, $$, av, toast, modal, beep } = G.UI;

  class Calls {
    constructor(K, A) {
      this.K = K; this.A = A; this.room = null; this.ring = null; this.vp = {}; this.peerSt = {};
      this.micOff = false; this.deaf = false; this.speaking = new Set(); this.showView = true;
      K.on('call', (from, p) => this.onSignal(from, p).catch((e) => console.error('call', e)));
      // Auf einem anderen eigenen Gerät angenommen/abgelehnt -> hier nicht mehr klingeln
      K.on('callself', (p) => { if (p.k === 'taken' && this.ring && this.ring.cid === p.cid) this.hideRing(); });
      setInterval(() => this.tick(), 10000);
      setInterval(() => { if (this.room) this.updateTiles(); }, 1500);
      addEventListener('keydown', (e) => this.ptt(e, true));
      addEventListener('keyup', (e) => this.ptt(e, false));
      addEventListener('beforeunload', () => { if (this.room) this.leave(true); });
    }
    get me() { return this.K.id; }
    ice() {
      const l = (this.iceCache && this.iceCache.list) || [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
      const t = (this.K.settings.turn || '').trim();
      if (t) { const [urls, username, credential] = t.split('|'); l.push({ urls, username, credential }); }
      return l;
    }
    // Vermittlungs-Server (TURN) für schwierige Netze: kurzlebige Zugangsdaten von unserem Server holen
    async loadIce() {
      if (this.iceCache && Date.now() < this.iceCache.until) return;
      const C = G.KREIS_CFG;
      try {
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 5000);
        const r = await fetch(C.url + '/functions/v1/turn', { method: 'POST', headers: { apikey: C.key, Authorization: 'Bearer ' + C.key }, signal: ctl.signal });
        clearTimeout(to);
        const j = await r.json();
        if (Array.isArray(j.iceServers) && j.iceServers.length) this.iceCache = { list: j.iceServers.concat({ urls: 'stun:stun.l.google.com:19302' }), turn: !!j.turn, until: Date.now() + (j.turn ? 6 * 3600000 : 600000) };
      } catch (e) { /* ohne TURN weiter */ }
    }
    chat(id) { return this.K.chats[id]; }
    cards(chatId) { return this.K.members(this.chat(chatId)); }
    ctx(chatId) { const c = this.chat(chatId); return c && c.kind !== 'dm' ? { g: c.state.gid } : {}; }
    send(chatId, cards, p) { return this.K.sendLive(cards, Object.assign({ t: 'call' }, this.ctx(chatId), p)); }
    sendAll(chatId, p) { return this.send(chatId, this.cards(chatId), p); }
    cardOf(uid) { const c = this.K.contacts[uid]; return c ? c.card : this.K.memberCard(uid); }
    chatIdFor(from, p) { return p.g ? 'g:' + p.g : 'd:' + from; }
    roomTitle() {
      const r = this.room; if (!r) return '';
      const c = this.chat(r.chatId); if (!c) return '';
      if (r.kind === 'voice') { const ch = c.state.channels.find((x) => x.id === r.ch); return (ch ? ch.name : 'Sprachkanal') + ' / ' + c.state.name; }
      return this.K.chatTitle(c);
    }
    voiceMembers(chatId, ch) {
      const key = chatId + '|' + ch, now = Date.now();
      const ids = Object.keys(this.vp[key] || {}).filter((u) => now - this.vp[key][u] < 50000);
      if (this.room && this.room.kind === 'voice' && this.room.chatId === chatId && this.room.ch === ch && !ids.includes(this.me)) ids.unshift(this.me);
      return ids;
    }
    isSpeaking(uid) { return this.speaking.has(uid); }
    peerState(uid) { return uid === this.me ? { mic: !this.micOff } : this.peerSt[uid] || {}; }

    async media(video) {
      const s = this.K.settings;
      const audio = { echoCancellation: s.echo, noiseSuppression: s.noise, autoGainControl: true, deviceId: s.micId ? { ideal: s.micId } : undefined };
      const vid = video ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, deviceId: s.camId ? { ideal: s.camId } : undefined, facingMode: 'user' } : false;
      try { return await navigator.mediaDevices.getUserMedia({ audio, video: vid }); }
      catch (e) {
        if (video) { toast('Kamera nicht verfügbar – nur Ton.'); try { return await navigator.mediaDevices.getUserMedia({ audio }); } catch (e2) {} }
        toast('Kein Zugriff aufs Mikrofon. Du kannst trotzdem zuhören.');
        return new MediaStream();
      }
    }

    // ---------- Raum betreten / verlassen ----------
    async enter(r) {
      const [local] = await Promise.all([this.media(r.video), this.loadIce()]);
      this.room = Object.assign({ peers: new Map(), local, screen: null, started: Date.now() }, r);
      this.room.cam = local.getVideoTracks().length > 0;
      this.applyMic();
      this.watchLevel(this.me, local);
      this.showView = true;
      const room = this.room;
      setTimeout(() => {
        if (this.room !== room || this.micOff || this.K.settings.pushToTalk) return;
        if (!local.getAudioTracks().length) return toast('Kein Mikrofon gefunden – die anderen hören dich nicht.', 6000);
        if ((room.myMax || 0) < 3) toast('Dein Mikrofon nimmt nichts auf. Prüfe unter Einstellungen → Sprache & Video, ob das richtige Mikrofon gewählt ist.', 7000);
      }, 12000);
      this.A.renderAll();
    }
    async start(chatId, video) {
      if (this.room) { if (this.room.chatId === chatId && this.room.kind === 'call') { this.showView = true; this.renderView(); return; } this.leave(); }
      const c = this.chat(chatId); if (!c || c.left) return;
      if (!this.cards(chatId).length) return toast('Hier ist niemand zum Anrufen.');
      const cid = G.KC.rid(8);
      await this.enter({ cid, chatId, video, kind: 'call', caller: this.me });
      this.sendAll(chatId, { k: 'ring', cid, video: !!video });
      this.room.ringing = true;
      const r = this.room;
      this.renderView();
      const again = setInterval(() => { if (this.room !== r || !r.ringing) return clearInterval(again); this.sendAll(chatId, { k: 'ring', cid, video: !!video }); }, 8000);
      setTimeout(() => {
        if (this.room === r && r.peers.size === 0) { this.sendAll(chatId, { k: 'cancel', cid }); toast('Niemand hat abgenommen.'); this.leave(true); }
        if (this.room === r) r.ringing = false;
      }, 45000);
    }
    async joinVoice(chatId, ch) {
      const cid = 'v-' + chatId.slice(2) + '-' + ch;
      if (this.room && this.room.cid === cid) { this.showView = true; this.A.openChat(chatId, (this.chat(chatId).state.channels.find((x) => x.type === 'text') || {}).id); this.renderView(); return; }
      if (this.room) this.leave();
      await this.enter({ cid, chatId, ch, kind: 'voice', video: false });
      this.sendAll(chatId, { k: 'join', cid, ch });
      beep('msg');
      this.A.renderSide();
    }
    leave(silent) {
      const r = this.room; if (!r) return;
      this.room = null;
      this.sendAll(r.chatId, { k: 'leave', cid: r.cid, ch: r.ch });
      for (const p of r.peers.values()) this.dropPeer(p);
      for (const s of [r.local, r.screen]) if (s) s.getTracks().forEach((t) => t.stop());
      const box = $('#call-audio'); if (box) box.innerHTML = '';
      if (r.kind === 'voice') { const key = r.chatId + '|' + r.ch; if (this.vp[key]) delete this.vp[key][this.me]; }
      this.speaking.clear();
      this.A.renderAll();
    }

    // ---------- Verbindungen ----------
    peer(uid) {
      const r = this.room; if (!r || uid === this.me) return null;
      let p = r.peers.get(uid); if (p) return p;
      const pc = new RTCPeerConnection({ iceServers: this.ice(), bundlePolicy: 'max-bundle' });
      p = { uid, pc, polite: this.me > uid, makingOffer: false, ignoreOffer: false, streams: new Map(), audios: new Map(), vol: 1, card: this.cardOf(uid), joined: Date.now(), outIce: [], q: Promise.resolve() };
      r.peers.set(uid, p);
      if (r.ringing) { r.ringing = false; setTimeout(() => this.renderView(), 0); }
      for (const t of r.local.getTracks()) pc.addTrack(t, r.local);
      if (r.screen) for (const t of r.screen.getTracks()) pc.addTrack(t, r.screen);
      // Kandidaten sammeln und gebündelt schicken (weniger Nachrichten = zuverlässiger)
      pc.onicecandidate = (e) => {
        if (e.candidate) p.outIce.push(e.candidate.toJSON());
        clearTimeout(p.iceT);
        const flush = () => { if (!p.outIce.length) return; const cs = p.outIce; p.outIce = []; this.sig(uid, { k: 'ice', cs }); };
        if (!e.candidate) flush(); else p.iceT = setTimeout(flush, 250);
      };
      pc.onnegotiationneeded = async () => {
        try { p.makingOffer = true; await pc.setLocalDescription(); this.sig(uid, { k: 'sdp', d: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }); }
        catch (e) { console.error(e); } finally { p.makingOffer = false; }
      };
      pc.ontrack = (e) => {
        const s = e.streams[0] || new MediaStream([e.track]);
        p.streams.set(s.id, s);
        e.track.onunmute = () => this.updateTiles();
        e.track.onended = () => this.updateTiles();
        s.onremovetrack = () => { if (!s.getTracks().length) p.streams.delete(s.id); this.updateTiles(); };
        if (e.track.kind === 'audio') this.playAudio(p, s);
        this.updateTiles();
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') { try { pc.restartIce(); } catch (e) {} }
        if (pc.connectionState === 'connected') { p.ok = true; for (const a of p.audios.values()) a.play().catch(() => {}); }
        if (pc.connectionState === 'closed') { this.dropPeer(p); return; }
        this.updateTiles();
      };
      // Wächter: kommt keine Verbindung zustande, neu versuchen und Bescheid geben
      p.watch = setTimeout(() => {
        if (pc.connectionState === 'connected' || !this.room) return;
        try { pc.restartIce(); } catch (e) {}
        p.watch = setTimeout(() => {
          if (pc.connectionState === 'connected' || !this.room) return;
          p.failed = true; this.updateTiles();
          toast(`Keine Verbindung zu ${this.K.contactName(uid)} – eure Netze blockieren direkte Verbindungen.` + (this.iceCache && this.iceCache.turn ? '' : ' Ein Vermittlungs-Server (TURN) hilft.'), 6000);
        }, 15000);
      }, 12000);
      this.sig(uid, { k: 'st', mic: !this.micOff, cam: r.cam, screen: r.screen ? r.screen.id : null });
      this.A.renderSide();
      return p;
    }
    dropPeer(p) {
      clearTimeout(p.watch); clearTimeout(p.iceT);
      try { p.pc.close(); } catch (e) {}
      for (const a of p.audios.values()) { a.srcObject = null; a.remove(); }
      if (this.room) this.room.peers.delete(p.uid);
      this.speaking.delete(p.uid);
      this.updateTiles();
    }
    sig(uid, p) {
      const r = this.room; if (!r) return;
      const card = this.cardOf(uid); if (!card) return;
      const msg = Object.assign({ cid: r.cid, to: uid }, p);
      // pro Gesprächspartner der Reihe nach senden, damit nichts überholt
      const pe = r.peers.get(uid);
      const job = () => this.send(r.chatId, [card], msg);
      if (pe) pe.q = pe.q.then(job, job); else job();
    }
    playAudio(p, s) {
      let box = $('#call-audio'); if (!box) { box = document.createElement('div'); box.id = 'call-audio'; box.className = 'hide'; document.body.appendChild(box); }
      if (p.audios.has(s.id)) return;
      const a = document.createElement('audio'); a.autoplay = true; a.srcObject = s; a.volume = p.vol; a.muted = this.deaf;
      if (this.K.settings.spkId && a.setSinkId) a.setSinkId(this.K.settings.spkId).catch(() => {});
      box.appendChild(a); p.audios.set(s.id, a);
      const tryPlay = () => a.play().catch(() => {
        // Wiedergabe blockiert (Autoplay) -> beim nächsten Tippen/Klicken starten und Hinweis zeigen
        if (!this._audioHint) { this._audioHint = true; toast('Tippe einmal irgendwo hin, um den Ton zu hören.', 5000); }
        const h = () => { a.play().catch(() => {}); removeEventListener('pointerdown', h, true); this._audioHint = false; };
        addEventListener('pointerdown', h, true);
      });
      tryPlay();
      this.watchLevel(p.uid, s);
    }
    watchLevel(uid, stream) {
      if (!stream.getAudioTracks().length) return;
      try {
        const ac = this.ac || (this.ac = new (G.AudioContext || G.webkitAudioContext)());
        const src = ac.createMediaStreamSource(stream); const an = ac.createAnalyser(); an.fftSize = 512; src.connect(an);
        const buf = new Uint8Array(an.fftSize); const r = this.room;
        const t = setInterval(() => {
          if (this.room !== r || !r) { clearInterval(t); return; }
          an.getByteTimeDomainData(buf); let mx = 0; for (const v of buf) mx = Math.max(mx, Math.abs(v - 128));
          // Pegel-Anzeige auf der Kachel
          const lvl = Math.min(1, mx / 60);
          const bar = document.querySelector(`.tile[data-key="${uid === this.me ? 'me' : CSS.escape(uid)}"] .lvl i`);
          if (bar) bar.style.width = Math.round(lvl * 100) + '%';
          if (uid === this.me) { r.myMax = Math.max(r.myMax || 0, this.micOff ? 0 : mx); }
          const on = mx > 14 && !(uid === this.me && this.micOff);
          if (on !== this.speaking.has(uid)) { if (on) this.speaking.add(uid); else this.speaking.delete(uid); this.markSpeaking(); }
        }, 180);
      } catch (e) {}
    }
    markSpeaking() {
      $$('.tile[data-uid]').forEach((t) => t.classList.toggle('speaking', this.speaking.has(t.dataset.uid)));
      clearTimeout(this._sp); this._sp = setTimeout(() => { if (this.room && this.room.kind === 'voice') this.A.renderSide(); }, 250);
    }

    // ---------- Signale ----------
    async onSignal(from, p) {
      const chatId = this.chatIdFor(from, p);
      const r = this.room;
      const inRoom = r && r.cid === p.cid;
      if (p.to && p.to !== this.me) return;
      switch (p.k) {
        case 'ring': {
          if (inRoom) return;
          if (r) { this.send(chatId, [this.cardOf(from)], { k: 'busy', cid: p.cid }); return; }
          if (this.ring && this.ring.cid === p.cid) { this.ring.last = Date.now(); return; }
          this.showRing({ cid: p.cid, from, chatId, video: !!p.video, last: Date.now() });
          return;
        }
        case 'cancel': if (this.ring && this.ring.cid === p.cid) this.missed(); return;
        case 'join': {
          if (p.ch) this.vpSet(chatId, p.ch, from, true);
          if (inRoom) { this.peer(from); this.send(chatId, [this.cardOf(from)], { k: 'here', cid: p.cid }); }
          if (this.ring && this.ring.cid === p.cid && this.chat(chatId).kind === 'dm') this.hideRing();
          return;
        }
        case 'here': if (inRoom) this.peer(from); return;
        case 'vpres': if (p.ch) this.vpSet(chatId, p.ch, from, true); return;
        case 'leave': {
          if (p.ch) this.vpSet(chatId, p.ch, from, false);
          if (inRoom) { const pe = r.peers.get(from); if (pe) this.dropPeer(pe); if (r.kind === 'call' && this.chat(r.chatId).kind === 'dm') { toast('Anruf beendet'); this.leave(true); } }
          if (this.ring && this.ring.cid === p.cid && this.ring.from === from) this.missed();
          return;
        }
        case 'decline': case 'busy': if (inRoom && r.peers.size === 0 && this.chat(r.chatId).kind === 'dm') { toast(p.k === 'busy' ? 'Gerade besetzt.' : 'Anruf abgelehnt.'); this.leave(true); } return;
        case 'st': this.peerSt[from] = { mic: p.mic, cam: p.cam, screen: p.screen }; this.updateTiles(); if (r && r.kind === 'voice') this.A.renderSide(); return;
        case 'sdp': {
          if (!inRoom) return;
          const pe = this.peer(from); if (!pe) return;
          const d = p.d;
          const collision = d.type === 'offer' && (pe.makingOffer || pe.pc.signalingState !== 'stable');
          pe.ignoreOffer = !pe.polite && collision;
          if (pe.ignoreOffer) return;
          await pe.pc.setRemoteDescription(d);
          if (pe.pend && pe.pend.length) { const l = pe.pend; pe.pend = []; for (const c of l) { try { await pe.pc.addIceCandidate(c); } catch (e) {} } }
          if (d.type === 'offer') { await pe.pc.setLocalDescription(); this.sig(from, { k: 'sdp', d: { type: pe.pc.localDescription.type, sdp: pe.pc.localDescription.sdp } }); }
          return;
        }
        case 'ice': {
          if (!inRoom) return;
          const pe = r.peers.get(from) || this.peer(from);
          const list = p.cs || (p.c ? [p.c] : []);
          for (const c of list) {
            if (!pe.pc.remoteDescription) { (pe.pend = pe.pend || []).push(c); continue; }
            try { await pe.pc.addIceCandidate(c); } catch (e) { if (!pe.ignoreOffer) console.warn(e); }
          }
          return;
        }
      }
    }
    vpSet(chatId, ch, uid, on) {
      const key = chatId + '|' + ch; this.vp[key] = this.vp[key] || {};
      const had = !!this.vp[key][uid];
      if (on) this.vp[key][uid] = Date.now(); else delete this.vp[key][uid];
      if (had !== on) this.A.renderSide();
    }
    tick() {
      const r = this.room;
      if (r && r.kind === 'voice') this.sendAll(r.chatId, { k: 'vpres', cid: r.cid, ch: r.ch });
      let changed = false; const now = Date.now();
      for (const k in this.vp) for (const u in this.vp[k]) if (now - this.vp[k][u] > 50000) { delete this.vp[k][u]; changed = true; }
      if (changed) this.A.renderSide();
      if (this.ring && now - this.ring.last > 20000) this.missed();
    }

    // ---------- Klingeln ----------
    showRing(ring) {
      this.ring = ring;
      const c = this.chat(ring.chatId); const K = this.K;
      const isGroup = c && c.kind !== 'dm';
      const el = document.createElement('div'); el.className = 'ring'; el.id = 'ring';
      el.innerHTML = `${av(K.contactName(ring.from), K.contactColor(ring.from), K.avatarOf(ring.from), 'lg')}<div style="font-weight:800;font-size:18px">${esc(K.contactName(ring.from))}</div><div class="small muted">${isGroup ? 'ruft in ' + esc(c.state.name) + ' an' : ring.video ? 'Videoanruf' : 'Sprachanruf'} …</div>
        <div class="row" style="justify-content:center;margin-top:16px;gap:14px"><button class="ib lg redbg" data-r="no" title="Ablehnen">${ic('hang')}</button><button class="ib lg" style="background:var(--ok);color:#fff" data-r="yes" title="Annehmen">${ic('phone')}</button>${ring.video ? `<button class="ib lg" style="background:var(--ok);color:#fff" data-r="vid" title="Mit Video annehmen">${ic('video')}</button>` : ''}</div>`;
      el.onclick = (e) => { const b = e.target.closest('[data-r]'); if (!b) return; if (b.dataset.r === 'no') this.decline(); else this.accept(b.dataset.r === 'vid'); };
      $$('#ring').forEach((x) => x.remove());
      document.body.appendChild(el);
      this.ringT = setInterval(() => beep('ring'), 1600); beep('ring');
      this.A.notify({ kind: 'call', chat: ring.chatId, title: K.contactName(ring.from), body: ring.video ? 'Videoanruf …' : 'Sprachanruf …' });
      if (navigator.vibrate) navigator.vibrate([400, 200, 400]);
    }
    hideRing() { clearInterval(this.ringT); $$('#ring').forEach((x) => x.remove()); this.ring = null; }
    missed() {
      const r = this.ring; this.hideRing(); if (!r) return;
      const c = this.chat(r.chatId); if (c) this.K._sys(c, r.from, 'hat versucht, dich anzurufen.');
      this.A.notify({ kind: 'missed', chat: r.chatId, title: 'Verpasster Anruf', body: this.K.contactName(r.from) });
    }
    async accept(video) {
      const r = this.ring; if (!r) return; this.hideRing();
      this.K.sendLive([], { t: 'call', k: 'taken', cid: r.cid }, true);
      if (this.room) this.leave();
      const c = this.chat(r.chatId); if (!c) return;
      this.A.openChat(r.chatId);
      await this.enter({ cid: r.cid, chatId: r.chatId, video: !!video, kind: 'call', caller: r.from });
      this.sendAll(r.chatId, { k: 'join', cid: r.cid });
    }
    decline() {
      const r = this.ring; if (!r) return; this.hideRing();
      this.K.sendLive([], { t: 'call', k: 'taken', cid: r.cid }, true);
      const card = this.cardOf(r.from); if (card) this.send(r.chatId, [card], { k: 'decline', cid: r.cid });
    }

    // ---------- Steuerung ----------
    applyMic() {
      const r = this.room; if (!r) return;
      const ptt = this.K.settings.pushToTalk;
      const on = !this.micOff && !this.deaf && (!ptt || this.pttDown);
      r.local.getAudioTracks().forEach((t) => { t.enabled = on; });
    }
    broadcastState() {
      const r = this.room; if (!r) return;
      for (const uid of r.peers.keys()) this.sig(uid, { k: 'st', mic: !this.micOff, cam: r.cam, screen: r.screen ? r.screen.id : null });
    }
    toggleMic() { this.micOff = !this.micOff; if (!this.micOff && this.deaf) this.deaf = false; this.applyMic(); this.applyDeaf(); this.broadcastState(); this.refresh(); }
    toggleDeaf() { this.deaf = !this.deaf; this.applyDeaf(); this.applyMic(); this.broadcastState(); this.refresh(); }
    applyDeaf() { const r = this.room; if (!r) return; for (const p of r.peers.values()) for (const a of p.audios.values()) a.muted = this.deaf; }
    ptt(e, down) {
      if (!this.room || !this.K.settings.pushToTalk || e.code !== this.K.settings.pttKey) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (this.pttDown === down) return;
      this.pttDown = down; this.applyMic();
    }
    async toggleCam() {
      const r = this.room; if (!r) return;
      if (r.cam) {
        for (const t of r.local.getVideoTracks()) { t.stop(); r.local.removeTrack(t); for (const p of r.peers.values()) { const s = p.pc.getSenders().find((x) => x.track === t); if (s) p.pc.removeTrack(s); } }
        r.cam = false;
      } else {
        try {
          const s = this.K.settings;
          const v = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, deviceId: s.camId ? { ideal: s.camId } : undefined, facingMode: this.facing || 'user' } });
          const t = v.getVideoTracks()[0]; r.local.addTrack(t);
          for (const p of r.peers.values()) p.pc.addTrack(t, r.local);
          r.cam = true;
        } catch (e) { return toast('Keine Kamera verfügbar.'); }
      }
      this.broadcastState(); this.refresh();
    }
    async flipCam() {
      const r = this.room; if (!r || !r.cam) return;
      this.facing = this.facing === 'environment' ? 'user' : 'environment';
      try {
        const v = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing } });
        const nt = v.getVideoTracks()[0]; const old = r.local.getVideoTracks()[0];
        for (const p of r.peers.values()) { const s = p.pc.getSenders().find((x) => x.track === old); if (s) s.replaceTrack(nt); }
        if (old) { old.stop(); r.local.removeTrack(old); } r.local.addTrack(nt); this.updateTiles(true);
      } catch (e) {}
    }
    async toggleScreen() {
      const r = this.room; if (!r) return;
      if (r.screen) {
        const s = r.screen; r.screen = null;
        for (const t of s.getTracks()) { t.stop(); for (const p of r.peers.values()) { const se = p.pc.getSenders().find((x) => x.track === t); if (se) p.pc.removeTrack(se); } }
        this.broadcastState(); this.refresh(); return;
      }
      if (!navigator.mediaDevices.getDisplayMedia) return toast('Bildschirm teilen geht auf diesem Gerät nicht.');
      try {
        if (G.kreisDesktop && G.kreisDesktop.screens) { const id = await this.pickScreen(); if (!id) return; await G.kreisDesktop.chooseScreen(id); }
        const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 }, width: { ideal: 1920 } }, audio: true });
        r.screen = s;
        s.getVideoTracks()[0].onended = () => { if (this.room && this.room.screen === s) this.toggleScreen(); };
        for (const t of s.getTracks()) for (const p of r.peers.values()) p.pc.addTrack(t, s);
        this.broadcastState(); this.refresh();
      } catch (e) { if (e.name !== 'NotAllowedError') toast('Bildschirm teilen nicht möglich.'); }
    }
    async pickScreen() {
      const list = await G.kreisDesktop.screens();
      return new Promise((res) => {
        const m = modal(`<div class="mh"><h3>Was möchtest du teilen?</h3><button class="ib" data-close>${G.UI.ic('x')}</button></div><div class="mb"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">${list.map((s) => `<button data-s="${esc(s.id)}" class="item" style="flex-direction:column;align-items:stretch;border:1px solid var(--line)"><img src="${s.thumb}" style="width:100%;border-radius:8px;background:#000;aspect-ratio:16/9;object-fit:contain"><span class="small ell">${esc(s.name)}</span></button>`).join('')}</div></div>`, { onClose: () => res(null) });
        m.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { m.remove(); res(b.dataset.s); } });
      });
    }
    setVol(uid, v) { const p = this.room && this.room.peers.get(uid); if (!p) return; p.vol = v; for (const a of p.audios.values()) a.volume = v; }
    refresh() { this.A.renderSide(); this.renderView(); }

    // ---------- Ansicht ----------
    renderView() {
      const main = $('#main'); if (!main) return;
      let el = $('#callview', main);
      const r = this.room;
      const here = r && this.showView && this.A.v.chat === r.chatId;
      if (!here) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('div'); el.className = 'call'; el.id = 'callview';
        const after = $('#pinbar', main) || $('#mh', main) || $('.main-h', main);
        if (after && after.nextSibling) main.insertBefore(el, after.nextSibling); else main.appendChild(el);
        el.innerHTML = '<div class="ctitle"></div><div class="tiles"></div><div class="bar"></div>'; el.addEventListener('click', (e) => this.onBar(e));
      }
      el.classList.toggle('full', !!this.full);
      $('.ctitle', el).innerHTML = esc(this.roomTitle()) + (r.ringing && !r.peers.size ? ' · <span style="color:var(--tx3)">klingelt …</span>' : '');
      const canScreen = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && !this.A.isCap;
      $('.bar', el).innerHTML = `<button class="ib ${this.micOff ? 'off' : ''}" data-c="mic" title="Mikrofon">${ic(this.micOff ? 'micoff' : 'mic')}</button><button class="ib ${this.deaf ? 'off' : ''}" data-c="deaf" title="Ton aus">${ic(this.deaf ? 'headoff' : 'head')}</button><button class="ib ${r.cam ? '' : 'off'}" data-c="cam" title="Kamera">${ic(r.cam ? 'video' : 'videooff')}</button>${this.A.isCap && r.cam ? `<button class="ib" data-c="flip" title="Kamera wechseln">${ic('refresh')}</button>` : ''}${canScreen ? `<button class="ib ${r.screen ? 'on' : ''}" data-c="screen" title="Bildschirm teilen" style="${r.screen ? 'background:var(--ok)' : ''}">${ic('screen')}</button>` : ''}<button class="ib" data-c="full" title="${this.full ? 'Chat daneben anzeigen' : 'Vollbild'}">${ic(this.full ? 'chat' : 'max')}</button><button class="ib" data-c="min" title="Anruf ausblenden (läuft weiter)">${ic('down')}</button><button class="ib redbg" data-c="leave" title="Auflegen">${ic('hang')}</button>`;
      this.updateTiles();
    }
    onBar(e) {
      const b = e.target.closest('[data-c]');
      if (b) {
        const c = b.dataset.c;
        if (c === 'mic') this.toggleMic(); else if (c === 'deaf') this.toggleDeaf(); else if (c === 'cam') this.toggleCam(); else if (c === 'flip') this.flipCam();
        else if (c === 'screen') this.toggleScreen(); else if (c === 'leave') this.leave(); else if (c === 'min') { this.showView = false; this.renderView(); this.A.renderSide(); }
        else if (c === 'full') { this.full = !this.full; this.renderView(); }
        return;
      }
      const t = e.target.closest('.tile');
      if (t) { this.focus = this.focus === t.dataset.key ? null : t.dataset.key; this.updateTiles(); }
    }
    updateTiles() {
      const el = $('#callview .tiles'); const r = this.room; if (!el || !r) return;
      const K = this.K;
      const want = [];
      const vid = (s) => s && s.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted);
      want.push({ key: 'me', uid: this.me, stream: r.cam ? r.local : null, me: true });
      if (r.screen) want.push({ key: 'me-screen', uid: this.me, stream: r.screen, screen: true, me: true });
      for (const p of r.peers.values()) {
        const st = this.peerSt[p.uid] || {};
        let cam = null; const screens = [];
        for (const s of p.streams.values()) { if (!vid(s)) continue; if (st.screen && s.id === st.screen) screens.push(s); else if (!cam && st.cam !== false) cam = s; else screens.push(s); }
        want.push({ key: p.uid, uid: p.uid, stream: cam, peer: p });
        screens.forEach((s, i) => want.push({ key: p.uid + '-s' + i, uid: p.uid, stream: s, screen: true, peer: p }));
      }
      const keys = new Set(want.map((w) => w.key));
      $$('.tile', el).forEach((t) => { if (!keys.has(t.dataset.key)) t.remove(); });
      if (this.focus && !keys.has(this.focus)) this.focus = null;
      for (const w of want) {
        let t = el.querySelector(`.tile[data-key="${CSS.escape(w.key)}"]`);
        if (!t) { t = document.createElement('div'); t.className = 'tile'; t.dataset.key = w.key; t.dataset.uid = w.uid; el.appendChild(t); }
        const cs = w.peer && !w.screen ? (w.peer.failed ? ' · keine Verbindung' : w.peer.pc.connectionState !== 'connected' ? ' · verbindet …' : '') : '';
        const name = K.contactName(w.uid) + (w.me ? ' (du)' : '') + (w.screen ? ' – Bildschirm' : '') + cs;
        const st = w.me ? { mic: !this.micOff } : this.peerSt[w.uid] || {};
        t.classList.toggle('big', this.focus === w.key || (!this.focus && w.screen && want.filter((x) => x.screen).length === 1 && want.length > 1));
        t.classList.toggle('speaking', !w.screen && this.speaking.has(w.uid));
        const has = w.stream && vid(w.stream);
        let v = t.querySelector('video');
        if (has) {
          if (!v) { t.innerHTML = ''; v = document.createElement('video'); v.autoplay = true; v.playsInline = true; v.muted = true; t.appendChild(v); }
          if (v.srcObject !== w.stream) { v.srcObject = w.stream; v.play().catch(() => {}); }
          v.classList.toggle('contain', !!w.screen);
          v.style.transform = w.me && !w.screen && this.facing !== 'environment' ? 'scaleX(-1)' : '';
          let l = t.querySelector('.lbl'); if (!l) { l = document.createElement('div'); l.className = 'lbl'; t.appendChild(l); }
          l.innerHTML = (st.mic === false ? ic('micoff', 's') : '') + esc(name);
          if (!w.screen && !t.querySelector('.lvl')) t.insertAdjacentHTML('beforeend', '<div class="lvl" title="Lautstärke"><i></i></div>');
        } else {
          t.innerHTML = `${av(K.contactName(w.uid), K.contactColor(w.uid), K.avatarOf(w.uid))}${w.screen ? '' : '<div class="lvl" title="Lautstärke"><i></i></div>'}<div class="lbl">${st.mic === false ? ic('micoff', 's') : ''}${esc(name)}</div>${w.peer ? `<input type="range" min="0" max="100" value="${Math.round(w.peer.vol * 100)}" title="Lautstärke" data-vol="${w.uid}" style="position:absolute;right:10px;bottom:12px;width:90px">` : ''}`;
          const range = t.querySelector('[data-vol]'); if (range) { range.onclick = (e) => e.stopPropagation(); range.oninput = (e) => this.setVol(w.uid, e.target.value / 100); }
        }
      }
    }
  }

  G.Calls = Calls;
})(window);
