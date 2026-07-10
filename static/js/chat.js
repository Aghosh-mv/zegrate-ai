(function () {
  'use strict';

  const state = {
    conversations: [],
    currentConvId: null,
    messages: [],
    models: [],
    selectedModel: '',
    isStreaming: false,
    isDark: true,
    sidebarOpen: window.innerWidth > 768,
    todos: [],
    apps: [],
    editingAppId: null,
    recording: false,
    mediaRecorder: null,
    audioChunks: [],
    showThinking: localStorage.getItem('zg-thinking') === 'true',
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const el = {};

  function cacheEls() {
    el.sidebar            = $('#sidebar');
    el.sidebarToggle      = $('#sidebarToggle');
    el.conversationList   = $('#conversationList');
    el.newChatBtn         = $('#newChatBtn');
    el.modelSelect        = $('#modelSelect');
    el.modelName          = $('#currentModelName');
    el.modelStatus        = $('#modelStatus');
    el.chatMessages       = $('#chatMessages');
    el.welcomeScreen      = $('#welcomeScreen');
    el.messageInput       = $('#messageInput');
    el.sendBtn            = $('#sendBtn');
    el.themeToggle        = $('#themeToggle');
    el.modelCards         = $('#modelCards');
    el.chatContainer      = $('#chatContainer');
    el.chatSearch         = $('#chatSearch');
    el.sidebarTabs        = $$('.sidebar-tab');
    el.tabPanels          = $$('.tab-panel');
    el.todoInput          = $('#todoInput');
    el.addTodoBtn         = $('#addTodoBtn');
    el.todoList           = $('#todoList');
    el.appList            = $('#appList');
    el.newAppBtn          = $('#newAppBtn');
    el.appSearch          = $('#appSearch');
    el.appModal           = $('#appModal');
    el.appModalTitle      = $('#appModalTitle');
    el.appNameInput       = $('#appNameInput');
    el.appDescInput       = $('#appDescInput');
    el.appCategoryInput   = $('#appCategoryInput');
    el.appCodeInput       = $('#appCodeInput');
    el.saveAppBtn         = $('#saveAppBtn');
    el.voiceBtn           = $('#voiceBtn');
    el.thinkingToggle     = $('#thinkingToggle');
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
      let msg = `HTTP ${res.status}`;
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
      console.warn('loadModels failed:', e);
      state.models = [];
    }
    renderModelSelect();
    renderModelCards();
    if (state.models.length && (!state.selectedModel || !state.models.some(m => m.name === state.selectedModel))) {
      const preferred = state.models.find(m => /zegrate.*langsec/i.test(m.name))
        || state.models.find(m => /zegrate.*turbo.*builder/i.test(m.name))
        || state.models.find(m => /zegrate/i.test(m.name));
      state.selectedModel = preferred ? preferred.name : state.models[0].name;
    }
    el.modelSelect.value = state.selectedModel;
    updateModelName();
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes === 0) return '';
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
    if (/turbo/i.test(name)) return '\u26A1';
    if (/zegrate/i.test(name)) return 'Z';
    if (/qwen/i.test(name)) return '\uD83D\uDD0D';
    if (/llama/i.test(name)) return '\uD83E\uDD16';
    if (/mistral/i.test(name)) return '\uD83C\uDF1F';
    return '\u2728';
  }

  function isZegrateModel(m) {
    return /zegrate/i.test(m.name) || (m.details && m.details.family === 'zegrate');
  }

  function renderModelSelect() {
    el.modelSelect.innerHTML = '<option value="">\u2014 Select model \u2014</option>';
    state.models.filter(isZegrateModel).forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.name;
      const suffix = m.size ? '  (' + formatSize(m.size) + ')' : '';
      opt.textContent = displayName(m.name) + suffix;
      opt.style.fontWeight = '600';
      el.modelSelect.appendChild(opt);
    });
    el.modelSelect.value = state.selectedModel;
  }

  function renderModelCards() {
    el.modelCards.innerHTML = '';
    const show = state.models.filter(isZegrateModel).slice(0, 6);
    show.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'model-card';
      const icon = modelIcon(m.name);
      const size = m.size ? formatSize(m.size) : '';
      if (/turbo/i.test(m.name)) {
        card.style.borderColor = '#6366f1';
        card.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))';
      }
      card.innerHTML =
        '<div class="model-card-icon">' + icon + '</div>' +
        '<div class="model-card-name">' + displayName(m.name) + '</div>' +
        (size ? '<div class="model-card-size">' + size + '</div>' : '');
      card.addEventListener('click', () => { selectModel(m.name); });
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
     SIDEBAR TABS
     ============================================================ */
  function setupSidebarTabs() {
    el.sidebarTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        el.sidebarTabs.forEach(t => t.classList.remove('active'));
        el.tabPanels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.getElementById('panel-' + tab.dataset.tab);
        if (panel) panel.classList.add('active');
      });
    });
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
      del.title = 'Delete conversation';
      del.addEventListener('click', (e) => { e.stopPropagation(); deleteConversation(c.id); });
      div.appendChild(del);
      div.addEventListener('click', () => switchConversation(c.id));
      el.conversationList.appendChild(div);
    });
  }

  async function startNewChat() {
    if (!state.selectedModel) { toast('Please select a model first'); return; }
    try {
      const res = await api('/api/conversations', { method: 'POST' });
      const data = await res.json();
      state.currentConvId = data.id;
      state.messages = [];
      showChatView(false);
      await loadConversations();
      enableInput(true);
      el.messageInput.focus();
    } catch (e) {
      toast('Failed to create conversation: ' + e.message);
    }
  }

  async function switchConversation(id) {
    state.currentConvId = id;
    try {
      const res = await api('/api/conversations/' + encodeURIComponent(id));
      const data = await res.json();
      state.messages = data.messages || [];
      renderConversations();
      if (state.messages.length) { renderMessages(); showChatView(true); }
      else { showChatView(false); enableInput(true); }
      scrollToBottom();
    } catch (e) { toast('Failed to load conversation'); }
  }

  async function deleteConversation(id) {
    try {
      await api('/api/conversations/' + encodeURIComponent(id), { method: 'DELETE' });
      if (state.currentConvId === id) { state.currentConvId = null; state.messages = []; showChatView(false); enableInput(false); }
      await loadConversations();
    } catch (e) { toast('Failed to delete conversation'); }
  }

  function showChatView(hasMessages) {
    el.welcomeScreen.style.display = hasMessages ? 'none' : 'flex';
    el.chatMessages.style.display = hasMessages ? 'flex' : 'none';
  }

  /* ============================================================
     CHAT SEARCH
     ============================================================ */
  function setupChatSearch() {
    let timer;
    el.chatSearch.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = el.chatSearch.value.trim();
        try {
          const url = q ? '/api/conversations?search=' + encodeURIComponent(q) : '/api/conversations';
          const res = await api(url);
          const data = await res.json();
          state.conversations = data.conversations || [];
          renderConversations();
        } catch (_) {}
      }, 300);
    });
  }

  /* ============================================================
     MESSAGE RENDERING
     ============================================================ */
  function renderMessages() {
    el.chatMessages.innerHTML = '';
    state.messages.forEach((msg) => appendMessageDOM(msg, false));
  }

  function appendMessageDOM(msg, scroll = true) {
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
    el.chatMessages.appendChild(div);
    if (scroll) scrollToBottom();
    return div;
  }

  function formatContent(text) {
    if (!text) return '';
    let html = text.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return '<pre><code' + (lang ? ' class="lang-' + lang + '"' : '') + '>' + escaped + '</code></pre>';
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => { el.chatContainer.scrollTop = el.chatContainer.scrollHeight; });
  }

  /* ============================================================
     CHAT (STREAMING)
     ============================================================ */
  async function sendMessage() {
    const text = el.messageInput.value.trim();
    if (!text || state.isStreaming || !state.selectedModel || !state.currentConvId) return;
    el.messageInput.value = '';
    el.sendBtn.disabled = true;
    state.isStreaming = true;
    el.modelStatus.className = 'model-status thinking';
    el.modelStatus.textContent = 'Thinking\u2026';

    const userMsg = { id: 'um-' + Date.now(), role: 'user', content: text, timestamp: new Date().toISOString() };
    state.messages.push(userMsg);
    showChatView(true);
    appendMessageDOM(userMsg);
    saveMessages([userMsg]);

    const typingId = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = typingId;
    typingDiv.innerHTML = '<div class="message-avatar assistant">AI</div><div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
    el.chatMessages.appendChild(typingDiv);
    scrollToBottom();

    const messagesForAPI = state.messages.map((m) => ({ role: m.role, content: m.content }));
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: state.selectedModel, messages: messagesForAPI, stream: true, show_thinking: state.showThinking }),
      });
      if (!res.ok) {
        let errMsg = 'HTTP ' + res.status;
        try { const e = await res.json(); errMsg = e.detail || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }
      const typingEl = document.getElementById(typingId);
      if (typingEl) typingEl.remove();

      const assistMsg = { id: 'am-' + Date.now(), role: 'assistant', content: '', thinking: '', timestamp: new Date().toISOString() };
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
      if (state.showThinking) {
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking-block';
        thinkingDiv.id = 'think-' + assistMsg.id;
        thinkingDiv.style.display = 'none';
        thinkingDiv.innerHTML = '<div class="thinking-label">Thinking...</div><div class="thinking-text"></div>';
        msgDiv.appendChild(thinkingDiv);
      }
      msgDiv.appendChild(contentDiv);
      el.chatMessages.appendChild(msgDiv);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;
      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.error) { contentDiv.innerHTML = '<p style="color:var(--danger)">Error: ' + escapeHtml(data.error) + '</p>'; assistMsg.content += '\n[Error: ' + data.error + ']'; done = true; break; }
            if (data.done) { done = true; break; }
            if (data.thinking) {
              assistMsg.thinking += data.thinking;
              const thinkEl = document.getElementById('think-' + assistMsg.id);
              if (thinkEl) {
                thinkEl.querySelector('.thinking-text').textContent = assistMsg.thinking;
                thinkEl.style.display = 'block';
              }
            }
            if (data.content) { assistMsg.content += data.content; contentDiv.innerHTML = formatContent(assistMsg.content); scrollToBottom(); }
          } catch (_) {}
        }
      }
      contentDiv.innerHTML = formatContent(assistMsg.content);
      const thinkEl = document.getElementById('think-' + assistMsg.id);
      if (thinkEl && assistMsg.thinking) {
        thinkEl.querySelector('.thinking-text').textContent = assistMsg.thinking;
        thinkEl.style.display = '';
        const label = thinkEl.querySelector('.thinking-label');
        label.textContent = '\uD83E\uDD14 Show thinking';
        label.style.cursor = 'pointer';
        label.onclick = function() {
          const txt = thinkEl.querySelector('.thinking-text');
          txt.style.display = txt.style.display === 'none' ? 'block' : 'none';
          label.textContent = txt.style.display === 'none' ? '\uD83E\uDD14 Show thinking' : '\uD83E\uDD13 Hide thinking';
        };
      }
      const time = document.createElement('div');
      time.className = 'message-time';
      time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      contentDiv.appendChild(time);
      scrollToBottom();
      saveMessages([assistMsg]);
      loadConversations();
    } catch (e) {
      console.error('Chat error:', e);
      const typingEl = document.getElementById(typingId);
      if (typingEl) typingEl.remove();
      const errDiv = document.createElement('div');
      errDiv.className = 'message';
      errDiv.innerHTML = '<div class="message-avatar assistant">AI</div><div class="message-content"><p style="color:var(--danger)">Something went wrong</p><p style="font-size:13px;opacity:0.7;margin-top:4px">Please try again later.</p></div>';
      el.chatMessages.appendChild(errDiv);
      scrollToBottom();
    } finally {
      state.isStreaming = false;
      el.modelStatus.className = 'model-status idle';
      el.modelStatus.textContent = 'Idle';
      el.sendBtn.disabled = false;
      el.messageInput.focus();
    }
  }

  async function saveMessages(msgs) {
    if (!state.currentConvId) return;
    try {
      await fetch('/api/conversations/' + state.currentConvId + '/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs }),
      });
    } catch (_) {}
  }

  function escapeHtml(t) {
    if (!t) return '';
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ============================================================
     TODO
     ============================================================ */
  async function loadTodos() {
    try {
      const res = await api('/api/todos');
      const data = await res.json();
      state.todos = data.todos || [];
      renderTodos();
    } catch (_) {}
  }

  function renderTodos() {
    el.todoList.innerHTML = '';
    if (!state.todos.length) {
      el.todoList.innerHTML = '<div style="padding:14px;font-size:13px;color:var(--text-muted);text-align:center;">No tasks yet</div>';
      return;
    }
    state.todos.forEach(t => {
      const div = document.createElement('div');
      div.className = 'todo-item' + (t.completed ? ' completed' : '');
      const cb = document.createElement('div');
      cb.className = 'todo-checkbox' + (t.completed ? ' checked' : '');
      cb.addEventListener('click', () => toggleTodo(t.id, !t.completed));
      const text = document.createElement('span');
      text.className = 'todo-text';
      text.textContent = t.title;
      const del = document.createElement('button');
      del.className = 'todo-delete';
      del.textContent = '\u00D7';
      del.addEventListener('click', () => deleteTodo(t.id));
      div.appendChild(cb);
      div.appendChild(text);
      div.appendChild(del);
      el.todoList.appendChild(div);
    });
  }

  async function addTodo() {
    const title = el.todoInput.value.trim();
    if (!title) return;
    try {
      await api('/api/todos', { method: 'POST', body: JSON.stringify({ title }) });
      el.todoInput.value = '';
      await loadTodos();
    } catch (e) { toast('Failed to add task'); }
  }

  async function toggleTodo(id, completed) {
    const t = state.todos.find(t => t.id === id);
    if (!t) return;
    try {
      await api('/api/todos/' + id, { method: 'PUT', body: JSON.stringify({ title: t.title, completed }) });
      await loadTodos();
    } catch (_) {}
  }

  async function deleteTodo(id) {
    try {
      await api('/api/todos/' + id, { method: 'DELETE' });
      await loadTodos();
    } catch (_) {}
  }

  /* ============================================================
     APPS
     ============================================================ */
  async function loadApps() {
    try {
      const q = el.appSearch ? el.appSearch.value.trim() : '';
      const url = q ? '/api/apps?search=' + encodeURIComponent(q) : '/api/apps';
      const res = await api(url);
      const data = await res.json();
      state.apps = data.apps || [];
      renderApps();
    } catch (_) {}
  }

  function renderApps() {
    el.appList.innerHTML = '';
    if (!state.apps.length) {
      el.appList.innerHTML = '<div style="padding:14px;font-size:13px;color:var(--text-muted);text-align:center;">No apps yet. Click "+ New App" to create one.</div>';
      return;
    }
    state.apps.forEach(a => {
      const card = document.createElement('div');
      card.className = 'app-card';
      card.innerHTML = '<div class="app-card-name">' + escapeHtml(a.name) + '</div>' +
        '<div class="app-card-desc">' + escapeHtml(a.description || 'No description') + ' &middot; ' + escapeHtml(a.category || 'general') + '</div>' +
        '<div class="app-card-actions">' +
          '<button class="small-btn" onclick="window.openAppEdit(' + a.id + ')">Edit</button>' +
          '<button class="small-btn" onclick="window.openAppView(' + a.id + ')">View</button>' +
          '<button class="small-btn" onclick="window.deleteApp(' + a.id + ')">Delete</button>' +
        '</div>';
      el.appList.appendChild(card);
    });
  }

  window.openAppEdit = function(id) {
    const a = state.apps.find(x => x.id === id);
    if (!a) return;
    state.editingAppId = id;
    el.appModalTitle.textContent = 'Edit App';
    el.appNameInput.value = a.name;
    el.appDescInput.value = a.description || '';
    el.appCategoryInput.value = a.category || 'general';
    el.appCodeInput.value = a.code || '';
    el.appModal.style.display = 'flex';
  };

  window.openAppView = function(id) {
    const a = state.apps.find(x => x.id === id);
    if (!a) return;
    state.editingAppId = id;
    el.appModalTitle.textContent = a.name;
    el.appNameInput.value = a.name;
    el.appDescInput.value = a.description || '';
    el.appCategoryInput.value = a.category || 'general';
    el.appCodeInput.value = a.code || '';
    el.appModal.style.display = 'flex';
  };

  window.deleteApp = async function(id) {
    try {
      await api('/api/apps/' + id, { method: 'DELETE' });
      await loadApps();
    } catch (_) { toast('Failed to delete app'); }
  };

  window.closeAppModal = function() {
    el.appModal.style.display = 'none';
    state.editingAppId = null;
  };

  async function saveApp() {
    const data = {
      name: el.appNameInput.value.trim() || 'Untitled',
      description: el.appDescInput.value.trim(),
      code: el.appCodeInput.value,
      category: el.appCategoryInput.value,
    };
    try {
      if (state.editingAppId) {
        await api('/api/apps/' + state.editingAppId, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        await api('/api/apps', { method: 'POST', body: JSON.stringify(data) });
      }
      window.closeAppModal();
      await loadApps();
    } catch (e) { toast('Failed to save app'); }
  }

  /* ============================================================
     VOICE (ElevenLabs TTS + Speech Recognition)
     ============================================================ */
  function setupVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      el.voiceBtn.style.display = 'none';
      return;
    }
    el.voiceBtn.addEventListener('click', toggleRecording);
  }

  function toggleRecording() {
    if (state.recording) { stopRecording(); return; }
    startRecording();
  }

  let recognition = null;
  function startRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { toast('Speech recognition not available'); return; }
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      el.messageInput.value = transcript;
      el.messageInput.dispatchEvent(new Event('input'));
    };
    recognition.onerror = () => { stopRecording(); };
    recognition.onend = () => { stopRecording(); };

    recognition.start();
    state.recording = true;
    el.voiceBtn.classList.add('recording');
    el.voiceBtn.title = 'Stop recording';
  }

  function stopRecording() {
    if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; }
    state.recording = false;
    el.voiceBtn.classList.remove('recording');
    el.voiceBtn.title = 'Voice input';
  }

  async function speakText(text) {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.substring(0, 500) }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play();
    } catch (e) {
      // Fallback: use browser speech synthesis
      if ('speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(text.substring(0, 200));
        utter.rate = 1.0;
        speechSynthesis.speak(utter);
      }
    }
  }

  /* ============================================================
     INPUT
     ============================================================ */
  function enableInput(enabled) {
    el.messageInput.disabled = !enabled;
    el.sendBtn.disabled = !enabled || !el.messageInput.value.trim();
    el.voiceBtn.disabled = !enabled;
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

  function toggleThinking() {
    state.showThinking = !state.showThinking;
    localStorage.setItem('zg-thinking', state.showThinking);
    el.thinkingToggle.classList.toggle('active', state.showThinking);
    el.thinkingToggle.title = state.showThinking ? 'Hide thinking' : 'Show thinking';
    toast(state.showThinking ? 'Thinking visible' : 'Thinking hidden');
  }

  /* ============================================================
     CONNECTION (hidden - app just works)
     ============================================================ */
  window.closeConnectModal = function() {};
  window.switchProviderTab = function() {};

  /* ============================================================
     TOAST
     ============================================================ */
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  /* ============================================================
     EVENTS
     ============================================================ */
  function initThinking() {
    if (state.showThinking) {
      el.thinkingToggle.classList.add('active');
      el.thinkingToggle.title = 'Hide thinking';
    }
  }

  function setup() {
    cacheEls();
    loadTheme();
    initThinking();
    setupSidebarTabs();
    setupChatSearch();
    setupVoice();

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
    el.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    el.messageInput.addEventListener('input', () => {
      autoResize();
      el.sendBtn.disabled = !el.messageInput.value.trim() || state.isStreaming || !state.currentConvId || !state.selectedModel;
    });
    el.themeToggle.addEventListener('click', toggleTheme);
    el.thinkingToggle.addEventListener('click', toggleThinking);

    // Todo
    el.addTodoBtn.addEventListener('click', addTodo);
    el.todoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTodo(); } });

    // Apps
    el.newAppBtn.addEventListener('click', () => {
      state.editingAppId = null;
      el.appModalTitle.textContent = 'New App';
      el.appNameInput.value = '';
      el.appDescInput.value = '';
      el.appCategoryInput.value = 'web';
      el.appCodeInput.value = '';
      el.appModal.style.display = 'flex';
    });
    el.saveAppBtn.addEventListener('click', saveApp);
    el.appSearch.addEventListener('input', () => {
      clearTimeout(window._appSearchTimer);
      window._appSearchTimer = setTimeout(loadApps, 300);
    });

    // Close modal on outside click
    el.appModal.addEventListener('click', (e) => { if (e.target === el.appModal) window.closeAppModal(); });

    // Close sidebar on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && state.sidebarOpen) {
        if (!el.sidebar.contains(e.target) && e.target !== el.sidebarToggle && !el.sidebarToggle.contains(e.target)) {
          state.sidebarOpen = false;
          el.sidebar.classList.remove('open');
        }
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) { state.sidebarOpen = true; el.sidebar.classList.remove('open'); }
    });
  }

  /* ============================================================
     INIT
     ============================================================ */
  async function init() {
    setup();
    await loadModels();
    await loadConversations();
    await loadTodos();
    await loadApps();
    if (state.selectedModel) await startNewChat();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
