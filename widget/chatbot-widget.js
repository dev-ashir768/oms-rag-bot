(function () {
  'use strict';

  // ─── Config from script tag ───────────────────────────────────────────────
  const script = document.currentScript || (function () {
    const s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();

  const API_URL    = (script.getAttribute('data-api-url') || '').replace(/\/$/, '');
  const BOT_NAME   = script.getAttribute('data-bot-name') || 'Assistant';
  const BOT_COLOR  = script.getAttribute('data-primary-color') || '#6366f1';
  const BOT_LOGO   = script.getAttribute('data-logo-url') || '';
  const WELCOME    = script.getAttribute('data-welcome-message') || `Hi! I'm ${BOT_NAME}. How can I help you?`;
  const POSITION   = script.getAttribute('data-position') || 'right';

  if (!API_URL) { console.error('[ChatBot] data-api-url is required'); return; }
  if (window.__ragBotLoaded) return;
  window.__ragBotLoaded = true;

  let sessionId = sessionStorage.getItem('_ragbot_sid') || null;

  // ─── Markdown Parser ──────────────────────────────────────────────────────
  function parseMarkdown(raw) {
    let text = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const lines = text.split('\n');
    const out = [];
    let inUl = false, inOl = false;

    lines.forEach(line => {
      const ulMatch = /^[\*\-]\s+(.+)/.exec(line);
      const olMatch = /^\d+\.\s+(.+)/.exec(line);

      if (ulMatch) {
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (!inUl) { out.push('<ul>'); inUl = true; }
        out.push(`<li>${ulMatch[1]}</li>`);
      } else if (olMatch) {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (!inOl) { out.push('<ol>'); inOl = true; }
        out.push(`<li>${olMatch[1]}</li>`);
      } else {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (line.trim() === '') {
          out.push('<div class="rb-spacer"></div>');
        } else {
          out.push(`<p>${line}</p>`);
        }
      }
    });

    if (inUl) out.push('</ul>');
    if (inOl) out.push('</ol>');

    let html = out.join('');
    // Bold + Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic (only when surrounded by non-list asterisks)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    return html;
  }

  // ─── CSS ─────────────────────────────────────────────────────────────────
  const darkenColor = (hex, amt) => {
    let c = hex.replace('#','');
    if (c.length === 3) c = c.split('').map(x=>x+x).join('');
    const num = parseInt(c, 16);
    const r = Math.max(0, (num>>16)-amt);
    const g = Math.max(0, ((num>>8)&0xff)-amt);
    const b = Math.max(0, (num&0xff)-amt);
    return `#${((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}`;
  };
  const colorDark = darkenColor(BOT_COLOR, 30);

  const CSS = `
    #rb-widget *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0}
    #rb-widget{position:fixed;${POSITION}:24px;bottom:24px;z-index:2147483647}

    /* ── Toggle button ── */
    #rb-btn{width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,${BOT_COLOR},${colorDark});
      border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 24px ${BOT_COLOR}55;transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;outline:none}
    #rb-btn:hover{transform:scale(1.1);box-shadow:0 6px 32px ${BOT_COLOR}77}
    #rb-btn svg{position:absolute;width:26px;height:26px;fill:#fff;transition:opacity .2s,transform .2s}
    #rb-btn .ic-chat{opacity:1;transform:scale(1)}
    #rb-btn .ic-close{opacity:0;transform:scale(.5)}
    #rb-widget.open #rb-btn .ic-chat{opacity:0;transform:scale(.5)}
    #rb-widget.open #rb-btn .ic-close{opacity:1;transform:scale(1)}

    /* unread badge */
    #rb-badge{position:absolute;top:-3px;${POSITION}:-3px;min-width:20px;height:20px;padding:0 5px;
      background:#ef4444;border-radius:10px;border:2px solid #fff;display:none;
      align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff}
    #rb-badge.show{display:flex}

    /* ── Panel ── */
    #rb-panel{position:absolute;${POSITION}:0;bottom:70px;width:370px;max-height:580px;
      background:#fff;border-radius:20px;display:flex;flex-direction:column;overflow:hidden;
      box-shadow:0 12px 48px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.08);
      transform:translateY(20px) scale(.95);opacity:0;pointer-events:none;
      transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .25s ease}
    #rb-widget.open #rb-panel{transform:translateY(0) scale(1);opacity:1;pointer-events:all}

    /* ── Header ── */
    #rb-header{background:linear-gradient(135deg,${BOT_COLOR},${colorDark});
      padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;
      position:relative;overflow:hidden}
    #rb-header::before{content:'';position:absolute;top:-30px;${POSITION}:-30px;width:120px;height:120px;
      background:rgba(255,255,255,.08);border-radius:50%}
    #rb-avatar{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.2);
      border:2px solid rgba(255,255,255,.3);display:flex;align-items:center;
      justify-content:center;flex-shrink:0;overflow:hidden;z-index:1}
    #rb-avatar img{width:100%;height:100%;object-fit:cover}
    #rb-avatar svg{width:22px;height:22px;fill:#fff}
    #rb-hinfo{flex:1;min-width:0;z-index:1}
    #rb-hname{color:#fff;font-weight:700;font-size:15px}
    #rb-hstatus{color:rgba(255,255,255,.85);font-size:11.5px;display:flex;align-items:center;gap:5px;margin-top:2px}
    #rb-hstatus-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;
      box-shadow:0 0 0 2px rgba(74,222,128,.3);flex-shrink:0}
    #rb-close{background:rgba(255,255,255,.15);border:none;cursor:pointer;color:#fff;
      width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;
      transition:background .15s;z-index:1;flex-shrink:0}
    #rb-close:hover{background:rgba(255,255,255,.25)}
    #rb-close svg{width:16px;height:16px;stroke:#fff;fill:none}

    /* ── Messages ── */
    #rb-msgs{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:14px;
      scroll-behavior:smooth;min-height:0}
    #rb-msgs::-webkit-scrollbar{width:4px}
    #rb-msgs::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:2px}

    /* ── Message rows ── */
    .rb-row{display:flex;align-items:flex-end;gap:8px;animation:rb-in .22s ease both}
    @keyframes rb-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .rb-row.user{flex-direction:row-reverse}
    .rb-row-inner{display:flex;flex-direction:column;max-width:82%}
    .rb-row.user .rb-row-inner{align-items:flex-end}

    /* ── Bubbles ── */
    .rb-bubble{padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.6;
      word-wrap:break-word;position:relative}
    .rb-row.bot .rb-bubble{background:#f3f4f6;color:#111827;border-bottom-left-radius:4px}
    .rb-row.user .rb-bubble{background:linear-gradient(135deg,${BOT_COLOR},${colorDark});
      color:#fff;border-bottom-right-radius:4px}

    /* Markdown styles inside bubble */
    .rb-bubble p{margin:0 0 6px 0}
    .rb-bubble p:last-child{margin-bottom:0}
    .rb-bubble ul,.rb-bubble ol{padding-left:18px;margin:6px 0}
    .rb-bubble li{margin-bottom:3px}
    .rb-bubble strong{font-weight:700}
    .rb-bubble em{font-style:italic}
    .rb-bubble code{background:rgba(0,0,0,.08);border-radius:4px;padding:1px 5px;
      font-family:'SF Mono',Monaco,monospace;font-size:12px}
    .rb-row.user .rb-bubble code{background:rgba(255,255,255,.2)}
    .rb-bubble .rb-spacer{height:4px}

    /* timestamp */
    .rb-time{font-size:10px;color:#9ca3af;margin-top:4px;padding:0 2px}
    .rb-row.user .rb-time{text-align:right}

    /* avatar */
    .rb-msg-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,${BOT_COLOR},${colorDark});
      flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;
      border:2px solid rgba(255,255,255,.8);box-shadow:0 2px 8px ${BOT_COLOR}44}
    .rb-msg-av img{width:100%;height:100%;object-fit:cover}
    .rb-msg-av svg{width:16px;height:16px;fill:#fff}
    .rb-row.user .rb-msg-av{display:none}

    /* ── Typing indicator ── */
    .rb-typing-wrap{display:flex;align-items:flex-end;gap:8px}
    .rb-typing{display:flex;align-items:center;gap:5px;padding:12px 16px;
      background:#f3f4f6;border-radius:18px;border-bottom-left-radius:4px;width:fit-content}
    .rb-typing span{width:7px;height:7px;background:#9ca3af;border-radius:50%;
      animation:rb-bounce .9s infinite ease-in-out;display:inline-block}
    .rb-typing span:nth-child(2){animation-delay:.18s}
    .rb-typing span:nth-child(3){animation-delay:.36s}
    @keyframes rb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-7px)}}

    /* cursor blink during typewriter */
    .rb-cursor::after{content:'▍';animation:rb-blink .7s infinite;font-size:12px;
      margin-left:1px;color:${BOT_COLOR}}
    @keyframes rb-blink{0%,100%{opacity:1}50%{opacity:0}}

    /* ── Input area ── */
    #rb-input-area{padding:12px 14px;border-top:1px solid #f3f4f6;
      display:flex;gap:8px;align-items:flex-end;flex-shrink:0;background:#fff}
    #rb-input{flex:1;border:1.5px solid #e5e7eb;border-radius:14px;padding:10px 14px;
      font-size:14px;resize:none;max-height:120px;min-height:44px;outline:none;
      line-height:1.5;transition:border-color .15s,box-shadow .15s;color:#111827;background:#fafafa}
    #rb-input:focus{border-color:${BOT_COLOR};box-shadow:0 0 0 3px ${BOT_COLOR}18;background:#fff}
    #rb-input::placeholder{color:#b0b8c8}
    #rb-send{width:42px;height:42px;border-radius:12px;
      background:linear-gradient(135deg,${BOT_COLOR},${colorDark});
      border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
      flex-shrink:0;transition:transform .15s,opacity .15s,box-shadow .15s;outline:none;
      box-shadow:0 2px 10px ${BOT_COLOR}44}
    #rb-send:hover:not(:disabled){transform:scale(1.07);box-shadow:0 4px 16px ${BOT_COLOR}66}
    #rb-send:disabled{opacity:.35;cursor:not-allowed;transform:none;box-shadow:none}
    #rb-send svg{width:18px;height:18px;fill:#fff}

    /* ── Footer ── */
    #rb-footer{text-align:center;padding:7px;font-size:10px;color:#c8d0da;
      background:#fafafa;border-top:1px solid #f3f4f6}

    /* ── Responsive ── */
    @media(max-width:420px){
      #rb-panel{width:calc(100vw - 20px);${POSITION}:-2px;bottom:70px;border-radius:16px}
    }
  `;

  // ─── Icons ───────────────────────────────────────────────────────────────
  const IC_CHAT  = `<svg class="ic-chat" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  const IC_CLOSE = `<svg class="ic-close" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  const IC_SEND  = `<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`;
  const IC_BOT   = `<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V7h3a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h3V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zm-4 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4 5c-1.5 0-2.5-.5-3-1h6c-.5.5-1.5 1-3 1z"/></svg>`;
  const IC_X     = `<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke-width="2.5" stroke-linecap="round"/></svg>`;

  const avatarHTML = BOT_LOGO ? `<img src="${BOT_LOGO}" alt="">` : IC_BOT;

  // ─── Inject styles ───────────────────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  // ─── Build DOM ───────────────────────────────────────────────────────────
  const widget = document.createElement('div');
  widget.id = 'rb-widget';
  widget.innerHTML = `
    <div id="rb-panel" role="dialog" aria-label="${BOT_NAME} Chat">
      <div id="rb-header">
        <div id="rb-avatar">${avatarHTML}</div>
        <div id="rb-hinfo">
          <div id="rb-hname">${BOT_NAME}</div>
          <div id="rb-hstatus"><span id="rb-hstatus-dot"></span>Online</div>
        </div>
        <button id="rb-close" aria-label="Close">${IC_X}</button>
      </div>
      <div id="rb-msgs" role="log" aria-live="polite"></div>
      <div id="rb-input-area">
        <textarea id="rb-input" placeholder="Type your message..." rows="1" aria-label="Message"></textarea>
        <button id="rb-send" disabled aria-label="Send">${IC_SEND}</button>
      </div>
      <div id="rb-footer">Powered by RAG Bot</div>
    </div>
    <div id="rb-badge" aria-hidden="true">1</div>
    <button id="rb-btn" aria-label="Open chat">${IC_CHAT}${IC_CLOSE}</button>
  `;
  document.body.appendChild(widget);

  // ─── Refs ────────────────────────────────────────────────────────────────
  const btn    = document.getElementById('rb-btn');
  const panel  = document.getElementById('rb-panel');
  const msgs   = document.getElementById('rb-msgs');
  const input  = document.getElementById('rb-input');
  const sendBtn= document.getElementById('rb-send');
  const badge  = document.getElementById('rb-badge');
  const closeBtn = document.getElementById('rb-close');

  let isOpen = false, isBusy = false;

  // ─── Open / Close ────────────────────────────────────────────────────────
  function open() {
    isOpen = true;
    widget.classList.add('open');
    badge.classList.remove('show');
    setTimeout(() => input.focus(), 300);
  }
  function close() {
    isOpen = false;
    widget.classList.remove('open');
  }
  btn.addEventListener('click', () => isOpen ? close() : open());
  closeBtn.addEventListener('click', close);

  // ─── Scroll helpers ──────────────────────────────────────────────────────
  let userScrolled = false;

  msgs.addEventListener('scroll', () => {
    const atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 60;
    userScrolled = !atBottom;
  });

  function scrollToMsg(el) {
    // Scroll so the target element is at the TOP of the visible msgs area
    msgs.scrollTop = el.offsetTop - msgs.offsetTop - 8;
    userScrolled = false;
  }

  function scrollBottomIfNeeded() {
    if (!userScrolled) msgs.scrollTop = msgs.scrollHeight;
  }

  // ─── Timestamp ───────────────────────────────────────────────────────────
  function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ─── Append message ──────────────────────────────────────────────────────
  function appendMsg(role, html, isHtml = false) {
    const row = document.createElement('div');
    row.className = `rb-row ${role}`;

    const av = document.createElement('div');
    av.className = 'rb-msg-av';
    av.innerHTML = BOT_LOGO ? `<img src="${BOT_LOGO}" alt="">` : IC_BOT;

    const inner = document.createElement('div');
    inner.className = 'rb-row-inner';

    const bubble = document.createElement('div');
    bubble.className = 'rb-bubble';
    if (isHtml) bubble.innerHTML = html;
    else bubble.textContent = html;

    const time = document.createElement('div');
    time.className = 'rb-time';
    time.textContent = now();

    inner.appendChild(bubble);
    inner.appendChild(time);

    if (role === 'bot') row.appendChild(av);
    row.appendChild(inner);
    msgs.appendChild(row);

    if (!isOpen && role === 'bot') badge.classList.add('show');

    return { row, bubble };
  }

  // ─── Typing indicator ────────────────────────────────────────────────────
  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'rb-typing-wrap';
    wrap.id = 'rb-typing';

    const av = document.createElement('div');
    av.className = 'rb-msg-av';
    av.innerHTML = BOT_LOGO ? `<img src="${BOT_LOGO}" alt="">` : IC_BOT;

    const dots = document.createElement('div');
    dots.className = 'rb-typing';
    dots.innerHTML = '<span></span><span></span><span></span>';

    wrap.appendChild(av);
    wrap.appendChild(dots);
    msgs.appendChild(wrap);
    scrollBottomIfNeeded();
    return wrap;
  }

  function hideTyping(el) { if (el) el.remove(); }

  // ─── Typewriter effect ───────────────────────────────────────────────────
  // Reveals text word-by-word, re-renders markdown each step
  // userMsgEl is the user's message row — we scroll to it when bot starts
  function typewrite(bubble, fullText, userMsgEl, onDone) {
    const words = fullText.split(' ');
    let revealed = '';
    let i = 0;
    bubble.classList.add('rb-cursor');

    // Scroll to user's message so they see from where bot is replying
    scrollToMsg(userMsgEl);

    const SPEED = 28; // ms per word — adjust for faster/slower

    function step() {
      if (i >= words.length) {
        bubble.classList.remove('rb-cursor');
        bubble.innerHTML = parseMarkdown(fullText);
        if (onDone) onDone();
        return;
      }
      revealed += (i === 0 ? '' : ' ') + words[i];
      bubble.innerHTML = parseMarkdown(revealed);
      i++;
      scrollBottomIfNeeded();
      setTimeout(step, SPEED);
    }
    step();
  }

  // ─── Send message ────────────────────────────────────────────────────────
  async function send() {
    const text = input.value.trim();
    if (!text || isBusy) return;

    isBusy = true;
    input.value = '';
    input.style.height = 'auto';
    updateSend();

    // Append user message and note its position
    const { row: userRow } = appendMsg('user', text);
    scrollBottomIfNeeded();

    // Show typing dots
    const typingEl = showTyping();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionId) headers['X-Session-Id'] = sessionId;

      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      hideTyping(typingEl);

      if (!res.ok) {
        appendMsg('bot', data.error || 'Something went wrong. Please try again.', false);
        scrollBottomIfNeeded();
        isBusy = false;
        updateSend();
        return;
      }

      if (data.sessionId) {
        sessionId = data.sessionId;
        sessionStorage.setItem('_ragbot_sid', sessionId);
      }

      // Create empty bot bubble then typewrite into it
      const { bubble } = appendMsg('bot', '', true);
      typewrite(bubble, data.answer, userRow, () => {
        isBusy = false;
        updateSend();
      });

    } catch {
      hideTyping(typingEl);
      appendMsg('bot', 'Network error. Please check your connection.', false);
      scrollBottomIfNeeded();
      isBusy = false;
      updateSend();
    }
  }

  // ─── Input events ────────────────────────────────────────────────────────
  function updateSend() {
    sendBtn.disabled = input.value.trim().length === 0 || isBusy;
  }

  input.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    updateSend();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) send();
    }
  });

  sendBtn.addEventListener('click', send);

  // ─── Welcome message ─────────────────────────────────────────────────────
  setTimeout(() => {
    const { bubble } = appendMsg('bot', '', true);
    typewrite(bubble, WELCOME, msgs.firstChild || msgs, null);
  }, 500);

})();
