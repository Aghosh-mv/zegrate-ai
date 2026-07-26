/**
 * Group Chat Module for Zegrate AI
 * Features: multi-user chat, bot personality adaptation, message splitting, drag effects
 */
(function() {
  'use strict';

  // State
  const state = {
    members: ['Alex', 'Sam', 'Jordan'],
    groupName: '',
    style: 'casual',
    frequency: 'medium',
    splitMode: 'sometimes',
    messages: [],
    botSpeakingProbability: { low: 0.2, medium: 0.4, high: 0.6, very_high: 0.8 },
    splitPatterns: {
      never: [],
      sometimes: [
        ['ok', 'so', 'hold on', 'is no one going to address what {user} said?'],
        ['wait', 'i think {user} has a point here'],
        ['bruh', '{user} is absolutely right'],
      ],
      dramatic: [
        ['every once in a while', 'someone says something', 'so perfect', 'that i have to acknowledge it', '{user} that was beautiful'],
        ['ladies and gentlemen', 'i present to you', 'the single greatest moment', 'in chat history', '*drumroll*', '{user} just admitted they were wrong'],
        ['ok', 'so', 'i've been thinking', 'for about 0.3 seconds', 'and my conclusion is', 'you're absolutely right', 'and i'm terrified'],
      ],
      chaotic: [
        ['WAIT', 'WAIT WAIT WAIT', '{user} DID NOT JUST SAY THAT'],
        ['i'm', 'literally', 'crying', 'right now'],
        ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', '{user}'],
      ],
    },
  };

  // Personality responses by style
  const responses = {
    casual: {
      speak: [
        'lol {user} absolutely nailed it',
        'bruh {user} 💀',
        'ok but real talk {user} has a point',
        "i'm screaming 💀",
        'the way {user} said that... chef\'s kiss 👨‍🍳',
        'no because that\'s literally the funniest thing i\'ve read today',
        'ok {user} is right and we all know it',
        'not {user} being correct again 😭',
      ],
      quiet: ['^', 'factual', 'real', 'this', 'true'],
    },
    work: {
      speak: [
        "That's an interesting perspective, {user}. I'd like to explore that further.",
        'Good point, {user}. I\'ll add that to the agenda.',
        'Noted. I\'ll have the documentation ready by tomorrow.',
        'Agreed, {user}. Let\'s discuss this in the next standup.',
        'That\'s a solid approach, {user}. Can you elaborate?',
      ],
      quiet: ['Noted.', 'Agreed.', 'Will do.', 'Thanks.'],
    },
    chaotic: {
      speak: [
        'LMAO {user} ABSOLUTELY DESTROYED THEM',
        '{user} IS COOKING AND I\'M HERE FOR IT',
        'I\'M LITERALLY SCREAMING {user} 💀💀💀',
        'STOP {user} YOU\'RE KILLING ME',
        'THE AUDACITY OF {user} IS UNMATCHED',
      ],
      quiet: ['💀', '😭', '😂', '💀💀', 'bruh'],
    },
    gaming: {
      speak: [
        '{user} just got a killstreak in this chat',
        'GG {user} that was clean',
        '{user} is carrying this conversation',
        'NICE ONE {user} 🎮',
        '{user} really just pulled off that play',
      ],
      quiet: ['gg', 'ez', 'nice', 'wp', '🎯'],
    },
    creative: {
      speak: [
        '{user} that\'s actually a brilliant idea',
        'the way {user} framed that... *chef\'s kiss*',
        '{user} is onto something here',
        'ok {user} that\'s genuinely inspiring',
        'the creative energy from {user} is unmatched',
      ],
      quiet: ['✨', '🎨', '💡', 'nice'],
    },
    serious: {
      speak: [
        '{user} makes an important point worth discussing',
        'I agree with {user} on this one',
        'That\'s a thoughtful perspective, {user}',
        '{user} raises a valid concern',
        'Let me address what {user} said...',
      ],
      quiet: ['Understood.', 'Noted.', 'Agreed.'],
    },
  };

  // DOM elements
  let elements = {};

  function init() {
    elements = {
      groupName: document.getElementById('groupName'),
      memberList: document.getElementById('groupMemberList'),
      addMemberInput: document.getElementById('addMemberInput'),
      styleSelect: document.getElementById('groupStyle'),
      frequencySelect: document.getElementById('groupFrequency'),
      splitSelect: document.getElementById('groupSplit'),
      messages: document.getElementById('groupChatMessages'),
      senderSelect: document.getElementById('groupMsgSender'),
      msgInput: document.getElementById('groupMsgInput'),
      sendBtn: document.getElementById('groupSendBtn'),
      newGroupBtn: document.getElementById('newGroupBtn'),
    };

    if (!elements.sendBtn) return;

    // Event listeners
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.msgInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
    elements.addMemberInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addMember();
    });
    elements.styleSelect.addEventListener('change', (e) => {
      state.style = e.target.value;
    });
    elements.frequencySelect.addEventListener('change', (e) => {
      state.frequency = e.target.value;
    });
    elements.splitSelect.addEventListener('change', (e) => {
      state.splitMode = e.target.value;
    });
    elements.newGroupBtn.addEventListener('click', resetGroup);

    // Remove member clicks
    elements.memberList.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-member')) {
        const tag = e.target.closest('.group-member-tag');
        if (tag) removeMember(tag.dataset.member);
      }
    });

    // Initial member tags
    updateMemberTags();
    updateSenderOptions();
  }

  function addMember() {
    const name = elements.addMemberInput.value.trim();
    if (!name || state.members.includes(name)) return;
    state.members.push(name);
    elements.addMemberInput.value = '';
    updateMemberTags();
    updateSenderOptions();
  }

  function removeMember(name) {
    state.members = state.members.filter(m => m !== name);
    updateMemberTags();
    updateSenderOptions();
  }

  function updateMemberTags() {
    elements.memberList.innerHTML = state.members.map(m =>
      `<div class="group-member-tag" data-member="${m}">${m} <span class="remove-member">×</span></div>`
    ).join('');
  }

  function updateSenderOptions() {
    elements.senderSelect.innerHTML = state.members.map(m =>
      `<option value="${m}">${m}</option>`
    ).join('') + '<option value="Zegrate">🤖 Zegrate</option>';
  }

  function resetGroup() {
    state.messages = [];
    state.members = ['Alex', 'Sam', 'Jordan'];
    elements.groupName.value = '';
    elements.messages.innerHTML = '';
    updateMemberTags();
    updateSenderOptions();
    addSystemMessage('New group chat created');
  }

  function sendMessage() {
    const text = elements.msgInput.value.trim();
    if (!text) return;

    const sender = elements.senderSelect.value;
    const isBot = sender === 'Zegrate';

    if (!isBot) {
      // Human message - render immediately
      addChatMessage(sender, text, false);
      elements.msgInput.value = '';

      // Maybe bot responds
      if (Math.random() < state.botSpeakingProbability[state.frequency]) {
        const delay = 500 + Math.random() * 2000; // 0.5-2.5s delay
        setTimeout(() => generateBotResponse(text, sender), delay);
      }
    } else {
      // Bot typing manually
      addChatMessage('Zegrate', text, true);
      elements.msgInput.value = '';
    }
  }

  function generateBotResponse(triggerMsg, triggerUser) {
    const style = responses[state.style] || responses.casual;
    const shouldSplit = state.splitMode !== 'never' && Math.random() < 0.4;

    if (shouldSplit) {
      // Pick a split pattern
      const patterns = state.splitPatterns[state.splitMode] || state.splitPatterns.sometimes;
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];
      const messages = pattern.map(m => m.replace('{user}', triggerUser));
      sendSplitMessages(messages, 300 + Math.random() * 500);
    } else {
      // Single message
      const pool = style.speak;
      const msg = pool[Math.floor(Math.random() * pool.length)].replace('{user}', triggerUser);
      addChatMessage('Zegrate', msg, true);
    }
  }

  function sendSplitMessages(messages, delayBetween) {
    let i = 0;
    function sendNext() {
      if (i >= messages.length) return;
      addChatMessage('Zegrate', messages[i], true, true); // split=true
      i++;
      if (i < messages.length) {
        setTimeout(sendNext, delayBetween + Math.random() * 300);
      }
    }
    sendNext();
  }

  function addChatMessage(sender, text, isBot, isSplit = false) {
    const div = document.createElement('div');
    div.className = `group-msg ${isBot ? 'group-msg-bot' : 'group-msg-user'} ${isSplit ? 'group-msg-split' : ''}`;
    div.innerHTML = `
      <div class="group-msg-sender">${sender}</div>
      <div class="group-msg-text">${escapeHtml(text)}</div>
      <div class="group-msg-time">${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
    `;
    elements.messages.appendChild(div);
    elements.messages.scrollTop = elements.messages.scrollHeight;

    state.messages.push({ sender, text, isBot, timestamp: Date.now() });
  }

  function addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'group-msg-system';
    div.textContent = text;
    elements.messages.appendChild(div);
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
