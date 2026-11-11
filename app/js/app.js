/* Vaultline – Oberfläche: Start, Gerüst, Seitenleisten, Chatfenster, Nachrichten, Eingabe */
(function (G) {
  'use strict';
  const { ic, LOGO, esc, $, $$, av, time, dayLabel, shortTime, size, dur, md, onlyEmoji, toast, modal, confirmBox, prompt2, pop, closePop, menu, emojiPicker, copy } = G.UI;
  const CFG = G.KREIS_CFG;
  const A = G.A = { v: { space: 'home', tab: 'chats', chat: null, ch: null, panel: null, reply: null, edit: null, thread: null, q: '' }, blobs: new Map(), loading: new Set(), uploads: {} };
  A.isCap = !!(G.Capacitor && G.Capacitor.isNativePlatform && G.Capacitor.isNativePlatform());
  A.isDesk = !!G.kreisDesktop;
  A.touch = matchMedia('(pointer: coarse)').matches;
  A.mobile = () => innerWidth <= 860;
  let K, S, N;

  // ---------- Start ----------
  function theme(t) { document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark'; try { localStorage.setItem('kreis.theme', t); } catch (e) {} }
  A.theme = theme;
  async function boot() {
    try { theme(localStorage.getItem('kreis.theme') || 'dark'); } catch (e) {}
    if (!G.crypto || !G.crypto.subtle) { document.body.innerHTML = '<div class="start"><div class="card"><h1>Vaultline</h1><p>Dieses Gerät unterstützt die nötige Verschlüsselung nicht (WebCrypto fehlt). Bitte öffne Vaultline über https oder aktualisiere den Browser bzw. Android System WebView.</p></div></div>'; return; }
    S = await G.KStore.browser('kreis');
    N = G.__testNet ? G.__testNet() : new G.KNet({ url: CFG.url, key: CFG.key });
    K = A.K = new G.Kreis(S, N);
    const ua = navigator.userAgent;
    K.deviceName = A.isDesk ? 'Windows-PC' : A.isCap ? 'Android-Handy' : /iPhone|iPad/.test(ua) ? 'iPhone (Browser)' : /Android/.test(ua) ? 'Android (Browser)' : 'Browser';
    const st = S.state();
    if (st === 'new') return welcome();
    if (st === 'locked') return lockScreen();
    await S.open();
    if (!(await K.init())) return welcome();
    startApp();
  }

  function startScreen(html) { let s = $('#start'); if (!s) { s = document.createElement('div'); s.id = 'start'; s.className = 'start'; document.body.appendChild(s); } s.innerHTML = `<div class="card">${html}</div>`; return s; }
  function welcome(tab) {
    let color = G.Kreis.COLORS[0];
    tab = tab || 'new';
    const feats = `<div class="feat"><div class="ic">${ic('lock')}</div><div><b style="color:var(--tx)">Ende-zu-Ende-verschlüsselt</b><br>Nur ihr könnt eure Nachrichten, Bilder und Anrufe sehen. Auch dein Passwort verlässt nie dein Gerät.</div></div>
      <div class="feat"><div class="ic">${ic('server')}</div><div><b style="color:var(--tx)">Am PC, Handy und im Browser</b><br>Ein Konto auf allen Geräten gleichzeitig – wie bei Discord und WhatsApp.</div></div>`;
    const s = startScreen(`${LOGO}<h1>Willkommen bei Vaultline</h1><p class="muted" style="margin-top:0">Dein privater Messenger für dich und deine Freunde.</p>
      <div class="tabs" style="margin:6px 0 4px"><button class="tab ${tab === 'new' ? 'on' : ''}" data-w="new">Konto erstellen</button><button class="tab ${tab === 'login' ? 'on' : ''}" data-w="login">Anmelden</button></div>
      ${tab === 'new' ? `
      <label class="fld"><span>Dein Name (sehen deine Freunde)</span><input class="inp" id="w-name" maxlength="40" placeholder="z. B. Jonas" autofocus></label>
      <label class="fld"><span>Benutzername (zum Anmelden und Finden)</span><input class="inp" id="w-user" maxlength="21" placeholder="z. B. jonas_k" autocapitalize="none" autocomplete="username" spellcheck="false"></label>
      <label class="fld"><span>Passwort (mind. 8 Zeichen)</span><input class="inp" id="w-pass" type="password" autocomplete="new-password"></label>
      <label class="fld"><span>Passwort wiederholen</span><input class="inp" id="w-pass2" type="password" autocomplete="new-password"></label>
      <div class="fld"><span class="small muted" style="display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">Farbe</span><div class="colors" id="w-col">${G.Kreis.COLORS.map((c, i) => `<button style="background:${c}" data-c="${c}" class="${i ? '' : 'on'}"></button>`).join('')}</div></div>
      <div class="note small" style="margin:6px 0 4px">${ic('info', 's')}<span>Merk dir dein Passwort gut. Weil alles verschlüsselt ist, kann es niemand zurücksetzen – auch wir nicht.</span></div>
      <button class="btn full" id="w-go" style="margin-top:8px">Konto erstellen</button>` : `
      <label class="fld"><span>Benutzername</span><input class="inp" id="w-user" maxlength="21" autocapitalize="none" autocomplete="username" spellcheck="false" autofocus></label>
      <label class="fld"><span>Passwort</span><input class="inp" id="w-pass" type="password" autocomplete="current-password"></label>
      <button class="btn full" id="w-go" style="margin-top:8px">Anmelden</button>
      <p class="small muted">Deine Chats werden von deinem anderen Gerät geholt, sobald es einmal online ist.</p>`}
      ${feats}
      <button class="btn ghost full small" id="w-restore" style="margin-top:4px">${ic('dl', 's')} Aus einer Sicherungsdatei wiederherstellen</button>
      <button class="btn ghost full small" id="w-local">Ohne Konto starten (nur dieses Gerät)</button>`);
    $$('[data-w]', s).forEach((b) => { b.onclick = () => welcome(b.dataset.w); });
    const col = $('#w-col', s);
    if (col) col.onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; color = b.dataset.c; $$('#w-col button').forEach((x) => x.classList.toggle('on', x === b)); };
    const busy = (t) => { const b = $('#w-go'); b.disabled = !!t; b.textContent = t || (tab === 'new' ? 'Konto erstellen' : 'Anmelden'); };
    const go = async () => {
      const user = $('#w-user').value.trim(), pass = $('#w-pass').value;
      try {
        if (tab === 'new') {
          const name = $('#w-name').value.trim();
          if (!name) { $('#w-name').focus(); return toast('Bitte gib einen Namen ein.'); }
          if (!/^@?[a-zA-Z0-9_.]{3,20}$/.test(user)) { $('#w-user').focus(); return toast('Benutzername: 3–20 Zeichen, nur Buchstaben, Zahlen, Punkt und Unterstrich.'); }
          if (pass.length < 8) return toast('Das Passwort braucht mindestens 8 Zeichen.');
          if (pass !== $('#w-pass2').value) return toast('Die Passwörter stimmen nicht überein.');
          busy('Schlüssel werden erzeugt …');
          if (!K.me) await K.setup(name, color); else await K.setProfile({ name, color });
          busy('Konto wird angelegt …');
          await K.createAccount(user, pass);
        } else {
          if (!user || !pass) return toast('Bitte Benutzername und Passwort eingeben.');
          busy('Anmelden …');
          await K.login(user, pass);
        }
        s.remove(); startApp(tab === 'new');
        if (tab === 'login') toast('Angemeldet! Deine Chats werden geholt …', 4000);
      } catch (e) { busy(''); toast(e.message || String(e), 4000); }
    };
    $('#w-go').onclick = go;
    $$('input', s).forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }));
    $('#w-restore').onclick = () => A.restoreDialog(async () => { s.remove(); startApp(); });
    $('#w-local').onclick = async () => {
      const name = await prompt2('Ohne Konto starten', 'Dein Name', '', 'Los geht\'s', { max: 40 });
      if (!name || !name.trim()) return;
      await K.setup(name.trim(), color); s.remove(); startApp(true);
    };
  }
  function lockScreen() {
    const s = startScreen(`${LOGO}<h1>Vaultline ist gesperrt</h1><p class="muted">Gib deine PIN ein.</p>
      <input class="inp" id="l-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" style="text-align:center;font-size:24px;letter-spacing:.3em;height:56px" autofocus>
      <button class="btn full" id="l-go" style="margin-top:12px">Entsperren</button>
      <button class="btn ghost full small" id="l-reset" style="margin-top:8px">PIN vergessen?</button>`);
    const go = async () => {
      try { await S.unlock($('#l-pin').value); }
      catch (e) { $('#l-pin').value = ''; $('#l-pin').animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], 240); return toast('Falsche PIN'); }
      await K.init(); s.remove(); startApp();
    };
    $('#l-go').onclick = go;
    $('#l-pin').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    setTimeout(() => $('#l-pin').focus(), 50);
    $('#l-reset').onclick = async () => {
      if (await confirmBox('Alles zurücksetzen?', 'Ohne PIN kommt niemand an deine Daten – auch wir nicht. Du kannst Vaultline zurücksetzen und mit einer Sicherung neu starten. <b>Alle Nachrichten auf diesem Gerät werden gelöscht.</b>', 'Zurücksetzen', true)) { await S.wipe(); location.reload(); }
    };
  }

  // ---------- Gerüst ----------
  function startApp(first) {
    const app = $('#app');
    app.innerHTML = '<nav class="rail" id="rail"></nav><aside class="side" id="side"></aside><section class="main" id="main"></section><aside class="panel" id="panel"></aside>';
    theme(K.settings.theme);
    bind();
    K.on('any', onCore);
    K.on('loggedOut', async (why) => {
      if (A.loggingOut) return; A.loggingOut = true;
      await confirmBox('Abgemeldet', why === 'pass' ? 'Dein Passwort wurde auf einem anderen Gerät geändert. Bitte melde dich mit dem neuen Passwort wieder an.' : 'Dieses Gerät wurde von deinem Konto abgemeldet.', 'OK');
      K.stop(); await S.wipe(); location.reload();
    });
    K.on('synced', (n) => { if (n) toast(n + ' Nachrichten von deinem anderen Gerät übernommen'); });
    K.start();
    if (G.Calls) A.calls = new G.Calls(K, A);
    renderAll();
    if (!A.mobile() && !A.v.chat) { const c = K.sortedChats().find((x) => x.kind !== 'server'); if (c) openChat(c.id); }
    document.addEventListener('visibilitychange', () => {
      K.visible = document.visibilityState === 'visible';
      if (K.visible) { K.sync(); K.presence(); if (A.v.chat) K.open(A.v.chat, A.v.ch); if (A.lockAt && S.hasPin() && Date.now() - A.lockAt > 5 * 60000) location.reload(); A.lockAt = 0; }
      else A.lockAt = Date.now();
    });
    addEventListener('focus', () => { K.visible = true; if (A.v.chat) K.open(A.v.chat, A.v.ch); });
    A.handleHash();
    addEventListener('hashchange', A.handleHash);
    A.setupNotifications();
    A.checkUpdate();
    setInterval(() => A.checkUpdate(), 3 * 3600000);
    if (first) setTimeout(() => A.addFriendDialog(true), 400);
    else if (!K.acct) { let seen = false; try { seen = localStorage.getItem('kreis.acctHint') === '1'; } catch (e) {} if (!seen) setTimeout(() => A.accountHint(), 1500); }
    setInterval(() => { if (A.v.space === 'home' && A.v.tab === 'friends') renderSide(); }, 30000);
  }
  let rT = {};
  function later(name, f, ms = 30) { clearTimeout(rT[name]); rT[name] = setTimeout(f, ms); }
  function onCore(e, a, b) {
    if (e === 'msg') { if (a.chat === A.v.chat) later('msgs', () => renderMsgs(), 10); later('side', renderSide); later('rail', renderRail); if (A.v.panel && a.chat === A.v.chat) later('panel', A.renderPanel, 60); }
    else if (e === 'msgs') { if (a === A.v.chat) later('msgs', () => renderMsgs(), 10); later('side', renderSide); }
    else if (e === 'chats' || e === 'contacts') { later('side', renderSide); later('rail', renderRail); later('head', renderHead); if (A.v.chat && !K.chats[A.v.chat]) { A.v.chat = null; renderMain(); } if (A.v.panel) later('panel', A.renderPanel, 60); later('compose', renderComposerState, 40); }
    else if (e === 'group') { if (a === A.v.chat) { later('head', renderHead); later('side', renderSide); later('msgs', () => renderMsgs(), 20); if (A.v.panel) later('panel', A.renderPanel, 40); } else later('side', renderSide); later('rail', renderRail); }
    else if (e === 'typing') { if (a === A.v.chat) later('typing', renderTyping, 10); later('side', renderSide, 200); }
    else if (e === 'reads') { if (a === A.v.chat) later('msgs', () => renderMsgs(), 30); }
    else if (e === 'presence') { later('head', renderHead); if (A.v.tab === 'friends') later('side', renderSide); }
    else if (e === 'online') { renderOffline(); }
    else if (e === 'notify') A.notify(a);
    else if (e === 'account') { later('side', renderSide); }
    else if (e === 'profile' || e === 'settings') { later('side', renderSide); later('msgs', () => renderMsgs(), 30); }
  }
  function renderAll() { renderRail(); renderSide(); renderMain(); A.renderPanel(); }
  A.renderAll = renderAll;

  // ---------- Linke Leiste ----------
  function unreadOf(filter) { return K.sortedChats().concat(K.sortedChats('archived')).filter(filter).reduce((a, c) => a + (c.muted ? 0 : c.unread || 0), 0); }
  function renderRail() {
    const r = $('#rail'); if (!r) return;
    const dm = unreadOf((c) => c.kind !== 'server');
    const req = Object.values(K.contacts).filter((c) => c.status === 'pending-in').length;
    const servers = Object.values(K.chats).filter((c) => c.kind === 'server').sort((a, b) => (a.created || 0) - (b.created || 0));
    r.innerHTML = `<button class="rb ${A.v.space === 'home' ? 'on' : ''}" data-a="space" data-id="home" title="Direktnachrichten">${ic('chat', 'l')}${dm + req ? `<span class="badge">${dm + req > 99 ? '99+' : dm + req}</span>` : ''}</button><div class="sep"></div>`
      + servers.map((c) => { const u = c.muted ? 0 : c.unread || 0; return `<button class="rb ${A.v.space === c.id ? 'on' : ''}" data-a="space" data-id="${c.id}" title="${esc(c.state.name)}" style="${A.v.space === c.id ? '' : ''}${c.left ? 'opacity:.45' : ''}">${c.state.icon ? `<img src="${esc(c.state.icon)}">` : `<span style="color:inherit">${esc(G.UI.initials(c.state.name))}</span>`}${u ? `<span class="badge ${c.mention ? 'at' : ''}">${c.mention ? '@' : u > 99 ? '99+' : u}</span>` : ''}</button>`; }).join('')
      + `<button class="rb add" data-a="newServer" title="Server erstellen oder beitreten">${ic('plus', 'l')}</button>`;
    document.title = (dm + req ? `(${dm + req}) ` : '') + 'Vaultline';
    if (A.isDesk) G.kreisDesktop.badge(dm + req + unreadOf((c) => c.kind === 'server' && c.mention));
  }

  function meBar() {
    const p = K.profile, c = A.calls;
    const inVoice = c && c.room;
    return (inVoice ? `<div class="vbar"><div class="row"><div class="grow"><div class="st">${ic('wave', 's')} ${c.room.video ? 'Videoanruf' : 'Sprachverbindung'}</div><div class="tiny muted ell">${esc(c.roomTitle())}</div></div><button class="ib" data-a="callShow" title="Anruf anzeigen">${ic('video', 's')}</button><button class="ib red" data-a="callLeave" title="Auflegen">${ic('hang', 's')}</button></div></div>` : '')
      + `<div class="me-bar"><button class="who" data-a="settings" data-id="profil">${av(p.name, p.color, p.avatar, 'sm', K.online)}<div class="grow"><div class="ell" style="font-weight:700;font-size:14px">${esc(p.name)}</div><div class="tiny dim ell">${esc(p.status || (K.acct ? '@' + K.acct.u : K.online ? 'Online' : 'Verbinde …'))}</div></div></button>`
      + `<button class="ib ${c && c.micOff ? 'red' : ''}" data-a="toggleMic" title="Mikrofon">${ic(c && c.micOff ? 'micoff' : 'mic')}</button><button class="ib ${c && c.deaf ? 'red' : ''}" data-a="toggleDeaf" title="Ton">${ic(c && c.deaf ? 'headoff' : 'head')}</button><button class="ib" data-a="settings" title="Einstellungen">${ic('settings')}</button></div>`;
  }
  A.meBar = meBar;

  function chatItem(c) {
    const typers = K.typers(c.id);
    const isDm = c.kind === 'dm';
    const name = K.chatTitle(c);
    const sub = typers.length ? `<span style="color:var(--accent-2)">${isDm ? 'schreibt …' : esc(K.contactName(typers[0])) + ' schreibt …'}</span>` : esc((c.lastFrom === K.id ? 'Du: ' : (!isDm && c.lastFrom ? K.contactName(c.lastFrom) + ': ' : '')) + (c.lastText || (c.left ? 'Nicht mehr in der Gruppe' : isDm ? 'Sag Hallo!' : 'Neue Gruppe')));
    const avatar = isDm ? av(name, K.contactColor(c.peer), K.avatarOf(c.peer), '', K.isOnline(c.peer)) : av(name, c.state.color, c.state.icon, 'sq');
    const u = c.unread || 0;
    return `<button class="item ${A.v.chat === c.id ? 'on' : ''} ${u ? 'unread' : ''}" data-a="chat" data-id="${c.id}" data-ctx="chatmenu">${avatar}<div class="grow"><div class="row" style="gap:6px"><span class="nm ell">${esc(name)}</span>${c.ttl || (c.state && c.state.ttl) ? ic('clock', 's') : ''}</div><div class="sub ell">${sub}</div></div><div class="meta"><span>${shortTime(c.lastTs)}</span><span class="row" style="gap:4px">${c.pinned ? ic('pin', 's') : ''}${c.muted ? ic('belloff', 's') : ''}${u ? `<span class="badge ${c.muted ? 'soft' : ''} ${c.mention ? 'at' : ''}" style="border:0">${c.mention ? '@' : u}</span>` : ''}</span></div></button>`;
  }

  function renderSide() {
    const s = $('#side'); if (!s) return;
    const scroll = $('.side-b', s) ? $('.side-b', s).scrollTop : 0;
    const focusQ = document.activeElement && document.activeElement.id === 'side-q';
    if (A.v.space !== 'home' && K.chats[A.v.space]) s.innerHTML = serverSide(K.chats[A.v.space]);
    else {
      A.v.space = 'home';
      const req = Object.values(K.contacts).filter((c) => c.status === 'pending-in');
      const tab = A.v.tab, q = A.v.q.toLowerCase();
      let body = '';
      if (tab === 'chats' || tab === 'archived') {
        const list = K.sortedChats(tab === 'archived' ? 'archived' : null).filter((c) => c.kind !== 'server' && (!q || K.chatTitle(c).toLowerCase().includes(q)));
        body = list.map(chatItem).join('') || `<div class="empty small" style="padding:40px 16px"><div><div class="muted">${tab === 'archived' ? 'Keine archivierten Chats.' : 'Noch keine Chats.'}</div>${tab === 'archived' ? '' : `<button class="btn sm" style="margin-top:12px" data-a="addFriend">${ic('uplus', 's')} Freund hinzufügen</button>`}</div></div>`;
        const arch = K.sortedChats('archived').filter((c) => c.kind !== 'server').length;
        if (tab === 'chats' && arch) body = `<button class="item" data-a="tab" data-id="archived"><div class="av sm" style="background:var(--bg4);color:var(--tx2)">${ic('archive', 's')}</div><div class="grow nm">Archiviert</div><span class="dim small">${arch}</span></button>` + body;
        if (tab === 'archived') body = `<button class="item" data-a="tab" data-id="chats">${ic('left')}<span class="nm">Zurück zu den Chats</span></button>` + body;
        if (q) {
          const hits = K.search(q).slice(0, 30);
          if (hits.length) body += `<div class="grp-t">Nachrichten</div>` + hits.map((m) => `<button class="item" data-a="jump" data-id="${m.chat}" data-m="${m.id}" data-ch="${m.ch || ''}"><div class="grow"><div class="nm ell small">${esc(K.chats[m.chat] ? K.chatTitle(K.chats[m.chat]) : '')} · ${esc(K.contactName(m.from))}</div><div class="sub ell">${esc(m.text || (m.file && m.file.n) || '')}</div></div><span class="tiny dim">${shortTime(m.ts)}</span></button>`).join('');
        }
      } else if (tab === 'friends') {
        const fr = Object.values(K.contacts).filter((c) => c.status === 'friend' && (!q || K.contactName(c.card.id).toLowerCase().includes(q)))
          .sort((a, b) => (K.isOnline(b.card.id) ? 1 : 0) - (K.isOnline(a.card.id) ? 1 : 0) || K.contactName(a.card.id).localeCompare(K.contactName(b.card.id)));
        const on = fr.filter((c) => K.isOnline(c.card.id)).length;
        body = `<button class="btn full sm" data-a="addFriend" style="margin:4px 0 8px">${ic('uplus', 's')} Freund hinzufügen</button><div class="grp-t">Freunde – ${fr.length} (${on} online)</div>`
          + fr.map((c) => { const id = c.card.id; return `<div class="item" data-a="friend" data-id="${id}" style="cursor:pointer">${av(K.contactName(id), K.contactColor(id), K.avatarOf(id), 'sm', K.isOnline(id))}<div class="grow"><div class="nm ell">${esc(K.contactName(id))} ${c.verified ? `<span title="Verifiziert" style="color:var(--ok)">${ic('shield', 's')}</span>` : ''}</div><div class="sub ell">${esc((c.profile && c.profile.status) || (K.isOnline(id) ? 'Online' : 'Offline'))}</div></div><button class="ib" data-a="chat" data-id="d:${id}" title="Nachricht">${ic('chat', 's')}</button><button class="ib" data-a="callUser" data-id="${id}" title="Anrufen">${ic('phone', 's')}</button></div>`; }).join('')
          + (fr.length ? '' : '<div class="muted small" style="padding:12px 8px">Füge Freunde mit ihrem Code oder QR-Code hinzu.</div>');
        const bl = Object.values(K.contacts).filter((c) => c.status === 'blocked');
        if (bl.length) body += `<div class="grp-t">Blockiert</div>` + bl.map((c) => `<div class="item">${av(K.contactName(c.card.id), '#555', '', 'sm')}<div class="grow nm ell">${esc(K.contactName(c.card.id))}</div><button class="btn sec sm" data-a="unblock" data-id="${c.card.id}">Freigeben</button></div>`).join('');
      } else if (tab === 'requests') {
        const out = Object.values(K.contacts).filter((c) => c.status === 'pending-out');
        const pj = Object.entries(K.pendingJoins || {});
        body = `<div class="grp-t">Eingehend – ${req.length}</div>` + (req.map((c) => { const id = c.card.id; return `<div class="item">${av(K.contactName(id), K.contactColor(id), K.avatarOf(id), 'sm')}<div class="grow"><div class="nm ell">${esc(K.contactName(id))}</div><div class="sub">möchte dich hinzufügen</div></div><button class="ib" style="color:var(--ok)" data-a="accept" data-id="${id}" title="Annehmen">${ic('check')}</button><button class="ib red" data-a="decline" data-id="${id}" title="Ablehnen">${ic('x')}</button></div>`; }).join('') || '<div class="muted small" style="padding:4px 8px">Keine offenen Anfragen.</div>')
          + `<div class="grp-t">Gesendet – ${out.length}</div>` + (out.map((c) => `<div class="item">${av(c.card.n, c.card.c, '', 'sm')}<div class="grow"><div class="nm ell">${esc(c.card.n)}</div><div class="sub">wartet auf Annahme</div></div><button class="ib" data-a="decline" data-id="${c.card.id}" title="Zurückziehen">${ic('x')}</button></div>`).join('') || '<div class="muted small" style="padding:4px 8px">—</div>')
          + (pj.length ? `<div class="grp-t">Beitritte</div>` + pj.map(([g, d]) => `<div class="item"><div class="av sm sq" style="background:var(--bg4)">${ic('server', 's')}</div><div class="grow"><div class="nm ell">${esc(d.n || 'Server')}</div><div class="sub">Wartet auf Bestätigung des Admins</div></div><button class="ib" data-a="cancelJoin" data-id="${g}">${ic('x')}</button></div>`).join('') : '');
      }
      s.innerHTML = `<div class="side-h"><div class="t row">${G.UI.LOGO.replace('class="logo"', 'class="logo" style="width:28px;height:28px"')}<span>Vaultline</span></div><button class="ib" data-a="newMenu" title="Neu">${ic('plus')}</button></div>
        <div style="padding:10px 8px 0"><div class="search">${ic('search', 's')}<input id="side-q" placeholder="${tab === 'friends' ? 'Freunde suchen' : 'Chats und Nachrichten suchen'}" value="${esc(A.v.q)}"></div>
        <div class="tabs"><button class="tab ${tab === 'chats' || tab === 'archived' ? 'on' : ''}" data-a="tab" data-id="chats">Chats</button><button class="tab ${tab === 'friends' ? 'on' : ''}" data-a="tab" data-id="friends">Freunde</button><button class="tab ${tab === 'requests' ? 'on' : ''}" data-a="tab" data-id="requests">Anfragen${req.length ? ` <span class="badge" style="border:0">${req.length}</span>` : ''}</button></div></div>
        <div class="side-b">${body}</div>${meBar()}`;
      const qi = $('#side-q', s);
      qi.oninput = () => { A.v.q = qi.value; later('sideq', () => renderSide(), 120); };
      if (focusQ) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
    }
    const b = $('.side-b', s); if (b) b.scrollTop = scroll;
  }
  A.renderSide = renderSide;

  function serverSide(c) {
    const st = c.state, admin = K.isAdmin(c, K.id);
    const cats = [];
    for (const ch of st.channels) { let g = cats.find((x) => x.n === ch.cat); if (!g) cats.push(g = { n: ch.cat, l: [] }); g.l.push(ch); }
    const body = (c.left ? '<div class="note warn" style="margin:6px">Du bist nicht mehr in diesem Server.</div>' : '') + cats.map((g) => `<div class="grp-t">${ic('down', 's')}${esc(g.n)}${admin ? `<button data-a="addChannel" data-id="${esc(g.n)}" title="Kanal erstellen">${ic('plus', 's')}</button>` : ''}</div>` + g.l.map((ch) => {
      if (ch.type === 'voice') {
        const ppl = A.calls ? A.calls.voiceMembers(c.id, ch.id) : [];
        return `<button class="chan" data-a="voice" data-id="${ch.id}">${ic('vol', 's')}<span class="grow ell">${esc(ch.name)}</span>${admin ? `<span class="act" data-a="chanMenu" data-id="${ch.id}">${ic('settings', 's')}</span>` : ''}</button>` + ppl.map((uid) => `<div class="vmem">${av(K.contactName(uid), K.contactColor(uid), K.avatarOf(uid), 'xs ' + (A.calls && A.calls.isSpeaking(uid) ? 'speaking' : ''))}<span class="ell">${esc(K.contactName(uid))}</span>${A.calls && A.calls.peerState(uid).mic === false ? ic('micoff', 's') : ''}</div>`).join('');
      }
      const u = (c.unreadCh || {})[ch.id] || 0;
      return `<button class="chan ${A.v.chat === c.id && A.v.ch === ch.id ? 'on' : ''} ${u ? 'unread' : ''}" data-a="channel" data-id="${ch.id}">${ic('hash', 's')}<span class="grow ell">${esc(ch.name)}</span>${u ? `<span class="badge soft" style="border:0">${u}</span>` : ''}${admin ? `<span class="act" data-a="chanMenu" data-id="${ch.id}">${ic('settings', 's')}</span>` : ''}</button>`;
    }).join('')).join('');
    return `<div class="side-h" style="cursor:pointer" data-a="serverMenu"><div class="t ell">${esc(st.name)}</div>${ic('down')}</div>
      <div class="side-b">${!c.left ? `<button class="item" data-a="invite" style="color:var(--accent-2)">${ic('uplus')}<span class="nm" style="color:inherit">Leute einladen</span></button>` : ''}${body}</div>${meBar()}`;
  }

  // ---------- Hauptbereich ----------
  function curChat() { return A.v.chat ? K.chats[A.v.chat] : null; }
  A.curChat = curChat;
  function renderMain() {
    const m = $('#main'); if (!m) return;
    const c = curChat();
    $('#app').classList.toggle('chat-open', !!c);
    if (!c) {
      m.innerHTML = `<div class="main-h"></div><div class="empty"><div><div class="big">${ic('chat', 'l')}</div><h2>Schön, dass du da bist, ${esc(K.profile.name)}!</h2><p>Alles, was du hier schreibst, ist Ende-zu-Ende-verschlüsselt.</p><div class="row wrap" style="justify-content:center;margin-top:16px"><button class="btn" data-a="addFriend">${ic('uplus', 's')} Freund hinzufügen</button><button class="btn sec" data-a="newGroup">${ic('users', 's')} Gruppe erstellen</button><button class="btn sec" data-a="newServer">${ic('server', 's')} Server</button></div></div></div>`;
      if (A.calls && A.calls.room) A.calls.renderView();
      return;
    }
    m.innerHTML = `<div class="main-h" id="mh"></div><div id="pinbar"></div><div class="msgs" id="msgs"></div><div class="typing" id="typing"></div><div class="composer" id="composer"></div>`;
    renderHead(); renderMsgs(true); renderTyping(); renderComposer(); renderOffline();
    if (A.calls) A.calls.renderView();
    const box = $('#msgs');
    box.addEventListener('scroll', () => { A.atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80; if (box.scrollTop < 60 && A.more && !A.loadingMore) { A.loadingMore = true; const h = box.scrollHeight; A.limit += 150; renderMsgs(); box.scrollTop = box.scrollHeight - h; A.loadingMore = false; } });
  }
  A.renderMain = renderMain;
  function renderOffline() {
    const m = $('#main'); if (!m) return;
    let o = $('.offline', m);
    if (!K.online && A.v.chat) { if (!o) { o = document.createElement('div'); o.className = 'offline'; m.appendChild(o); } o.textContent = 'Keine Verbindung – Nachrichten werden gesendet, sobald du wieder online bist.'; }
    else if (o) o.remove();
    const mb = $('.me-bar .av .dot'); if (mb) mb.classList.toggle('on', K.online);
  }
  function chanOf(c) { return c && c.kind === 'server' ? c.state.channels.find((x) => x.id === A.v.ch) : null; }
  function renderHead() {
    const h = $('#mh'); const c = curChat(); if (!h || !c) return;
    let left, title, sub = '';
    if (c.kind === 'dm') {
      const id = c.peer, ct = K.contacts[id];
      left = av(K.contactName(id), K.contactColor(id), K.avatarOf(id), 'sm', K.isOnline(id));
      title = esc(K.contactName(id)) + (ct && ct.verified ? ` <span style="color:var(--ok)" title="Sicherheitsnummer bestätigt">${ic('shield', 's')}</span>` : '');
      sub = ct && ct.status === 'pending-out' ? 'Anfrage gesendet – wartet auf Annahme' : ct && ct.status === 'pending-in' ? 'möchte dich hinzufügen' : K.isOnline(id) ? '<span style="color:var(--ok)">Online</span>' : ct && ct.seenAt ? 'zuletzt online ' + shortTime(ct.seenAt) + (new Date(ct.seenAt).toDateString() === new Date().toDateString() ? ' Uhr' : '') : 'Ende-zu-Ende-verschlüsselt';
      const ty = K.typers(c.id); if (ty.length) sub = '<span style="color:var(--accent-2)">schreibt …</span>';
    } else if (c.kind === 'server') {
      const ch = chanOf(c);
      left = `<span class="dim">${ic('hash')}</span>`; title = esc(ch ? ch.name : c.state.name); sub = esc(c.state.name);
    } else {
      left = av(c.state.name, c.state.color, c.state.icon, 'sm sq');
      title = esc(c.state.name);
      const n = Object.keys(c.state.members).length;
      const on = Object.keys(c.state.members).filter((x) => x !== K.id && K.isOnline(x)).length;
      sub = c.left ? 'Du bist nicht mehr in der Gruppe' : n + ' Mitglieder' + (on ? `, ${on} online` : '');
    }
    const canCall = c.kind !== 'server' && !c.left;
    h.innerHTML = `<button class="ib back" data-a="back">${ic('left')}</button>${left}<div class="grow" style="cursor:pointer" data-a="panel" data-id="info"><div class="t ell">${title}</div><div class="s ell">${sub}</div></div>
      ${canCall ? `<button class="ib" data-a="call" data-id="audio" title="Sprachanruf">${ic('phone')}</button><button class="ib" data-a="call" data-id="video" title="Videoanruf">${ic('video')}</button>` : ''}
      <button class="ib ${A.v.panel === 'pins' ? 'on' : ''}" data-a="panel" data-id="pins" title="Angepinnte Nachrichten">${ic('pin')}</button><button class="ib ${A.v.panel === 'search' ? 'on' : ''}" data-a="panel" data-id="search" title="Suchen">${ic('search')}</button><button class="ib ${A.v.panel === 'info' ? 'on' : ''}" data-a="panel" data-id="info" title="${c.kind === 'dm' ? 'Kontaktinfo' : 'Mitglieder'}">${ic(c.kind === 'dm' ? 'info' : 'users')}</button>`;
  }
  A.renderHead = renderHead;

  // ---------- Nachrichten ----------
  A.limit = 150;
  function namesFor(c) { const n = c.kind === 'dm' ? [K.contactName(c.peer), K.profile.name] : Object.values(c.state.members).map((x) => x.n || ''); return n.map((x) => String(x).toLowerCase()); }
  function readState(c, m) {
    if (m.from !== K.id || m.sys) return '';
    if (m.status === 'failed') return `<span class="st fail" data-a="retry" data-id="${m.id}" title="Nicht gesendet – antippen zum Wiederholen">${ic('info', 's')}</span>`;
    if (m.status === 'sending') return `<span class="st" title="Wird gesendet">${ic('clock', 's')}</span>`;
    const reads = c.reads || {};
    if (c.kind === 'dm') return (reads[c.peer] || 0) >= m.ts ? `<span class="st read" title="Gelesen">${ic('checks', 's')}</span>` : `<span class="st" title="Gesendet">${ic('check', 's')}</span>`;
    const others = Object.keys(c.state.members).filter((x) => x !== K.id);
    const n = others.filter((x) => (reads[x] || 0) >= m.ts).length;
    return n && n >= others.length ? `<span class="st read" title="Von allen gelesen">${ic('checks', 's')}</span>` : `<span class="st" title="${n ? 'Gelesen von ' + n : 'Gesendet'}">${ic(n ? 'checks' : 'check', 's')}</span>`;
  }
  function msgHTML(m, prev, c, names, opt = {}) {
    if (m.sys) return `<div class="sys"><b>${esc(K.contactName(m.from))}</b> ${esc(m.text)}</div>`;
    const first = opt.thread || !prev || prev.sys || prev.from !== m.from || m.ts - prev.ts > 5 * 60000 || m.reply;
    const name = K.contactName(m.from), color = K.contactColor(m.from);
    const role = c.kind !== 'dm' ? K.roleOf(c, m.from) : null;
    const isAdminOwner = c.state && c.state.owner === m.from;
    let body = '';
    if (m.reply && !opt.thread) {
      const r = K.msgs.get(c.id + '|' + m.reply);
      body += `<div class="rp" data-a="jumpMsg" data-id="${m.reply}">${ic('reply', 's')}${r ? `<b>${esc(K.contactName(r.from))}</b><span class="ell">${esc(K.preview(r))}</span>` : '<span>Ursprüngliche Nachricht nicht verfügbar</span>'}</div>`;
    }
    if (m.fwd) body += `<div class="fwd">${ic('fwd', 's')} Weitergeleitet</div>`;
    if (m.deleted) body += `<div class="txt del">${ic('trash', 's')} Diese Nachricht wurde gelöscht.</div>`;
    else {
      if (m.sticker) body += `<div class="txt big" style="font-size:96px;line-height:1.1">${esc(m.sticker)}</div>`;
      if (m.text) body += `<div class="txt ${onlyEmoji(m.text) && !m.file ? 'big' : ''}">${md(m.text, names)}${m.edited ? ' <span class="ed">(bearbeitet)</span>' : ''}${first ? '' : readState(c, m)}</div>`;
      if (m.file) body += A.attHTML(m);
      if (m.poll) body += pollHTML(m);
    }
    const rs = Object.entries(m.reactions || {});
    if (rs.length) body += `<div class="reacts">${rs.map(([e, l]) => `<button class="re ${l.includes(K.id) ? 'mine' : ''}" data-a="react" data-id="${m.id}" data-e="${esc(e)}" title="${esc(l.map((x) => K.contactName(x)).join(', '))}">${esc(e)} <b class="small">${l.length}</b></button>`).join('')}</div>`;
    if (!opt.thread) {
      const tn = opt.threads && opt.threads[m.id];
      if (tn) body += `<button class="thr" data-a="thread" data-id="${m.id}">${ic('thread', 's')} ${tn} ${tn === 1 ? 'Antwort' : 'Antworten'}</button>`;
    }
    const mentioned = !m.deleted && m.from !== K.id && m.text && (new RegExp('@' + K.profile.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(m.text) || /@(alle|everyone)\b/i.test(m.text));
    const tools = m.deleted ? '' : `<div class="tools"><button class="ib" data-a="quickReact" data-id="${m.id}" title="Reagieren">${ic('smile', 's')}</button><button class="ib" data-a="reply" data-id="${m.id}" title="Antworten">${ic('reply', 's')}</button>${m.from === K.id && m.text && !m.poll ? `<button class="ib" data-a="edit" data-id="${m.id}" title="Bearbeiten">${ic('edit', 's')}</button>` : ''}<button class="ib" data-a="msgMenu" data-id="${m.id}" title="Mehr">${ic('more', 's')}</button></div>`;
    return `<div class="m ${first ? 'first' : ''} ${mentioned ? 'mentioned' : ''}" data-mid="${m.id}" data-ctx="msgMenu">${first ? `<div class="gut" data-a="user" data-id="${m.from}" style="cursor:pointer">${av(name, color, K.avatarOf(m.from))}</div>` : `<div class="gut"><div class="tm">${time(m.ts)}</div></div>`}
      <div class="body">${first ? `<div class="hd"><span class="n" style="color:${role ? esc(role.color) : 'var(--tx)'}" data-a="user" data-id="${m.from}">${esc(name)}</span>${isAdminOwner && c.kind !== 'dm' ? `<span title="Besitzer" style="color:var(--warn)">${ic('crown', 's')}</span>` : ''}${role ? `<span class="role" style="color:${esc(role.color)}">${esc(role.name)}</span>` : ''}<span class="tm">${time(m.ts)}${m.exp ? ' · ' + ic('clock', 's') : ''}</span>${readState(c, m)}</div>` : ''}${body}</div>${tools}</div>`;
  }
  A.msgHTML = msgHTML;
  function pollHTML(m) {
    const p = m.poll, votes = m.votes || {};
    const total = Object.values(votes).reduce((a, l) => a + l.length, 0);
    return `<div class="poll"><div class="q">${ic('poll', 's')} ${esc(p.q)}</div>${p.opts.map((o, i) => { const l = votes[i] || []; const pc = total ? Math.round((l.length / total) * 100) : 0; return `<button class="o ${l.includes(K.id) ? 'mine' : ''}" data-a="vote" data-id="${m.id}" data-o="${i}"><span class="bar" style="width:${pc}%"></span><span class="grow">${esc(o)}</span><span class="small muted" title="${esc(l.map((x) => K.contactName(x)).join(', '))}">${l.length} · ${pc}%</span></button>`; }).join('')}<div class="tiny dim" style="margin-top:8px">${total} Stimme${total === 1 ? '' : 'n'}${p.multi ? ' · Mehrfachauswahl' : ''}</div></div>`;
  }
  function renderMsgs(reset) {
    const box = $('#msgs'); const c = curChat(); if (!box || !c) return;
    if (reset) A.limit = 150;
    const wasBottom = reset || A.atBottom !== false;
    const all = K.chatMsgs(c.id, c.kind === 'server' ? A.v.ch : undefined);
    const threads = {};
    for (const m of all) if (m.reply) threads[m.reply] = (threads[m.reply] || 0) + 1;
    const list = all.slice(-A.limit);
    A.more = all.length > list.length;
    const names = namesFor(c);
    let html = '<div class="spacer"></div>';
    if (!A.more) html += introHTML(c);
    let prev = null, lastDay = '';
    for (const m of list) {
      const d = new Date(m.ts).toDateString();
      if (d !== lastDay) { html += `<div class="day">${esc(dayLabel(m.ts))}</div>`; lastDay = d; prev = null; }
      html += msgHTML(m, prev, c, names, { threads });
      prev = m;
    }
    box.innerHTML = html;
    if (wasBottom) box.scrollTop = box.scrollHeight;
    A.atBottom = wasBottom;
    A.loadVisibleMedia(box);
    renderPinbar();
  }
  A.renderMsgs = renderMsgs;
  function introHTML(c) {
    if (c.kind === 'dm') {
      const id = c.peer;
      return `<div style="padding:24px 16px 8px">${av(K.contactName(id), K.contactColor(id), K.avatarOf(id), 'lg')}<h2 style="margin:12px 0 4px">${esc(K.contactName(id))}</h2><div class="muted small">Das ist der Anfang eures Chats. ${ic('lock', 's')} Nachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt.</div>${K.contacts[id] && K.contacts[id].status === 'pending-in' ? `<div class="row" style="margin-top:12px"><button class="btn ok sm" data-a="accept" data-id="${id}">Annehmen</button><button class="btn sec sm" data-a="decline" data-id="${id}">Ablehnen</button><button class="btn sec sm" data-a="block" data-id="${id}">Blockieren</button></div>` : ''}</div>`;
    }
    const ch = chanOf(c);
    if (c.kind === 'server') return `<div style="padding:24px 16px 8px"><div class="av lg" style="background:var(--bg4);color:var(--tx)">${ic('hash', 'l')}</div><h2 style="margin:12px 0 4px">Willkommen in #${esc(ch ? ch.name : '')}!</h2><div class="muted small">Das ist der Anfang des Kanals #${esc(ch ? ch.name : '')}.</div></div>`;
    return `<div style="padding:24px 16px 8px">${av(c.state.name, c.state.color, c.state.icon, 'lg sq')}<h2 style="margin:12px 0 4px">${esc(c.state.name)}</h2><div class="muted small">${esc(c.state.desc || 'Gruppe erstellt von ' + K.contactName(c.state.owner) + '.')} ${ic('lock', 's')} Ende-zu-Ende-verschlüsselt.</div></div>`;
  }
  function renderPinbar() {
    const pb = $('#pinbar'); const c = curChat(); if (!pb || !c) return;
    const pins = K.chatMsgs(c.id, c.kind === 'server' ? A.v.ch : undefined).filter((m) => m.pinned && !m.deleted);
    if (!pins.length) { pb.innerHTML = ''; return; }
    const p = pins[pins.length - 1];
    pb.innerHTML = `<div class="pinbar" data-a="jumpMsg" data-id="${p.id}"><span style="color:var(--accent-2)">${ic('pin', 's')}</span><div class="grow ell"><b>${pins.length > 1 ? pins.length + ' angepinnte Nachrichten' : 'Angepinnt'}</b> · ${esc(K.contactName(p.from))}: ${esc(K.preview(p))}</div><button class="ib" data-a="panel" data-id="pins">${ic('right', 's')}</button></div>`;
  }
  function renderTyping() {
    const t = $('#typing'); const c = curChat(); if (!t || !c) return;
    const ty = K.typers(c.id, c.kind === 'server' ? A.v.ch : null);
    t.innerHTML = ty.length ? `<span class="dots"><i></i><i></i><i></i></span><span><b>${esc(ty.slice(0, 3).map((x) => K.contactName(x)).join(', '))}</b> ${ty.length > 1 ? 'schreiben' : 'schreibt'} …</span>` : '';
    renderHead();
  }
  A.jumpTo = (id) => {
    const el = $(`[data-mid="${id}"]`);
    if (!el) { A.limit = 100000; renderMsgs(); }
    const e2 = $(`[data-mid="${id}"]`);
    if (e2) { e2.scrollIntoView({ block: 'center', behavior: 'smooth' }); e2.classList.remove('hl'); void e2.offsetWidth; e2.classList.add('hl'); }
  };

  // ---------- Eingabe ----------
  function composerBlocked(c) {
    if (c.left) return 'Du bist nicht mehr in dieser Gruppe.';
    if (c.kind === 'dm') { const ct = K.contacts[c.peer]; if (!ct) return 'Dieser Kontakt existiert nicht mehr.'; if (ct.status === 'blocked') return 'Du hast diesen Kontakt blockiert.'; }
    if (c.kind === 'server' && !chanOf(c)) return 'Wähle links einen Textkanal.';
    return '';
  }
  function renderComposer() {
    const el = $('#composer'); const c = curChat(); if (!el || !c) return;
    const blocked = composerBlocked(c);
    if (blocked) { el.innerHTML = `<div class="locked-note">${esc(blocked)}</div>`; el.dataset.blocked = '1'; return; }
    el.dataset.blocked = '';
    const ch = chanOf(c);
    const ph = c.kind === 'server' ? `Nachricht an #${ch.name}` : c.kind === 'dm' ? `Nachricht an ${K.contactName(c.peer)}` : `Nachricht an ${c.state.name}`;
    el.innerHTML = `<div id="cctx"></div><div class="cbox" id="cbox"><button class="ib" data-a="attach" title="Anhängen">${ic('plus')}</button><textarea id="ta" rows="1" placeholder="${esc(ph)}" maxlength="8000"></textarea><button class="ib" data-a="emoji" title="Emoji">${ic('smile')}</button><button class="ib" data-a="sticker" title="Sticker">${ic('sticker')}</button><button class="ib send" id="sendbtn" data-a="sendOrRec" title="Senden">${ic('mic')}</button></div><input type="file" id="fileinp" multiple class="hide">`;
    const ta = $('#ta');
    const draft = (c.drafts || {})[A.v.ch || ''] || '';
    ta.value = draft; autosize(ta); updSend();
    ta.addEventListener('input', () => { autosize(ta); updSend(); if (ta.value.trim()) K.typing(c.id, A.v.ch); saveDraft(); mentionHelp(ta); });
    ta.addEventListener('keydown', (e) => {
      const enterSends = K.settings.enterSends && !A.touch;
      if (e.key === 'Enter' && !e.shiftKey && (enterSends || e.ctrlKey)) { e.preventDefault(); A.sendText(); }
      else if (e.key === 'Escape') { A.v.reply = null; A.v.edit = null; renderCtx(); }
      else if (e.key === 'ArrowUp' && !ta.value) { const mine = K.chatMsgs(c.id, c.kind === 'server' ? A.v.ch : undefined).filter((m) => m.from === K.id && m.text && !m.deleted).pop(); if (mine) { e.preventDefault(); A.startEdit(mine.id); } }
    });
    ta.addEventListener('paste', (e) => { const fs = Array.from(e.clipboardData.files || []); if (fs.length) { e.preventDefault(); A.sendFiles(fs); } });
    $('#fileinp').onchange = (e) => { A.sendFiles(Array.from(e.target.files)); e.target.value = ''; };
    renderCtx();
    if (!A.touch) setTimeout(() => ta.focus(), 20);
  }
  A.renderComposer = renderComposer;
  function renderComposerState() { const el = $('#composer'); const c = curChat(); if (!el || !c) return; const b = !!composerBlocked(c); if (b !== (el.dataset.blocked === '1')) renderComposer(); }
  function saveDraft() { const c = curChat(); if (!c) return; c.drafts = c.drafts || {}; c.drafts[A.v.ch || ''] = $('#ta').value; later('draft', () => K.save('chats'), 600); }
  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(200, ta.scrollHeight) + 'px'; }
  function updSend() { const b = $('#sendbtn'); const ta = $('#ta'); if (!b || !ta) return; const has = !!ta.value.trim() || !!A.v.edit; b.innerHTML = ic(has ? 'send' : 'mic'); b.title = has ? 'Senden' : 'Sprachnachricht aufnehmen'; }
  A.updSend = updSend;
  function renderCtx() {
    const x = $('#cctx'); const c = curChat(); if (!x || !c) return;
    const r = A.v.reply && K.msgs.get(c.id + '|' + A.v.reply);
    const e = A.v.edit && K.msgs.get(c.id + '|' + A.v.edit);
    const up = Object.values(A.uploads).filter((u) => u.chat === c.id);
    let h = '';
    if (e) h = `<div class="ctx">${ic('edit', 's')}<div class="grow ell">Nachricht bearbeiten</div><button class="ib" data-a="cancelCtx">${ic('x', 's')}</button></div>`;
    else if (r) h = `<div class="ctx">${ic('reply', 's')}<div class="grow ell">Antwort an <b>${esc(K.contactName(r.from))}</b>: ${esc(K.preview(r))}</div><button class="ib" data-a="cancelCtx">${ic('x', 's')}</button></div>`;
    for (const u of up) h += `<div class="ctx">${ic('clip', 's')}<div class="grow"><div class="ell">${esc(u.name)} – ${Math.round(u.p * 100)} %</div><div class="prog"><i style="width:${Math.round(u.p * 100)}%"></i></div></div></div>`;
    x.innerHTML = h;
  }
  A.renderCtx = renderCtx;
  function mentionHelp(ta) {
    const c = curChat(); if (!c || c.kind === 'dm') return;
    const before = ta.value.slice(0, ta.selectionStart);
    const m = before.match(/(^|\s)@([^\s@]{0,20})$/);
    if (!m) { if (A.mPop) { closePop(); A.mPop = null; } return; }
    const q = m[2].toLowerCase();
    const ppl = Object.values(c.state.members).filter((x) => x.id !== K.id && (x.n || '').toLowerCase().startsWith(q)).slice(0, 8);
    const opts = ppl.map((x) => ({ k: x.n, t: x.n, i: 'at' })).concat('alle'.startsWith(q) ? [{ k: 'alle', t: 'alle (jeden erwähnen)', i: 'users' }] : []);
    if (!opts.length) { closePop(); return; }
    A.mPop = true;
    menu(opts, $('#cbox')).then((name) => {
      const v = ta.value, pos = ta.selectionStart;
      const start = before.length - m[2].length;
      ta.value = v.slice(0, start) + name.replace(/\s+/g, '') + ' ' + v.slice(pos);
      ta.focus(); A.mPop = null; updSend();
    });
  }
  A.sendText = async () => {
    const c = curChat(); const ta = $('#ta'); if (!c || !ta) return;
    const text = ta.value.trim();
    if (A.v.edit) {
      const id = A.v.edit; A.v.edit = null;
      if (text) await K.edit(c.id, id, text).catch((e) => toast(e.message));
      ta.value = ''; autosize(ta); updSend(); renderCtx(); saveDraft(); return;
    }
    if (!text) return A.toggleRecord();
    const reply = A.v.reply; A.v.reply = null;
    ta.value = ''; autosize(ta); updSend(); renderCtx(); saveDraft();
    A.atBottom = true;
    try { await K.send(c.id, { text, reply, ch: c.kind === 'server' ? A.v.ch : undefined }); } catch (e) { toast(e.message); }
  };
  A.startEdit = (id) => {
    const c = curChat(); const m = K.msgs.get(c.id + '|' + id); if (!m) return;
    A.v.edit = id; A.v.reply = null;
    const ta = $('#ta'); ta.value = m.text || ''; autosize(ta); ta.focus(); updSend(); renderCtx();
  };

  // ---------- Navigation ----------
  function openChat(id, ch, noHist) {
    const c = K.chats[id]; if (!c) return;
    if (c.kind === 'server') {
      A.v.space = id;
      if (!ch) { const first = (c.state.channels.find((x) => x.id === c.lastCh) || c.state.channels.find((x) => x.type === 'text')); ch = first ? first.id : null; }
      c.lastCh = ch;
    } else if (A.v.space !== 'home') A.v.space = 'home';
    const prevChat = A.v.chat;
    A.v.chat = id; A.v.ch = ch || null; A.v.reply = null; A.v.edit = null;
    if (A.v.panel === 'thread') A.v.panel = null;
    K.open(id, A.v.ch);
    renderMain(); renderSide(); renderRail(); A.renderPanel();
    if (A.mobile() && !noHist && !prevChat) history.pushState({ k: 'chat' }, '');
  }
  A.openChat = openChat;
  function closeChat() { A.v.chat = null; A.v.ch = null; K.activeChat = null; A.v.panel = null; renderMain(); renderSide(); A.renderPanel(); }
  A.closeChat = closeChat;
  addEventListener('popstate', () => {
    if (A._skipPop) { A._skipPop = false; return; }
    if (G.UI.topModal()) { A._popClosing = true; G.UI.topModal().close(); A._popClosing = false; return; }
    if (A.v.panel && A.mobile()) { A.v.panel = null; A.renderPanel(); return; }
    if (A.v.chat && A.mobile()) closeChat();
  });

  // ---------- Klicks ----------
  const ACT = A.ACT = {
    space(el) { const id = el.dataset.id; if (id === 'home') { A.v.space = 'home'; renderSide(); renderRail(); if (!A.mobile()) { const c = K.chats[A.v.chat]; if (!c || c.kind === 'server') { const f = K.sortedChats().find((x) => x.kind !== 'server'); if (f) openChat(f.id); else closeChat(); } } else if (A.v.chat && K.chats[A.v.chat] && K.chats[A.v.chat].kind === 'server') closeChat(); } else { if (A.mobile()) { A.v.space = id; closeChat(); renderRail(); } else openChat(id); } },
    tab(el) { A.v.tab = el.dataset.id; renderSide(); },
    chat(el, e) { e.stopPropagation(); const id = el.dataset.id; if (id.startsWith('d:')) K.ensureDm(id.slice(2)); openChat(id); },
    channel(el) { openChat(A.v.space, el.dataset.id); },
    friend(el, e) { if (e.target.closest('button')) return; A.userCard(el.dataset.id, el); },
    user(el) { A.userCard(el.dataset.id, el); },
    back() { if (A.mobile()) history.back(); else closeChat(); },
    accept(el) { K.accept(el.dataset.id); toast('Freundschaft angenommen'); },
    decline(el) { K.decline(el.dataset.id); },
    block(el) { K.block(el.dataset.id); toast('Blockiert'); },
    unblock(el) { K.unblock(el.dataset.id); },
    cancelJoin(el) { delete K.pendingJoins[el.dataset.id]; K.save('pendingJoins'); renderSide(); },
    jump(el) { openChat(el.dataset.id, el.dataset.ch || null); setTimeout(() => A.jumpTo(el.dataset.m), 60); },
    jumpMsg(el) { A.jumpTo(el.dataset.id); },
    retry(el) { const c = curChat(); K.retry(c.id + '|' + el.dataset.id); },
    reply(el) { A.v.reply = el.dataset.id; A.v.edit = null; renderCtx(); const ta = $('#ta'); if (ta) ta.focus(); },
    edit(el) { A.startEdit(el.dataset.id); },
    cancelCtx() { A.v.reply = null; A.v.edit = null; const ta = $('#ta'); if (ta && A.v.edit === null) {} renderCtx(); updSend(); },
    react(el) { const c = curChat(); K.react(c.id, el.dataset.id, el.dataset.e); },
    quickReact(el) {
      const c = curChat(); const id = el.dataset.id;
      const p = pop(`<div class="quick">${['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉'].map((e) => `<button data-m="${e}" data-q="${e}">${e}</button>`).join('')}<button data-more title="Mehr">${ic('plus', 's')}</button></div>`, el, { alignRight: true });
      p.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) K.react(c.id, id, b.dataset.q); if (e.target.closest('[data-more]')) emojiPicker(el, (x) => K.react(c.id, id, x)); });
    },
    vote(el) { const c = curChat(); K.vote(c.id, el.dataset.id, +el.dataset.o); },
    spoiler(el) { el.classList.toggle('open'); },
    ext(el, e) { e.preventDefault(); A.openExternal(el.href); },
    emoji(el) { emojiPicker(el, (x) => { const ta = $('#ta'); const p = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, p) + x + ta.value.slice(p); ta.focus(); ta.selectionStart = ta.selectionEnd = p + x.length; updSend(); }, { keep: true }); },
    sticker(el) {
      const p = pop(`<div style="width:300px"><div class="grp-t">Sticker</div><div class="emojis" style="grid-template-columns:repeat(5,1fr)">${G.UI.STICKERS.map((s) => `<button data-m="${s}" data-s="${s}" style="font-size:38px;height:58px">${s}</button>`).join('')}</div></div>`, el);
      p.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { const c = curChat(); K.send(c.id, { sticker: b.dataset.s, ch: c.kind === 'server' ? A.v.ch : undefined }).catch((x) => toast(x.message)); } });
    },
    sendOrRec() { const ta = $('#ta'); if ((ta && ta.value.trim()) || A.v.edit) A.sendText(); else A.toggleRecord(); },
    attach(el) {
      menu([{ k: 'file', t: 'Datei, Foto oder Video', i: 'clip' }, { k: 'cam', t: 'Kamera', i: 'camera' }, { k: 'poll', t: 'Umfrage', i: 'poll' }, { k: 'sticker', t: 'Sticker', i: 'sticker' }], el).then((k) => {
        if (k === 'file') $('#fileinp').click();
        else if (k === 'cam') { const i = $('#fileinp'); i.setAttribute('accept', 'image/*'); i.setAttribute('capture', 'environment'); i.click(); setTimeout(() => { i.removeAttribute('accept'); i.removeAttribute('capture'); }, 1000); }
        else if (k === 'poll') A.pollDialog();
        else if (k === 'sticker') ACT.sticker(el);
      });
    },
    panel(el) { const p = el.dataset.id; A.v.panel = A.v.panel === p ? null : p; if (A.v.panel === 'thread') A.v.panel = null; A.renderPanel(); renderHead(); if (A.v.panel && A.mobile()) history.pushState({ k: 'panel' }, ''); },
    closePanel() { if (A.mobile() && A.v.panel) history.back(); else { A.v.panel = null; A.renderPanel(); renderHead(); } },
    thread(el) { A.v.thread = el.dataset.id; A.v.panel = 'thread'; A.renderPanel(); if (A.mobile()) history.pushState({ k: 'panel' }, ''); },
  };
  function bind() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-a]');
      if (!el) return;
      const f = ACT[el.dataset.a];
      if (f) { f(el, e); }
    });
    document.addEventListener('contextmenu', (e) => {
      const el = e.target.closest('[data-ctx]');
      if (!el || e.target.closest('a,input,textarea')) return;
      const f = ACT[el.dataset.ctx]; if (!f) return;
      e.preventDefault();
      if (el.dataset.mid) el.dataset.id = el.dataset.mid;
      f(el, e, { x: e.clientX, y: e.clientY });
    });
    // Langes Drücken am Handy = Kontextmenü
    let lp = null;
    document.addEventListener('touchstart', (e) => {
      const el = e.target.closest('[data-ctx]'); if (!el) return;
      const t = e.touches[0]; const pt = { x: t.clientX, y: t.clientY };
      lp = setTimeout(() => { lp = null; const f = ACT[el.dataset.ctx]; if (f) { if (navigator.vibrate) navigator.vibrate(15); if (el.dataset.mid) el.dataset.id = el.dataset.mid; f(el, e, pt); } }, 480);
    }, { passive: true });
    const cancel = () => { if (lp) { clearTimeout(lp); lp = null; } };
    document.addEventListener('touchend', cancel); document.addEventListener('touchmove', cancel, { passive: true });
    // Dateien hineinziehen
    document.addEventListener('dragover', (e) => { if (curChat() && e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
    document.addEventListener('drop', (e) => { if (!curChat() || !e.dataTransfer.files.length) return; e.preventDefault(); A.sendFiles(Array.from(e.dataTransfer.files)); });
    addEventListener('resize', () => later('resize', () => { renderMain(); renderSide(); }, 200));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closePop(); const t = G.UI.topModal(); if (t) t.close(); else if (A.v.panel) ACT.closePanel(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); A.quickSwitch(); }
    });
  }

  G.addEventListener('DOMContentLoaded', () => boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<div class="banner">Fehler beim Start: ${esc(e.message)}</div>`); }));
})(window);
