(function () {
  'use strict';

  // ─── Config from script tag data attributes ──────────────────────────────
  const script = document.currentScript || (function () {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const API_URL   = (script.getAttribute('data-api-url') || '').replace(/\/$/, '');
  const BOT_NAME  = script.getAttribute('data-bot-name') || 'Assistant';
  const BOT_COLOR = script.getAttribute('data-primary-color') || '#6366f1';
  const BOT_LOGO  = script.getAttribute('data-logo-url') || '';
  const WELCOME   = script.getAttribute('data-welcome-message') || `Hi! I'm ${BOT_NAME}. How can I help you today?`;
  const POSITION  = script.getAttribute('data-position') || 'right'; // 'right' | 'left'

  if (!API_URL) {
    console.error('[ChatBot Widget] data-api-url is required');
    return;
  }

  // ─── Prevent double init ─────────────────────────────────────────────────
  if (window.__ragBotWidgetLoaded) return;
  window.__ragBotWidgetLoaded = true;

  // ─── Session ID (persisted per browser) ─────────────────────────────────
  let sessionId = sessionStorage.getItem('_ragbot_session') || null;

  // ─── CSS ─────────────────────────────────────────────────────────────────
  const CSS = `
    #ragbot-widget *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    #ragbot-widget{position:fixed;${POSITION}:20px;bottom:20px;z-index:999999}

    /* Toggle Button */
    #ragbot-toggle{width:56px;height:56px;border-radius:50%;background:${BOT_COLOR};border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.25);
      transition:transform .2s,box-shadow .2s;outline:none}
    #ragbot-toggle:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(0,0,0,0.3)}
    #ragbot-toggle svg{width:26px;height:26px;fill:#fff;transition:opacity .2s}
    #ragbot-toggle .icon-close{display:none}
    #ragbot-widget.open #ragbot-toggle .icon-chat{display:none}
    #ragbot-widget.open #ragbot-toggle .icon-close{display:block}
    #ragbot-badge{position:absolute;top:-2px;${POSITION}:-2px;width:18px;height:18px;background:#ef4444;
      border-radius:50%;border:2px solid #fff;display:none;align-items:center;justify-content:center;
      font-size:10px;font-weight:700;color:#fff}
    #ragbot-badge.show{display:flex}

    /* Panel */
    #ragbot-panel{position:absolute;${POSITION}:0;bottom:68px;width:360px;height:520px;background:#fff;
      border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.18);display:flex;flex-direction:column;
      overflow:hidden;transform-origin:bottom ${POSITION};transform:scale(0.8);opacity:0;
      pointer-events:none;transition:transform .25s cubic-bezier(.34,1.56,.64,1),opacity .2s}
    #ragbot-widget.open #ragbot-panel{transform:scale(1);opacity:1;pointer-events:all}

    /* Header */
    #ragbot-header{background:${BOT_COLOR};padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}
    #ragbot-avatar{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.25);
      display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
    #ragbot-avatar img{width:100%;height:100%;object-fit:cover}
    #ragbot-avatar svg{width:20px;height:20px;fill:#fff}
    #ragbot-header-info{flex:1;min-width:0}
    #ragbot-header-name{color:#fff;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #ragbot-status{color:rgba(255,255,255,.8);font-size:11px;display:flex;align-items:center;gap:4px}
    #ragbot-status-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;flex-shrink:0}
    #ragbot-close-btn{background:none;border:none;cursor:pointer;color:#fff;opacity:.8;
      padding:4px;border-radius:6px;line-height:1;font-size:18px;transition:opacity .15s}
    #ragbot-close-btn:hover{opacity:1}

    /* Messages */
    #ragbot-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}
    #ragbot-messages::-webkit-scrollbar{width:4px}
    #ragbot-messages::-webkit-scrollbar-track{background:transparent}
    #ragbot-messages::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:2px}

    .ragbot-msg{display:flex;align-items:flex-end;gap:8px;animation:ragbot-fadein .2s ease}
    @keyframes ragbot-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    .ragbot-msg.user{flex-direction:row-reverse}

    .ragbot-bubble{max-width:78%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;
      word-wrap:break-word;white-space:pre-wrap}
    .ragbot-msg.bot .ragbot-bubble{background:#f3f4f6;color:#111827;border-bottom-left-radius:4px}
    .ragbot-msg.user .ragbot-bubble{background:${BOT_COLOR};color:#fff;border-bottom-right-radius:4px}

    .ragbot-msg-avatar{width:28px;height:28px;border-radius:50%;background:${BOT_COLOR};flex-shrink:0;
      display:flex;align-items:center;justify-content:center;overflow:hidden}
    .ragbot-msg-avatar img{width:100%;height:100%;object-fit:cover}
    .ragbot-msg-avatar svg{width:16px;height:16px;fill:#fff}
    .ragbot-msg.user .ragbot-msg-avatar{display:none}

    .ragbot-time{font-size:10px;color:#9ca3af;margin-top:3px;text-align:right}
    .ragbot-msg.bot .ragbot-time{text-align:left}

    /* Typing indicator */
    .ragbot-typing{display:flex;align-items:center;gap:4px;padding:10px 14px;background:#f3f4f6;
      border-radius:18px;border-bottom-left-radius:4px;width:fit-content}
    .ragbot-typing span{width:7px;height:7px;background:#9ca3af;border-radius:50%;
      animation:ragbot-bounce .8s infinite;display:inline-block}
    .ragbot-typing span:nth-child(2){animation-delay:.15s}
    .ragbot-typing span:nth-child(3){animation-delay:.3s}
    @keyframes ragbot-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}

    /* Input */
    #ragbot-input-area{padding:12px 14px;border-top:1px solid #f0f0f0;display:flex;gap:8px;align-items:flex-end;flex-shrink:0}
    #ragbot-input{flex:1;border:1.5px solid #e5e7eb;border-radius:12px;padding:10px 14px;
      font-size:14px;resize:none;max-height:100px;min-height:42px;outline:none;line-height:1.4;
      transition:border-color .15s;color:#111827;background:#fff}
    #ragbot-input:focus{border-color:${BOT_COLOR}}
    #ragbot-input::placeholder{color:#9ca3af}
    #ragbot-send{width:40px;height:40px;border-radius:10px;background:${BOT_COLOR};border:none;
      cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;
      transition:opacity .15s,transform .1s;outline:none}
    #ragbot-send:hover:not(:disabled){opacity:.9;transform:scale(1.05)}
    #ragbot-send:disabled{opacity:.4;cursor:not-allowed;transform:none}
    #ragbot-send svg{width:18px;height:18px;fill:#fff}

    /* Powered by */
    #ragbot-footer{text-align:center;padding:6px;font-size:10px;color:#d1d5db;background:#fff}
    #ragbot-footer a{color:#d1d5db;text-decoration:none}

    /* Responsive */
    @media(max-width:420px){
      #ragbot-panel{width:calc(100vw - 24px);${POSITION}:0;bottom:68px}
    }
  `;

  // ─── SVGs ────────────────────────────────────────────────────────────────
  const CHAT_ICON = `<svg class="icon-chat" viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>`;
  const CLOSE_ICON = `<svg class="icon-close" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>`;
  const SEND_ICON = `<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>`;
  const BOT_ICON = `<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V7h3a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h3V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zm-4 9a1.5 1.5 0 0 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 0 0 0 3 1.5 1.5 0 0 0 0-3zm-4 5c-1.5 0-2.5-.5-3-1h6c-.5.5-1.5 1-3 1z"/></svg>`;

  const avatarHTML = BOT_LOGO
    ? `<img src="${BOT_LOGO}" alt="${BOT_NAME}">`
    : BOT_ICON;

  // ─── DOM Build ───────────────────────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  const widget = document.createElement('div');
  widget.id = 'ragbot-widget';
  widget.innerHTML = `
    <div id="ragbot-panel" role="dialog" aria-label="${BOT_NAME} chat">
      <div id="ragbot-header">
        <div id="ragbot-avatar">${avatarHTML}</div>
        <div id="ragbot-header-info">
          <div id="ragbot-header-name">${BOT_NAME}</div>
          <div id="ragbot-status"><span id="ragbot-status-dot"></span>Online</div>
        </div>
        <button id="ragbot-close-btn" aria-label="Close chat">✕</button>
      </div>
      <div id="ragbot-messages" role="log" aria-live="polite"></div>
      <div id="ragbot-input-area">
        <textarea id="ragbot-input" placeholder="Type your message..." rows="1" aria-label="Message input"></textarea>
        <button id="ragbot-send" aria-label="Send message" disabled>${SEND_ICON}</button>
      </div>
      <div id="ragbot-footer">Powered by RAG Bot</div>
    </div>
    <div id="ragbot-badge" aria-hidden="true">1</div>
    <button id="ragbot-toggle" aria-label="Toggle chat">
      ${CHAT_ICON}${CLOSE_ICON}
    </button>
  `;
  document.body.appendChild(widget);

  // ─── Element refs ────────────────────────────────────────────────────────
  const toggle    = document.getElementById('ragbot-toggle');
  const panel     = document.getElementById('ragbot-panel');
  const messages  = document.getElementById('ragbot-messages');
  const input     = document.getElementById('ragbot-input');
  const sendBtn   = document.getElementById('ragbot-send');
  const badge     = document.getElementById('ragbot-badge');
  const closeBtn  = document.getElementById('ragbot-close-btn');

  // ─── State ───────────────────────────────────────────────────────────────
  let isOpen = false;
  let isTyping = false;
  let hasUnread = false;

  // ─── Toggle ──────────────────────────────────────────────────────────────
  function openWidget() {
    isOpen = true;
    widget.classList.add('open');
    badge.classList.remove('show');
    hasUnread = false;
    input.focus();
    scrollToBottom();
  }

  function closeWidget() {
    isOpen = false;
    widget.classList.remove('open');
  }

  toggle.addEventListener('click', () => isOpen ? closeWidget() : openWidget());
  closeBtn.addEventListener('click', closeWidget);

  // ─── Message rendering ───────────────────────────────────────────────────
  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function appendMessage(role, text, time) {
    const msg = document.createElement('div');
    msg.className = `ragbot-msg ${role}`;

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ragbot-msg-avatar';
    avatarEl.innerHTML = BOT_LOGO ? `<img src="${BOT_LOGO}" alt="">` : BOT_ICON;

    const right = document.createElement('div');

    const bubble = document.createElement('div');
    bubble.className = 'ragbot-bubble';
    bubble.textContent = text;

    const timeEl = document.createElement('div');
    timeEl.className = 'ragbot-time';
    timeEl.textContent = formatTime(time || new Date());

    right.appendChild(bubble);
    right.appendChild(timeEl);

    if (role === 'bot') msg.appendChild(avatarEl);
    msg.appendChild(right);

    messages.appendChild(msg);
    scrollToBottom();

    if (!isOpen && role === 'bot') {
      hasUnread = true;
      badge.classList.add('show');
    }

    return bubble;
  }

  function appendTyping() {
    const msg = document.createElement('div');
    msg.className = 'ragbot-msg bot';
    msg.id = 'ragbot-typing-msg';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ragbot-msg-avatar';
    avatarEl.innerHTML = BOT_ICON;

    const typing = document.createElement('div');
    typing.className = 'ragbot-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';

    msg.appendChild(avatarEl);
    msg.appendChild(typing);
    messages.appendChild(msg);
    scrollToBottom();
  }

  function removeTyping() {
    const el = document.getElementById('ragbot-typing-msg');
    if (el) el.remove();
  }

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  // ─── Send message ────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isTyping) return;

    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    isTyping = true;

    appendMessage('user', text);
    appendTyping();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionId) headers['X-Session-Id'] = sessionId;

      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      removeTyping();

      if (!res.ok) {
        appendMessage('bot', data.error || 'Something went wrong. Please try again.');
        return;
      }

      // Persist session ID
      if (data.sessionId) {
        sessionId = data.sessionId;
        sessionStorage.setItem('_ragbot_session', sessionId);
      }

      appendMessage('bot', data.answer);
    } catch (err) {
      removeTyping();
      appendMessage('bot', 'Network error. Please check your connection and try again.');
    } finally {
      isTyping = false;
      sendBtn.disabled = input.value.trim().length === 0;
    }
  }

  // ─── Input handling ───────────────────────────────────────────────────────
  input.addEventListener('input', function () {
    // Auto-resize textarea
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    sendBtn.disabled = this.value.trim().length === 0 || isTyping;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  // ─── Welcome message ─────────────────────────────────────────────────────
  setTimeout(() => {
    appendMessage('bot', WELCOME);
  }, 400);

})();
