/* Vaultline – Oberfläche Teil 2: Dateien, Sprachnachrichten, Menüs, Fenster, Einstellungen, Seitenleiste rechts */
(function (G) {
  'use strict';
  const { ic, esc, $, $$, av, time, shortTime, size, dur, toast, modal, confirmBox, prompt2, pop, closePop, menu, emojiPicker, qrImg, copy, beep } = G.UI;
  const A = G.A, CFG = G.KREIS_CFG;
  const K = () => A.K;
  const ACT = A.ACT;
  const chat = () => A.curChat();
  const Cap = () => (G.Capacitor && G.Capacitor.Plugins) || {};

  // ---------- Anhänge ----------
  A.attHTML = (m) => {
    const f = m.file, key = m.chat + '|' + m.id, url = A.blobs.get(key), busy = A.loading.has(key);
    const w = f.w || 320, h = f.h || 240, sw = Math.min(420, w);
    if (f.kind === 'image') return `<div class="att img" data-a="viewImg" data-id="${m.id}" style="width:${sw}px;aspect-ratio:${w}/${h}">${url ? `<img src="${url}" alt="">` : `${f.th ? `<img class="blur" src="${esc(f.th)}" alt="">` : ''}<div class="over"><span>${busy ? 'Lädt …' : ic('dl', 's') + ' ' + size(f.z)}</span></div>`}</div>${m.text ? '' : ''}`;
    if (f.kind === 'video') return `<div class="att img" data-a="playVideo" data-id="${m.id}" style="width:${sw}px;aspect-ratio:${w}/${h}">${f.th ? `<img src="${esc(f.th)}" alt="" style="width:100%;height:100%;object-fit:cover">` : ''}<div class="over"><span>${busy ? 'Lädt …' : ic('play', 's') + ' Video · ' + size(f.z) + (f.dur ? ' · ' + dur(f.dur) : '')}</span></div></div>`;
    if (f.kind === 'voice' || f.kind === 'audio') {
      const wave = (f.wave && f.wave.length ? f.wave : Array.from({ length: 36 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 1.7 + m.id.charCodeAt(0)))));
      const playing = A.audioKey === key && A.audio && !A.audio.paused;
      return `<div class="att"><div class="voice" data-key="${key}"><button class="pl" data-a="playVoice" data-id="${m.id}">${ic(playing ? 'pause' : 'play', 's')}</button><div class="wave">${wave.map((v) => `<i style="height:${Math.max(10, Math.round(v * 100))}%"></i>`).join('')}</div><span class="tiny dim" data-dur>${busy ? '…' : dur(f.dur)}</span></div>${f.kind === 'audio' ? `<div class="tiny dim" style="margin-top:4px">${esc(f.n)}</div>` : ''}</div>`;
    }
    return `<div class="att"><div class="fileb"><div class="ic">${ic('file')}</div><div class="grow"><div class="ell" style="font-weight:600">${esc(f.n || 'Datei')}</div><div class="tiny dim">${size(f.z)} · verschlüsselt</div></div><button class="ib" data-a="download" data-id="${m.id}" title="Speichern">${busy ? ic('clock') : ic('dl')}</button></div></div>`;
  };
  async function media(m, onP) {
    const key = m.chat + '|' + m.id;
    if (A.blobs.has(key)) return A.blobs.get(key);
    if (A.loading.has(key)) { await new Promise((r) => { const t = setInterval(() => { if (!A.loading.has(key)) { clearInterval(t); r(); } }, 120); }); return A.blobs.get(key); }
    A.loading.add(key);
    try {
      const bytes = await K().loadFile(m, onP);
      const url = URL.createObjectURL(new Blob([bytes], { type: m.file.m || 'application/octet-stream' }));
      A.blobs.set(key, url);
      return url;
    } catch (e) { toast('Datei konnte nicht geladen werden: ' + e.message); return null; }
    finally { A.loading.delete(key); }
  }
  A.media = media;
  A.loadVisibleMedia = (box) => {
    const c = chat(); if (!c) return;
    $$('.att.img[data-a="viewImg"]', box).forEach((el) => {
      const m = K().msgs.get(c.id + '|' + el.dataset.id);
      if (!m || !m.file || A.blobs.has(c.id + '|' + m.id) || m.file.z > 15 * 1048576) return;
      media(m).then((url) => { if (!url) return; const e2 = $(`[data-mid="${m.id}"] .att.img`); if (e2) e2.innerHTML = `<img src="${url}" alt="">`; });
    });
  };
  function viewer(inner, m) {
    const v = document.createElement('div'); v.className = 'viewer';
    v.innerHTML = `${inner}<div class="vt">${m ? `<button class="ib" data-v="dl">${ic('dl')}</button>` : ''}<button class="ib" data-v="x">${ic('x')}</button></div>`;
    v.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b && b.dataset.v === 'dl') return saveFile(m); if (e.target === v || (b && b.dataset.v === 'x')) v.remove(); });
    document.body.appendChild(v);
    const onKey = (e) => { if (e.key === 'Escape') { v.remove(); removeEventListener('keydown', onKey); } }; addEventListener('keydown', onKey);
  }
  async function saveFile(m) {
    const url = await media(m); if (!url) return;
    const name = m.file.n || 'kreis-datei';
    if (A.isCap && Cap().Filesystem) {
      try {
        const b64 = btoa(Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer()), (x) => String.fromCharCode(x)).join(''));
        const r = await Cap().Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' });
        if (Cap().Share) await Cap().Share.share({ title: name, files: [r.uri] });
        else toast('Gespeichert');
        return;
      } catch (e) { if (!/cancel/i.test(e.message || '')) toast('Speichern fehlgeschlagen'); return; }
    }
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  Object.assign(ACT, {
    async viewImg(el) { const m = K().msgs.get(chat().id + '|' + el.dataset.id); const url = await media(m); if (url) viewer(`<img src="${url}" alt="">`, m); },
    async playVideo(el) { const m = K().msgs.get(chat().id + '|' + el.dataset.id); el.querySelector('.over span').textContent = 'Lädt …'; const url = await media(m); el.querySelector('.over span').innerHTML = ic('play', 's') + ' Video'; if (url) viewer(`<video src="${url}" controls autoplay playsinline></video>`, m); },
    async download(el) { const m = K().msgs.get(chat().id + '|' + el.dataset.id); saveFile(m); },
    async playVoice(el) {
      const c = chat(); const key = c.id + '|' + el.dataset.id; const m = K().msgs.get(key);
      if (A.audio && A.audioKey === key) { if (A.audio.paused) A.audio.play(); else A.audio.pause(); return; }
      if (A.audio) A.audio.pause();
      const url = await media(m); if (!url) return;
      const au = new Audio(url); A.audio = au; A.audioKey = key;
      if (K().settings.spkId && au.setSinkId) au.setSinkId(K().settings.spkId).catch(() => {});
      const upd = () => {
        const w = $(`.voice[data-key="${CSS.escape(key)}"]`); if (!w) return;
        const bars = $$('.wave i', w), p = au.duration ? au.currentTime / au.duration : 0;
        bars.forEach((b, i) => b.classList.toggle('p', i / bars.length < p));
        $('.pl', w).innerHTML = ic(au.paused ? 'play' : 'pause', 's');
        $('[data-dur]', w).textContent = dur(au.paused && !au.currentTime ? m.file.dur : au.currentTime);
      };
      au.ontimeupdate = upd; au.onplay = upd; au.onpause = upd; au.onended = () => { au.currentTime = 0; upd(); };
      au.play().catch(() => toast('Abspielen nicht möglich'));
    },
  });

  // Dateien senden
  function loadImg(url) { return new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = url; }); }
  async function imageMeta(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImg(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      const c = document.createElement('canvas'); const tw = 48; c.width = tw; c.height = Math.max(1, Math.round(tw * h / w));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const th = c.toDataURL('image/jpeg', 0.6);
      let bytes = null;
      if (file.size > 1.5 * 1048576 && !/gif|svg/.test(file.type) && K().settings.compress !== false) {
        const max = 2560, s = Math.min(1, max / Math.max(w, h));
        const cc = document.createElement('canvas'); cc.width = Math.round(w * s); cc.height = Math.round(h * s);
        cc.getContext('2d').drawImage(img, 0, 0, cc.width, cc.height);
        const blob = await new Promise((r) => cc.toBlob(r, 'image/jpeg', 0.86));
        if (blob && blob.size < file.size) bytes = new Uint8Array(await blob.arrayBuffer());
        return { meta: { kind: 'image', n: file.name.replace(/\.\w+$/, '') + '.jpg', m: 'image/jpeg', w: cc.width, h: cc.height, th }, bytes };
      }
      return { meta: { kind: 'image', n: file.name, m: file.type, w, h, th }, bytes };
    } finally { URL.revokeObjectURL(url); }
  }
  async function videoMeta(file) {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((res) => {
        const v = document.createElement('video'); v.muted = true; v.preload = 'metadata'; v.src = url; v.playsInline = true;
        const done = (th) => res({ kind: 'video', n: file.name, m: file.type, w: v.videoWidth || 640, h: v.videoHeight || 360, dur: v.duration || 0, th });
        const to = setTimeout(() => done(''), 4000);
        v.onloadeddata = () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); } catch (e) {} };
        v.onseeked = () => { clearTimeout(to); try { const c = document.createElement('canvas'); c.width = 320; c.height = Math.round(320 * (v.videoHeight || 9) / (v.videoWidth || 16)); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); done(c.toDataURL('image/jpeg', 0.6)); } catch (e) { done(''); } };
        v.onerror = () => { clearTimeout(to); done(''); };
      });
    } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
  }
  A.sendFiles = async (files) => {
    const c = chat(); if (!c) return;
    for (const file of files) {
      if (file.size > 50 * 1048576) { toast(`${file.name} ist größer als 50 MB.`); continue; }
      const tmp = Math.random().toString(36).slice(2);
      A.uploads[tmp] = { chat: c.id, name: file.name, p: 0 }; A.renderCtx();
      try {
        let meta, bytes = null;
        if (file.type.startsWith('image/')) { const r = await imageMeta(file).catch(() => null); if (r) { meta = r.meta; bytes = r.bytes; } }
        else if (file.type.startsWith('video/')) meta = await videoMeta(file);
        else if (file.type.startsWith('audio/')) meta = { kind: 'audio', n: file.name, m: file.type };
        if (!meta) meta = { kind: 'file', n: file.name, m: file.type || 'application/octet-stream' };
        if (!bytes) bytes = new Uint8Array(await file.arrayBuffer());
        const reply = A.v.reply; A.v.reply = null;
        await K().sendFile(c.id, bytes, meta, { ch: c.kind === 'server' ? A.v.ch : undefined, reply }, (p) => { if (A.uploads[tmp]) { A.uploads[tmp].p = p; A.renderCtx(); } });
      } catch (e) { toast('Senden fehlgeschlagen: ' + e.message); }
      finally { delete A.uploads[tmp]; A.renderCtx(); }
    }
  };

  // Sprachnachricht
  A.toggleRecord = async () => {
    const c = chat(); if (!c) return;
    if (A.rec) return;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: K().settings.noise, echoCancellation: K().settings.echo, deviceId: K().settings.micId || undefined } }); }
    catch (e) { return toast('Kein Zugriff aufs Mikrofon.'); }
    const types = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
    const mime = types.find((t) => G.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : {});
    const chunks = [], levels = [];
    let ac, an, buf, lt;
    try { ac = new AudioContext(); an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an); buf = new Uint8Array(an.fftSize); lt = setInterval(() => { an.getByteTimeDomainData(buf); let mx = 0; for (const v of buf) mx = Math.max(mx, Math.abs(v - 128)); levels.push(mx / 128); }, 100); } catch (e) {}
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const t0 = Date.now();
    A.rec = { rec, stream, send: false };
    const box = $('#cbox');
    box.innerHTML = `<button class="ib red" data-a="recCancel" title="Verwerfen">${ic('trash')}</button><div class="rec"><span class="pulse"></span><span id="rect">0:00</span><span class="muted small" style="font-weight:500">Aufnahme läuft …</span></div><button class="ib send" data-a="recSend" title="Senden">${ic('send')}</button>`;
    const tick = setInterval(() => { const e = $('#rect'); if (e) e.textContent = dur((Date.now() - t0) / 1000); if (Date.now() - t0 > 10 * 60000) ACT.recSend(); }, 250);
    rec.onstop = async () => {
      clearInterval(tick); clearInterval(lt); stream.getTracks().forEach((t) => t.stop()); try { ac && ac.close(); } catch (e) {}
      const send = A.rec && A.rec.send; A.rec = null; A.renderComposer();
      if (!send) return;
      const d = (Date.now() - t0) / 1000;
      if (d < 0.6) return toast('Zu kurz – halte die Aufnahme etwas länger.');
      const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
      const n = 40, wave = []; const per = Math.max(1, Math.floor(levels.length / n));
      for (let i = 0; i < n; i++) { const sl = levels.slice(i * per, (i + 1) * per); wave.push(Math.min(1, (sl.length ? Math.max(...sl) : 0.1) * 1.8 + 0.08)); }
      try { await K().sendFile(c.id, new Uint8Array(await blob.arrayBuffer()), { kind: 'voice', n: 'Sprachnachricht', m: blob.type, dur: d, wave: wave.map((x) => Math.round(x * 100) / 100) }, { ch: c.kind === 'server' ? A.v.ch : undefined }); }
      catch (e) { toast('Senden fehlgeschlagen: ' + e.message); }
    };
    rec.start(250);
  };
  ACT.recCancel = () => { if (A.rec) { A.rec.send = false; A.rec.rec.stop(); } };
  ACT.recSend = () => { if (A.rec) { A.rec.send = true; A.rec.rec.stop(); } };

  // Umfrage
  A.pollDialog = () => {
    const m = modal(`<div class="mh"><h3>Umfrage erstellen</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb"><label class="fld"><span>Frage</span><input class="inp" id="pq" maxlength="200" autofocus placeholder="Was wollt ihr wissen?"></label><div class="fld"><span>Antworten</span><div id="po"></div><button class="btn ghost sm" id="padd">${ic('plus', 's')} Antwort hinzufügen</button></div><label class="opt" style="border:0"><span class="grow">Mehrere Antworten erlauben</span><span class="sw" id="pmulti"></span></label></div><div class="mf"><button class="btn sec" data-close>Abbrechen</button><button class="btn" id="pgo">Senden</button></div>`);
    const po = $('#po', m);
    const add = () => { if (po.children.length >= 10) return; const i = document.createElement('input'); i.className = 'inp'; i.style.marginBottom = '6px'; i.maxLength = 100; i.placeholder = 'Antwort ' + (po.children.length + 1); po.appendChild(i); };
    add(); add();
    $('#padd', m).onclick = add;
    $('#pmulti', m).parentElement.onclick = () => $('#pmulti', m).classList.toggle('on');
    $('#pgo', m).onclick = async () => {
      const q = $('#pq', m).value.trim(); const opts = $$('input', po).map((i) => i.value.trim()).filter(Boolean);
      if (!q || opts.length < 2) return toast('Frage und mindestens zwei Antworten eingeben.');
      const c = chat(); m.close();
      await K().send(c.id, { poll: { q, opts, multi: $('#pmulti', m).classList.contains('on') }, ch: c.kind === 'server' ? A.v.ch : undefined }).catch((e) => toast(e.message));
    };
  };

  // ---------- Nachrichten-Menü ----------
  ACT.msgMenu = async (el, e, pt) => {
    const c = chat(); const id = el.dataset.id || el.dataset.mid; const m = K().msgs.get(c.id + '|' + id); if (!m || m.sys) return;
    const mine = m.from === K().id, admin = c.kind !== 'dm' && K().isAdmin(c, K().id);
    const items = [];
    if (!m.deleted) {
      items.push({ k: 'reply', t: 'Antworten', i: 'reply' }, { k: 'thread', t: 'Im Thread antworten', i: 'thread' });
      if (m.text) items.push({ k: 'copy', t: 'Text kopieren', i: 'copy' });
      items.push({ k: 'fwd', t: 'Weiterleiten', i: 'fwd' }, { k: 'pin', t: m.pinned ? 'Nicht mehr anpinnen' : 'Anpinnen', i: 'pin' });
      if (mine && m.text && !m.poll) items.push({ k: 'edit', t: 'Bearbeiten', i: 'edit' });
      if (m.file) items.push({ k: 'save', t: 'Speichern', i: 'dl' });
      items.push({ k: 'info', t: 'Info', i: 'info' }, '-');
      if (mine || admin) items.push({ k: 'del', t: 'Für alle löschen', i: 'trash', red: true });
    }
    items.push({ k: 'delme', t: 'Für mich löschen', i: 'trash', red: true });
    const head = m.deleted ? '' : `<div class="quick">${['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉'].map((x) => `<button data-m="r:${x}">${x}</button>`).join('')}<button data-m="r:+">${ic('plus', 's')}</button></div>`;
    const k = await menu(items, pt || el, { head, alignRight: !pt });
    if (k.startsWith('r:')) { const x = k.slice(2); if (x === '+') emojiPicker(pt || el, (y) => K().react(c.id, id, y)); else K().react(c.id, id, x); return; }
    if (k === 'reply') ACT.reply({ dataset: { id } });
    else if (k === 'thread') ACT.thread({ dataset: { id } });
    else if (k === 'copy') copy(m.text);
    else if (k === 'fwd') forwardDialog(m);
    else if (k === 'pin') K().pin(c.id, id, !m.pinned);
    else if (k === 'edit') A.startEdit(id);
    else if (k === 'save') saveFile(m);
    else if (k === 'info') msgInfo(c, m);
    else if (k === 'del') { if (await confirmBox('Für alle löschen?', 'Die Nachricht wird bei allen gelöscht.', 'Löschen', true)) K().remove(c.id, id); }
    else if (k === 'delme') K().deleteForMe(c.id, id);
  };
  function forwardDialog(m) {
    const list = K().sortedChats().filter((c) => !c.left && (c.kind !== 'dm' || (K().contacts[c.peer] && K().contacts[c.peer].status === 'friend')));
    const md = modal(`<div class="mh"><h3>Weiterleiten an …</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb" style="max-height:50vh;overflow:auto">${list.map((c) => `<label class="chk"><input type="checkbox" value="${c.id}">${c.kind === 'dm' ? av(K().chatTitle(c), K().contactColor(c.peer), K().avatarOf(c.peer), 'sm') : av(K().chatTitle(c), c.state.color, c.state.icon, 'sm sq')}<span class="grow ell">${esc(K().chatTitle(c))}</span></label>`).join('')}</div><div class="mf"><button class="btn sec" data-close>Abbrechen</button><button class="btn" id="fgo">Senden</button></div>`);
    $('#fgo', md).onclick = async () => {
      const ids = $$('input:checked', md).map((i) => i.value); if (!ids.length) return;
      md.close();
      for (const id of ids) {
        const c = K().chats[id];
        const ch = c.kind === 'server' ? (c.state.channels.find((x) => x.type === 'text') || {}).id : undefined;
        await K().send(id, { text: m.text, file: m.file, sticker: m.sticker, fwd: true, ch }).catch((e) => toast(e.message));
      }
      toast('Weitergeleitet');
    };
  }
  function msgInfo(c, m) {
    let rows = `<div class="kv"><span class="muted">Gesendet</span><span>${new Date(m.ts).toLocaleString('de-DE')}</span></div>`;
    if (m.rcv) rows += `<div class="kv"><span class="muted">Empfangen</span><span>${new Date(m.rcv).toLocaleString('de-DE')}</span></div>`;
    if (m.edited) rows += `<div class="kv"><span class="muted">Bearbeitet</span><span>${new Date(m.edited).toLocaleString('de-DE')}</span></div>`;
    if (m.exp) rows += `<div class="kv"><span class="muted">Löscht sich</span><span>${new Date(m.exp).toLocaleString('de-DE')}</span></div>`;
    if (m.from === K().id) {
      const ids = c.kind === 'dm' ? [c.peer] : Object.keys(c.state.members).filter((x) => x !== K().id);
      rows += `<div class="grp-t">Gelesen von</div>` + (ids.filter((x) => ((c.reads || {})[x] || 0) >= m.ts).map((x) => `<div class="item">${av(K().contactName(x), K().contactColor(x), K().avatarOf(x), 'xs')}<span>${esc(K().contactName(x))}</span></div>`).join('') || '<div class="muted small" style="padding:4px 8px">Noch niemand (oder Lesebestätigungen sind aus).</div>');
    }
    modal(`<div class="mh"><h3>Nachrichteninfo</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb">${rows}<div class="note" style="margin-top:12px">${ic('lock', 's')}<span>Diese Nachricht ist Ende-zu-Ende-verschlüsselt und signiert.</span></div></div>`);
  }

  // ---------- Chat-Menüs ----------
  ACT.chatmenu = async (el, e, pt) => {
    const c = K().chats[el.dataset.id]; if (!c) return;
    const items = [{ k: 'pin', t: c.pinned ? 'Nicht mehr oben anheften' : 'Oben anheften', i: 'pin' }, { k: 'mute', t: c.muted ? 'Stummschaltung aufheben' : 'Stummschalten', i: c.muted ? 'bell' : 'belloff' }, { k: 'arch', t: c.archived ? 'Aus dem Archiv holen' : 'Archivieren', i: 'archive' }, { k: 'read', t: 'Als gelesen markieren', i: 'checks' }, '-', { k: 'clear', t: 'Chat leeren', i: 'trash', red: true }];
    if (c.kind === 'dm') items.push({ k: 'delete', t: 'Chat löschen', i: 'trash', red: true });
    else items.push(c.left ? { k: 'delete', t: 'Chat löschen', i: 'trash', red: true } : { k: 'leave', t: 'Gruppe verlassen', i: 'out', red: true });
    const k = await menu(items, pt || el);
    A.chatAction(c, k);
  };
  A.chatAction = async (c, k) => {
    if (k === 'pin') K().chatFlag(c.id, 'pinned', !c.pinned);
    else if (k === 'mute') K().chatFlag(c.id, 'muted', !c.muted);
    else if (k === 'arch') K().chatFlag(c.id, 'archived', !c.archived);
    else if (k === 'read') { c.unread = 0; c.unreadCh = {}; c.mention = false; K().save('chats'); K().emit('chats'); }
    else if (k === 'clear') { if (await confirmBox('Chat leeren?', 'Alle Nachrichten in diesem Chat werden auf diesem Gerät gelöscht.', 'Leeren', true)) K().clearChat(c.id); }
    else if (k === 'delete') { if (await confirmBox('Chat löschen?', 'Der Chat und alle Nachrichten werden auf diesem Gerät gelöscht.', 'Löschen', true)) { if (A.v.chat === c.id) A.closeChat(); K().deleteChat(c.id); } }
    else if (k === 'leave') { if (await confirmBox(c.kind === 'server' ? 'Server verlassen?' : 'Gruppe verlassen?', `Du verlässt <b>${esc(c.state.name)}</b>.`, 'Verlassen', true)) { await K().leaveGroup(c.id); if (c.kind === 'server') { A.v.space = 'home'; A.closeChat(); A.renderAll(); } } }
  };
  ACT.newMenu = async (el) => {
    const k = await menu([{ k: 'friend', t: 'Freund hinzufügen', i: 'uplus' }, { k: 'group', t: 'Neue Gruppe', i: 'users' }, { k: 'server', t: 'Server erstellen', i: 'server' }, { k: 'join', t: 'Einladungslink öffnen', i: 'link' }], el, { alignRight: true });
    if (k === 'friend') A.addFriendDialog(); else if (k === 'group') ACT.newGroup(); else if (k === 'server') createServer(); else if (k === 'join') joinDialog();
  };
  ACT.addFriend = () => A.addFriendDialog();
  ACT.newServer = () => {
    const m = modal(`<div class="mh"><h3>Server</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb"><p class="muted">Ein Server ist wie bei Discord: mehrere Text- und Sprachkanäle, Rollen und Einladungslinks.</p><button class="item" id="sv-new" style="border:1px solid var(--line);margin-bottom:8px"><div class="av sq" style="background:var(--accent)">${ic('plus')}</div><div class="grow"><div class="nm">Eigenen Server erstellen</div><div class="sub">Für dich und deine Freunde</div></div>${ic('right')}</button><button class="item" id="sv-join" style="border:1px solid var(--line)"><div class="av sq" style="background:var(--ok)">${ic('link')}</div><div class="grow"><div class="nm">Einem Server beitreten</div><div class="sub">Mit einem Einladungslink</div></div>${ic('right')}</button></div>`);
    $('#sv-new', m).onclick = () => { m.close(); createServer(); };
    $('#sv-join', m).onclick = () => { m.close(); joinDialog(); };
  };
  function friendChecklist() {
    const fr = Object.values(K().contacts).filter((c) => c.status === 'friend');
    return fr.length ? fr.map((c) => `<label class="chk"><input type="checkbox" value="${c.card.id}">${av(K().contactName(c.card.id), K().contactColor(c.card.id), K().avatarOf(c.card.id), 'sm')}<span class="grow ell">${esc(K().contactName(c.card.id))}</span></label>`).join('') : '<div class="muted small">Du hast noch keine Freunde hinzugefügt.</div>';
  }
  async function createServer() {
    const m = modal(`<div class="mh"><h3>Server erstellen</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb"><label class="fld"><span>Name des Servers</span><input class="inp" id="sn" maxlength="60" autofocus value="${esc(K().profile.name)}s Server"></label><div class="fld"><span>Freunde direkt hinzufügen (optional)</span><div style="max-height:34vh;overflow:auto">${friendChecklist()}</div></div></div><div class="mf"><button class="btn sec" data-close>Abbrechen</button><button class="btn" id="sgo">Erstellen</button></div>`);
    $('#sgo', m).onclick = async () => {
      const n = $('#sn', m).value.trim(); if (!n) return;
      const ids = $$('input:checked', m).map((i) => i.value); m.close();
      const c = await K().createGroup(n, ids, 'server');
      A.openChat(c.id); toast('Server erstellt');
    };
  }
  ACT.newGroup = () => {
    const m = modal(`<div class="mh"><h3>Neue Gruppe</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb"><label class="fld"><span>Gruppenname</span><input class="inp" id="gn" maxlength="60" autofocus placeholder="z. B. Zocker-Runde"></label><div class="fld"><span>Mitglieder</span><div style="max-height:40vh;overflow:auto">${friendChecklist()}</div></div></div><div class="mf"><button class="btn sec" data-close>Abbrechen</button><button class="btn" id="ggo">Erstellen</button></div>`);
    $('#ggo', m).onclick = async () => {
      const n = $('#gn', m).value.trim(); const ids = $$('input:checked', m).map((i) => i.value);
      if (!n) return toast('Bitte einen Namen eingeben.');
      m.close(); const c = await K().createGroup(n, ids, 'group'); A.openChat(c.id);
    };
  };
  function joinDialog(pre) {
    const m = modal(`<div class="mh"><h3>Einem Server beitreten</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb"><label class="fld"><span>Einladungslink</span><input class="inp" id="jl" autofocus placeholder="https://…#join=J1…" value="${esc(pre || '')}"></label><p class="small muted">Der Admin, der den Link erstellt hat, bestätigt deinen Beitritt automatisch, sobald seine App online ist.</p></div><div class="mf"><button class="btn sec" data-close>Abbrechen</button><button class="btn" id="jgo">Beitreten</button></div>`);
    $('#jgo', m).onclick = async () => {
      try { const d = await K().joinByInvite($('#jl', m).value); m.close(); toast(`Anfrage an „${d.n}“ gesendet …`); A.v.tab = 'requests'; A.renderSide(); }
      catch (e) { toast(e.message); }
    };
  }
  A.joinDialog = joinDialog;

  // ---------- Freund hinzufügen ----------
  A.addFriendDialog = (first) => {
    const link = K().inviteLink();
    const m = modal(`<div class="mh"><h3>${first ? 'Fast fertig! Lade deine Freunde ein' : 'Freund hinzufügen'}</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb">
      <div class="row" style="align-items:flex-start;gap:16px;flex-wrap:wrap"><div>${qrImg(link)}</div><div class="grow" style="min-width:200px"><div style="font-weight:700;margin-bottom:6px">Dein Code</div><p class="small muted" style="margin-top:0">Schick deinen Link einem Freund oder lass ihn den QR-Code scannen. Er enthält nur deinen öffentlichen Schlüssel – nichts Geheimes.</p><div class="row wrap"><button class="btn sm" data-x="copy">${ic('copy', 's')} Link kopieren</button>${navigator.share ? `<button class="btn sec sm" data-x="share">${ic('fwd', 's')} Teilen</button>` : ''}</div></div></div>
      ${K().acct ? `<div class="note" style="margin-top:12px">${ic('at')}<div>Oder einfach deinen Benutzernamen sagen: <b>@${esc(K().acct.u)}</b></div></div>` : ''}
      <div class="grp-t" style="padding-left:0;margin-top:10px">Freund hinzufügen</div>
      <div class="row"><input class="inp grow" id="fc" placeholder="@Benutzername, Link oder Code" autocapitalize="none" spellcheck="false"><button class="btn" data-x="add">Hinzufügen</button></div>
      <button class="btn ghost full" data-x="scan" style="margin-top:8px">${ic('qr', 's')} QR-Code scannen</button></div>`);
    m.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      const x = b.dataset.x;
      if (x === 'copy') copy(link);
      else if (x === 'share') navigator.share({ title: 'Vaultline', text: `Füg mich auf Vaultline hinzu – unser privater, verschlüsselter Chat: ${link}` }).catch(() => {});
      else if (x === 'add') { b.disabled = true; try { const c = await K().addContact($('#fc', m).value); m.close(); toast(c.status === 'friend' ? 'Ihr seid jetzt Freunde!' : 'Anfrage gesendet – sobald dein Freund annimmt, könnt ihr schreiben.'); A.v.tab = c.status === 'friend' ? 'chats' : 'requests'; A.renderSide(); } catch (err) { toast(err.message); } finally { b.disabled = false; } }
      else if (x === 'scan') { const t = await scanQR(); if (t) { $('#fc', m).value = t; m.querySelector('[data-x="add"]').click(); } }
    });
  };
  async function scanQR() {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
    catch (e) { toast('Kein Kamerazugriff.'); return null; }
    return new Promise((res) => {
      const m = modal(`<div class="mh"><h3>QR-Code scannen</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb"><video id="qv" playsinline muted style="width:100%;border-radius:12px;background:#000"></video><p class="small muted">Halte den QR-Code deines Freundes in die Kamera.</p></div>`, { onClose: () => { stop(); res(null); } });
      const v = $('#qv', m); v.srcObject = stream; v.play();
      const cv = document.createElement('canvas'); const cx = cv.getContext('2d', { willReadFrequently: true });
      let on = true;
      const det = G.BarcodeDetector ? new G.BarcodeDetector({ formats: ['qr_code'] }) : null;
      function stop() { on = false; stream.getTracks().forEach((t) => t.stop()); }
      async function loop() {
        if (!on) return;
        if (v.readyState >= 2) {
          let txt = null;
          if (det) { try { const r = await det.detect(v); if (r[0]) txt = r[0].rawValue; } catch (e) {} }
          if (!txt && G.jsQR) { cv.width = v.videoWidth; cv.height = v.videoHeight; cx.drawImage(v, 0, 0); const d = cx.getImageData(0, 0, cv.width, cv.height); const r = G.jsQR(d.data, d.width, d.height); if (r) txt = r.data; }
          if (txt) { stop(); m.remove(); return res(txt); }
        }
        setTimeout(loop, 200);
      }
      loop();
    });
  }

  // Einladen in Gruppe/Server
  ACT.invite = () => inviteDialog(K().chats[A.v.space] || chat());
  function inviteDialog(c) {
    if (!c || !c.state) return;
    const admin = K().isAdmin(c, K().id);
    const m = modal(`<div class="mh"><h3>Leute zu ${esc(c.state.name)} einladen</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb">
      ${admin ? `<div class="fld"><span>Freunde direkt hinzufügen</span><div style="max-height:28vh;overflow:auto">${Object.values(K().contacts).filter((x) => x.status === 'friend' && !c.state.members[x.card.id]).map((x) => `<label class="chk"><input type="checkbox" value="${x.card.id}">${av(K().contactName(x.card.id), K().contactColor(x.card.id), K().avatarOf(x.card.id), 'sm')}<span class="grow ell">${esc(K().contactName(x.card.id))}</span></label>`).join('') || '<div class="muted small">Alle deine Freunde sind schon drin.</div>'}</div><button class="btn sm" id="iadd" style="margin-top:6px">Hinzufügen</button></div>
      <div class="fld"><span>Oder Einladungslink erstellen</span><div class="row"><select class="inp" id="iexp"><option value="1">Läuft nach 1 Stunde ab</option><option value="24" selected>Läuft nach 24 Stunden ab</option><option value="168">Läuft nach 7 Tagen ab</option><option value="0">Läuft nie ab</option></select><button class="btn" id="imk">Erstellen</button></div></div><div id="iout"></div>` : '<p class="muted">Nur Admins können Leute einladen. Frag einen Admin nach einem Einladungslink.</p>'}
      </div>`);
    if (!admin) return;
    $('#iadd', m).onclick = async () => { const ids = $$('input:checked', m).map((i) => i.value); if (!ids.length) return; await K().addMembers(c.id, ids).catch((e) => toast(e.message)); m.close(); toast('Hinzugefügt'); };
    $('#imk', m).onclick = async () => {
      const link = await K().makeInvite(c.id, +$('#iexp', m).value);
      $('#iout', m).innerHTML = `<div class="row" style="gap:14px;align-items:flex-start;flex-wrap:wrap">${qrImg(link)}<div class="grow" style="min-width:200px"><div class="code">${esc(link)}</div><div class="row" style="margin-top:8px"><button class="btn sm" id="icp">${ic('copy', 's')} Kopieren</button>${navigator.share ? `<button class="btn sec sm" id="ish">${ic('fwd', 's')} Teilen</button>` : ''}</div><p class="tiny dim">Wer den Link hat, kann beitreten. Gebannte Personen werden abgelehnt.</p></div></div>`;
      $('#icp', m).onclick = () => copy(link);
      if ($('#ish', m)) $('#ish', m).onclick = () => navigator.share({ title: c.state.name, text: `Tritt „${c.state.name}“ auf Vaultline bei: ${link}` }).catch(() => {});
    };
  }
  A.inviteDialog = inviteDialog;

  ACT.serverMenu = async (el) => {
    const c = K().chats[A.v.space]; if (!c) return;
    const admin = K().isAdmin(c, K().id);
    const items = [];
    if (!c.left) items.push({ k: 'inv', t: 'Leute einladen', i: 'uplus' });
    if (admin) items.push({ k: 'set', t: 'Server-Einstellungen', i: 'settings' }, { k: 'chan', t: 'Kanal erstellen', i: 'plus' });
    items.push({ k: 'mem', t: 'Mitglieder', i: 'users' }, { k: 'mute', t: c.muted ? 'Stummschaltung aufheben' : 'Stummschalten', i: 'belloff' }, { k: 'read', t: 'Als gelesen markieren', i: 'checks' }, '-');
    items.push(c.left ? { k: 'delete', t: 'Server entfernen', i: 'trash', red: true } : { k: 'leave', t: 'Server verlassen', i: 'out', red: true });
    const k = await menu(items, el);
    if (k === 'inv') inviteDialog(c);
    else if (k === 'set') groupSettings(c);
    else if (k === 'chan') ACT.addChannel({ dataset: {} });
    else if (k === 'mem') { if (!A.v.chat || A.v.chat !== c.id) A.openChat(c.id); A.v.panel = 'info'; A.renderPanel(); }
    else A.chatAction(c, k);
  };
  ACT.addChannel = async (el) => {
    const c = K().chats[A.v.space]; if (!c) return;
    const m = modal(`<div class="mh"><h3>Kanal erstellen</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb"><div class="fld"><span>Art</span><label class="chk"><input type="radio" name="ct" value="text" checked>${ic('hash')}<span class="grow"><b>Text</b><br><span class="small muted">Nachrichten, Bilder, Umfragen</span></span></label><label class="chk"><input type="radio" name="ct" value="voice">${ic('vol')}<span class="grow"><b>Sprache</b><br><span class="small muted">Gemeinsam reden, Video und Bildschirm teilen</span></span></label></div><label class="fld"><span>Name</span><input class="inp" id="cn" maxlength="40" autofocus placeholder="neuer-kanal"></label></div><div class="mf"><button class="btn sec" data-close>Abbrechen</button><button class="btn" id="cgo">Erstellen</button></div>`);
    $('#cgo', m).onclick = async () => { const n = $('#cn', m).value.trim(); if (!n) return; const t = $('input[name=ct]:checked', m).value; m.close(); await K().addChannel(c.id, n, t, t === 'voice' ? 'Sprachkanäle' : (el.dataset.id && el.dataset.id !== 'Sprachkanäle' ? el.dataset.id : 'Textkanäle')).catch((e) => toast(e.message)); };
  };
  ACT.chanMenu = async (el, e) => {
    e.stopPropagation();
    const c = K().chats[A.v.space]; const chId = el.dataset.id; const ch = c.state.channels.find((x) => x.id === chId);
    const k = await menu([{ k: 'ren', t: 'Umbenennen', i: 'edit' }, { k: 'del', t: 'Kanal löschen', i: 'trash', red: true }], el);
    if (k === 'ren') { const n = await prompt2('Kanal umbenennen', 'Name', ch.name); if (n && n.trim()) K().renameChannel(c.id, chId, n.trim()); }
    else if (k === 'del') { if (await confirmBox('Kanal löschen?', `#${esc(ch.name)} wird für alle entfernt.`, 'Löschen', true)) { await K().removeChannel(c.id, chId); if (A.v.ch === chId) A.openChat(c.id); } }
  };

  // Gruppen-/Server-Einstellungen
  const TTL = [[0, 'Aus'], [300, '5 Minuten'], [3600, '1 Stunde'], [86400, '24 Stunden'], [604800, '7 Tage'], [7776000, '90 Tage']];
  async function smallImage(file, px = 160) {
    const url = URL.createObjectURL(file);
    try { const img = await loadImg(url); const c = document.createElement('canvas'); c.width = c.height = px; const s = Math.min(img.width, img.height); c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, px, px); return c.toDataURL('image/jpeg', 0.8); }
    finally { URL.revokeObjectURL(url); }
  }
  A.smallImage = smallImage;
  function groupSettings(c) {
    const st = c.state;
    let icon = st.icon || '', color = st.color;
    const m = modal(`<div class="mh"><h3>${c.kind === 'server' ? 'Server' : 'Gruppe'} bearbeiten</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb">
      <div class="row"><div id="gav">${av(st.name, color, icon, 'lg sq')}</div><div><button class="btn sec sm" id="gic">${ic('image', 's')} Bild wählen</button> ${icon ? `<button class="btn ghost sm" id="gicx">Entfernen</button>` : ''}<input type="file" accept="image/*" id="gif" class="hide"></div></div>
      <label class="fld"><span>Name</span><input class="inp" id="gname" maxlength="60" value="${esc(st.name)}"></label>
      <label class="fld"><span>Beschreibung</span><textarea class="inp" id="gdesc" maxlength="300">${esc(st.desc || '')}</textarea></label>
      <div class="fld"><span>Farbe</span><div class="colors" id="gcol">${G.Kreis.COLORS.map((x) => `<button style="background:${x}" data-c="${x}" class="${x === color ? 'on' : ''}"></button>`).join('')}</div></div>
      <label class="fld"><span>Selbstlöschende Nachrichten</span><select class="inp" id="gttl">${TTL.map(([v, l]) => `<option value="${v}" ${v === (st.ttl || 0) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="fld"><span>Rollen</span><div id="groles">${st.roles.map((r) => `<div class="row" style="padding:4px 0"><span style="width:12px;height:12px;border-radius:50%;background:${esc(r.color)}"></span><span class="grow">${esc(r.name)}</span><button class="ib" data-rdel="${r.id}">${ic('trash', 's')}</button></div>`).join('') || '<div class="muted small">Noch keine Rollen. Rollen geben Mitgliedern Farbe und Titel.</div>'}</div><div class="row" style="margin-top:6px"><input class="inp grow" id="rname" maxlength="30" placeholder="Neue Rolle, z. B. Pro-Gamer"><input type="color" id="rcol" value="#E25563" style="width:42px;height:42px;border:0;background:none"><button class="btn sec" id="radd">Hinzufügen</button></div></div>
      ${st.bans.length ? `<div class="fld"><span>Gebannt</span>${st.bans.map((b) => `<div class="row" style="padding:4px 0"><span class="grow">${esc(K().contactName(b))}</span><button class="btn sec sm" data-unban="${b}">Entbannen</button></div>`).join('')}</div>` : ''}
      </div><div class="mf"><button class="btn sec" data-close>Abbrechen</button><button class="btn" id="gsave">Speichern</button></div>`, { wide: false });
    $('#gic', m).onclick = () => $('#gif', m).click();
    $('#gif', m).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; icon = await smallImage(f, 128); $('#gav', m).innerHTML = av(st.name, color, icon, 'lg sq'); };
    if ($('#gicx', m)) $('#gicx', m).onclick = () => { icon = ''; $('#gav', m).innerHTML = av(st.name, color, '', 'lg sq'); };
    $('#gcol', m).onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; color = b.dataset.c; $$('#gcol button', m).forEach((x) => x.classList.toggle('on', x === b)); $('#gav', m).innerHTML = av(st.name, color, icon, 'lg sq'); };
    $('#radd', m).onclick = async () => { const n = $('#rname', m).value.trim(); if (!n) return; await K().addRole(c.id, n, $('#rcol', m).value); m.close(); groupSettings(K().chats[c.id]); };
    m.addEventListener('click', async (e) => {
      const r = e.target.closest('[data-rdel]'); if (r) { await K().removeRole(c.id, r.dataset.rdel); m.close(); groupSettings(K().chats[c.id]); }
      const u = e.target.closest('[data-unban]'); if (u) { await K().unban(c.id, u.dataset.unban); m.close(); groupSettings(K().chats[c.id]); }
    });
    $('#gsave', m).onclick = async () => {
      const ttl = +$('#gttl', m).value;
      await K().updateGroup(c.id, (s) => { s.name = $('#gname', m).value.trim() || s.name; s.desc = $('#gdesc', m).value.trim(); s.color = color; s.icon = icon; s.ttl = ttl; }).catch((er) => toast(er.message));
      m.close(); toast('Gespeichert');
    };
  }
  A.groupSettings = groupSettings;

  // ---------- Personen ----------
  A.userCard = async (id, anchor) => {
    const k = K(); const ct = k.contacts[id]; const c = chat();
    const isMe = id === k.id;
    const prof = isMe ? k.profile : (ct && ct.profile) || {};
    const role = c && c.state ? k.roleOf(c, id) : null;
    const admin = c && c.state && k.isAdmin(c, k.id) && !isMe && c.state.members[id];
    const btns = [];
    if (!isMe && ct && ct.status === 'friend') btns.push(`<button class="btn sm" data-u="msg">${ic('chat', 's')} Nachricht</button><button class="btn sec sm" data-u="call">${ic('phone', 's')}</button><button class="btn sec sm" data-u="vcall">${ic('video', 's')}</button>`);
    if (!isMe && (!ct || ct.status === 'pending-in') && k.memberCard(id)) btns.push(`<button class="btn sm" data-u="add">${ic('uplus', 's')} Als Freund hinzufügen</button>`);
    if (isMe) btns.push(`<button class="btn sec sm" data-u="me">${ic('edit', 's')} Profil bearbeiten</button>`);
    const p = pop(`<div style="width:300px;padding:6px"><div class="row">${av(k.contactName(id), k.contactColor(id), k.avatarOf(id), 'lg', isMe ? k.online : k.isOnline(id))}<div class="grow"><div style="font-weight:800;font-size:18px" class="ell">${esc(k.contactName(id))}</div>${role ? `<span class="role" style="color:${esc(role.color)}">${esc(role.name)}</span>` : ''}<div class="small muted">${esc(prof.status || '')}</div></div></div>${prof.bio ? `<div class="small" style="margin:10px 0;white-space:pre-wrap">${esc(prof.bio)}</div>` : ''}<div class="row wrap" style="margin-top:10px">${btns.join('')}</div>
      ${!isMe ? `<div class="menu" style="margin-top:8px">${ct ? `<button data-u="safety">${ic('shield', 's')}<span>Sicherheitsnummer${ct.verified ? ' (bestätigt)' : ''}</span></button>` : ''}${admin ? `<hr><button data-u="role">${ic('star', 's')}<span>Rollen</span></button><button data-u="adm">${ic('crown', 's')}<span>${k.isAdmin(c, id) ? 'Admin-Rechte entziehen' : 'Zum Admin machen'}</span></button><button data-u="kick" class="red">${ic('out', 's')}<span>Entfernen</span></button><button data-u="ban" class="red">${ic('ban', 's')}<span>Bannen</span></button>` : ''}</div>` : ''}</div>`, anchor, {});
    p.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-u]'); if (!b) return; closePop();
      const u = b.dataset.u;
      if (u === 'msg') { k.ensureDm(id); A.openChat('d:' + id); }
      else if (u === 'call' || u === 'vcall') { k.ensureDm(id); A.openChat('d:' + id); A.calls && A.calls.start('d:' + id, u === 'vcall'); }
      else if (u === 'add') { await k.addContact(k.memberCard(id)).catch((er) => toast(er.message)); toast('Anfrage gesendet'); }
      else if (u === 'me') A.settingsDialog('profil');
      else if (u === 'safety') safetyDialog(id);
      else if (u === 'adm') k.setAdmin(c.id, id, !k.isAdmin(c, id)).catch((er) => toast(er.message));
      else if (u === 'kick') { if (await confirmBox('Entfernen?', `${esc(k.contactName(id))} wird aus ${esc(c.state.name)} entfernt.`, 'Entfernen', true)) k.kick(c.id, id, false); }
      else if (u === 'ban') { if (await confirmBox('Bannen?', `${esc(k.contactName(id))} wird entfernt und kann nicht mehr über Links beitreten.`, 'Bannen', true)) k.kick(c.id, id, true); }
      else if (u === 'role') {
        if (!c.state.roles.length) { toast('Lege zuerst in den Einstellungen eine Rolle an.'); return groupSettings(c); }
        const mine = (c.state.memberRoles || {})[id] || [];
        const r = await menu(c.state.roles.map((x) => ({ k: x.id, t: (mine.includes(x.id) ? '✓ ' : '') + x.name, i: 'star' })), anchor);
        k.toggleRole(c.id, id, r);
      }
    });
  };
  async function safetyDialog(id) {
    const k = K(); const nums = await k.safetyNumber(id); const ct = k.contacts[id];
    const m = modal(`<div class="mh"><h3>Sicherheitsnummer</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb"><p class="muted small">Vergleiche diese Nummer mit ${esc(k.contactName(id))} – am besten persönlich oder per Anruf. Stimmt sie bei euch beiden überein, ist sicher, dass niemand dazwischen sitzt.</p><div class="safety">${nums.map((n) => `<span>${n}</span>`).join('')}</div>${ct ? `<label class="opt" style="margin-top:10px"><span class="grow">Als bestätigt markieren</span><span class="sw ${ct.verified ? 'on' : ''}" id="sv"></span></label>` : ''}</div>`);
    if (ct) $('#sv', m).parentElement.onclick = () => { const on = !$('#sv', m).classList.contains('on'); $('#sv', m).classList.toggle('on', on); k.markVerified(id, on); };
  }

  // ---------- Rechte Leiste ----------
  A.renderPanel = () => {
    const p = $('#panel'); if (!p) return;
    const c = chat();
    if (!c || !A.v.panel) { p.classList.remove('open'); return; }
    p.classList.add('open');
    const k = K(); let h = '', b = '';
    const close = `<button class="ib" data-a="closePanel">${ic(A.mobile() ? 'left' : 'x')}</button>`;
    if (A.v.panel === 'info') {
      if (c.kind === 'dm') {
        const id = c.peer, ct = k.contacts[id] || {}, prof = ct.profile || {};
        h = 'Kontaktinfo';
        const media = k.chatMsgs(c.id).filter((m) => m.file && m.file.kind === 'image' && !m.deleted).slice(-9).reverse();
        b = `<div style="text-align:center;padding:10px 0">${av(k.contactName(id), k.contactColor(id), k.avatarOf(id), 'lg', k.isOnline(id))}<h2 style="margin:10px 0 2px">${esc(k.contactName(id))}</h2>${ct.nick ? `<div class="small muted">eigentlich: ${esc(prof.name || ct.card.n)}</div>` : ''}<div class="small muted">${esc(prof.status || '')}</div></div>
          ${prof.bio ? `<div class="sect small" style="white-space:pre-wrap">${esc(prof.bio)}</div>` : ''}
          <div class="sect"><button class="item" data-p="safety">${ic('shield')}<div class="grow"><div class="nm">Verschlüsselung</div><div class="sub">${ct.verified ? 'Sicherheitsnummer bestätigt' : 'Sicherheitsnummer vergleichen'}</div></div></button>
          <button class="item" data-p="nick">${ic('edit')}<div class="grow"><div class="nm">Spitzname</div><div class="sub">${esc(ct.nick || 'Nur für dich sichtbar')}</div></div></button>
          <div class="item"><span>${ic('clock')}</span><div class="grow"><div class="nm">Selbstlöschende Nachrichten</div></div><select class="inp" style="width:auto;height:34px" data-p="ttl">${TTL.map(([v, l]) => `<option value="${v}" ${v === (c.ttl || 0) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <button class="item" data-p="mute">${ic(c.muted ? 'bell' : 'belloff')}<div class="grow nm">${c.muted ? 'Stummschaltung aufheben' : 'Stummschalten'}</div></button></div>
          ${media.length ? `<div class="grp-t">Medien</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">${media.map((m) => `<div class="att img" style="margin:0;aspect-ratio:1" data-a="jumpMsg" data-id="${m.id}">${A.blobs.get(m.chat + '|' + m.id) ? `<img src="${A.blobs.get(m.chat + '|' + m.id)}" style="width:100%;height:100%;object-fit:cover">` : `<img src="${esc(m.file.th || '')}" class="blur" style="width:100%;height:100%;object-fit:cover">`}</div>`).join('')}</div>` : ''}
          <div class="grp-t">Gemeinsame Gruppen</div>${Object.values(k.chats).filter((x) => x.state && !x.left && x.state.members[id]).map((x) => `<button class="item" data-a="chat" data-id="${x.id}">${av(x.state.name, x.state.color, x.state.icon, 'sm sq')}<span class="nm ell">${esc(x.state.name)}</span></button>`).join('') || '<div class="small muted" style="padding:4px 8px">Keine</div>'}
          <div class="sect" style="margin-top:12px">${ct.status === 'blocked' ? `<button class="item" data-a="unblock" data-id="${id}" style="color:var(--ok)">${ic('check')}<span class="nm" style="color:inherit">Freigeben</span></button>` : `<button class="item" data-p="block" style="color:var(--bad)">${ic('ban')}<span class="nm" style="color:inherit">${esc(k.contactName(id))} blockieren</span></button>`}<button class="item" data-p="remove" style="color:var(--bad)">${ic('trash')}<span class="nm" style="color:inherit">Freund entfernen</span></button><button class="item" data-p="clear" style="color:var(--bad)">${ic('trash')}<span class="nm" style="color:inherit">Chat leeren</span></button></div>`;
      } else {
        const st = c.state, admin = k.isAdmin(c, k.id);
        h = c.kind === 'server' ? 'Mitglieder' : 'Gruppeninfo';
        const mem = Object.values(st.members).sort((a, b) => (st.owner === b.id) - (st.owner === a.id) || (k.isAdmin(c, b.id) ? 1 : 0) - (k.isAdmin(c, a.id) ? 1 : 0) || (k.isOnline(b.id) ? 1 : 0) - (k.isOnline(a.id) ? 1 : 0) || k.contactName(a.id).localeCompare(k.contactName(b.id)));
        b = (c.kind !== 'server' ? `<div style="text-align:center;padding:10px 0">${av(st.name, st.color, st.icon, 'lg sq')}<h2 style="margin:10px 0 2px">${esc(st.name)}</h2><div class="small muted">${esc(st.desc || '')}</div></div>` : `<div class="small muted" style="padding:4px 8px 8px">${esc(st.desc || '')}</div>`)
          + `<div class="sect">${admin && !c.left ? `<button class="item" data-p="invite">${ic('uplus')}<span class="nm">Leute einladen</span></button><button class="item" data-p="settings">${ic('settings')}<span class="nm">${c.kind === 'server' ? 'Server' : 'Gruppe'} bearbeiten</span></button>` : ''}<button class="item" data-p="mute">${ic(c.muted ? 'bell' : 'belloff')}<span class="nm">${c.muted ? 'Stummschaltung aufheben' : 'Stummschalten'}</span></button>${st.ttl ? `<div class="item">${ic('clock')}<span class="sub">Nachrichten löschen sich nach ${G.Kreis.ttlLabel(st.ttl)}</span></div>` : ''}</div>`
          + `<div class="grp-t">Mitglieder – ${mem.length}</div>` + mem.map((x) => { const r = k.roleOf(c, x.id); return `<button class="item" data-a="user" data-id="${x.id}">${av(k.contactName(x.id), k.contactColor(x.id), k.avatarOf(x.id), 'sm', x.id === k.id ? k.online : k.isOnline(x.id))}<div class="grow"><div class="nm ell" style="${r ? 'color:' + esc(r.color) : ''}">${esc(k.contactName(x.id))}${x.id === k.id ? ' (du)' : ''}</div><div class="sub ell">${st.owner === x.id ? 'Besitzer' : k.isAdmin(c, x.id) ? 'Admin' : r ? esc(r.name) : ''}</div></div>${st.owner === x.id ? `<span style="color:var(--warn)">${ic('crown', 's')}</span>` : ''}</button>`; }).join('')
          + `<div class="sect" style="margin-top:12px">${c.left ? `<button class="item" data-p="delete" style="color:var(--bad)">${ic('trash')}<span class="nm" style="color:inherit">Chat löschen</span></button>` : `<button class="item" data-p="leave" style="color:var(--bad)">${ic('out')}<span class="nm" style="color:inherit">${c.kind === 'server' ? 'Server' : 'Gruppe'} verlassen</span></button>`}</div>`;
      }
    } else if (A.v.panel === 'search') {
      h = 'Im Chat suchen';
      b = `<div class="search">${ic('search', 's')}<input id="pq" placeholder="Suchbegriff" value="${esc(A.v.pq || '')}"></div><div id="pres" style="margin-top:8px"></div>`;
    } else if (A.v.panel === 'pins') {
      h = 'Angepinnt';
      const pins = k.chatMsgs(c.id, c.kind === 'server' ? A.v.ch : undefined).filter((m) => m.pinned && !m.deleted).reverse();
      b = pins.map((m) => `<button class="item" data-a="jumpMsg" data-id="${m.id}" style="align-items:flex-start">${av(k.contactName(m.from), k.contactColor(m.from), k.avatarOf(m.from), 'sm')}<div class="grow"><div class="nm small">${esc(k.contactName(m.from))} <span class="dim tiny">${shortTime(m.ts)}</span></div><div class="sub" style="white-space:normal">${esc(k.preview(m))}</div></div></button>`).join('') || '<div class="muted small" style="padding:12px">Noch nichts angepinnt. Öffne das Menü einer Nachricht und wähle „Anpinnen“.</div>';
    } else if (A.v.panel === 'thread') {
      h = 'Thread';
      const root = k.msgs.get(c.id + '|' + A.v.thread);
      const names = [];
      const rep = k.chatMsgs(c.id).filter((m) => m.reply === A.v.thread);
      b = root ? `<div style="margin:0 -8px">${A.msgHTML(root, null, c, names, { thread: true })}</div><div class="grp-t">${rep.length} ${rep.length === 1 ? 'Antwort' : 'Antworten'}</div><div style="margin:0 -8px">${rep.map((m, i) => A.msgHTML(m, rep[i - 1], c, names, { thread: true })).join('')}</div><div class="cbox" style="margin-top:10px"><textarea id="tta" rows="1" placeholder="Im Thread antworten"></textarea><button class="ib send" id="tsend">${ic('send')}</button></div>` : '<div class="muted">Nachricht nicht gefunden.</div>';
    }
    p.innerHTML = `<div class="side-h"><div class="t">${h}</div>${close}</div><div class="side-b">${b}</div>`;
    if (A.v.panel === 'search') {
      const q = $('#pq', p); const run = () => { A.v.pq = q.value; const r = k.search(q.value, c.id); $('#pres', p).innerHTML = q.value ? (r.map((m) => `<button class="item" data-a="jumpMsg" data-id="${m.id}" style="align-items:flex-start"><div class="grow"><div class="nm small">${esc(k.contactName(m.from))} <span class="dim tiny">${shortTime(m.ts)}</span></div><div class="sub" style="white-space:normal">${esc(m.text || (m.file && m.file.n) || '')}</div></div></button>`).join('') || '<div class="muted small" style="padding:8px">Nichts gefunden.</div>') : ''; };
      q.oninput = run; run(); setTimeout(() => q.focus(), 30);
    }
    if (A.v.panel === 'thread') {
      const ta = $('#tta', p); const send = async () => { const t = ta.value.trim(); if (!t) return; ta.value = ''; await K().send(c.id, { text: t, reply: A.v.thread, ch: c.kind === 'server' ? A.v.ch : undefined }).catch((e) => toast(e.message)); };
      if (ta) { ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }); $('#tsend', p).onclick = send; }
    }
    p.onclick = async (e) => {
      const x = e.target.closest('[data-p]'); if (!x) return;
      const a = x.dataset.p;
      if (a === 'safety') safetyDialog(c.peer);
      else if (a === 'nick') { const n = await prompt2('Spitzname', 'Spitzname (nur für dich sichtbar)', (k.contacts[c.peer] || {}).nick || ''); if (n !== null) k.setNick(c.peer, n.trim()); }
      else if (a === 'mute') A.chatAction(c, 'mute');
      else if (a === 'block') { if (await confirmBox('Blockieren?', 'Du bekommst keine Nachrichten und Anrufe mehr von dieser Person.', 'Blockieren', true)) k.block(c.peer); }
      else if (a === 'remove') { if (await confirmBox('Freund entfernen?', 'Ihr könnt euch danach nicht mehr schreiben, bis ihr euch neu hinzufügt.', 'Entfernen', true)) { k.removeContact(c.peer); A.closeChat(); } }
      else if (a === 'clear') A.chatAction(c, 'clear');
      else if (a === 'invite') inviteDialog(c);
      else if (a === 'settings') groupSettings(c);
      else if (a === 'leave') A.chatAction(c, 'leave');
      else if (a === 'delete') A.chatAction(c, 'delete');
    };
    p.onchange = (e) => { if (e.target.dataset.p === 'ttl') k.setTtl(c.id, +e.target.value); };
  };

  // ---------- Einstellungen ----------
  ACT.settings = (el) => A.settingsDialog(el && el.dataset && el.dataset.id);
  A.settingsDialog = (tab) => {
    const tabs = [['profil', 'Mein Profil', 'users'], ['privat', 'Privatsphäre & Sicherheit', 'lock'], ['noti', 'Benachrichtigungen', 'bell'], ['look', 'Aussehen', 'sun'], ['av', 'Sprache & Video', 'mic'], ['konto', 'Konto & Geräte', 'key'], ['about', 'Über Vaultline', 'info']];
    if (A.mobile()) {
      // Handy: Vollbild, erst Liste, dann Bereich mit Zurück-Pfeil
      history.pushState({ k: 'modal' }, '');
      const m = modal(`<div class="mh sheet-h"><button class="ib" data-back>${ic('left')}</button><h3 id="stitle">Einstellungen</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb" id="sbody"></div>`, { sheet: true, onClose: () => { if (!A._popClosing) { A._skipPop = true; history.back(); } A._popClosing = false; } });
      const body = $('#sbody', m), back = $('[data-back]', m), title = $('#stitle', m);
      const list = () => {
        title.textContent = 'Einstellungen'; back.style.visibility = 'hidden';
        const p = K().profile;
        body.innerHTML = `<div class="item" data-t="profil" style="cursor:pointer;margin-bottom:8px">${av(p.name, p.color, p.avatar, 'lg')}<div class="grow"><div class="nm" style="font-size:18px">${esc(p.name)}</div><div class="sub">${K().acct ? '@' + esc(K().acct.u) : 'Profil bearbeiten'}</div></div>${ic('right')}</div>`
          + tabs.filter((t) => t[0] !== 'profil').map(([k, l, i]) => `<button class="item" data-t="${k}" style="padding:14px 8px"><span class="av sm" style="background:var(--bg4);color:var(--tx)">${ic(i, 's')}</span><span class="nm grow">${l}</span>${ic('right', 's')}</button>`).join('');
      };
      const show = (t) => { const tb = tabs.find((x) => x[0] === t); title.textContent = tb ? tb[1] : ''; back.style.visibility = 'visible'; body.innerHTML = ''; body.scrollTop = 0; PANES[t](body, m); };
      m.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b && body.contains(b) && !b.closest('.pane-inner')) show(b.dataset.t); if (e.target.closest('[data-back]')) list(); });
      if (tab && PANES[tab]) show(tab); else list();
      return;
    }
    const m = modal(`<div class="set"><nav>${tabs.map(([k, l, i]) => `<button data-t="${k}">${ic(i, 's')}${l}</button>`).join('')}<div class="grow"></div><button data-close>${ic('x', 's')}Schließen</button></nav><div class="pane" id="spane"></div></div>`, { wide: true });
    const show = (t) => { $$('nav [data-t]', m).forEach((b) => b.classList.toggle('on', b.dataset.t === t)); PANES[t](($('#spane', m)), m); };
    m.addEventListener('click', (e) => { const b = e.target.closest('nav [data-t]'); if (b) show(b.dataset.t); });
    show(tab && tabs.some((x) => x[0] === tab) ? tab : 'profil');
  };
  const sw = (key, label, sub) => `<label class="opt" data-sw="${key}"><div class="grow"><div style="font-weight:600">${label}</div>${sub ? `<div class="small muted">${sub}</div>` : ''}</div><span class="sw ${K().settings[key] ? 'on' : ''}"></span></label>`;
  function bindSw(el) { el.addEventListener('click', (e) => { const o = e.target.closest('[data-sw]'); if (!o) return; e.preventDefault(); const k = o.dataset.sw; const v = !K().settings[k]; K().setSetting(k, v); $('.sw', o).classList.toggle('on', v); if (k === 'online' && v) K().presence(); }); }
  const PANES = {
    profil(el) {
      const k = K(), p = k.profile; let avatar = p.avatar || '', color = p.color;
      el.innerHTML = `<h3>Mein Profil</h3><div class="row"><div id="pav">${av(p.name, color, avatar, 'lg')}</div><div class="row wrap"><button class="btn sec sm" id="pic">${ic('image', 's')} Profilbild</button>${avatar ? '<button class="btn ghost sm" id="picx">Entfernen</button>' : ''}<input type="file" accept="image/*" class="hide" id="pif"></div></div>
        <label class="fld"><span>Name</span><input class="inp" id="pn" maxlength="40" value="${esc(p.name)}"></label>
        <label class="fld"><span>Status</span><input class="inp" id="ps" maxlength="80" value="${esc(p.status || '')}" placeholder="z. B. Am Zocken"></label>
        <label class="fld"><span>Über mich</span><textarea class="inp" id="pb" maxlength="300">${esc(p.bio || '')}</textarea></label>
        <div class="fld"><span>Farbe</span><div class="colors" id="pcol">${G.Kreis.COLORS.map((c) => `<button style="background:${c}" data-c="${c}" class="${c === color ? 'on' : ''}"></button>`).join('')}</div></div>
        <button class="btn" id="psave">Speichern</button>
        <div class="grp-t" style="padding-left:0;margin-top:20px">Meine Kennung</div><div class="code">${esc(k.id)}</div><button class="btn ghost sm" style="margin-top:6px" data-a="addFriend">${ic('qr', 's')} Meinen Einladungscode zeigen</button>`;
      const re = () => { $('#pav', el).innerHTML = av($('#pn', el).value || p.name, color, avatar, 'lg'); };
      $('#pic', el).onclick = () => $('#pif', el).click();
      $('#pif', el).onchange = async (e) => { const f = e.target.files[0]; if (f) { avatar = await smallImage(f, 160); re(); } };
      if ($('#picx', el)) $('#picx', el).onclick = () => { avatar = ''; re(); };
      $('#pcol', el).onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; color = b.dataset.c; $$('#pcol button', el).forEach((x) => x.classList.toggle('on', x === b)); re(); };
      $('#psave', el).onclick = async () => { await k.setProfile({ name: $('#pn', el).value.trim() || p.name, status: $('#ps', el).value.trim(), bio: $('#pb', el).value.trim(), color, avatar }); toast('Profil gespeichert'); A.renderAll(); };
    },
    privat(el) {
      const k = K(), S = k.store;
      el.innerHTML = `<h3>Privatsphäre & Sicherheit</h3>${sw('readReceipts', 'Lesebestätigungen senden', 'Andere sehen, wann du ihre Nachrichten gelesen hast.')}${sw('typing', '„Schreibt …“ anzeigen', 'Andere sehen, wenn du gerade tippst.')}${sw('online', 'Online-Status teilen', 'Freunde sehen, wann du online bist.')}
        <div class="grp-t" style="padding-left:0">App-Sperre</div><div class="opt" style="cursor:default"><div class="grow"><div style="font-weight:600">PIN-Sperre</div><div class="small muted">${S.hasPin() ? 'Aktiv. Vaultline sperrt sich beim Start und nach 5 Minuten im Hintergrund.' : 'Schützt deine Chats auf diesem Gerät mit einer PIN. Ohne PIN sind sie trotzdem verschlüsselt gespeichert.'}</div></div><button class="btn sec sm" id="pinset">${S.hasPin() ? 'Ändern' : 'PIN festlegen'}</button>${S.hasPin() ? '<button class="btn ghost sm" id="pinoff">Aus</button>' : ''}</div>
        <div class="grp-t" style="padding-left:0">Verschlüsselung</div><div class="note">${ic('shield')}<div>Jede Nachricht, Datei und jeder Anruf ist Ende-zu-Ende-verschlüsselt (ECDH P-256 + AES-256-GCM, signiert mit ECDSA). Der Server speichert nur verschlüsselte Umschläge, und das höchstens 30 Tage, bis sie abgeholt sind. Vergleiche mit Freunden die Sicherheitsnummer, um ganz sicher zu sein.</div></div>
        <div class="grp-t" style="padding-left:0">Gefahrenzone</div><button class="btn red sm" id="wipe">${ic('trash', 's')} Alle Daten auf diesem Gerät löschen</button>`;
      bindSw(el);
      $('#pinset', el).onclick = async () => {
        const a = await prompt2('PIN festlegen', 'Neue PIN (mindestens 4 Ziffern)', '', 'Weiter', { type: 'password', max: 12 }); if (a == null) return;
        if (!/^\d{4,12}$/.test(a)) return toast('Bitte 4 bis 12 Ziffern verwenden.');
        const b = await prompt2('PIN wiederholen', 'PIN noch einmal', '', 'Speichern', { type: 'password', max: 12 }); if (b !== a) return toast('Die PINs stimmen nicht überein.');
        await S.setPin(a); toast('PIN-Sperre aktiv'); PANES.privat(el);
      };
      if ($('#pinoff', el)) $('#pinoff', el).onclick = async () => { await S.setPin(null); toast('PIN-Sperre aus'); PANES.privat(el); };
      $('#wipe', el).onclick = async () => { if (await confirmBox('Wirklich alles löschen?', 'Dein Konto, alle Chats und Schlüssel werden von diesem Gerät gelöscht. Ohne Sicherung ist das endgültig.', 'Alles löschen', true)) { k.stop(); await S.wipe(); location.reload(); } };
    },
    noti(el) {
      const perm = G.Notification ? Notification.permission : 'n/a';
      el.innerHTML = `<h3>Benachrichtigungen</h3>${sw('notify', 'Benachrichtigungen zeigen', 'Bei neuen Nachrichten, Anfragen und Anrufen.')}${sw('sound', 'Ton abspielen')}
        ${!A.isCap && G.Notification && perm !== 'granted' ? `<div class="note warn" style="margin-top:10px">${ic('bell')}<div>Dein ${A.isDesk ? 'System' : 'Browser'} erlaubt noch keine Benachrichtigungen. <button class="btn sm" id="nperm" style="margin-top:6px">Erlauben</button></div></div>` : ''}
        ${A.isCap ? `<div class="note" style="margin-top:10px">${ic('info')}<div>Am Handy prüft Vaultline im Hintergrund etwa alle 15 Minuten auf neue Nachrichten (ohne Google-Dienste). Ist die App offen, kommen Nachrichten sofort an. Für zuverlässige Hinweise: Akku-Optimierung für Vaultline ausschalten.</div></div>` : ''}
        ${A.isDesk ? `<div class="note" style="margin-top:10px">${ic('info')}<div>Wenn du das Fenster schließt, läuft Vaultline unten rechts im Infobereich weiter – wie Discord. Über das Symbol dort kannst du es ganz beenden.</div></div>` : ''}`;
      bindSw(el);
      if ($('#nperm', el)) $('#nperm', el).onclick = () => Notification.requestPermission().then(() => PANES.noti(el));
    },
    look(el) {
      const k = K();
      el.innerHTML = `<h3>Aussehen</h3><div class="row" style="gap:12px"><button class="item" data-th="dark" style="border:2px solid ${k.settings.theme !== 'light' ? 'var(--accent)' : 'var(--line)'};flex:1">${ic('moon')}<span class="nm">Dunkel</span></button><button class="item" data-th="light" style="border:2px solid ${k.settings.theme === 'light' ? 'var(--accent)' : 'var(--line)'};flex:1">${ic('sun')}<span class="nm">Hell</span></button></div>
        ${sw('enterSends', 'Enter sendet die Nachricht', 'Mit Umschalt + Enter machst du eine neue Zeile. (Am Handy fügt Enter immer eine Zeile ein.)')}${sw('compress', 'Große Fotos verkleinern', 'Spart Datenvolumen. Aus = Originalqualität.')}`;
      if (k.settings.compress === undefined) k.settings.compress = true;
      bindSw(el);
      el.onclick = (e) => { const b = e.target.closest('[data-th]'); if (b) { k.setSetting('theme', b.dataset.th); A.theme(b.dataset.th); PANES.look(el); } };
    },
    async av(el) {
      const k = K();
      let devs = [];
      try { devs = await navigator.mediaDevices.enumerateDevices(); } catch (e) {}
      const opt = (kind, key) => `<option value="">Standard</option>` + devs.filter((d) => d.kind === kind).map((d, i) => `<option value="${esc(d.deviceId)}" ${k.settings[key] === d.deviceId ? 'selected' : ''}>${esc(d.label || (kind === 'audioinput' ? 'Mikrofon ' : kind === 'videoinput' ? 'Kamera ' : 'Lautsprecher ') + (i + 1))}</option>`).join('');
      el.innerHTML = `<h3>Sprache & Video</h3><label class="fld"><span>Mikrofon</span><select class="inp" data-dev="micId">${opt('audioinput', 'micId')}</select></label><div class="prog" style="height:8px"><i id="lvl"></i></div><button class="btn sec sm" id="mtest" style="margin-top:8px">${ic('mic', 's')} Mikrofon testen</button>
        <label class="fld"><span>Kamera</span><select class="inp" data-dev="camId">${opt('videoinput', 'camId')}</select></label>
        ${devs.some((d) => d.kind === 'audiooutput') ? `<label class="fld"><span>Lautsprecher</span><select class="inp" data-dev="spkId">${opt('audiooutput', 'spkId')}</select></label>` : ''}
        ${sw('noise', 'Rauschunterdrückung')}${sw('echo', 'Echo-Unterdrückung')}${sw('pushToTalk', 'Push-to-Talk', 'Mikrofon ist nur an, solange du die Taste gedrückt hältst (während das Vaultline-Fenster aktiv ist).')}
        <label class="fld"><span>Push-to-Talk-Taste</span><input class="inp" id="pttk" readonly value="${esc((k.settings.pttKey || 'KeyV').replace('Key', ''))}" style="cursor:pointer" title="Klicken und Taste drücken"></label>
        <div class="grp-t" style="padding-left:0">Verbindung für Anrufe</div><div class="note" id="iceinfo">${ic('globe')}<div>Prüfe Vermittlungs-Server …</div></div><button class="btn sec sm" id="icetest" style="margin-top:8px">${ic('refresh', 's')} Verbindung testen</button>
        <label class="fld"><span>Eigener TURN-Server (optional, für schwierige Netze)</span><input class="inp" id="turn" placeholder="turn:server:3478|benutzer|passwort" value="${esc(k.settings.turn || '')}"></label><p class="tiny dim">Anrufe laufen direkt zwischen euren Geräten. In manchen Mobilfunk- oder Firmennetzen klappt das nur über einen Vermittlungs-Server (TURN).</p>`;
      bindSw(el);
      el.onchange = (e) => { const d = e.target.dataset.dev; if (d) k.setSetting(d, e.target.value); };
      $('#turn', el).onchange = (e) => k.setSetting('turn', e.target.value.trim());
      $('#pttk', el).onclick = (e) => { e.target.value = 'Taste drücken …'; const h = (ev) => { ev.preventDefault(); k.setSetting('pttKey', ev.code); e.target.value = ev.code.replace('Key', ''); removeEventListener('keydown', h, true); }; addEventListener('keydown', h, true); };
      const iceCheck = async () => {
        const box = $('#iceinfo', el); if (!box) return;
        box.innerHTML = `${ic('globe')}<div>Teste Verbindung …</div>`;
        if (A.calls) { A.calls.iceCache = null; await A.calls.loadIce(); }
        const turn = A.calls && A.calls.iceCache && A.calls.iceCache.turn;
        let types = {};
        try {
          const pc = new RTCPeerConnection({ iceServers: A.calls ? A.calls.ice() : [] });
          pc.onicecandidate = (e) => { if (e.candidate) { const t = (e.candidate.candidate.match(/typ (\w+)/) || [])[1]; types[t] = 1; } };
          pc.createDataChannel('t'); await pc.setLocalDescription(await pc.createOffer());
          await new Promise((r) => { const t = setTimeout(r, 6000); pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } }; });
          pc.close();
        } catch (e) {}
        if (!el.isConnected) return;
        const ok = types.relay ? 'Vermittlungs-Server erreichbar – Anrufe klappen auch in schwierigen Netzen.' : turn ? 'Vermittlungs-Server ist eingerichtet, aber von hier gerade nicht erreichbar.' : 'Kein Vermittlungs-Server eingerichtet. Anrufe klappen nur, wenn eure Netze direkte Verbindungen erlauben (bei Mobilfunk oft nicht).';
        box.className = 'note ' + (types.relay ? '' : 'warn');
        box.innerHTML = `${ic(types.relay ? 'check' : 'info')}<div>${esc(ok)}<div class="tiny dim" style="margin-top:4px">Gefunden: ${esc(Object.keys(types).join(', ') || 'nichts')}</div></div>`;
      };
      $('#icetest', el).onclick = iceCheck; iceCheck();
      $('#mtest', el).onclick = async () => {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: k.settings.micId || undefined, noiseSuppression: k.settings.noise, echoCancellation: k.settings.echo } });
          const ac = new AudioContext(), an = ac.createAnalyser(); ac.createMediaStreamSource(s).connect(an); const b = new Uint8Array(an.fftSize);
          const t = setInterval(() => { an.getByteTimeDomainData(b); let mx = 0; for (const v of b) mx = Math.max(mx, Math.abs(v - 128)); const l = $('#lvl'); if (l) l.style.width = Math.min(100, mx / 128 * 180) + '%'; else { clearInterval(t); s.getTracks().forEach((x) => x.stop()); ac.close(); } }, 60);
          setTimeout(() => { clearInterval(t); s.getTracks().forEach((x) => x.stop()); ac.close(); }, 8000);
          if (!devs.some((d) => d.label)) setTimeout(() => PANES.av(el), 8200);
        } catch (e) { toast('Kein Zugriff aufs Mikrofon'); }
      };
    },
    konto(el) {
      const k = K();
      const devs = k.devices || [];
      const backup = `<div class="grp-t" style="padding-left:0;margin-top:22px">Sicherungsdatei</div><p class="small muted" style="margin-top:0">Zusätzlich zum Konto kannst du alles in eine mit Passwort verschlüsselte Datei sichern.</p><div class="row wrap"><button class="btn sec sm" id="bexp">${ic('dl', 's')} Sicherung erstellen</button><button class="btn ghost sm" id="bimp">Sicherung laden</button></div>`;
      if (!k.acct) {
        el.innerHTML = `<h3>Konto & Geräte</h3><div class="note">${ic('key')}<div>Leg dir einen <b>Benutzernamen und ein Passwort</b> an. Dann kannst du dich auch am Handy, am Laptop oder im Browser anmelden – mit all deinen Chats. Und Freunde finden dich einfach per @Benutzername.</div></div>
          <label class="fld"><span>Benutzername</span><input class="inp" id="au" maxlength="21" placeholder="z. B. jonas_k" autocapitalize="none" spellcheck="false"></label>
          <label class="fld"><span>Passwort (mind. 8 Zeichen)</span><input class="inp" id="ap" type="password" autocomplete="new-password"></label>
          <label class="fld"><span>Passwort wiederholen</span><input class="inp" id="ap2" type="password" autocomplete="new-password"></label>
          <p class="small muted">Dein Passwort verlässt nie dein Gerät – der Server bekommt nur einen daraus berechneten Schlüssel. Deshalb kann es auch niemand zurücksetzen.</p>
          <button class="btn" id="acreate">Konto erstellen</button>` + backup;
        $('#acreate', el).onclick = async (e) => {
          const u = $('#au', el).value.trim(), p1 = $('#ap', el).value;
          if (p1 !== $('#ap2', el).value) return toast('Die Passwörter stimmen nicht überein.');
          e.target.disabled = true; e.target.textContent = 'Wird angelegt …';
          try { await k.createAccount(u, p1); toast('Konto @' + k.acct.u + ' erstellt'); PANES.konto(el); A.renderAll(); }
          catch (er) { e.target.disabled = false; e.target.textContent = 'Konto erstellen'; toast(er.message, 4000); }
        };
      } else {
        el.innerHTML = `<h3>Konto & Geräte</h3><div class="row" style="padding:6px 0 10px">${av(k.profile.name, k.profile.color, k.profile.avatar, 'lg')}<div><div style="font-weight:800;font-size:20px">@${esc(k.acct.u)}</div><div class="small muted">Freunde können dich mit diesem Benutzernamen hinzufügen.</div><button class="btn ghost sm" style="margin-top:6px;padding-left:0" id="acopy">${ic('copy', 's')} Benutzernamen kopieren</button></div></div>
          <div class="grp-t" style="padding-left:0">Angemeldete Geräte</div>
          ${devs.map((d) => `<div class="opt" style="cursor:default"><span class="av sm" style="background:var(--bg4);color:var(--tx)">${ic(/Handy|Android|iPhone/.test(d.n) ? 'phone' : /Browser/.test(d.n) ? 'globe' : 'screen', 's')}</span><div class="grow"><div style="font-weight:600">${esc(d.n)}${d.b === k.me.box ? ' <span class="small" style="color:var(--ok)">· dieses Gerät</span>' : ''}</div><div class="small muted">angemeldet ${esc(new Date(d.at).toLocaleDateString('de-DE'))}</div></div>${d.b === k.me.box ? '' : `<button class="btn ghost sm" data-rm="${esc(d.b)}" style="color:var(--bad)">Abmelden</button>`}</div>`).join('') || '<div class="small muted">Wird geladen …</div>'}
          <p class="small muted">Neues Gerät hinzufügen: Vaultline dort installieren und mit <b>@${esc(k.acct.u)}</b> und deinem Passwort anmelden.</p>
          <div class="row wrap" style="margin-top:10px"><button class="btn sec sm" id="apw">${ic('key', 's')} Passwort ändern</button><button class="btn ghost sm" id="aout" style="color:var(--bad)">${ic('out', 's')} Auf diesem Gerät abmelden</button></div>` + backup;
        $('#acopy', el).onclick = () => copy('@' + k.acct.u);
        el.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = async () => { if (!(await confirmBox('Gerät abmelden?', 'Das Gerät bekommt danach keine neuen Nachrichten mehr und wird beim nächsten Start abgemeldet.', 'Abmelden', true))) return; try { await k.removeDevice(b.dataset.rm); toast('Gerät abgemeldet'); PANES.konto(el); } catch (e) { toast(e.message); } }; });
        $('#apw', el).onclick = async () => {
          const o = await prompt2('Passwort ändern', 'Aktuelles Passwort', '', 'Weiter', { type: 'password', max: 200 }); if (o == null) return;
          const n1 = await prompt2('Passwort ändern', 'Neues Passwort (mind. 8 Zeichen)', '', 'Weiter', { type: 'password', max: 200 }); if (n1 == null) return;
          const n2 = await prompt2('Passwort ändern', 'Neues Passwort wiederholen', '', 'Ändern', { type: 'password', max: 200 }); if (n2 == null) return;
          if (n1 !== n2) return toast('Die neuen Passwörter stimmen nicht überein.');
          try { await k.changePassword(o, n1); toast('Passwort geändert. Deine anderen Geräte musst du neu anmelden.', 4500); } catch (e) { toast(e.message, 4000); }
        };
        $('#aout', el).onclick = async () => {
          if (!(await confirmBox('Abmelden?', 'Vaultline wird auf diesem Gerät gelöscht. Deine Chats bleiben auf deinen anderen Geräten und kommen zurück, wenn du dich hier wieder anmeldest.', 'Abmelden', true))) return;
          await k.logoutHere(); location.reload();
        };
        k.accountRefresh().then(() => { if (el.isConnected && (k.devices || []).length !== devs.length) PANES.konto(el); });
      }
      $('#bexp', el).onclick = async () => {
        const a = await prompt2('Sicherung erstellen', 'Passwort für die Sicherung (mind. 8 Zeichen)', '', 'Weiter', { type: 'password', max: 100 }); if (a == null) return;
        if (a.length < 8) return toast('Bitte mindestens 8 Zeichen verwenden.');
        const b = await prompt2('Passwort wiederholen', 'Passwort noch einmal', '', 'Sicherung erstellen', { type: 'password', max: 100 }); if (b !== a) return toast('Die Passwörter stimmen nicht überein.');
        toast('Sicherung wird erstellt …');
        const data = await k.exportBackup(a);
        const name = 'kreis-sicherung-' + new Date().toISOString().slice(0, 10) + '.json';
        if (A.isCap && Cap().Filesystem) {
          try { const r = await Cap().Filesystem.writeFile({ path: name, data, directory: 'DOCUMENTS', encoding: 'utf8' }); if (Cap().Share) await Cap().Share.share({ title: name, files: [r.uri] }); else toast('In „Dokumente“ gespeichert'); } catch (e) { toast('Speichern fehlgeschlagen'); }
        } else { const a2 = document.createElement('a'); a2.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a2.download = name; a2.click(); }
      };
      $('#bimp', el).onclick = () => A.restoreDialog(() => location.reload());
    },
    about(el) {
      el.innerHTML = `<h3>Über Vaultline</h3><div class="row">${G.UI.LOGO}<div><div style="font-weight:800;font-size:20px">Vaultline ${esc(CFG.version)}</div><div class="small muted">${A.isDesk ? 'Windows-Programm' : A.isCap ? 'Android-App' : 'Web-App'} · Build ${esc(String(CFG.build))}</div></div></div>
        <button class="btn sec sm" id="upd" style="margin-top:12px">${ic('refresh', 's')} Nach Updates suchen</button>
        <p class="small muted" style="margin-top:14px">Vaultline ist ein privater Messenger für dich und deine Freunde. Downloads für Handy und PC: <a href="${esc(CFG.web)}" data-a="ext">${esc(CFG.web)}</a></p>
        <p class="tiny dim">Enthält qrcode-generator (MIT, Kazuhiko Arase) und jsQR (Apache 2.0, Cosmo Wolfe).</p>`;
      $('#upd', el).onclick = () => A.checkUpdate(true);
    },
  };
  A.accountHint = () => {
    try { localStorage.setItem('kreis.acctHint', '1'); } catch (e) {}
    const b = document.createElement('div'); b.className = 'banner';
    b.innerHTML = `${ic('key')}<div class="grow"><div style="font-weight:700">Neu: Vaultline auf all deinen Geräten</div><div class="small muted">Leg dir Benutzername + Passwort an und melde dich auch am Handy an.</div></div><button class="btn sm" data-g>Einrichten</button><button class="ib" data-x>${ic('x', 's')}</button>`;
    document.body.appendChild(b);
    b.querySelector('[data-x]').onclick = () => b.remove();
    b.querySelector('[data-g]').onclick = () => { b.remove(); A.settingsDialog('konto'); };
  };
  A.restoreDialog = (done) => {
    const m = modal(`<div class="mh"><h3>Sicherung laden</h3><button class="ib" data-close>${ic('x')}</button></div><div class="mb"><label class="fld"><span>Sicherungsdatei</span><input type="file" accept=".json,application/json" class="inp" id="rf" style="padding-top:8px"></label><label class="fld"><span>Passwort</span><input class="inp" type="password" id="rp"></label></div><div class="mf"><button class="btn sec" data-close>Abbrechen</button><button class="btn" id="rgo">Wiederherstellen</button></div>`);
    $('#rgo', m).onclick = async () => {
      const f = $('#rf', m).files[0]; if (!f) return toast('Bitte eine Datei wählen.');
      try { $('#rgo', m).disabled = true; await A.K.importBackup(await f.text(), $('#rp', m).value); m.close(); toast('Wiederhergestellt'); done && done(); }
      catch (e) { $('#rgo', m).disabled = false; toast(e.message); }
    };
  };

  // ---------- Schnellwechsel (Strg+K) ----------
  A.quickSwitch = () => {
    const m = modal(`<div class="mb" style="padding-top:18px"><div class="search">${ic('search', 's')}<input id="qs" autofocus placeholder="Wohin willst du?"></div><div id="qr" style="margin-top:8px;max-height:50vh;overflow:auto"></div></div>`);
    const run = () => {
      const q = $('#qs', m).value.toLowerCase();
      const list = Object.values(K().chats).filter((c) => K().chatTitle(c).toLowerCase().includes(q)).slice(0, 12);
      $('#qr', m).innerHTML = list.map((c) => `<button class="item" data-q="${c.id}">${c.kind === 'dm' ? av(K().chatTitle(c), K().contactColor(c.peer), K().avatarOf(c.peer), 'sm') : av(c.state.name, c.state.color, c.state.icon, 'sm sq')}<span class="nm">${esc(K().chatTitle(c))}</span></button>`).join('');
    };
    $('#qs', m).oninput = run; run();
    $('#qs', m).onkeydown = (e) => { if (e.key === 'Enter') { const b = $('#qr [data-q]', m); if (b) b.click(); } };
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) { m.close(); A.openChat(b.dataset.q); } });
  };

  // ---------- Links von außen ----------
  A.handleHash = () => {
    const h = location.hash || '';
    if (!h || !A.K || !A.K.me) return;
    const add = h.match(/add=(K1[A-Za-z0-9_-]+)/), join = h.match(/join=(J1[A-Za-z0-9_-]+)/);
    history.replaceState(null, '', location.pathname + location.search);
    if (add) { const c = A.K.parseCode(add[1]); if (c && c.id !== A.K.id) confirmBox('Freund hinzufügen?', `Möchtest du <b>${esc(c.n)}</b> als Freund hinzufügen?`, 'Hinzufügen').then((ok) => ok && A.K.addContact(c).then(() => toast('Anfrage gesendet')).catch((e) => toast(e.message))); }
    if (join) joinDialog(join[1]);
  };
  A.openExternal = (url) => {
    if (A.isDesk) G.kreisDesktop.open(url);
    else G.open(url, '_blank', 'noopener');
  };

  // ---------- Benachrichtigungen ----------
  A.setupNotifications = async () => {
    const k = K();
    if (A.isCap) {
      const LN = Cap().LocalNotifications;
      if (LN) { try { await LN.requestPermissions(); LN.addListener('localNotificationActionPerformed', (a) => { const ex = a.notification.extra || {}; if (ex.chat) A.openChat(ex.chat, ex.ch); }); } catch (e) {} }
      const KP = Cap().KreisPush;
      if (KP) { try { await KP.configure({ url: CFG.url, key: CFG.key, box: k.me.box }); const r = await KP.takeOpen(); if (r && r.open) setTimeout(() => {}, 0); } catch (e) {} }
    } else if (G.Notification && Notification.permission === 'default') {
      const ask = () => { Notification.requestPermission(); removeEventListener('click', ask); };
      addEventListener('click', ask);
    }
    if (A.isDesk && G.kreisDesktop.onOpenChat) G.kreisDesktop.onOpenChat((id) => A.openChat(id));
  };
  let nid = 1;
  A.notify = async (n) => {
    const k = K();
    const visibleSame = document.visibilityState === 'visible' && document.hasFocus() && n.chat && n.chat === A.v.chat;
    if (visibleSame) return;
    if (k.settings.sound && n.kind !== 'call') beep('msg');
    if (!k.settings.notify) return;
    const appVisible = document.visibilityState === 'visible' && document.hasFocus();
    if (appVisible) {
      const b = document.createElement('div'); b.className = 'banner'; b.style.cursor = 'pointer';
      b.innerHTML = `<div class="grow" style="min-width:0"><div style="font-weight:700" class="ell">${esc(n.title)}</div><div class="small muted ell">${esc(n.body)}</div></div><button class="ib">${ic('x', 's')}</button>`;
      b.onclick = (e) => { b.remove(); if (!e.target.closest('.ib')) { if (n.chat) A.openChat(n.chat, n.ch); else if (n.kind === 'request') { A.v.space = 'home'; A.v.tab = 'requests'; A.renderAll(); } } };
      document.querySelectorAll('.banner').forEach((x) => x.remove());
      document.body.appendChild(b); setTimeout(() => b.remove(), 4500);
      return;
    }
    if (A.isCap && Cap().LocalNotifications) {
      try { await Cap().LocalNotifications.schedule({ notifications: [{ id: nid++, title: n.title, body: n.body, extra: { chat: n.chat || '', ch: n.ch || '' }, smallIcon: 'ic_stat_kreis' }] }); } catch (e) {}
      return;
    }
    if (A.isDesk) { G.kreisDesktop.notify(n.title, n.body, n.chat || ''); return; }
    if (G.Notification && Notification.permission === 'granted') {
      try { const no = new Notification(n.title, { body: n.body, tag: n.chat || n.kind, icon: 'icons/icon-192.png', silent: true }); no.onclick = () => { focus(); if (n.chat) A.openChat(n.chat, n.ch); no.close(); }; } catch (e) {}
    }
  };

  // ---------- Updates ----------
  A.checkUpdate = async (manual) => {
    if (!A.isCap && !A.isDesk) { if (manual) toast('Die Web-App ist immer auf dem neuesten Stand.'); return; }
    try {
      const r = await fetch(CFG.web + 'version.json?t=' + Date.now(), { cache: 'no-store' });
      const v = await r.json();
      if (!(v.build > CFG.build)) { if (manual) toast('Du hast die neueste Version.'); return; }
      document.querySelectorAll('.banner.upd').forEach((x) => x.remove());
      const b = document.createElement('div'); b.className = 'banner upd';
      b.innerHTML = `${ic('dl')}<div class="grow"><div style="font-weight:700">Vaultline ${esc(v.name)} ist da</div><div class="small muted">${esc((v.notes || []).slice(0, 2).join(' · '))}</div></div><button class="btn sm" data-u>Aktualisieren</button><button class="ib" data-x>${ic('x', 's')}</button>`;
      document.body.appendChild(b);
      b.querySelector('[data-x]').onclick = () => b.remove();
      b.querySelector('[data-u]').onclick = async () => {
        if (A.isDesk) { b.querySelector('[data-u]').textContent = 'Lädt …'; G.kreisDesktop.update(v.exe); return; }
        const U = Cap().Updater;
        if (!U) return A.openExternal(CFG.web);
        try {
          const info = await U.info();
          if (!info.canInstall) { toast('Erlaube Vaultline einmal, Apps zu installieren, und tippe dann nochmal auf Aktualisieren.'); await U.allowInstall(); return; }
          b.querySelector('[data-u]').textContent = 'Lädt …';
          await U.download({ url: v.apk });
          await U.install();
        } catch (e) { toast('Update fehlgeschlagen – lade es über die Webseite.'); A.openExternal(CFG.web); }
      };
    } catch (e) { if (manual) toast('Update-Prüfung nicht möglich.'); }
  };

  // ---------- Anrufe (Knöpfe) ----------
  Object.assign(ACT, {
    call(el) { const c = chat(); if (A.calls && c) A.calls.start(c.id, el.dataset.id === 'video'); },
    callUser(el) { const id = el.dataset.id; K().ensureDm(id); A.openChat('d:' + id); if (A.calls) A.calls.start('d:' + id, false); },
    callLeave() { if (A.calls) A.calls.leave(); },
    callShow() { if (A.calls && A.calls.room) { const r = A.calls.room; A.openChat(r.chatId, r.ch && K().chats[r.chatId].kind === 'server' ? (K().chats[r.chatId].state.channels.find((x) => x.type === 'text') || {}).id : null); A.calls.showView = true; A.calls.renderView(); } },
    toggleMic() { if (A.calls) A.calls.toggleMic(); },
    toggleDeaf() { if (A.calls) A.calls.toggleDeaf(); },
    voice(el, e) { if (e.target.closest('.act')) return; if (A.calls) A.calls.joinVoice(A.v.space, el.dataset.id); },
  });
})(window);
