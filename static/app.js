const layout = document.getElementById("app");
const resumeName = document.getElementById("resume-name");
const resumeTagline = document.getElementById("resume-tagline");
const resumeMeta = document.getElementById("resume-meta");
const resumeContent = document.getElementById("resume-content");
const resumeBadges = document.getElementById("resume-badges");
const resumeFocus = document.getElementById("resume-focus");
const resumePhoto = document.getElementById("resume-photo");
const resumeReset = document.getElementById("resume-reset");
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatStatus = document.getElementById("chat-status");

const SESSION_KEY = "resume_chat_session";

const PLACEHOLDER_HEADSHOT =
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&h=675&q=80";

const PLACEHOLDER_GALLERY = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&h=675&q=80",
  "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&h=675&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&h=675&q=80&sat=-30",
];

let resumeData = null;
let currentFocus = null;

function getSessionId() {
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

function setChatStatus(text) {
  chatStatus.textContent = text;
}

function addBubble(text, who) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${who}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function createSection(title) {
  const section = document.createElement("section");
  section.className = "resume-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.appendChild(heading);
  return { section };
}

function createCard(title, text) {
  const card = document.createElement("div");
  card.className = "card";
  const heading = document.createElement("h4");
  heading.textContent = title;
  const body = document.createElement("p");
  body.textContent = text;
  card.appendChild(heading);
  card.appendChild(body);
  return card;
}

function createList(items) {
  const list = document.createElement("ul");
  list.className = "list";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
  return list;
}

function createChipRow(items) {
  const row = document.createElement("div");
  row.className = "chip-row";
  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = item;
    row.appendChild(chip);
  });
  return row;
}

function formatDate(value) {
  if (!value) return "";
  const [year, month] = value.split("-");
  if (!month) return value;
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthIndex = Number(month) - 1;
  if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return value;
  return `${monthNames[monthIndex]} ${year}`;
}

function formatRange(start, end) {
  const startText = formatDate(start);
  const endText = end ? formatDate(end) : "Present";
  if (!startText && !endText) return "";
  if (startText && endText) return `${startText} - ${endText}`;
  return startText || endText;
}

function renderOverview(data) {
  const { section } = createSection("Overview");
  const grid = document.createElement("div");
  grid.className = "card-grid";

  if (data?.personal_info?.title) {
    grid.appendChild(createCard("Role", data.personal_info.title));
  }
  if (data?.personal_info?.tagline) {
    grid.appendChild(createCard("Tagline", data.personal_info.tagline));
  }

  if (Array.isArray(data.languages)) {
    grid.appendChild(createCard("Languages", data.languages.join(", ")));
  }

  section.appendChild(grid);
  return section;
}

function renderExperience(data) {
  const { section } = createSection("Experience");
  const timeline = document.createElement("div");
  timeline.className = "timeline";

  (data.experience || []).forEach((item) => {
    const block = document.createElement("div");
    block.className = "timeline-item";
    const title = document.createElement("h4");
    title.textContent = `${item.role || "Role"} � ${item.company || ""}`.trim();
    const meta = document.createElement("div");
    meta.className = "timeline-meta";
    meta.textContent = [item.location, formatRange(item.start_date, item.end_date)]
      .filter(Boolean)
      .join(" � ");
    block.appendChild(title);
    if (meta.textContent) block.appendChild(meta);

    if (Array.isArray(item.domains) && item.domains.length) {
      block.appendChild(createChipRow(item.domains));
    }

    if (Array.isArray(item.responsibilities)) {
      block.appendChild(createList(item.responsibilities));
    }

    timeline.appendChild(block);
  });

  section.appendChild(timeline);
  return section;
}

function renderProjects(data) {
  const { section } = createSection("Projects");
  const timeline = document.createElement("div");
  timeline.className = "timeline";

  (data.projects || []).forEach((item) => {
    const block = document.createElement("div");
    block.className = "timeline-item";
    const title = document.createElement("h4");
    title.textContent = item.name || "Project";
    block.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "timeline-meta";
    meta.textContent = item.duration || "";
    if (meta.textContent) block.appendChild(meta);

    if (Array.isArray(item.technologies)) {
      block.appendChild(createChipRow(item.technologies));
    }

    if (Array.isArray(item.highlights)) {
      block.appendChild(createList(item.highlights));
    }

    if (Array.isArray(item.links) && item.links.length) {
      const links = document.createElement("div");
      links.className = "timeline-meta";
      links.textContent = `Links: ${item.links.join(", ")}`;
      block.appendChild(links);
    }

    timeline.appendChild(block);
  });

  section.appendChild(timeline);
  return section;
}

function renderSkills(data) {
  const { section } = createSection("Skills");
  const grid = document.createElement("div");
  grid.className = "card-grid";

  const skills = data.skills || {};
  Object.keys(skills).forEach((key) => {
    const label = key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
    const card = document.createElement("div");
    card.className = "card";
    const title = document.createElement("h4");
    title.textContent = label;
    card.appendChild(title);
    if (Array.isArray(skills[key])) {
      card.appendChild(createChipRow(skills[key]));
    }
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

function renderEducation(data) {
  const { section } = createSection("Education");
  const timeline = document.createElement("div");
  timeline.className = "timeline";

  (data.education || []).forEach((item) => {
    const block = document.createElement("div");
    block.className = "timeline-item";
    const title = document.createElement("h4");
    title.textContent = `${item.degree || ""} � ${item.institution || ""}`.trim();
    const meta = document.createElement("div");
    meta.className = "timeline-meta";
    const dateRange = formatRange(item.start_date, item.end_date) || item.year;
    meta.textContent = [item.major, item.gpa, dateRange].filter(Boolean).join(" � ");
    block.appendChild(title);
    if (meta.textContent) block.appendChild(meta);
    timeline.appendChild(block);
  });

  section.appendChild(timeline);
  return section;
}

function renderCertifications(data) {
  const { section } = createSection("Certifications");
  const items = (data.certifications || []).map((item) => {
    const pieces = [item.name, item.platform, item.year].filter(Boolean);
    return pieces.join(" � ");
  });
  section.appendChild(createList(items));
  return section;
}

function renderLeadership(data) {
  const { section } = createSection("Leadership");
  const items = (data.leadership_and_extracurricular || []).map((item) => {
    const pieces = [item.role, item.organization, item.duration].filter(Boolean);
    return pieces.join(" � ");
  });
  section.appendChild(createList(items));
  return section;
}

function renderPhotography(data) {
  const { section } = createSection("Photography & Interests");
  const interests = data.hobbies_and_interests || {};
  const cards = document.createElement("div");
  cards.className = "card-grid";

  if (Array.isArray(interests.hobbies)) {
    cards.appendChild(createCard("Hobbies", interests.hobbies.join(", ")));
  }
  if (Array.isArray(interests.personal_achievements)) {
    cards.appendChild(
      createCard("Personal Achievements", interests.personal_achievements.join(" � "))
    );
  }
  if (interests.photography_gear?.camera) {
    cards.appendChild(createCard("Camera", interests.photography_gear.camera));
  }
  section.appendChild(cards);

  const gallery = document.createElement("div");
  gallery.className = "photo-grid";
  PLACEHOLDER_GALLERY.forEach((src) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "Sample photography";
    img.loading = "lazy";
    gallery.appendChild(img);
  });
  section.appendChild(gallery);
  return section;
}

function renderMeta(data) {
  resumeMeta.innerHTML = "";
  const contact = data?.personal_info?.contact || {};
  const items = [
    { label: "Email", value: contact.email },
    { label: "Phone", value: contact.phone },
    { label: "Website", value: contact.website },
    { label: "GitHub", value: contact.github },
    { label: "LinkedIn", value: contact.linkedin },
  ].filter((item) => item.value);

  items.forEach((item) => {
    const meta = document.createElement("div");
    meta.className = "meta-item";
    const label = document.createElement("div");
    label.textContent = item.label;
    const value = document.createElement("a");
    value.textContent = item.value;
    if (item.label === "Email") {
      value.href = `mailto:${item.value}`;
    } else if (item.label === "Phone") {
      value.href = `tel:${item.value.replace(/\s+/g, "")}`;
    } else {
      value.href = item.value;
    }
    value.target = "_blank";
    value.rel = "noreferrer";
    meta.appendChild(label);
    meta.appendChild(value);
    resumeMeta.appendChild(meta);
  });
}

function detectFocus(message) {
  const text = message.toLowerCase();
  const rules = [
    { key: "projects", words: ["project", "portfolio", "build", "case study", "app"] },
    { key: "experience", words: ["experience", "work", "job", "company", "role"] },
    { key: "skills", words: ["skill", "stack", "technology", "tools", "python", "sql", "ml"] },
    { key: "education", words: ["education", "college", "degree", "university", "gpa"] },
    { key: "certifications", words: ["certification", "certificate", "course", "coursera"] },
    { key: "leadership", words: ["leadership", "extracurricular", "representative", "volunteer"] },
    { key: "photography", words: ["photo", "photography", "camera", "hobby", "interests"] },
  ];

  for (const rule of rules) {
    if (rule.words.some((word) => text.includes(word))) return rule.key;
  }
  return null;
}

function renderResume() {
  if (!resumeData) return;
  resumeContent.innerHTML = "";

  const sections = [];
  sections.push(renderOverview(resumeData));

  const renderMap = {
    experience: renderExperience,
    projects: renderProjects,
    skills: renderSkills,
    education: renderEducation,
    certifications: renderCertifications,
    leadership: renderLeadership,
    photography: renderPhotography,
  };

  if (currentFocus && renderMap[currentFocus]) {
    const focusSection = renderMap[currentFocus](resumeData);
    focusSection.classList.add("focus-section");
    sections.push(focusSection);
  } else {
    sections.push(renderExperience(resumeData));
    sections.push(renderProjects(resumeData));
    sections.push(renderSkills(resumeData));
    sections.push(renderEducation(resumeData));
    sections.push(renderCertifications(resumeData));
    sections.push(renderLeadership(resumeData));
    sections.push(renderPhotography(resumeData));
  }

  sections.forEach((section) => resumeContent.appendChild(section));

  resumeFocus.textContent = currentFocus
    ? `Focused view: ${currentFocus.replace(/\b\w/g, (char) => char.toUpperCase())}`
    : "";
  resumeReset.style.display = currentFocus ? "inline-flex" : "none";
}

async function loadResume() {
  try {
    const response = await fetch("/resume");
    const data = await response.json();
    resumeData = data;

    resumeName.textContent = data.personal_info?.name || "Resume";
    resumeTagline.textContent =
      data.personal_info?.tagline || data.personal_info?.title || "";

    resumeBadges.innerHTML = "";
    const badges = [data.personal_info?.title, data.personal_info?.tagline].filter(Boolean);
    badges.forEach((badgeText) => {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = badgeText;
      resumeBadges.appendChild(badge);
    });

    resumePhoto.src = PLACEHOLDER_HEADSHOT;

    renderMeta(data);
    renderResume();
  } catch (error) {
    resumeContent.innerHTML = "";
    const errorDiv = document.createElement("div");
    errorDiv.className = "resume-loading";
    errorDiv.textContent = "Unable to load resume.";
    resumeContent.appendChild(errorDiv);
  }
}

async function sendMessage(message) {
  setChatStatus("Thinking...");
  const sessionId = getSessionId();

  try {
    const response = await fetch("/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: sessionId }),
    });

    const data = await response.json();
    const reply = data.response || "Sorry, I could not respond.";
    addBubble(reply, "bot");
  } catch (error) {
    addBubble("Something went wrong talking to the server.", "bot");
  } finally {
    setChatStatus("Ready");
  }
}

resumeReset.addEventListener("click", () => {
  currentFocus = null;
  renderResume();
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  addBubble(message, "user");
  chatInput.value = "";

  if (!layout.classList.contains("layout-chat-active")) {
    layout.classList.add("layout-chat-active");
  }

  const focus = detectFocus(message);
  if (focus) {
    currentFocus = focus;
    renderResume();
  }

  await sendMessage(message);
});

loadResume();
