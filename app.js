const STORAGE_KEY = "category-stopwatch-v1";

/** @type {{categories: Array<{id:string,name:string,totalMs:number,sessions:Array<{id:string,start:number,end:number,durationMs:number}>}>, active: {categoryId:string,start:number}|null}} */
let state = loadState();
let tickInterval = null;

const categoryForm = document.getElementById("category-form");
const categoryNameInput = document.getElementById("category-name");
const categoryList = document.getElementById("category-list");
const sessionList = document.getElementById("session-list");
const stopActiveBtn = document.getElementById("stop-active");
const categoryTemplate = document.getElementById("category-template");
const sessionTemplate = document.getElementById("session-template");

categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = categoryNameInput.value.trim();
  if (!name) return;

  state.categories.push({
    id: createId(),
    name,
    totalMs: 0,
    sessions: [],
  });

  categoryNameInput.value = "";
  persist();
  render();
});

stopActiveBtn.addEventListener("click", () => {
  stopActiveSession();
});

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { categories: [], active: null };

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.categories)) throw new Error("Invalid state");

    const categories = parsed.categories.map((category) => {
      const sessions = Array.isArray(category.sessions)
        ? category.sessions.map((session) => ({
            id: typeof session.id === "string" ? session.id : createId(),
            start: Number(session.start) || Date.now(),
            end: Number(session.end) || Number(session.start) || Date.now(),
            durationMs: Math.max(0, Number(session.durationMs) || 0),
          }))
        : [];

      const safeCategory = {
        id: typeof category.id === "string" ? category.id : createId(),
        name: typeof category.name === "string" ? category.name : "Untitled",
        totalMs: Number(category.totalMs) || 0,
        sessions,
      };

      recalculateCategoryTotal(safeCategory);
      return safeCategory;
    });

    return {
      categories,
      active: parsed.active && parsed.active.categoryId ? parsed.active : null,
    };
  } catch {
    return { categories: [], active: null };
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function parseDurationInput(value) {
  const normalized = value.trim();
  const hhmmss = /^(\d+):([0-5]\d):([0-5]\d)$/;
  const mmss = /^([0-5]?\d):([0-5]\d)$/;

  if (hhmmss.test(normalized)) {
    const [, h, m, s] = normalized.match(hhmmss);
    return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000;
  }

  if (mmss.test(normalized)) {
    const [, m, s] = normalized.match(mmss);
    return (Number(m) * 60 + Number(s)) * 1000;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized) * 60000;
  }

  return null;
}

function recalculateCategoryTotal(category) {
  category.totalMs = category.sessions.reduce((sum, session) => sum + Math.max(0, session.durationMs), 0);
}

function getTodayTotalsByCategory() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const totals = new Map();

  for (const category of state.categories) {
    let sum = 0;
    for (const session of category.sessions) {
      if (session.start >= startOfDay) sum += session.durationMs;
    }

    if (state.active?.categoryId === category.id && state.active.start >= startOfDay) {
      sum += Date.now() - state.active.start;
    }

    totals.set(category.id, sum);
  }

  return totals;
}

function getAllTimeTotal(category) {
  if (state.active?.categoryId === category.id) {
    return category.totalMs + (Date.now() - state.active.start);
  }
  return category.totalMs;
}

function startSession(categoryId) {
  if (state.active?.categoryId === categoryId) return;

  stopActiveSession();
  state.active = { categoryId, start: Date.now() };
  persist();
  ensureTicking();
  render();
}

function stopActiveSession() {
  if (!state.active) return;

  const category = state.categories.find((item) => item.id === state.active.categoryId);
  if (!category) {
    state.active = null;
    persist();
    render();
    return;
  }

  const end = Date.now();
  const durationMs = Math.max(0, end - state.active.start);

  category.sessions.push({
    id: createId(),
    start: state.active.start,
    end,
    durationMs,
  });
  recalculateCategoryTotal(category);
  state.active = null;

  persist();
  stopTickingIfIdle();
  render();
}

function editSession(categoryId, sessionId) {
  const category = state.categories.find((item) => item.id === categoryId);
  if (!category) return;
  const session = category.sessions.find((item) => item.id === sessionId);
  if (!session) return;

  const entered = window.prompt(
    "Enter new duration as HH:MM:SS, MM:SS, or minutes (number only).",
    formatDuration(session.durationMs)
  );
  if (entered === null) return;

  const parsedMs = parseDurationInput(entered);
  if (parsedMs === null) {
    window.alert("Invalid format. Use HH:MM:SS, MM:SS, or a whole number of minutes.");
    return;
  }

  session.durationMs = parsedMs;
  session.end = session.start + parsedMs;
  recalculateCategoryTotal(category);

  persist();
  render();
}

function deleteCategory(categoryId) {
  const wasActive = state.active?.categoryId === categoryId;
  state.categories = state.categories.filter((item) => item.id !== categoryId);
  if (wasActive) state.active = null;

  persist();
  stopTickingIfIdle();
  render();
}

function render() {
  renderCategories();
  renderSessions();
}

function renderCategories() {
  categoryList.innerHTML = "";
  const todayTotals = getTodayTotalsByCategory();

  if (state.categories.length === 0) {
    categoryList.innerHTML = "<p class=\"meta\">No categories yet.</p>";
    return;
  }

  for (const category of state.categories) {
    const node = categoryTemplate.content.firstElementChild.cloneNode(true);
    const isActive = state.active?.categoryId === category.id;

    node.querySelector(".category-name").textContent = category.name;
    node.querySelector(".today-total").textContent = formatDuration(todayTotals.get(category.id) || 0);
    node.querySelector(".all-total").textContent = formatDuration(getAllTimeTotal(category));

    const startStopButton = node.querySelector(".start-stop");
    startStopButton.textContent = isActive ? "Stop" : "Start";
    startStopButton.addEventListener("click", () => {
      if (isActive) {
        stopActiveSession();
      } else {
        startSession(category.id);
      }
    });

    node.querySelector(".delete").addEventListener("click", () => {
      deleteCategory(category.id);
    });

    categoryList.appendChild(node);
  }
}

function collectRecentSessions(limit = 20) {
  const records = [];

  for (const category of state.categories) {
    for (const session of category.sessions) {
      records.push({
        categoryId: category.id,
        categoryName: category.name,
        sessionId: session.id,
        ...session,
      });
    }
  }

  records.sort((a, b) => b.end - a.end);
  return records.slice(0, limit);
}

function renderSessions() {
  sessionList.innerHTML = "";
  const sessions = collectRecentSessions();

  if (sessions.length === 0) {
    sessionList.innerHTML = "<p class=\"meta\">No completed sessions yet.</p>";
    return;
  }

  for (const session of sessions) {
    const node = sessionTemplate.content.firstElementChild.cloneNode(true);
    const startDate = new Date(session.start);

    node.querySelector(".session-title").textContent = session.categoryName;
    node.querySelector(".session-meta").textContent = `${startDate.toLocaleString()} - ${formatDuration(session.durationMs)}`;
    node.querySelector(".edit-session").addEventListener("click", () => {
      editSession(session.categoryId, session.sessionId);
    });

    sessionList.appendChild(node);
  }
}

function ensureTicking() {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    if (state.active) {
      renderCategories();
    }
  }, 1000);
}

function stopTickingIfIdle() {
  if (state.active || !tickInterval) return;
  clearInterval(tickInterval);
  tickInterval = null;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!location.protocol.startsWith("http")) return;
  navigator.serviceWorker.register("service-worker.js").catch(() => {
    // Ignore registration failures; app still works without offline support.
  });
}

if (state.active) {
  ensureTicking();
}

registerServiceWorker();
render();
