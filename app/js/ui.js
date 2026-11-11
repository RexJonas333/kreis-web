/* Vaultline – kleine Oberflächen-Helfer: Symbole, Fenster, Menüs, Hinweise, Textformatierung */
(function (G) {
  'use strict';
  const P = {
    chat: 'M7.9 20A9 9 0 1 0 4 16.1L2 22z',
    users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
    plus: 'M12 5v14M5 12h14', x: 'M18 6 6 18M6 6l12 12', check: 'M5 12.5l4.5 4.5L19 7.5',
    checks: 'M2 12.5l4.5 4.5L16 7.5M10.5 16.5l1 1L21 8',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7a2 2 0 0 1 1.7 2z',
    hang: 'M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 4.2 2 2 0 0 1 5.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L9.1 9.9M22 2 2 22',
    video: 'M23 7l-7 5 7 5V7zM3 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    videooff: 'M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5 0h4a2 2 0 0 1 2 2v3.3l1 1L23 7v10M1 1l22 22',
    mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3',
    micoff: 'M1 1l22 22M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.6M17 16.9A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.5-.35 2.17M12 19v3',
    head: 'M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z',
    headoff: 'M3 18v-6a9 9 0 0 1 14.5-7.1M21 12v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3zM2 2l20 20',
    screen: 'M2 4h20v13H2zM8 21h8M12 17v4M9 10.5l3-3 3 3M12 7.5v6',
    send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z', clip: 'M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5',
    smile: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
    image: 'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
    more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    reply: 'M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 5 5v2', edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
    pin: 'M12 17v5M9 10.8V5h6v5.8l3 3.2v2H6v-2z', fwd: 'M15 17l5-5-5-5M20 12H9a5 5 0 0 0-5 5v2',
    copy: 'M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2', lock: 'M5 11h14v11H5zM8 11V7a4 4 0 0 1 8 0v4',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4', hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
    vol: 'M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
    left: 'M15 18l-6-6 6-6', down: 'M6 9l6 6 6-6', right: 'M9 18l6-6-6-6',
    uplus: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20v.01M17 17h4v4h-4',
    camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    dl: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    belloff: 'M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17.9 17.9 0 0 1 18 8M6.3 6.3A5.9 5.9 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M1 1l22 22',
    archive: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4', out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    crown: 'M2 18h20M3 8l4 4 5-7 5 7 4-4-2 10H5z', thread: 'M4 6h16M4 12h10M4 18h6', poll: 'M3 3v18h18M8 16v-5M13 16V8M18 16v-3',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z', info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
    play: 'M6 4l14 8-14 8z', pause: 'M6 4h4v16H6zM14 4h4v16h-4z', stop: 'M6 6h12v12H6z', globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
    key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
    star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z', home: 'M3 10.5 12 3l9 7.5V21H3zM9 21v-7h6v7',
    server: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z', sticker: 'M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9.5L21 14.5V5a2 2 0 0 0-2-2zM14 21v-5a2 2 0 0 1 2-2h5',
    menu: 'M3 6h18M3 12h18M3 18h18', ban: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM4.9 4.9l14.2 14.2', refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
    max: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
    wave: 'M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 12h-2', at: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9',
  };
  const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24"><path d="${P[n] || ''}"/></svg>`;
  const LOGO = '<svg class="logo" viewBox="0 0 64 64"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9B8CFF"/><stop offset="1" stop-color="#5B4BE0"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#lg)"/><rect x="13.2" y="13.2" width="37.5" height="37.5" rx="6.2" fill="none" stroke="#fff" stroke-width="2.9"/><rect x="10.4" y="20.8" width="3.1" height="5.6" rx="0.9" fill="#fff"/><rect x="10.4" y="37.6" width="3.1" height="5.6" rx="0.9" fill="#fff"/><circle cx="32" cy="32" r="9.4" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M32.0 32.0L32.0 19.5M32.0 32.0L42.8 38.2M32.0 32.0L21.2 38.3" stroke="#fff" stroke-width="2.1" stroke-linecap="round"/><circle cx="32.0" cy="19.2" r="2.0" fill="#fff"/><circle cx="43.1" cy="38.4" r="2.0" fill="#fff"/><circle cx="20.9" cy="38.4" r="2.0" fill="#fff"/><circle cx="32" cy="32" r="3.1" fill="#fff"/><circle cx="50.8" cy="13.2" r="3.9" fill="#7CF2C2"/></svg>';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const initials = (n) => (String(n || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2) || '?').toUpperCase();
  const av = (name, color, img, cls = '', dot) => `<div class="av ${cls}" style="background:${esc(color || '#7C6CF2')}">${img ? `<img src="${esc(img)}" alt="">` : esc(initials(name))}${dot == null ? '' : `<i class="dot ${dot ? 'on' : ''}"></i>`}</div>`;

  function time(ts) { return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
  function dayLabel(ts) {
    const d = new Date(ts), t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Heute';
    if (d.toDateString() === y.toDateString()) return 'Gestern';
    return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() !== t.getFullYear() ? 'numeric' : undefined });
  }
  function shortTime(ts) {
    if (!ts) return '';
    const d = new Date(ts), t = new Date();
    if (d.toDateString() === t.toDateString()) return time(ts);
    if (t - d < 6 * 864e5) return d.toLocaleDateString('de-DE', { weekday: 'short' });
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }
  const size = (b) => b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : b > 1024 ? Math.round(b / 1024) + ' KB' : b + ' B';
  const dur = (s) => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  // Textformatierung (sicher: erst escapen, dann formatieren)
  function md(text, names) {
    let s = esc(text);
    const blocks = [];
    s = s.replace(/```(?:[a-z0-9]*\n)?([\s\S]*?)```/g, (_, c) => { blocks.push('<pre>' + c.replace(/^\n|\n$/g, '') + '</pre>'); return '\u0000' + (blocks.length - 1) + '\u0000'; });
    s = s.replace(/`([^`\n]+)`/g, (_, c) => { blocks.push('<code>' + c + '</code>'); return '\u0000' + (blocks.length - 1) + '\u0000'; });
    s = s.replace(/(^|\n)&gt; ?([^\n]*)/g, '$1<blockquote>$2</blockquote>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/__([^_\n]+)__/g, '<u>$1</u>').replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
    s = s.replace(/\|\|([^|\n]+)\|\|/g, '<span class="spoiler" data-a="spoiler">$1</span>');
    s = s.replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)"'\]]/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer" data-a="ext">${u}</a>`);
    s = s.replace(/(^|\s)@([A-Za-zÄÖÜäöüß0-9_.-]{2,32})/g, (all, pre, n) => (names && names.includes(n.toLowerCase())) || /^(alle|everyone)$/i.test(n) ? `${pre}<span class="mention">@${n}</span>` : all);
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]);
    return s;
  }
  const onlyEmoji = (t) => !!t && t.length <= 12 && /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u.test(t) && /\p{Extended_Pictographic}/u.test(t);

  const EMO = {
    'Häufig': '👍 ❤️ 😂 😮 😢 🔥 🎉 👀 🙏 💯 😎 🤝'.split(' '),
    'Gesichter': '😀 😃 😄 😁 😆 🥹 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👻 👽 🤖'.split(' '),
    'Gesten': '👋 🤚 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🙏 💪 🦾 🫡 🫶'.split(' '),
    'Herzen': '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 💕 💞 💓 💗 💖 💘 💝'.split(' '),
    'Spiele & Spaß': '🎮 🕹️ 🎲 🧩 🏆 🥇 ⚽ 🏀 🎯 🎳 🎸 🎧 🎤 🎬 📺 💻 🖥️ ⌨️ 🖱️ 📱 🔊 ⚔️ 🛡️ 🏹 💎 🪙 💰 🚀 ⭐ 🌙 ⚡ 🔥 💥 ✨ 🎉 🎊 🎁'.split(' '),
    'Essen': '🍕 🍔 🍟 🌭 🌮 🌯 🥙 🍝 🍜 🍣 🍱 🥗 🍿 🧁 🍰 🍩 🍪 🍫 🍦 🍉 🍓 🍌 🍎 ☕ 🧋 🥤 🍺 🍻'.split(' '),
    'Tiere & Natur': '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦅 🦉 🐺 🐗 🐴 🦄 🐝 🦋 🐢 🐍 🐙 🦈 🐳 🌲 🌴 🌵 🌸 🌻 🌈 ☀️ ❄️ 🌊'.split(' '),
    'Symbole': '✅ ❌ ⚠️ ❓ ❗ 💤 💬 👁️‍🗨️ 🔒 🔑 📌 📎 🔗 ⏰ 📅 ✏️ 🗑️ ➕ ➖ ✔️ 🆗 🆒 🆕 🔝 💲 ♻️ 🏳️ 🏴‍☠️'.split(' '),
  };
  const STICKERS = ['🎉', '🔥', '😂', '👍', '❤️', '🤯', '😎', '🥳', '😭', '🤝', '💀', '🙏', '🎮', '🏆', '🍕', '☕', '🚀', '🫡', '👀', '💯'];

  function toast(msg, ms = 2600) {
    let w = $('#toasts'); if (!w) { w = document.createElement('div'); w.id = 'toasts'; document.body.appendChild(w); }
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; w.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, ms);
  }
  let modalStack = [];
  function modal(html, opt = {}) {
    const ov = document.createElement('div'); ov.className = 'ov' + (opt.sheet ? ' sheet' : '');
    ov.innerHTML = `<div class="modal ${opt.wide ? 'wide' : ''} ${opt.sheet ? 'sheet' : ''}" role="dialog">${html}</div>`;
    const close = () => { ov.remove(); modalStack = modalStack.filter((x) => x !== ov); if (opt.onClose) opt.onClose(); };
    ov.close = close;
    ov.addEventListener('mousedown', (e) => { if (e.target === ov && !opt.sticky) close(); });
    ov.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    document.body.appendChild(ov); modalStack.push(ov);
    const f = ov.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 30);
    return ov;
  }
  const topModal = () => modalStack[modalStack.length - 1];
  function confirmBox(title, text, okText = 'OK', danger) {
    return new Promise((res) => {
      const m = modal(`<div class="mh"><h3>${esc(title)}</h3></div><div class="mb muted">${text}</div><div class="mf"><button class="btn sec" data-r="0">Abbrechen</button><button class="btn ${danger ? 'red' : ''}" data-r="1">${esc(okText)}</button></div>`, { onClose: () => res(false) });
      m.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { const v = b.dataset.r === '1'; m.remove(); modalStack = modalStack.filter((x) => x !== m); res(v); } });
    });
  }
  function prompt2(title, label, value = '', okText = 'Speichern', opt = {}) {
    return new Promise((res) => {
      const m = modal(`<div class="mh"><h3>${esc(title)}</h3></div><div class="mb"><label class="fld"><span>${esc(label)}</span>${opt.area ? `<textarea class="inp" autofocus>${esc(value)}</textarea>` : `<input class="inp" autofocus value="${esc(value)}" ${opt.type ? `type="${opt.type}"` : ''} maxlength="${opt.max || 200}" placeholder="${esc(opt.ph || '')}">`}</label></div><div class="mf"><button class="btn sec" data-close>Abbrechen</button><button class="btn" data-ok>${esc(okText)}</button></div>`, { onClose: () => res(null) });
      const inp = m.querySelector('.inp');
      const ok = () => { const v = inp.value; m.remove(); modalStack = modalStack.filter((x) => x !== m); res(v); };
      m.querySelector('[data-ok]').onclick = ok;
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !opt.area) ok(); });
    });
  }
  let popEl = null;
  function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
  function pop(html, anchor, opt = {}) {
    closePop();
    const p = document.createElement('div'); p.className = 'pop ' + (opt.cls || ''); p.innerHTML = html;
    document.body.appendChild(p); popEl = p;
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
    const pw = p.offsetWidth, ph = p.offsetHeight, W = innerWidth, H = innerHeight;
    let x = opt.alignRight ? r.right - pw : r.left, y = r.bottom + 6;
    if (y + ph > H - 8) y = Math.max(8, r.top - ph - 6);
    x = Math.max(8, Math.min(x, W - pw - 8));
    p.style.left = x + 'px'; p.style.top = y + 'px';
    setTimeout(() => document.addEventListener('mousedown', function h(e) { if (!p.contains(e.target)) { closePop(); document.removeEventListener('mousedown', h); } }), 0);
    p.addEventListener('click', (e) => { if (e.target.closest('[data-m]') && !opt.keep) setTimeout(closePop, 0); });
    return p;
  }
  function menu(items, anchor, opt) {
    const html = (opt && opt.head ? opt.head : '') + items.map((it) => it === '-' ? '<hr>' : `<button data-m="${esc(it.k)}" class="${it.red ? 'red' : ''}">${ic(it.i || 'right', 's')}<span>${esc(it.t)}</span></button>`).join('');
    const p = pop('<div class="menu">' + html + '</div>', anchor, opt);
    return new Promise((res) => { p.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) res(b.dataset.m); }); });
  }
  function emojiPicker(anchor, onPick, opt = {}) {
    const html = `<div style="width:340px"><div class="search" style="margin:4px 4px 8px">${ic('search', 's')}<input placeholder="Emoji suchen" data-es></div><div data-eb>` + Object.entries(EMO).map(([k, l]) => `<div class="grp-t">${esc(k)}</div><div class="emojis">${l.map((e) => `<button data-m="${e}" data-e="${e}">${e}</button>`).join('')}</div>`).join('') + '</div></div>';
    const p = pop(html, anchor, Object.assign({ keep: !!opt.keep }, opt));
    p.addEventListener('click', (e) => { const b = e.target.closest('[data-e]'); if (b) { onPick(b.dataset.e); if (!opt.keep) closePop(); } });
    const s = p.querySelector('[data-es]');
    s.addEventListener('input', () => { const q = s.value.trim(); p.querySelectorAll('.grp-t').forEach((g) => g.style.display = q ? 'none' : ''); p.querySelectorAll('[data-e]').forEach((b) => { b.style.display = !q || b.dataset.e.includes(q) ? '' : 'none'; }); });
    return p;
  }
  function qrImg(text) {
    try { const q = G.qrcode(0, 'M'); q.addData(text); q.make(); return `<div class="qr"><img alt="QR-Code" src="${q.createDataURL(6, 2)}"></div>`; }
    catch (e) { return ''; }
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Kopiert'); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); toast('Kopiert'); }
  }
  function beep(kind) {
    try {
      const A = G.__ac || (G.__ac = new (G.AudioContext || G.webkitAudioContext)());
      const o = A.createOscillator(), g = A.createGain(); o.connect(g); g.connect(A.destination);
      const t = A.currentTime;
      if (kind === 'ring') { o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + .18); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .5); o.start(t); o.stop(t + .52); }
      else { o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + .08); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.08, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .22); o.start(t); o.stop(t + .24); }
    } catch (e) {}
  }

  G.UI = { ic, LOGO, esc, $, $$, av, initials, time, dayLabel, shortTime, size, dur, md, onlyEmoji, EMO, STICKERS, toast, modal, topModal, confirmBox, prompt2, pop, closePop, menu, emojiPicker, qrImg, copy, beep };
})(window);
