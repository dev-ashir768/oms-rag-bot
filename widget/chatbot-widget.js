(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  const script = document.currentScript || (function () {
    const s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();

  const API_URL   = (script.getAttribute('data-api-url') || '').replace(/\/$/, '');
  const BOT_NAME  = script.getAttribute('data-bot-name') || 'Assistant';
  const BOT_COLOR = script.getAttribute('data-primary-color') || '#6366f1';
  const BOT_LOGO  = script.getAttribute('data-logo-url') || '';
  const WELCOME   = script.getAttribute('data-welcome-message') || `Hi! I'm ${BOT_NAME}. How can I help you?`;
  const POSITION  = script.getAttribute('data-position') || 'right';

  if (!API_URL) { console.error('[ChatBot] data-api-url is required'); return; }
  if (window.__ragBotLoaded) return;
  window.__ragBotLoaded = true;

  let sessionId = sessionStorage.getItem('_ragbot_sid') || null;

  // ─── Markdown Parser ──────────────────────────────────────────────────────
  function parseMarkdown(raw) {
    if (!raw) return '';

    // Escape HTML
    let text = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const lines = text.split('\n');
    const out   = [];
    let inUl = false, inOl = false;

    lines.forEach(function(line) {
      const ulM = /^[\*\-]\s+(.+)/.exec(line);
      const olM = /^\d+\.\s+(.+)/.exec(line);

      if (ulM) {
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (!inUl) { out.push('<ul>'); inUl = true; }
        out.push('<li>' + ulM[1] + '</li>');
      } else if (olM) {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (!inOl) { out.push('<ol>'); inOl = true; }
        out.push('<li>' + olM[1] + '</li>');
      } else {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (line.trim() === '') {
          out.push('<br>');
        } else {
          out.push('<p>' + line + '</p>');
        }
      }
    });

    if (inUl) out.push('</ul>');
    if (inOl) out.push('</ol>');

    let html = out.join('');

    // Bold+Italic: ***text***
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* (only single asterisk pairs)
    html = html.replace(/\*([^\*\n]+?)\*/g, '<em>$1</em>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    return html;
  }

  // ─── CSS ─────────────────────────────────────────────────────────────────
  function darken(hex, amt) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(function(x){ return x+x; }).join('');
    const n = parseInt(c, 16);
    const r = Math.max(0, (n >> 16) - amt);
    const g = Math.max(0, ((n >> 8) & 0xff) - amt);
    const b = Math.max(0, (n & 0xff) - amt);
    return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }
  const DARK = darken(BOT_COLOR, 35);

  const CSS = `
    #rb-w *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0}
    #rb-w{position:fixed;${POSITION}:24px;bottom:24px;z-index:2147483647}

    #rb-btn{width:58px;height:58px;border-radius:50%;
      background:linear-gradient(135deg,${BOT_COLOR},${DARK});
      border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 20px ${BOT_COLOR}66;
      transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;outline:none;position:relative}
    #rb-btn:hover{transform:scale(1.1)}
    #rb-btn svg{position:absolute;width:26px;height:26px;fill:#fff;
      transition:opacity .2s,transform .25s cubic-bezier(.34,1.56,.64,1)}
    #rb-btn .ic-chat{opacity:1;transform:rotate(0deg) scale(1)}
    #rb-btn .ic-x{opacity:0;transform:rotate(-90deg) scale(.5)}
    #rb-w.open #rb-btn .ic-chat{opacity:0;transform:rotate(90deg) scale(.5)}
    #rb-w.open #rb-btn .ic-x{opacity:1;transform:rotate(0deg) scale(1)}

    #rb-badge{position:absolute;top:-3px;${POSITION}:-3px;min-width:20px;height:20px;
      padding:0 5px;background:#ef4444;border-radius:10px;border:2px solid #fff;
      display:none;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff}
    #rb-badge.show{display:flex}

    /* Panel — slides up from bottom */
    #rb-panel{position:absolute;${POSITION}:0;bottom:70px;width:375px;
      background:#fff;border-radius:20px;display:flex;flex-direction:column;
      box-shadow:0 16px 56px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.06);
      transform:translateY(16px) scale(.96);opacity:0;pointer-events:none;
      transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .22s ease;
      max-height:min(580px, 85vh);overflow:hidden}
    #rb-w.open #rb-panel{transform:translateY(0) scale(1);opacity:1;pointer-events:all}

    /* Header */
    #rb-hdr{background:linear-gradient(135deg,${BOT_COLOR},${DARK});
      padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}
    #rb-av{width:40px;height:40px;border-radius:50%;
      background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.3);
      display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
    #rb-av img{width:100%;height:100%;object-fit:cover}
    #rb-av svg{width:22px;height:22px;fill:#fff}
    #rb-hi{flex:1;min-width:0}
    #rb-hn{color:#fff;font-weight:700;font-size:15px}
    #rb-hs{color:rgba(255,255,255,.85);font-size:11px;display:flex;align-items:center;gap:5px;margin-top:2px}
    #rb-hsd{width:7px;height:7px;border-radius:50%;background:#4ade80;
      box-shadow:0 0 0 2px rgba(74,222,128,.35);flex-shrink:0}
    #rb-xbtn{background:rgba(255,255,255,.18);border:none;cursor:pointer;
      width:30px;height:30px;border-radius:8px;display:flex;align-items:center;
      justify-content:center;transition:background .15s;flex-shrink:0}
    #rb-xbtn:hover{background:rgba(255,255,255,.3)}
    #rb-xbtn svg{width:15px;height:15px;stroke:#fff;fill:none;stroke-width:2.5;stroke-linecap:round}

    /* Messages */
    #rb-msgs{flex:1;overflow-y:auto;padding:16px 14px;display:flex;
      flex-direction:column;gap:12px;min-height:0}
    #rb-msgs::-webkit-scrollbar{width:4px}
    #rb-msgs::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:2px}

    /* Message row */
    .rb-row{display:flex;align-items:flex-end;gap:8px;
      animation:rb-in .2s ease both}
    @keyframes rb-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .rb-row.user{flex-direction:row-reverse}
    .rb-ri{display:flex;flex-direction:column;max-width:83%}
    .rb-row.user .rb-ri{align-items:flex-end}

    /* Bubbles */
    .rb-bbl{padding:10px 14px;border-radius:18px;font-size:14px;
      line-height:1.65;word-wrap:break-word}
    .rb-row.bot .rb-bbl{background:#f3f4f6;color:#111827;border-bottom-left-radius:5px}
    .rb-row.user .rb-bbl{background:linear-gradient(135deg,${BOT_COLOR},${DARK});
      color:#fff;border-bottom-right-radius:5px}

    /* Markdown inside bot bubble */
    .rb-row.bot .rb-bbl p{margin:0 0 5px}
    .rb-row.bot .rb-bbl p:last-child{margin:0}
    .rb-row.bot .rb-bbl ul,.rb-row.bot .rb-bbl ol{padding-left:18px;margin:5px 0}
    .rb-row.bot .rb-bbl li{margin-bottom:4px}
    .rb-row.bot .rb-bbl strong{font-weight:700;color:#111827}
    .rb-row.bot .rb-bbl em{font-style:italic}
    .rb-row.bot .rb-bbl code{background:#e8eaed;border-radius:4px;padding:1px 6px;
      font-family:monospace;font-size:12.5px;color:#d14}
    .rb-row.bot .rb-bbl br{display:block;content:'';margin:3px 0}

    /* Typewriter cursor */
    .rb-typing-cursor::after{content:'▍';display:inline-block;
      animation:rb-blink .65s infinite;color:${BOT_COLOR};font-size:13px;margin-left:1px}
    @keyframes rb-blink{0%,100%{opacity:1}50%{opacity:0}}

    .rb-time{font-size:10px;color:#9ca3af;margin-top:4px;padding:0 2px}
    .rb-row.user .rb-time{text-align:right}

    /* Mini avatar */
    .rb-mav{width:30px;height:30px;border-radius:50%;flex-shrink:0;overflow:hidden;
      background:linear-gradient(135deg,${BOT_COLOR},${DARK});
      display:flex;align-items:center;justify-content:center;
      border:2px solid rgba(255,255,255,.7);
      box-shadow:0 2px 8px ${BOT_COLOR}44}
    .rb-mav img{width:100%;height:100%;object-fit:cover}
    .rb-mav svg{width:16px;height:16px;fill:#fff}
    .rb-row.user .rb-mav{display:none}

    /* Typing dots */
    .rb-dots-row{display:flex;align-items:flex-end;gap:8px}
    .rb-dots{display:flex;align-items:center;gap:5px;padding:12px 15px;
      background:#f3f4f6;border-radius:18px;border-bottom-left-radius:5px;width:fit-content}
    .rb-dots span{width:7px;height:7px;background:#b0b8c8;border-radius:50%;
      animation:rb-bounce .9s infinite ease-in-out}
    .rb-dots span:nth-child(2){animation-delay:.18s}
    .rb-dots span:nth-child(3){animation-delay:.36s}
    @keyframes rb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-7px)}}

    /* Input */
    #rb-inp-area{padding:12px 14px;border-top:1px solid #f0f0f0;
      display:flex;gap:8px;align-items:flex-end;flex-shrink:0;background:#fff}
    #rb-inp{flex:1;border:1.5px solid #e5e7eb;border-radius:14px;padding:10px 14px;
      font-size:14px;resize:none;max-height:110px;min-height:44px;outline:none;
      line-height:1.5;transition:border-color .15s,box-shadow .15s;
      color:#111827;background:#fafafa}
    #rb-inp:focus{border-color:${BOT_COLOR};box-shadow:0 0 0 3px ${BOT_COLOR}1a;background:#fff}
    #rb-inp::placeholder{color:#b0b8c8}
    #rb-sbtn{width:42px;height:42px;border-radius:12px;
      background:linear-gradient(135deg,${BOT_COLOR},${DARK});
      border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
      flex-shrink:0;box-shadow:0 2px 10px ${BOT_COLOR}44;
      transition:transform .15s,opacity .15s;outline:none}
    #rb-sbtn:hover:not(:disabled){transform:scale(1.08)}
    #rb-sbtn:disabled{opacity:.35;cursor:not-allowed;transform:none;box-shadow:none}
    #rb-sbtn svg{width:18px;height:18px;fill:#fff}

    #rb-foot{text-align:center;padding:7px;font-size:10px;color:#c8d0da;
      background:#fafafa;border-top:1px solid #f3f4f6}

    @media(max-width:420px){
      #rb-panel{width:calc(100vw - 20px);${POSITION}:-2px}
    }
  `;

  // SVG icons
  const IC_CHAT = '<svg class="ic-chat" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  const IC_X    = '<svg class="ic-x" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const IC_SEND = '<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  const IC_BOT  = '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V7h3a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h3V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zm-4 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4 5c-1.5 0-2.5-.5-3-1h6c-.5.5-1.5 1-3 1z"/></svg>';
  const IC_CLS  = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  const avHTML = BOT_LOGO ? '<img src="'+BOT_LOGO+'" alt="">' : IC_BOT;

  // Inject CSS
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  // Build widget DOM
  const widget = document.createElement('div');
  widget.id = 'rb-w';
  widget.innerHTML =
    '<div id="rb-panel" role="dialog" aria-label="'+BOT_NAME+' Chat">' +
      '<div id="rb-hdr">' +
        '<div id="rb-av">'+avHTML+'</div>' +
        '<div id="rb-hi"><div id="rb-hn">'+BOT_NAME+'</div>' +
          '<div id="rb-hs"><span id="rb-hsd"></span>Online</div></div>' +
        '<button id="rb-xbtn" aria-label="Close">'+IC_CLS+'</button>' +
      '</div>' +
      '<div id="rb-msgs" role="log" aria-live="polite"></div>' +
      '<div id="rb-inp-area">' +
        '<textarea id="rb-inp" placeholder="Type your message..." rows="1"></textarea>' +
        '<button id="rb-sbtn" disabled aria-label="Send">'+IC_SEND+'</button>' +
      '</div>' +
      '<div id="rb-foot">Powered by RAG Bot</div>' +
    '</div>' +
    '<div id="rb-badge" aria-hidden="true">1</div>' +
    '<button id="rb-btn" aria-label="Open chat">'+IC_CHAT+IC_X+'</button>';

  document.body.appendChild(widget);

  const btn    = document.getElementById('rb-btn');
  const msgs   = document.getElementById('rb-msgs');
  const inp    = document.getElementById('rb-inp');
  const sbtn   = document.getElementById('rb-sbtn');
  const badge  = document.getElementById('rb-badge');
  const xbtn   = document.getElementById('rb-xbtn');

  let isOpen = false, isBusy = false, userScrolled = false;

  // ─── Open / Close ─────────────────────────────────────────────────────────
  function openW() {
    isOpen = true;
    widget.classList.add('open');
    badge.classList.remove('show');
    setTimeout(function(){ inp.focus(); }, 320);
  }
  function closeW() { isOpen = false; widget.classList.remove('open'); }

  btn.addEventListener('click', function(){ isOpen ? closeW() : openW(); });
  xbtn.addEventListener('click', closeW);

  // ─── Scroll helpers ───────────────────────────────────────────────────────
  msgs.addEventListener('scroll', function() {
    const distFromBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight;
    userScrolled = distFromBottom > 80;
  });

  // Scroll so `el` appears at the top of the messages container
  function scrollToEl(el) {
    if (!el) return;
    var rect    = el.getBoundingClientRect();
    var msgsRect = msgs.getBoundingClientRect();
    var delta   = rect.top - msgsRect.top - 10;
    msgs.scrollTop += delta;
    userScrolled = false;
  }

  function scrollBottom() {
    if (!userScrolled) msgs.scrollTop = msgs.scrollHeight;
  }

  function scrollBottomForce() {
    msgs.scrollTop = msgs.scrollHeight;
    userScrolled = false;
  }

  // ─── Time ─────────────────────────────────────────────────────────────────
  function ts() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ─── Append message ───────────────────────────────────────────────────────
  function appendMsg(role, content, isHtml) {
    var row  = document.createElement('div');
    row.className = 'rb-row ' + role;

    var av = document.createElement('div');
    av.className = 'rb-mav';
    av.innerHTML = BOT_LOGO ? '<img src="'+BOT_LOGO+'" alt="">' : IC_BOT;

    var ri = document.createElement('div');
    ri.className = 'rb-ri';

    var bbl = document.createElement('div');
    bbl.className = 'rb-bbl';
    if (isHtml) bbl.innerHTML = content;
    else bbl.textContent = content;

    var time = document.createElement('div');
    time.className = 'rb-time';
    time.textContent = ts();

    ri.appendChild(bbl);
    ri.appendChild(time);
    if (role === 'bot') row.appendChild(av);
    row.appendChild(ri);
    msgs.appendChild(row);

    if (!isOpen && role === 'bot') badge.classList.add('show');
    return { row: row, bbl: bbl };
  }

  // ─── Typing dots ──────────────────────────────────────────────────────────
  function showDots() {
    var wrap = document.createElement('div');
    wrap.className = 'rb-dots-row';
    wrap.id = 'rb-dots';
    var av = document.createElement('div');
    av.className = 'rb-mav';
    av.innerHTML = BOT_LOGO ? '<img src="'+BOT_LOGO+'" alt="">' : IC_BOT;
    var d = document.createElement('div');
    d.className = 'rb-dots';
    d.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(av);
    wrap.appendChild(d);
    msgs.appendChild(wrap);
    scrollBottom();
    return wrap;
  }
  function hideDots(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  // ─── Typewriter ───────────────────────────────────────────────────────────
  // userRow: the user's message row element (scroll anchor)
  // botBbl:  the bot's empty bubble to type into
  function typewrite(botBbl, fullText, userRow, onDone) {
    var words = fullText.split(' ');
    var i = 0;

    botBbl.classList.add('rb-typing-cursor');

    // Scroll so user message is visible at top → bot response types below it
    scrollToEl(userRow);

    function step() {
      if (i >= words.length) {
        // Final render: full markdown
        botBbl.classList.remove('rb-typing-cursor');
        botBbl.innerHTML = parseMarkdown(fullText);
        if (onDone) onDone();
        return;
      }
      var slice = words.slice(0, i + 1).join(' ');
      botBbl.innerHTML = parseMarkdown(slice);
      i++;
      scrollBottom(); // follows typing unless user scrolled up
      setTimeout(step, 32);
    }
    step();
  }

  // ─── Send ─────────────────────────────────────────────────────────────────
  function send() {
    var text = inp.value.trim();
    if (!text || isBusy) return;

    isBusy = true;
    inp.value = '';
    inp.style.height = 'auto';
    updateSend();

    var r = appendMsg('user', text, false);
    var userRow = r.row;
    scrollBottomForce();

    var dotsEl = showDots();

    var headers = { 'Content-Type': 'application/json' };
    if (sessionId) headers['X-Session-Id'] = sessionId;

    fetch(API_URL + '/api/chat', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ message: text })
    })
    .then(function(res) { return res.json().then(function(d){ return { ok: res.ok, data: d }; }); })
    .then(function(r2) {
      hideDots(dotsEl);

      if (!r2.ok) {
        appendMsg('bot', r2.data.error || 'Something went wrong. Please try again.', false);
        scrollBottom();
        isBusy = false;
        updateSend();
        return;
      }

      if (r2.data.sessionId) {
        sessionId = r2.data.sessionId;
        sessionStorage.setItem('_ragbot_sid', sessionId);
      }

      var b = appendMsg('bot', '', true);
      typewrite(b.bbl, r2.data.answer, userRow, function() {
        isBusy = false;
        updateSend();
      });
    })
    .catch(function() {
      hideDots(dotsEl);
      appendMsg('bot', 'Network error. Please check your connection.', false);
      scrollBottom();
      isBusy = false;
      updateSend();
    });
  }

  // ─── Input events ─────────────────────────────────────────────────────────
  function updateSend() {
    sbtn.disabled = inp.value.trim().length === 0 || isBusy;
  }

  inp.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 110) + 'px';
    updateSend();
  });

  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sbtn.disabled) send();
    }
  });

  sbtn.addEventListener('click', send);

  // ─── Welcome message ──────────────────────────────────────────────────────
  setTimeout(function() {
    var b = appendMsg('bot', '', true);
    typewrite(b.bbl, WELCOME, b.row, null);
  }, 500);

})();
