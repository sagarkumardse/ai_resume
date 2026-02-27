/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let chatStarted = false;

const app       = document.getElementById('app');
const welcome   = document.getElementById('chat-welcome');
const messagesEl = document.getElementById('messages');
const inputEl   = document.getElementById('chat-input');
const header    = document.getElementById('chat-header');

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

function addMessage(text, role) {
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  msg.innerHTML =
    '<div class="msg-bubble">' + escapeHtml(text) + '</div>' +
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

  // ── REPLACE THIS BLOCK WITH YOUR FASTAPI CALL ──
  //
  // try {
  //   const res = await fetch('http://localhost:8000/chat', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ message: text })
  //   });
  //   const data = await res.json();
  //   removeTyping();
  //   addMessage(data.reply, 'assistant');
  // } catch (err) {
  //   removeTyping();
  //   addMessage('Sorry, I had trouble connecting. Please try again.', 'assistant');
  // }

  // Mock response — delete once backend is connected
  await new Promise(r => setTimeout(r, 1200 + Math.random() * 600));
  removeTyping();

  const mockReplies = {
    project:    'Alex has built some really impressive projects! Forge is a local AI workbench with 3.2k stars, Tempo is a team analytics platform, and Bloom won 1st place at TreeHacks 2021.',
    experience: 'Alex has 6+ years of experience at world-class companies: currently a Senior Software Engineer at Stripe, previously at Figma, Airbnb, and Meta.',
    education:  'Alex studied Computer Science at Stanford (class of 2019) with a 3.94 GPA. Also holds an AWS Solutions Architect certification.',
    skill:      'Alex is strongest in Go and TypeScript (expert level), with strong Python, Rust, Kubernetes, and React skills.',
    hobb:       'Outside of work, Alex hikes mountains, shoots film photography on 35mm, bakes sourdough, and runs a philosophy of mind reading group.',
  };

  const lower = text.toLowerCase();
  let reply = "Great question! Ask me about Alex's projects, work experience, education, skills, or hobbies — and I'll highlight the relevant section too.";
  for (const [key, val] of Object.entries(mockReplies)) {
    if (lower.includes(key)) { reply = val; break; }
  }

  addMessage(reply, 'assistant');
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
