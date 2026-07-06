(function () {
  'use strict';

  const state = {
    conversations: [],
    currentConvId: null,
    messages: [],
    models: [],
    selectedModel: '',
    temperature: 0.7,
    isStreaming: false,
    abortController: null,
    isDark: true,
    sidebarOpen: window.innerWidth > 768,
    lastUserMessage: '',
    streamAborted: false,
  };

  const $ = (s) => document.querySelector(s);
  const el = {};

  function cacheEls() {
    el.sidebar          = $('#sidebar');
    el.sidebarToggle    = $('#sidebarToggle');
    el.conversationList = $('#conversationList');
    el.newChatBtn       = $('#newChatBtn');
    el.modelSelect      = $('#modelSelect');
    el.modelName        = $('#currentModelName');
    el.modelStatus      = $('#modelStatus');
    el.chatMessages     = $('#chatMessages');
    el.welcomeScreen    = $('#welcomeScreen');
    el.messageInput     = $('#messageInput');
    el.sendBtn          = $('#sendBtn');
    el.stopBtn          = $('#stopBtn');
    el.themeToggle      = $('#themeToggle');
    el.modelCards       = $('#modelCards');
    el.chatContainer    = $('#chatContainer');
    el.tempSlider       = $('#tempSlider');
    el.tempValue        = $('#tempValue');
  }

  /* ============================================================
     API
     ============================================================ */
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const e = await res.json(); msg = e.detail || msg; } catch (_) {}
      throw new Error(msg);
    }
    return res;
  }

  /* ============================================================
     MODELS
     ============================================================ */
  async function loadModels() {
    try {
      const res = await api('/api/models');
      const data = await res.json();
      state.models = data.models || [];
    } catch (e) {
      state.models = [];
    }
    renderModelSelect();
    renderModelCards();
    if (state.models.length) {
      if (!state.selectedModel || !state.models.some(m => m.name === state.selectedModel)) {
        state.selectedModel = state.models[0].name;
      }
      el.modelSelect.value = state.selectedModel;
      updateModelName();
      enableInput(true);
    }
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    const gb = bytes / 1e9;
    if (gb >= 1) return gb.toFixed(1) + ' GB';
    return (bytes / 1e6).toFixed(0) + ' MB';
  }

  function displayName(name) {
    return name
      .replace(/:latest$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function modelIcon(name) {
    if (/qwen/i.test(name)) return '\uD83D\uDD0D';
    if (/llama/i.test(name)) return '\uD83E\uDD16';
    if (/mistral/i.test(name)) return '\uD83C\uDF1F';
    return '\u2728';
  }

  function renderModelSelect() {
    el.modelSelect.innerHTML = '<option value="">\u2014 Select \u2014</option>';
    state.models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = displayName(m.name) + ' (' + formatSize(m.size) + ')';
      el.modelSelect.appendChild(opt);
    });
    el.modelSelect.value = state.selectedModel;
  }

  function renderModelCards() {
    el.modelCards.innerHTML = '';
    state.models.slice(0, 6).forEach((m) => {
      const card = document.createElement('div');
      card.className = 'model-card';
      card.innerHTML =
        '<div class="model-card-icon">' + modelIcon(m.name) + '</div>' +
        '<div class="model-card-name">' + displayName(m.name) + '</div>' +
        '<div class="model-card-size">' + formatSize(m.size) + '</div>';
      card.addEventListener('click', () => selectModel(m.name));
      el.modelCards.appendChild(card);
    });
  }

  function selectModel(name) {
    state.selectedModel = name;
    el.modelSelect.value = name;
    updateModelName();
    startNewChat();
  }

  function updateModelName() {
    el.modelName.textContent = state.selectedModel ? displayName(state.selectedModel) : 'Select a model';
  }

  /* ============================================================
     CONVERSATIONS
     ============================================================ */
  async function loadConversations() {
    try {
      const res = await api('/api/conversations');
      const data = await res.json();
      state.conversations = data.conversations || [];
    } catch (e) {
      state.conversations = [];
    }
    renderConversations();
  }

  function renderConversations() {
    el.conversationList.innerHTML = '';
    if (!state.conversations.length) {
      el.conversationList.innerHTML =
        '<div style="padding:14px;font-size:13px;color:var(--text-muted);text-align:center;">No conversations yet</div>';
      return;
    }
    state.conversations.forEach((c) => {
      const div = document.createElement('div');
      div.className = 'conv-item' + (c.id === state.currentConvId ? ' active' : '');
      div.textContent = c.title || 'New Chat';
      const del = document.createElement('button');
      del.className = 'conv-delete';
      del.textContent = '\u00D7';
      del.title = 'Delete';
      del.addEventListener('click', (e) => { e.stopPropagation(); deleteConversation(c.id); });
      div.appendChild(del);
      div.addEventListener('click', () => switchConversation(c.id));
      el.conversationList.appendChild(div);
    });
  }

  async function startNewChat() {
    if (!state.selectedModel) {
      toast('Please select a model first');
      return;
    }
    try {
      const res = await api('/api/conversations', { method: 'POST' });
      const data = await res.json();
      state.currentConvId = data.id;
      state.messages = [];
      state.lastUserMessage = '';
      showChatView(false);
      await loadConversations();
      enableInput(true);
      el.messageInput.focus();
    } catch (e) {
      toast('Failed to create conversation');
    }
  }

  async function switchConversation(id) {
    if (state.isStreaming) stopGeneration();
    state.currentConvId = id;
    try {
      const res = await api('/api/conversations/' + encodeURIComponent(id));
      const data = await res.json();
      state.messages = data.messages || [];
      renderConversations();
      if (state.messages.length) {
        renderMessages();
        showChatView(true);
      } else {
        showChatView(false);
        enableInput(true);
      }
      scrollToBottom();
    } catch (e) {
      toast('Failed to load conversation');
    }
  }

  async function deleteConversation(id) {
    try {
      await api('/api/conversations/' + encodeURIComponent(id), { method: 'DELETE' });
      if (state.currentConvId === id) {
        state.currentConvId = null;
        state.messages = [];
        state.lastUserMessage = '';
        showChatView(false);
        enableInput(false);
      }
      await loadConversations();
    } catch (e) {
      toast('Failed to delete conversation');
    }
  }

  function showChatView(hasMessages) {
    el.welcomeScreen.style.display = hasMessages ? 'none' : 'flex';
    el.chatMessages.style.display = hasMessages ? 'flex' : 'none';
  }

  /* ============================================================
     MESSAGE RENDERING
     ============================================================ */
  function renderMessages() {
    el.chatMessages.innerHTML = '';
    state.messages.forEach((msg, i) => appendMessageDOM(msg, i === state.messages.length - 1, false));
  }

  function appendMessageDOM(msg, isLast, scroll = true) {
    const div = document.createElement('div');
    div.className = 'message' + (msg.role === 'user' ? ' user-message' : '');
    div.id = 'msg-' + (msg.id || Date.now() + '-' + Math.random().toString(36).slice(2, 6));

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar ' + msg.role;
    avatar.textContent = msg.role === 'user' ? 'U' : 'AI';

    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = formatContent(msg.content || '');

    if (msg.timestamp) {
      const time = document.createElement('div');
      time.className = 'message-time';
      time.textContent = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      content.appendChild(time);
    }

    if (msg.role !== 'user') div.appendChild(avatar);
    div.appendChild(content);
    if (msg.role === 'user') div.appendChild(avatar);

    if (msg.role === 'assistant' && msg.content) {
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      actions.appendChild(createActionBtn('copy', 'Copy', () => copyText(msg.content)));
      if (isLast) {
        actions.appendChild(createActionBtn('refresh', 'Regenerate', () => regenerate()));
      }
      content.appendChild(actions);
    }

    el.chatMessages.appendChild(div);
    if (scroll) scrollToBottom();
    return div;
  }

  function createActionBtn(icon, title, handler) {
    const btn = document.createElement('button');
    btn.className = 'msg-action-btn';
    btn.title = title;
    btn.addEventListener('click', handler);
    if (icon === 'copy') {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
    } else if (icon === 'refresh') {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>';
    }
    return btn;
  }

  function formatContent(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const e = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return '<pre><code' + (lang ? ' class="lang-' + lang + '"' : '') + '>' + e + '</code></pre>';
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      el.chatContainer.scrollTop = el.chatContainer.scrollHeight;
    });
  }

  /* ============================================================
     MESSAGE ACTIONS
     ============================================================ */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard', 'success');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Copied to clipboard', 'success');
    }
  }

  async function regenerate() {
    if (!state.lastUserMessage || state.isStreaming || !state.currentConvId) return;
    const msg = state.lastUserMessage;
    state.lastUserMessage = '';

    while (state.messages.length > 0 && state.messages[state.messages.length - 1].role === 'assistant') {
      state.messages.pop();
    }

    if (state.messages.length > 0 && state.messages[state.messages.length - 1].role === 'user') {
      state.messages.pop();
    }

    renderMessages();
    showChatView(state.messages.length > 0);
    el.messageInput.value = msg;
    el.sendBtn.disabled = false;
    sendMessage();
  }

  /* ============================================================
     CHAT (STREAMING) WITH STOP SUPPORT
     ============================================================ */
  function stopGeneration() {
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
    state.streamAborted = true;
    state.isStreaming = false;
    el.stopBtn.style.display = 'none';
    el.sendBtn.style.display = 'flex';
    el.modelStatus.className = 'model-status idle';
    el.modelStatus.textContent = 'Idle';
    enableInput(true);
  }

  async function sendMessage() {
    const text = el.messageInput.value.trim();
    if (!text || state.isStreaming || !state.selectedModel || !state.currentConvId) return;

    state.lastUserMessage = text;
    el.messageInput.value = '';
    el.sendBtn.style.display = 'none';
    el.stopBtn.style.display = 'flex';
    state.isStreaming = true;
    state.streamAborted = false;
    state.abortController = new AbortController();

    el.modelStatus.className = 'model-status thinking';
    el.modelStatus.textContent = 'Thinking\u2026';

    const userMsg = {
      id: 'um-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    state.messages.push(userMsg);
    showChatView(true);
    appendMessageDOM(userMsg);
    saveMessages([userMsg]);

    const typingId = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = typingId;
    typingDiv.innerHTML =
      '<div class="message-avatar assistant">AI</div>' +
      '<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
    el.chatMessages.appendChild(typingDiv);
    scrollToBottom();

    const messagesForAPI = state.messages.map((m) => ({ role: m.role, content: m.content }));
    const options = { temperature: state.temperature };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: state.selectedModel,
          messages: messagesForAPI,
          options: options,
          stream: true,
        }),
        signal: state.abortController.signal,
      });

      if (!res.ok) {
        let errMsg = 'HTTP ' + res.status;
        try { const e = await res.json(); errMsg = e.detail || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }

      const typingEl = document.getElementById(typingId);
      if (typingEl) typingEl.remove();

      const assistMsg = {
        id: 'am-' + Date.now(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };
      state.messages.push(assistMsg);

      const msgDiv = document.createElement('div');
      msgDiv.className = 'message';
      msgDiv.id = 'msg-' + assistMsg.id;

      const avatar = document.createElement('div');
      avatar.className = 'message-avatar assistant';
      avatar.textContent = 'AI';

      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.id = 'stream-' + assistMsg.id;

      msgDiv.appendChild(avatar);
      msgDiv.appendChild(contentDiv);
      el.chatMessages.appendChild(msgDiv);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.error) {
              contentDiv.innerHTML = '<p style="color:var(--danger)">Error: ' + escHtml(data.error) + '</p>';
              assistMsg.content += '\n[Error: ' + data.error + ']';
              streamDone = true;
              break;
            }
            if (data.done) {
              streamDone = true;
              break;
            }
            if (data.content) {
              assistMsg.content += data.content;
              contentDiv.innerHTML = formatContent(assistMsg.content);
              scrollToBottom();
            }
          } catch (_) {}
        }
      }

      contentDiv.innerHTML = formatContent(assistMsg.content);

      const time = document.createElement('div');
      time.className = 'message-time';
      time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      contentDiv.appendChild(time);

      // Add action buttons
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      actions.appendChild(createActionBtn('copy', 'Copy', () => copyText(assistMsg.content)));
      actions.appendChild(createActionBtn('refresh', 'Regenerate', () => regenerate()));
      contentDiv.appendChild(actions);

      scrollToBottom();
      saveMessages([assistMsg]);
      loadConversations();
    } catch (e) {
      if (e.name === 'AbortError') return;

      const typingEl = document.getElementById(typingId);
      if (typingEl) typingEl.remove();

      const lastMsg = el.chatMessages.querySelector('.message:last-child');
      if (lastMsg && lastMsg.id && lastMsg.id.startsWith('msg-am-')) {
        lastMsg.querySelector('.message-content').innerHTML =
          '<p style="color:var(--danger)">Connection error</p>';
      } else {
        const errDiv = document.createElement('div');
        errDiv.className = 'message';
        errDiv.innerHTML =
          '<div class="message-avatar assistant">AI</div>' +
          '<div class="message-content">' +
            '<p style="color:var(--danger)">Connection error &mdash; make sure the server is running.<br>' +
            '<span style="font-size:13px;opacity:0.7">' + escHtml(e.message) + '</span></p>' +
          '</div>';
        el.chatMessages.appendChild(errDiv);
      }
      scrollToBottom();
    } finally {
      if (!state.streamAborted) {
        state.isStreaming = false;
        el.stopBtn.style.display = 'none';
        el.sendBtn.style.display = 'flex';
        el.modelStatus.className = 'model-status idle';
        el.modelStatus.textContent = 'Idle';
        enableInput(true);
      }
    }
  }

  function escHtml(t) {
    if (!t) return '';
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ============================================================
     PERSISTENCE
     ============================================================ */
  async function saveMessages(msgs) {
    if (!state.currentConvId) return;
    try {
      await fetch('/api/conversations/' + state.currentConvId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      });
    } catch (_) {}
  }

  /* ============================================================
     INPUT
     ============================================================ */
  function enableInput(enabled) {
    el.messageInput.disabled = !enabled;
    el.sendBtn.disabled = !enabled || !el.messageInput.value.trim();
    if (enabled) el.messageInput.focus();
  }

  function autoResize() {
    el.messageInput.style.height = 'auto';
    el.messageInput.style.height = Math.min(el.messageInput.scrollHeight, 160) + 'px';
  }

  /* ============================================================
     THEME
     ============================================================ */
  function toggleTheme() {
    state.isDark = !state.isDark;
    document.documentElement.className = state.isDark ? 'dark' : 'light';
    el.themeToggle.textContent = state.isDark ? '\u263E' : '\u2600';
    localStorage.setItem('zg-theme', state.isDark ? 'dark' : 'light');
  }

  function loadTheme() {
    const saved = localStorage.getItem('zg-theme');
    if (saved === 'light') {
      state.isDark = false;
      document.documentElement.className = 'light';
      el.themeToggle.textContent = '\u2600';
    } else {
      state.isDark = true;
      document.documentElement.className = 'dark';
      el.themeToggle.textContent = '\u263E';
    }
  }

  /* ============================================================
     TEMPERATURE
     ============================================================ */
  function setupTemperature() {
    el.tempSlider.addEventListener('input', () => {
      state.temperature = parseFloat(el.tempSlider.value);
      el.tempValue.textContent = state.temperature.toFixed(2);
    });
  }

  /* ============================================================
     TOAST
     ============================================================ */
  function toast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast';
    if (type === 'success') t.style.background = 'rgba(34, 197, 94, 0.85)';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300);
    }, 2000);
  }

  /* ============================================================
     EVENTS
     ============================================================ */
  function setup() {
    cacheEls();
    loadTheme();
    setupTemperature();

    el.newChatBtn.addEventListener('click', startNewChat);

    el.sidebarToggle.addEventListener('click', () => {
      state.sidebarOpen = !state.sidebarOpen;
      el.sidebar.classList.toggle('open', state.sidebarOpen);
    });

    el.modelSelect.addEventListener('change', () => {
      state.selectedModel = el.modelSelect.value;
      updateModelName();
    });

    el.sendBtn.addEventListener('click', sendMessage);
    el.stopBtn.addEventListener('click', stopGeneration);

    el.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    el.messageInput.addEventListener('input', () => {
      autoResize();
      el.sendBtn.disabled = !el.messageInput.value.trim() || state.isStreaming || !state.currentConvId || !state.selectedModel;
    });

    el.themeToggle.addEventListener('click', toggleTheme);

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && state.sidebarOpen) {
        const t = e.target;
        if (!el.sidebar.contains(t) && t !== el.sidebarToggle && !el.sidebarToggle.contains(t)) {
          state.sidebarOpen = false;
          el.sidebar.classList.remove('open');
        }
      }
    });

    window.addEventListener('resize', () => {
      state.sidebarOpen = window.innerWidth > 768;
      if (window.innerWidth > 768) el.sidebar.classList.remove('open');
    });
  }

  /* ============================================================
     INIT
     ============================================================ */
  async function init() {
    setup();
    await loadModels();
    await loadConversations();
    if (state.selectedModel) {
      await startNewChat();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
