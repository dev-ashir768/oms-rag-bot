(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();

  var API_URL  = (script.getAttribute('data-api-url') || '').replace(/\/$/, '');
  var BOT_NAME = script.getAttribute('data-bot-name') || 'Assistant';
  var COLOR    = script.getAttribute('data-primary-color') || '#6366f1';
  var BOT_LOGO = script.getAttribute('data-logo-url') || '';
  var WELCOME  = script.getAttribute('data-welcome-message') || ('Hi! I\'m ' + BOT_NAME + '. How can I help you?');
  var POS      = script.getAttribute('data-position') || 'right';

  if (!API_URL) { console.error('[ChatBot] data-api-url is required'); return; }
  if (window.__ragBotLoaded) return;
  window.__ragBotLoaded = true;

  var sessionId = sessionStorage.getItem('_rbot_sid') || null;

  // ─── Color helper ─────────────────────────────────────────────────────────
  function darken(hex, amt) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(function(x){ return x+x; }).join('');
    var n = parseInt(c, 16);
    var r = Math.max(0, (n >> 16) - amt);
    var g = Math.max(0, ((n >> 8) & 0xff) - amt);
    var b = Math.max(0, (n & 0xff) - amt);
    return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }
  var DARK = darken(COLOR, 35);

  // ─── Shadow DOM host ──────────────────────────────────────────────────────
  // Shadow DOM completely isolates our CSS from the host page.
  // No class name conflicts possible — this is production-standard.
  var host = document.createElement('div');
  host.setAttribute('id', '_ragbot_shadow_host_');
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'open' });

  // ─── CSS (injected into shadow — 100% isolated) ───────────────────────────
  var CSS = [
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
    'body { all: unset; }',

    /* Widget root — position fixed inside shadow works relative to viewport */
    '#w { position: fixed; ' + POS + ': 24px; bottom: 24px; z-index: 2147483647;',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',

    /* Toggle button */
    '#btn { width: 58px; height: 58px; border-radius: 50%;',
    '  background: linear-gradient(135deg,' + COLOR + ',' + DARK + ');',
    '  border: none; cursor: pointer; display: flex; align-items: center;',
    '  justify-content: center; box-shadow: 0 4px 20px ' + COLOR + '66;',
    '  transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .2s;',
    '  outline: none; position: relative; }',
    '#btn:hover { transform: scale(1.1); }',
    '#btn svg { position: absolute; width: 26px; height: 26px; fill: #fff;',
    '  transition: opacity .2s, transform .25s cubic-bezier(.34,1.56,.64,1); }',
    '#btn .ic { opacity: 1; transform: scale(1) rotate(0deg); }',
    '#btn .ix { opacity: 0; transform: scale(.5) rotate(-90deg); }',
    '#w.open #btn .ic { opacity: 0; transform: scale(.5) rotate(90deg); }',
    '#w.open #btn .ix { opacity: 1; transform: scale(1) rotate(0deg); }',

    /* Badge */
    '#badge { position: absolute; top: -3px; ' + POS + ': -3px; min-width: 20px; height: 20px;',
    '  padding: 0 5px; background: #ef4444; border-radius: 10px; border: 2px solid #fff;',
    '  display: none; align-items: center; justify-content: center;',
    '  font-size: 11px; font-weight: 700; color: #fff; }',
    '#badge.show { display: flex; }',

    /* Panel */
    '#panel { position: absolute; ' + POS + ': 0; bottom: 70px; width: 375px;',
    '  background: #fff; border-radius: 20px; display: flex; flex-direction: column;',
    '  box-shadow: 0 16px 56px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.06);',
    '  transform: translateY(16px) scale(.96); opacity: 0; pointer-events: none;',
    '  transition: transform .3s cubic-bezier(.34,1.56,.64,1), opacity .22s ease;',
    '  max-height: min(580px, 85vh); overflow: hidden; }',
    '#w.open #panel { transform: translateY(0) scale(1); opacity: 1; pointer-events: all; }',

    /* Header */
    '#hdr { background: linear-gradient(135deg,' + COLOR + ',' + DARK + ');',
    '  padding: 14px 16px; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }',
    '#av { width: 40px; height: 40px; border-radius: 50%;',
    '  background: rgba(255,255,255,.2); border: 2px solid rgba(255,255,255,.3);',
    '  display: flex; align-items: center; justify-content: center;',
    '  flex-shrink: 0; overflow: hidden; }',
    '#av img { width: 100%; height: 100%; object-fit: cover; }',
    '#av svg { width: 22px; height: 22px; fill: #fff; }',
    '#hi { flex: 1; min-width: 0; }',
    '#hn { color: #fff; font-weight: 700; font-size: 15px; }',
    '#hs { color: rgba(255,255,255,.85); font-size: 11px; display: flex;',
    '  align-items: center; gap: 5px; margin-top: 2px; }',
    '#hsd { width: 7px; height: 7px; border-radius: 50%; background: #4ade80;',
    '  box-shadow: 0 0 0 2px rgba(74,222,128,.35); flex-shrink: 0; }',
    '#xbtn { background: rgba(255,255,255,.18); border: none; cursor: pointer;',
    '  width: 30px; height: 30px; border-radius: 8px; display: flex;',
    '  align-items: center; justify-content: center; transition: background .15s; flex-shrink: 0; }',
    '#xbtn:hover { background: rgba(255,255,255,.3); }',
    '#xbtn svg { width: 15px; height: 15px; stroke: #fff; fill: none;',
    '  stroke-width: 2.5; stroke-linecap: round; }',

    /* Messages */
    '#msgs { flex: 1; overflow-y: auto; padding: 16px 14px;',
    '  display: flex; flex-direction: column; gap: 12px; min-height: 0;',
    '  scroll-behavior: auto; }',
    '#msgs::-webkit-scrollbar { width: 4px; }',
    '#msgs::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }',

    /* Row */
    '.row { display: flex; align-items: flex-end; gap: 8px;',
    '  animation: fadein .2s ease both; }',
    '@keyframes fadein { from { opacity:0; transform: translateY(8px); }',
    '  to { opacity:1; transform: translateY(0); } }',
    '.row.user { flex-direction: row-reverse; }',
    '.ri { display: flex; flex-direction: column; max-width: 83%; }',
    '.row.user .ri { align-items: flex-end; }',

    /* Bubble */
    '.bbl { padding: 10px 14px; border-radius: 18px; font-size: 14px;',
    '  line-height: 1.65; word-wrap: break-word; }',
    '.row.bot .bbl { background: #f3f4f6; color: #111827; border-bottom-left-radius: 5px; }',
    '.row.user .bbl { background: linear-gradient(135deg,' + COLOR + ',' + DARK + ');',
    '  color: #fff; border-bottom-right-radius: 5px; }',

    /* Markdown inside bot bubble */
    '.row.bot .bbl p { margin: 0 0 5px; }',
    '.row.bot .bbl p:last-child { margin: 0; }',
    '.row.bot .bbl ul, .row.bot .bbl ol { padding-left: 18px; margin: 5px 0; }',
    '.row.bot .bbl li { margin-bottom: 4px; }',
    '.row.bot .bbl strong { font-weight: 700; color: #111827; }',
    '.row.bot .bbl em { font-style: italic; }',
    '.row.bot .bbl code { background: #e8eaed; border-radius: 4px; padding: 1px 6px;',
    '  font-family: monospace; font-size: 12.5px; color: #c0392b; }',
    '.row.bot .bbl a { color: ' + COLOR + '; }',

    /* Typewriter cursor */
    '.tcursor::after { content: "▍"; display: inline-block; animation: blink .65s infinite;',
    '  color: ' + COLOR + '; font-size: 13px; margin-left: 1px; }',
    '@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }',

    /* Timestamp */
    '.ts { font-size: 10px; color: #9ca3af; margin-top: 4px; padding: 0 2px; }',
    '.row.user .ts { text-align: right; }',

    /* Mini avatar */
    '.mav { width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;',
    '  background: linear-gradient(135deg,' + COLOR + ',' + DARK + ');',
    '  display: flex; align-items: center; justify-content: center; overflow: hidden;',
    '  border: 2px solid rgba(255,255,255,.7); box-shadow: 0 2px 8px ' + COLOR + '44; }',
    '.mav img { width: 100%; height: 100%; object-fit: cover; }',
    '.mav svg { width: 16px; height: 16px; fill: #fff; }',
    '.row.user .mav { display: none; }',

    /* Typing dots */
    '.dots-row { display: flex; align-items: flex-end; gap: 8px; }',
    '.dots { display: flex; align-items: center; gap: 5px; padding: 12px 15px;',
    '  background: #f3f4f6; border-radius: 18px; border-bottom-left-radius: 5px; }',
    '.dots span { width: 7px; height: 7px; background: #b0b8c8; border-radius: 50%;',
    '  animation: bounce .9s infinite ease-in-out; display: inline-block; }',
    '.dots span:nth-child(2) { animation-delay: .18s; }',
    '.dots span:nth-child(3) { animation-delay: .36s; }',
    '@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-7px)} }',

    /* Input area */
    '#inp-area { padding: 12px 14px; border-top: 1px solid #f0f0f0;',
    '  display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; background: #fff; }',
    '#inp { flex: 1; border: 1.5px solid #e5e7eb; border-radius: 14px;',
    '  padding: 10px 14px; font-size: 14px; resize: none; max-height: 110px;',
    '  min-height: 44px; outline: none; line-height: 1.5; font-family: inherit;',
    '  transition: border-color .15s, box-shadow .15s; color: #111827; background: #fafafa; }',
    '#inp:focus { border-color: ' + COLOR + '; box-shadow: 0 0 0 3px ' + COLOR + '1a; background: #fff; }',
    '#inp::placeholder { color: #b0b8c8; }',
    '#sbtn { width: 42px; height: 42px; border-radius: 12px;',
    '  background: linear-gradient(135deg,' + COLOR + ',' + DARK + ');',
    '  border: none; cursor: pointer; display: flex; align-items: center;',
    '  justify-content: center; flex-shrink: 0; outline: none;',
    '  box-shadow: 0 2px 10px ' + COLOR + '44;',
    '  transition: transform .15s, opacity .15s; }',
    '#sbtn:hover:not(:disabled) { transform: scale(1.08); }',
    '#sbtn:disabled { opacity: .35; cursor: not-allowed; transform: none; box-shadow: none; }',
    '#sbtn svg { width: 18px; height: 18px; fill: #fff; }',

    /* Footer */
    '#foot { text-align: center; padding: 7px; font-size: 10px; color: #c8d0da;',
    '  background: #fafafa; border-top: 1px solid #f3f4f6; }',

    /* Responsive */
    '@media(max-width:420px){',
    '  #panel { width: calc(100vw - 20px); ' + POS + ': -2px; }',
    '}',
  ].join('\n');

  // ─── Icons ────────────────────────────────────────────────────────────────
  var IC  = '<svg class="ic" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var IX  = '<svg class="ix" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>';
  var SND = '<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  var BOT = '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V7h3a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h3V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zm-4 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4 5c-1.5 0-2.5-.5-3-1h6c-.5.5-1.5 1-3 1z"/></svg>';
  var CLX = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  var avHTML = BOT_LOGO ? '<img src="' + BOT_LOGO + '" alt="">' : BOT;

  // ─── Inject into Shadow DOM ───────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  shadow.appendChild(styleEl);

  var root = document.createElement('div');
  root.id = 'w';
  root.innerHTML =
    '<div id="panel" role="dialog" aria-label="' + BOT_NAME + ' Chat">' +
      '<div id="hdr">' +
        '<div id="av">' + avHTML + '</div>' +
        '<div id="hi"><div id="hn">' + BOT_NAME + '</div>' +
          '<div id="hs"><span id="hsd"></span>Online</div></div>' +
        '<button id="xbtn" aria-label="Close">' + CLX + '</button>' +
      '</div>' +
      '<div id="msgs" role="log" aria-live="polite"></div>' +
      '<div id="inp-area">' +
        '<textarea id="inp" placeholder="Type your message..." rows="1"></textarea>' +
        '<button id="sbtn" disabled aria-label="Send">' + SND + '</button>' +
      '</div>' +
      '<div id="foot">Powered by RAG Bot</div>' +
    '</div>' +
    '<div id="badge" aria-hidden="true">1</div>' +
    '<button id="btn" aria-label="Open chat">' + IC + IX + '</button>';

  shadow.appendChild(root);

  // ─── Refs (queried from shadow) ───────────────────────────────────────────
  var $ = function(id){ return shadow.getElementById(id); };
  var btn   = $('btn');
  var msgs  = $('msgs');
  var inp   = $('inp');
  var sbtn  = $('sbtn');
  var badge = $('badge');
  var xbtn  = $('xbtn');

  var isOpen = false, isBusy = false, userScrolled = false;

  // ─── Markdown Parser ──────────────────────────────────────────────────────
  function md(raw) {
    if (!raw) return '';
    var text = raw
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');

    var lines = text.split('\n');
    var out = [], inUl = false, inOl = false;

    lines.forEach(function(line) {
      var ulM = /^[\*\-]\s+(.+)/.exec(line);
      var olM = /^\d+\.\s+(.+)/.exec(line);
      if (ulM) {
        if (inOl){ out.push('</ol>'); inOl=false; }
        if (!inUl){ out.push('<ul>'); inUl=true; }
        out.push('<li>' + ulM[1] + '</li>');
      } else if (olM) {
        if (inUl){ out.push('</ul>'); inUl=false; }
        if (!inOl){ out.push('<ol>'); inOl=true; }
        out.push('<li>' + olM[1] + '</li>');
      } else {
        if (inUl){ out.push('</ul>'); inUl=false; }
        if (inOl){ out.push('</ol>'); inOl=false; }
        out.push(line.trim() === '' ? '<br>' : '<p>' + line + '</p>');
      }
    });

    if (inUl) out.push('</ul>');
    if (inOl) out.push('</ol>');

    var h = out.join('');
    h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*([^\*\n]+?)\*/g, '<em>$1</em>');
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Clickable links [text](url)
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return h;
  }

  // ─── Open / Close ─────────────────────────────────────────────────────────
  function openW() {
    isOpen = true; root.classList.add('open'); badge.classList.remove('show');
    setTimeout(function(){ inp.focus(); }, 320);
  }
  function closeW() { isOpen = false; root.classList.remove('open'); }
  btn.addEventListener('click', function(){ isOpen ? closeW() : openW(); });
  xbtn.addEventListener('click', closeW);

  // ─── Scroll ───────────────────────────────────────────────────────────────
  msgs.addEventListener('scroll', function() {
    userScrolled = (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight) > 80;
  });

  function scrollToEl(el) {
    if (!el) return;
    var eRect = el.getBoundingClientRect();
    var mRect = msgs.getBoundingClientRect();
    msgs.scrollTop += (eRect.top - mRect.top) - 10;
    userScrolled = false;
  }
  function scrollBottom() { if (!userScrolled) msgs.scrollTop = msgs.scrollHeight; }
  function scrollBottomForce() { msgs.scrollTop = msgs.scrollHeight; userScrolled = false; }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function nowTs() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function makeAv() {
    var el = document.createElement('div');
    el.className = 'mav';
    el.innerHTML = BOT_LOGO ? '<img src="' + BOT_LOGO + '" alt="">' : BOT;
    return el;
  }

  function appendMsg(role, content, isHtml) {
    var row = document.createElement('div');
    row.className = 'row ' + role;

    var ri  = document.createElement('div'); ri.className = 'ri';
    var bbl = document.createElement('div'); bbl.className = 'bbl';
    var ts  = document.createElement('div'); ts.className = 'ts';

    if (isHtml) bbl.innerHTML = content; else bbl.textContent = content;
    ts.textContent = nowTs();

    ri.appendChild(bbl); ri.appendChild(ts);
    if (role === 'bot') row.appendChild(makeAv());
    row.appendChild(ri);
    msgs.appendChild(row);

    if (!isOpen && role === 'bot') badge.classList.add('show');
    return { row: row, bbl: bbl };
  }

  function showDots() {
    var wrap = document.createElement('div');
    wrap.className = 'dots-row'; wrap.id = '_dots_';
    var d = document.createElement('div'); d.className = 'dots';
    d.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(makeAv()); wrap.appendChild(d);
    msgs.appendChild(wrap); scrollBottom();
    return wrap;
  }
  function hideDots(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  // ─── Typewriter ───────────────────────────────────────────────────────────
  function typewrite(bbl, fullText, userRow, onDone) {
    var words = fullText.split(' '), i = 0;
    bbl.classList.add('tcursor');
    scrollToEl(userRow); // anchor: user msg stays at top while bot types below

    function step() {
      if (i >= words.length) {
        bbl.classList.remove('tcursor');
        bbl.innerHTML = md(fullText); // final full render
        if (onDone) onDone();
        return;
      }
      bbl.innerHTML = md(words.slice(0, i + 1).join(' '));
      i++;
      scrollBottom();
      setTimeout(step, 32);
    }
    step();
  }

  // ─── Send ─────────────────────────────────────────────────────────────────
  function send() {
    var text = inp.value.trim();
    if (!text || isBusy) return;
    isBusy = true;
    inp.value = ''; inp.style.height = 'auto'; updateSend();

    var r = appendMsg('user', text, false);
    scrollBottomForce();
    var dotsEl = showDots();

    var headers = { 'Content-Type': 'application/json' };
    if (sessionId) headers['X-Session-Id'] = sessionId;

    fetch(API_URL + '/api/chat', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ message: text })
    })
    .then(function(res){
      return res.json().then(function(d){ return { ok: res.ok, data: d }; });
    })
    .then(function(result){
      hideDots(dotsEl);
      if (!result.ok) {
        appendMsg('bot', result.data.error || 'Something went wrong.', false);
        scrollBottom(); isBusy = false; updateSend(); return;
      }
      if (result.data.sessionId) {
        sessionId = result.data.sessionId;
        sessionStorage.setItem('_rbot_sid', sessionId);
      }
      var b = appendMsg('bot', '', true);
      typewrite(b.bbl, result.data.answer, r.row, function(){
        isBusy = false; updateSend();
      });
    })
    .catch(function(){
      hideDots(dotsEl);
      appendMsg('bot', 'Network error. Please check your connection.', false);
      scrollBottom(); isBusy = false; updateSend();
    });
  }

  // ─── Input ────────────────────────────────────────────────────────────────
  function updateSend() {
    sbtn.disabled = inp.value.trim().length === 0 || isBusy;
  }
  inp.addEventListener('input', function(){
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 110) + 'px';
    updateSend();
  });
  inp.addEventListener('keydown', function(e){
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); if (!sbtn.disabled) send(); }
  });
  sbtn.addEventListener('click', send);

  // ─── Welcome ──────────────────────────────────────────────────────────────
  setTimeout(function(){
    var b = appendMsg('bot', '', true);
    typewrite(b.bbl, WELCOME, b.row, null);
  }, 500);

})();
