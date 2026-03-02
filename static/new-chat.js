/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let chatStarted = false;
const SESSION_KEY = "resume_chat_session";

const app       = document.getElementById('app');
const welcome   = document.getElementById('chat-welcome');
const messagesEl = document.getElementById('messages');
const inputEl   = document.getElementById('chat-input');
const header    = document.getElementById('chat-header');

function getSessionId() {
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

/* ══════════════════════════════════════════
   MOBILE DRAWER TOGGLE
   On mobile the chat header is tappable —
   clicking it opens/closes the drawer.
   On desktop this is a no-op (drawer doesn't exist).
══════════════════════════════════════════ */
function isMobile() {
  return window.innerWidth < 768;
}

function openDrawer() {
  app.classList.add('chat-active');
}

function closeDrawer() {
  // Only close on mobile; on desktop chat-active just means 50/50 split
  if (isMobile()) {
    app.classList.remove('chat-active');
  }
}

header.addEventListener('click', function () {
  if (!isMobile()) return;
  if (app.classList.contains('chat-active')) {
    closeDrawer();
  } else {
    openDrawer();
  }
});

// Close drawer when user taps the resume panel on mobile
document.getElementById('resume-panel').addEventListener('click', function (e) {
  if (isMobile() && app.classList.contains('chat-active')) {
    // Only close if the tap wasn't inside a card / interactive element
    closeDrawer();
  }
});

/* ══════════════════════════════════════════
   KEYWORD → SECTION MAP
   Update keywords to match your real content.
══════════════════════════════════════════ */
const sectionKeywords = {
  'section-projects': [
    'project', 'projects', 'built', 'build', 'forge', 'tempo', 'drift', 'bloom',
    'side project', 'open source', 'github', 'portfolio', 'app', 'application'
  ],
  'section-experience': [
    'experience', 'work', 'job', 'career', 'stripe', 'figma', 'airbnb', 'meta',
    'worked', 'role', 'position', 'employment', 'company', 'professional'
  ],
  'section-education': [
    'education', 'school', 'university', 'stanford', 'degree', 'studied',
    'graduate', 'gpa', 'certification', 'award', 'hackathon'
  ],
  'section-skills': [
    'skill', 'skills', 'technology', 'technologies', 'stack', 'tech',
    'programming', 'language', 'languages', 'tools', 'framework', 'kubernetes',
    'python', 'go', 'rust', 'typescript', 'react', 'aws', 'cloud'
  ],
  'section-hobbies': [
    'hobby', 'hobbies', 'interest', 'interests', 'outside', 'personal',
    'hiking', 'photography', 'baking', 'philosophy', 'free time', 'fun'
  ]
};

function detectSection(text) {
  const lower = text.toLowerCase();
  let bestSection = null;
  let bestCount = 0;
  for (const [sectionId, keywords] of Object.entries(sectionKeywords)) {
    const count = keywords.filter(kw => lower.includes(kw)).length;
    if (count > bestCount) { bestCount = count; bestSection = sectionId; }
  }
  return bestCount > 0 ? bestSection : null;
}

function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;

  document.querySelectorAll('.resume-section').forEach(s => {
    s.classList.remove('highlighted');
    s.classList.add('dimmed');
  });
  el.classList.remove('dimmed');
  el.classList.add('highlighted');

  const panel = document.getElementById('resume-panel');
  panel.scrollTo({ top: el.offsetTop - 20, behavior: 'smooth' });

  // On mobile, briefly collapse drawer so the user sees the highlight
  if (isMobile()) {
    closeDrawer();
    setTimeout(openDrawer, 1800);
  }

  setTimeout(() => {
    document.querySelectorAll('.resume-section').forEach(s => {
      s.classList.remove('dimmed', 'highlighted');
    });
  }, 4000);
}

/* ══════════════════════════════════════════
   CHAT START
══════════════════════════════════════════ */
function startChat() {
  if (chatStarted) return;
  chatStarted = true;
  app.classList.add('chat-active');
  welcome.style.display = 'none';
  messagesEl.style.display = 'flex';
}

/* ══════════════════════════════════════════
   MESSAGES
══════════════════════════════════════════ */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatInline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function formatAssistantMessage(text) {
  const safe = escapeHtml(text || '').replace(/\r\n/g, '\n');
  const lines = safe.split('\n');
  const html = [];
  let inUl = false;
  let inOl = false;

  function closeLists() {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeLists();
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push('<li>' + formatInline(bullet[1]) + '</li>');
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push('<li>' + formatInline(numbered[1]) + '</li>');
      continue;
    }

    closeLists();

    const heading = line.match(/^\*\*(.+)\*\*:?$/);
    if (heading) {
      html.push('<h4>' + formatInline(heading[1]) + '</h4>');
      continue;
    }

    html.push('<p>' + formatInline(line) + '</p>');
  }

  closeLists();
  return html.join('');
}

function addMessage(text, role) {
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const bubbleContent = role === 'assistant'
    ? formatAssistantMessage(text)
    : escapeHtml(text);

  msg.innerHTML =
    '<div class="msg-bubble">' + bubbleContent + '</div>' +
    '<div class="msg-time">' + time + '</div>';

  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return msg;
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.id = 'typing';
  el.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

function removeTyping() {
  const el = document.getElementById('typing');
  if (el) el.remove();
}

/* ══════════════════════════════════════════
   SEND MESSAGE
   ── FastAPI integration point ──
   Replace the mock block below.
══════════════════════════════════════════ */
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  startChat();
  inputEl.value = '';
  inputEl.style.height = 'auto';

  addMessage(text, 'user');

  const section = detectSection(text);
  if (section) scrollToSection(section);

  showTyping();

  
  try {
    const sessionId = getSessionId();
    const res = await fetch('/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, session_id: sessionId })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('Request failed (' + res.status + '): ' + (errText || res.statusText));
    }

    removeTyping();
    const resClone = res.clone();
    let data;
    try {
      data = await res.json();
    } catch (_) {
      const raw = await resClone.text().catch(() => '');
      throw new Error('Server returned invalid JSON: ' + raw);
    }
    addMessage(data.response || 'Sorry, I could not respond.', 'assistant');
  } catch (err) {
    removeTyping();
    console.error('Chat error:', err);
    addMessage('Error: ' + (err && err.message ? err.message : 'Could not connect to server.'), 'assistant');
  }
}

function sendSuggestion(text) {
  inputEl.value = text;
  sendMessage();
}

/* ══════════════════════════════════════════
   INPUT: AUTO-RESIZE + KEYBOARD
══════════════════════════════════════════ */
inputEl.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

inputEl.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Stop input tap from toggling the drawer closed on mobile
inputEl.addEventListener('click', function (e) {
  e.stopPropagation();
});
document.getElementById('send-btn').addEventListener('click', function (e) {
  e.stopPropagation();
});

document.querySelectorAll('#section-hobbies .hobby-card').forEach(function (card) {
  function toggleCard() {
    card.classList.toggle('is-active');
  }

  card.addEventListener('click', toggleCard);
  card.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCard();
    }
  });
});
