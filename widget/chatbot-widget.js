(function () {
  'use strict';

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
  var CHIPS_RAW = script.getAttribute('data-quick-replies') || '';
  var CHIPS    = CHIPS_RAW ? CHIPS_RAW.split('|').map(function(c){ return c.trim(); }).filter(Boolean) : [];

  if (!API_URL) { console.error('[ChatBot] data-api-url is required'); return; }
  if (window.__ragBotLoaded) return;
  window.__ragBotLoaded = true;

  var sessionId = sessionStorage.getItem('_rbot_sid') || null;
  var chipsUsed = false;

  function darken(hex, amt) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(function(x){ return x+x; }).join('');
    var n = parseInt(c, 16);
    var r = Math.max(0,(n>>16)-amt), g = Math.max(0,((n>>8)&0xff)-amt), b = Math.max(0,(n&0xff)-amt);
    return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }
  var DARK = darken(COLOR, 35);
  var PALE = COLOR + '18';

  // ─── Shadow DOM ───────────────────────────────────────────────────────────
  var host = document.createElement('div');
  host.setAttribute('id', '_ragbot_host_');
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'open' });

  // ─── CSS ──────────────────────────────────────────────────────────────────
  var CSS = [
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
    '#w { position: fixed; ' + POS + ': 24px; bottom: 24px; z-index: 2147483647;',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',

    /* ── Toggle button ── */
    '#btn { width: 58px; height: 58px; border-radius: 50%; position: relative;',
    '  background: linear-gradient(135deg,' + COLOR + ',' + DARK + ');',
    '  border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;',
    '  box-shadow: 0 4px 20px ' + COLOR + '66;',
    '  transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .2s; outline: none; }',
    '#btn:hover { transform: scale(1.1); box-shadow: 0 6px 28px ' + COLOR + '88; }',
    '#btn svg { position: absolute; width: 26px; height: 26px; fill: #fff;',
    '  transition: opacity .2s, transform .25s cubic-bezier(.34,1.56,.64,1); }',
    '#btn .ic { opacity: 1; transform: scale(1) rotate(0deg); }',
    '#btn .ix { opacity: 0; transform: scale(.5) rotate(-90deg); }',
    '#w.open #btn .ic { opacity: 0; transform: scale(.5) rotate(90deg); }',
    '#w.open #btn .ix { opacity: 1; transform: scale(1) rotate(0deg); }',

    /* Pulse ring — plays when there's an unread bot message */
    '#btn::before { content: ""; position: absolute; inset: -4px; border-radius: 50%;',
    '  border: 3px solid ' + COLOR + '; opacity: 0; transform: scale(1);',
    '  transition: opacity .3s; pointer-events: none; }',
    '#w.pulse #btn::before { animation: ring 1.6s ease-out infinite; }',
    '@keyframes ring { 0%{opacity:.8;transform:scale(1)} 100%{opacity:0;transform:scale(1.7)} }',

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
    '#hdr { padding: 14px 16px; display: flex; align-items: center; gap: 10px; flex-shrink: 0;',
    '  background: linear-gradient(135deg,' + COLOR + ',' + DARK + ');',
    '  background-size: 200% 200%; animation: gradshift 6s ease infinite; }',
    '@keyframes gradshift {',
    '  0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%}',
    '}',
    '#av { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,.2);',
    '  border: 2px solid rgba(255,255,255,.3); display: flex; align-items: center;',
    '  justify-content: center; flex-shrink: 0; overflow: hidden; }',
    '#av img { width: 100%; height: 100%; object-fit: cover; }',
    '#av svg { width: 22px; height: 22px; fill: #fff; }',
    '#hi { flex: 1; min-width: 0; }',
    '#hn { color: #fff; font-weight: 700; font-size: 15px; }',
    '#hs { color: rgba(255,255,255,.85); font-size: 11px; display: flex; align-items: center; gap: 5px; margin-top: 2px; }',
    '#hsd { width: 7px; height: 7px; border-radius: 50%; background: #4ade80;',
    '  box-shadow: 0 0 0 2px rgba(74,222,128,.35); flex-shrink: 0; }',
    '#xbtn { background: rgba(255,255,255,.18); border: none; cursor: pointer;',
    '  width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center;',
    '  justify-content: center; transition: background .15s; flex-shrink: 0; }',
    '#xbtn:hover { background: rgba(255,255,255,.3); }',
    '#xbtn svg { width: 15px; height: 15px; stroke: #fff; fill: none; stroke-width: 2.5; stroke-linecap: round; }',

    /* Messages area */
    '#msgs-wrap { flex: 1; position: relative; min-height: 0; display: flex; flex-direction: column; }',
    '#msgs { flex: 1; overflow-y: auto; padding: 16px 14px 8px;',
    '  display: flex; flex-direction: column; gap: 12px; min-height: 0; }',
    '#msgs::-webkit-scrollbar { width: 4px; }',
    '#msgs::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }',

    /* Scroll-to-bottom button */
    '#scroll-down { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);',
    '  background: #fff; border: 1.5px solid #e5e7eb; border-radius: 20px;',
    '  padding: 5px 14px; font-size: 12px; font-weight: 600; color: #374151;',
    '  cursor: pointer; display: none; align-items: center; gap: 5px;',
    '  box-shadow: 0 2px 12px rgba(0,0,0,.12); transition: box-shadow .15s, transform .15s;',
    '  white-space: nowrap; }',
    '#scroll-down:hover { box-shadow: 0 4px 18px rgba(0,0,0,.18); transform: translateX(-50%) translateY(-1px); }',
    '#scroll-down.show { display: flex; }',
    '#scroll-down svg { width: 13px; height: 13px; }',
    '#scroll-down .dot { width: 7px; height: 7px; border-radius: 50%;',
    '  background: ' + COLOR + '; flex-shrink: 0; animation: sdpulse 1.2s infinite; }',
    '@keyframes sdpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }',

    /* Quick reply chips */
    '#chips { padding: 8px 14px; display: flex; flex-wrap: wrap; gap: 7px; flex-shrink: 0; }',
    '#chips.hidden { display: none; }',
    '.chip { background: #fff; border: 1.5px solid ' + COLOR + '; color: ' + COLOR + ';',
    '  border-radius: 20px; padding: 6px 14px; font-size: 12.5px; font-weight: 500;',
    '  cursor: pointer; transition: background .15s, color .15s, transform .1s;',
    '  white-space: nowrap; animation: chipin .25s ease both; }',
    '@keyframes chipin { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }',
    '.chip:hover { background: ' + COLOR + '; color: #fff; transform: translateY(-1px); }',

    /* Message row */
    '.row { display: flex; align-items: flex-end; gap: 8px; animation: fadein .2s ease both; }',
    '@keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }',
    '.row.user { flex-direction: row-reverse; }',
    '.ri { display: flex; flex-direction: column; max-width: 83%; }',
    '.row.user .ri { align-items: flex-end; }',

    /* Bubble */
    '.bbl { padding: 10px 14px; border-radius: 18px; font-size: 14px;',
    '  line-height: 1.65; word-wrap: break-word; position: relative; }',
    '.row.bot .bbl { background: #f3f4f6; color: #111827; border-bottom-left-radius: 5px; }',
    '.row.user .bbl { background: linear-gradient(135deg,' + COLOR + ',' + DARK + ');',
    '  color: #fff; border-bottom-right-radius: 5px; }',

    /* Copy button (appears on bot bubble hover) */
    '.copy-btn { position: absolute; top: 7px; right: 7px; width: 26px; height: 26px;',
    '  background: #fff; border: 1.5px solid #e5e7eb; border-radius: 7px; cursor: pointer;',
    '  display: none; align-items: center; justify-content: center;',
    '  box-shadow: 0 1px 4px rgba(0,0,0,.1); transition: background .15s, border-color .15s; }',
    '.bbl:hover .copy-btn { display: flex; }',
    '.copy-btn:hover { background: ' + COLOR + '; border-color: ' + COLOR + '; }',
    '.copy-btn:hover svg { stroke: #fff; }',
    '.copy-btn svg { width: 13px; height: 13px; stroke: #6b7280; fill: none;',
    '  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }',
    '.copy-btn.copied { background: #22c55e; border-color: #22c55e; }',
    '.copy-btn.copied svg { stroke: #fff; }',

    /* Feedback (thumbs) */
    '.feedback { display: flex; align-items: center; gap: 6px; margin-top: 5px; padding: 0 2px; }',
    '.fb-btn { background: none; border: 1.5px solid #e5e7eb; border-radius: 8px;',
    '  width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center;',
    '  justify-content: center; font-size: 13px; transition: background .15s, border-color .15s, transform .1s;',
    '  line-height: 1; }',
    '.fb-btn:hover { background: #f9fafb; transform: scale(1.15); }',
    '.fb-btn.active-up { background: #dcfce7; border-color: #22c55e; }',
    '.fb-btn.active-dn { background: #fee2e2; border-color: #ef4444; }',
    '.fb-label { font-size: 10px; color: #9ca3af; transition: color .2s; }',
    '.fb-label.thanks { color: #22c55e; font-weight: 600; }',

    /* Markdown */
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

    /* Input */
    '#inp-area { padding: 12px 14px; border-top: 1px solid #f0f0f0;',
    '  display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; background: #fff; }',
    '#inp { flex: 1; border: 1.5px solid #e5e7eb; border-radius: 14px; padding: 10px 14px;',
    '  font-size: 14px; resize: none; max-height: 110px; min-height: 44px; outline: none;',
    '  line-height: 1.5; font-family: inherit; transition: border-color .15s, box-shadow .15s;',
    '  color: #111827; background: #fafafa; }',
    '#inp:focus { border-color: ' + COLOR + '; box-shadow: 0 0 0 3px ' + PALE + '; background: #fff; }',
    '#inp::placeholder { color: #b0b8c8; }',
    '#sbtn { width: 42px; height: 42px; border-radius: 12px;',
    '  background: linear-gradient(135deg,' + COLOR + ',' + DARK + ');',
    '  border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;',
    '  flex-shrink: 0; outline: none; box-shadow: 0 2px 10px ' + COLOR + '44;',
    '  transition: transform .15s, opacity .15s; }',
    '#sbtn:hover:not(:disabled) { transform: scale(1.08); }',
    '#sbtn:disabled { opacity: .35; cursor: not-allowed; transform: none; box-shadow: none; }',
    '#sbtn svg { width: 18px; height: 18px; fill: #fff; }',

    '#foot { text-align: center; padding: 7px; font-size: 10px; color: #c8d0da;',
    '  background: #fafafa; border-top: 1px solid #f3f4f6; }',

    '@media(max-width:420px){',
    '  #panel { width: calc(100vw - 20px); ' + POS + ': -2px; }',
    '}',
  ].join('\n');

  // ─── Icons ────────────────────────────────────────────────────────────────
  var IC   = '<svg class="ic" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var IX   = '<svg class="ix" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>';
  var SND  = '<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  var BOT  = '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V7h3a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h3V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zm-4 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4 5c-1.5 0-2.5-.5-3-1h6c-.5.5-1.5 1-3 1z"/></svg>';
  var CLX  = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var CPY  = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var CHK  = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  var ARR  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';

  var avHTML = BOT_LOGO ? '<img src="' + BOT_LOGO + '" alt="">' : BOT;

  // ─── Inject into Shadow ───────────────────────────────────────────────────
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
      '<div id="msgs-wrap">' +
        '<div id="msgs" role="log" aria-live="polite"></div>' +
        '<button id="scroll-down" aria-label="Scroll to latest"><span class="dot"></span>New reply ' + ARR + '</button>' +
      '</div>' +
      (CHIPS.length ? '<div id="chips">' + CHIPS.map(function(c,i){
        return '<div class="chip" style="animation-delay:' + (i*0.06) + 's">' + c + '</div>';
      }).join('') + '</div>' : '') +
      '<div id="inp-area">' +
        '<textarea id="inp" placeholder="Type your message..." rows="1"></textarea>' +
        '<button id="sbtn" disabled aria-label="Send">' + SND + '</button>' +
      '</div>' +
      '<div id="foot">Powered by RAG Bot</div>' +
    '</div>' +
    '<div id="badge" aria-hidden="true">1</div>' +
    '<button id="btn" aria-label="Open chat">' + IC + IX + '</button>';

  shadow.appendChild(root);

  // ─── Refs ─────────────────────────────────────────────────────────────────
  var $ = function(id){ return shadow.getElementById(id); };
  var btn       = $('btn');
  var msgs      = $('msgs');
  var inp       = $('inp');
  var sbtn      = $('sbtn');
  var badge     = $('badge');
  var xbtn      = $('xbtn');
  var scrollBtn = $('scroll-down');
  var chipsEl   = $('chips');

  var isOpen = false, isBusy = false, userScrolled = false;

  // ─── Open / Close ─────────────────────────────────────────────────────────
  function openW() {
    isOpen = true;
    root.classList.add('open');
    root.classList.remove('pulse');
    badge.classList.remove('show');
    setTimeout(function(){ inp.focus(); }, 320);
  }
  function closeW() { isOpen = false; root.classList.remove('open'); }
  btn.addEventListener('click', function(){ isOpen ? closeW() : openW(); });
  xbtn.addEventListener('click', closeW);

  // ─── Scroll ───────────────────────────────────────────────────────────────
  msgs.addEventListener('scroll', function() {
    var dist = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight;
    userScrolled = dist > 80;
    if (!userScrolled) {
      scrollBtn.classList.remove('show');
    }
  });

  function scrollToEl(el) {
    if (!el) return;
    var eR = el.getBoundingClientRect(), mR = msgs.getBoundingClientRect();
    msgs.scrollTop += (eR.top - mR.top) - 10;
    userScrolled = false;
  }
  function scrollBottom() { if (!userScrolled) msgs.scrollTop = msgs.scrollHeight; }
  function scrollBottomForce() { msgs.scrollTop = msgs.scrollHeight; userScrolled = false; scrollBtn.classList.remove('show'); }

  scrollBtn.addEventListener('click', function(){
    scrollBottomForce();
  });

  // ─── Markdown ─────────────────────────────────────────────────────────────
  function md(raw) {
    if (!raw) return '';
    var text = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    var lines = text.split('\n'), out = [], inUl = false, inOl = false;
    lines.forEach(function(line) {
      var uM = /^[\*\-]\s+(.+)/.exec(line), oM = /^\d+\.\s+(.+)/.exec(line);
      if (uM) {
        if (inOl){out.push('</ol>');inOl=false;} if(!inUl){out.push('<ul>');inUl=true;}
        out.push('<li>'+uM[1]+'</li>');
      } else if (oM) {
        if (inUl){out.push('</ul>');inUl=false;} if(!inOl){out.push('<ol>');inOl=true;}
        out.push('<li>'+oM[1]+'</li>');
      } else {
        if(inUl){out.push('</ul>');inUl=false;} if(inOl){out.push('</ol>');inOl=false;}
        out.push(line.trim()===''?'<br>':'<p>'+line+'</p>');
      }
    });
    if(inUl)out.push('</ul>'); if(inOl)out.push('</ol>');
    var h = out.join('');
    h = h.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
    h = h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    h = h.replace(/\*([^\*\n]+?)\*/g,'<em>$1</em>');
    h = h.replace(/`([^`]+)`/g,'<code>$1</code>');
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
    return h;
  }

  // ─── Time ─────────────────────────────────────────────────────────────────
  function nowTs() {
    return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  }

  // ─── Mini avatar ──────────────────────────────────────────────────────────
  function makeAv() {
    var el = document.createElement('div'); el.className = 'mav';
    el.innerHTML = BOT_LOGO ? '<img src="'+BOT_LOGO+'" alt="">' : BOT;
    return el;
  }

  // ─── Append message ───────────────────────────────────────────────────────
  function appendMsg(role, content, isHtml) {
    var row = document.createElement('div'); row.className = 'row ' + role;
    var ri  = document.createElement('div'); ri.className = 'ri';
    var bbl = document.createElement('div'); bbl.className = 'bbl';
    var ts  = document.createElement('div'); ts.className = 'ts';

    if (isHtml) bbl.innerHTML = content; else bbl.textContent = content;
    ts.textContent = nowTs();

    // Copy button (bot only)
    if (role === 'bot') {
      var cpBtn = document.createElement('button');
      cpBtn.className = 'copy-btn'; cpBtn.title = 'Copy message';
      cpBtn.innerHTML = CPY;
      cpBtn.addEventListener('click', function() {
        var plainText = bbl.innerText || bbl.textContent || '';
        navigator.clipboard && navigator.clipboard.writeText(plainText).then(function(){
          cpBtn.innerHTML = CHK; cpBtn.classList.add('copied');
          setTimeout(function(){ cpBtn.innerHTML = CPY; cpBtn.classList.remove('copied'); }, 1500);
        });
      });
      bbl.appendChild(cpBtn);
    }

    ri.appendChild(bbl);

    // Thumbs up/down (bot only, after full render)
    if (role === 'bot') {
      var fb = document.createElement('div'); fb.className = 'feedback';
      var upBtn = document.createElement('button'); upBtn.className = 'fb-btn'; upBtn.title = 'Helpful'; upBtn.textContent = '👍';
      var dnBtn = document.createElement('button'); dnBtn.className = 'fb-btn'; dnBtn.title = 'Not helpful'; dnBtn.textContent = '👎';
      var lbl   = document.createElement('span');   lbl.className = 'fb-label'; lbl.textContent = 'Was this helpful?';

      upBtn.addEventListener('click', function(){
        if (upBtn.classList.contains('active-up')) return;
        upBtn.classList.add('active-up'); dnBtn.classList.remove('active-dn');
        lbl.textContent = 'Thanks for the feedback!'; lbl.classList.add('thanks');
      });
      dnBtn.addEventListener('click', function(){
        if (dnBtn.classList.contains('active-dn')) return;
        dnBtn.classList.add('active-dn'); upBtn.classList.remove('active-up');
        lbl.textContent = 'Thanks, we\'ll improve!'; lbl.classList.add('thanks');
      });

      fb.appendChild(upBtn); fb.appendChild(dnBtn); fb.appendChild(lbl);
      ri.appendChild(fb);
    }

    ri.appendChild(ts);
    if (role === 'bot') row.appendChild(makeAv());
    row.appendChild(ri);
    msgs.appendChild(row);

    // Notify unread when panel is closed
    if (!isOpen && role === 'bot') {
      badge.classList.add('show');
      root.classList.add('pulse');
    }

    return { row: row, bbl: bbl };
  }

  // ─── Typing dots ──────────────────────────────────────────────────────────
  function showDots() {
    var wrap = document.createElement('div'); wrap.className = 'dots-row'; wrap.id = '_dots_';
    var d = document.createElement('div'); d.className = 'dots';
    d.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(makeAv()); wrap.appendChild(d);
    msgs.appendChild(wrap); scrollBottom(); return wrap;
  }
  function hideDots(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  // ─── Typewriter ───────────────────────────────────────────────────────────
  function typewrite(bbl, fullText, userRow, onDone) {
    var words = fullText.split(' '), i = 0;
    bbl.classList.add('tcursor');
    scrollToEl(userRow);

    function step() {
      if (i >= words.length) {
        bbl.classList.remove('tcursor');
        bbl.innerHTML = md(fullText);
        // Re-attach copy button after full render
        addCopyBtn(bbl);
        if (onDone) onDone();
        return;
      }
      bbl.innerHTML = md(words.slice(0, i+1).join(' '));
      i++;
      // Show scroll-down button if user has scrolled up
      if (userScrolled) scrollBtn.classList.add('show');
      else scrollBottom();
      setTimeout(step, 32);
    }
    step();
  }

  function addCopyBtn(bbl) {
    // Remove old copy btn if any, add fresh one
    var old = bbl.querySelector('.copy-btn');
    if (old) old.parentNode.removeChild(old);
    var cpBtn = document.createElement('button');
    cpBtn.className = 'copy-btn'; cpBtn.title = 'Copy message'; cpBtn.innerHTML = CPY;
    cpBtn.addEventListener('click', function(){
      var plainText = bbl.innerText || bbl.textContent || '';
      navigator.clipboard && navigator.clipboard.writeText(plainText).then(function(){
        cpBtn.innerHTML = CHK; cpBtn.classList.add('copied');
        setTimeout(function(){ cpBtn.innerHTML = CPY; cpBtn.classList.remove('copied'); }, 1500);
      });
    });
    bbl.appendChild(cpBtn);
  }

  // ─── Quick reply chips ────────────────────────────────────────────────────
  function hideChips() {
    if (chipsEl) { chipsEl.classList.add('hidden'); }
    chipsUsed = true;
  }

  if (chipsEl) {
    var chipEls = shadow.querySelectorAll('.chip');
    chipEls.forEach(function(chip) {
      chip.addEventListener('click', function(){
        var q = chip.textContent;
        hideChips();
        inp.value = q;
        send();
      });
    });
  }

  // ─── Send ─────────────────────────────────────────────────────────────────
  function send() {
    var text = inp.value.trim();
    if (!text || isBusy) return;
    isBusy = true;
    inp.value = ''; inp.style.height = 'auto'; updateSend();
    hideChips();

    var r = appendMsg('user', text, false);
    scrollBottomForce();
    var dotsEl = showDots();

    var headers = { 'Content-Type': 'application/json' };
    if (sessionId) headers['X-Session-Id'] = sessionId;

    fetch(API_URL + '/api/chat', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ message: text })
    })
    .then(function(res){ return res.json().then(function(d){ return { ok: res.ok, data: d }; }); })
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
  function updateSend() { sbtn.disabled = inp.value.trim().length === 0 || isBusy; }
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
