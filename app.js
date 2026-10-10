import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://tbdnfhoswqyvodgwxncu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3mAdpUJMAjE3hkUM8H1sUQ_7TMWpYGH";
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const app = document.querySelector("#app");
const state = {
  user: null,
  view: "today",
  tasks: [],
  routines: [],
  completions: [],
  classes: [],
  sessions: [],
  settings: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata", attendance_target: 75 },
  search: "",
  taskFilter: "All",
  authMode: "signin",
  busy: false
};

const weekdays = [
  { n: 1, short: "Mon", full: "Monday" },
  { n: 2, short: "Tue", full: "Tuesday" },
  { n: 3, short: "Wed", full: "Wednesday" },
  { n: 4, short: "Thu", full: "Thursday" },
  { n: 5, short: "Fri", full: "Friday" },
  { n: 6, short: "Sat", full: "Saturday" },
  { n: 7, short: "Sun", full: "Sunday" }
];

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isoWeekday(date = new Date()) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

function dateLabel(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric"
  }).format(date);
}

function dayPicker(name, selected = []) {
  return `<div class="day-picker">${weekdays.map(day => `
    <label class="day-chip">
      <input type="checkbox" name="${name}" value="${day.n}" ${selected.includes(day.n) ? "checked" : ""}>
      ${day.short}
    </label>`).join("")}
  </div>`;
}

function showToast(message, error = false) {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.style.background = error ? "#963f31" : "#293a2c";
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 4200);
}

function setBusy(form, busy) {
  const button = form?.querySelector('button[type="submit"]');
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = "Please wait…";
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
}

function renderAuth(message = "") {
  app.innerHTML = `
    <section class="auth-layout">
      <div class="auth-art">
        <div class="brand">
          <span class="brand-mark">✦</span>
          <span class="brand-name">Daymark</span>
        </div>
        <div>
          <div class="eyebrow" style="color:#d4e7a1">A calmer way to stay on track</div>
          <h1>Make room for what matters.</h1>
          <p>Your routines, tasks, class attendance, and progress in one personal planner.</p>
        </div>
      </div>
      <div class="auth-form-wrap">
        <section class="auth-card">
          <div class="eyebrow">Personal planner</div>
          <h2>${state.authMode === "signup" ? "Create your account" : "Welcome back"}</h2>
          <p>Sign in from your laptop or phone to access the same saved planner.</p>
          <form id="auth-form">
            <label for="auth-email">Email</label>
            <input id="auth-email" type="email" autocomplete="email" required>
            <label for="auth-password">Password</label>
            <input id="auth-password" type="password" minlength="6"
              autocomplete="${state.authMode === "signup" ? "new-password" : "current-password"}" required>
            <button class="button full" type="submit">
              ${state.authMode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
          ${message ? `<div class="notice success" style="margin-top:12px">${escapeHtml(message)}</div>` : ""}
          <p class="auth-switch">
            ${state.authMode === "signup" ? "Already registered?" : "New to Daymark?"}
            <button class="text-button" data-action="toggle-auth">
              ${state.authMode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </section>
      </div>
    </section>`;
}

function shell() {
  const tabs = [
    ["today", "◷", "Today"],
    ["tasks", "✓", "Tasks"],
    ["routines", "↻", "Routines"],
    ["attendance", "▦", "Attendance"],
    ["progress", "↗", "Progress"]
  ];

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">✦</span>
          <span><span class="brand-name">Daymark</span><span class="brand-caption">Your personal planner</span></span>
        </div>
        <div class="nav-label">Workspace</div>
        <nav class="nav-list">
          ${tabs.map(([id, icon, label]) => `
            <button class="nav-item ${state.view === id ? "active" : ""}" data-view="${id}">
              <span class="nav-icon">${icon}</span>${label}
            </button>`).join("")}
        </nav>
        <div class="sidebar-bottom">
          <button class="nav-item ${state.view === "settings" ? "active" : ""}" data-view="settings">
            <span class="nav-icon">⚙</span>Settings
          </button>
          <div class="profile-card">
            <div class="avatar">${escapeHtml((state.user?.email || "U").slice(0, 1).toUpperCase())}</div>
            <div style="min-width:0">
              <div class="profile-email">${escapeHtml(state.user?.email)}</div>
              <span class="profile-hint">Personal workspace</span>
            </div>
          </div>
        </div>
      </aside>
      <main class="main-area">
        <header class="topbar">
          <div class="mobile-brand brand">
            <span class="brand-mark">✦</span><span class="brand-name">Daymark</span>
          </div>
          <div class="topbar-date">${escapeHtml(dateLabel())}</div>
          <div class="topbar-actions">
            <button class="button ghost small" data-view="settings">Settings</button>
            <button class="button ghost small" data-action="signout">Sign out</button>
          </div>
        </header>
        <div class="page-content" id="page-content"></div>
      </main>
    </div>`;
}

function statCard(label, value, note = "") {
  return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-footnote">${note}</div></div>`;
}

function badge(text, kind = "") {
  return `<span class="badge ${kind}">${escapeHtml(text)}</span>`;
}

function routineIsToday(routine) {
  return Array.isArray(routine.days_of_week) && routine.days_of_week.includes(isoWeekday());
}

function routineCompletion(routineId) {
  return state.completions.find(row => row.routine_id === routineId && row.completed);
}

function cutoffPassed(time) {
  if (!time) return false;
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes;
}

function missedRoutine(routine) {
  return !routineCompletion(routine.id) && routine.complete_by && cutoffPassed(routine.complete_by);
}

function routineRow(routine) {
  const completed = Boolean(routineCompletion(routine.id));
  const missed = missedRoutine(routine);
  const locked = Boolean(missed || completed);
  const days = (routine.days_of_week || []).map(number => weekdays.find(day => day.n === number)?.short).filter(Boolean).join(", ");

  return `
    <article class="routine-row ${completed ? "done" : ""} ${missed ? "locked" : ""}">
      <input class="task-check" type="checkbox" data-action="toggle-routine" data-id="${routine.id}"
        ${completed ? "checked" : ""} ${locked ? "disabled" : ""} aria-label="Complete ${escapeHtml(routine.title)}">
      <div>
        <div class="task-title">${escapeHtml(routine.title)}</div>
        <div class="task-detail">${escapeHtml(days || "No weekdays set")}${routine.complete_by ? ` · Complete by ${escapeHtml(routine.complete_by.slice(0, 5))}` : ""}</div>
        <div class="task-badges">
          ${badge(routine.priority, routine.priority === "High" ? "high" : "")}
          ${routine.category ? badge(routine.category) : ""}
          ${completed ? badge("Done", "complete") : missed ? badge("Missed", "missed") : ""}
        </div>
      </div>
      <button class="icon-button" data-action="archive-routine" data-id="${routine.id}" title="Remove routine">×</button>
    </article>`;
}

function taskRow(task) {
  const completed = task.status === "Done";
  const late = !completed && task.due_date && task.due_date < localDate();
  const timedOut = !completed && task.due_date === localDate() && task.due_time && cutoffPassed(task.due_time);
  const locked = Boolean(late || timedOut);

  return `
    <article class="task-row ${completed ? "done" : ""} ${locked ? "locked" : ""}">
      <input class="task-check" type="checkbox" data-action="toggle-task" data-id="${task.id}"
        ${completed ? "checked" : ""} ${locked ? "disabled" : ""} aria-label="Complete ${escapeHtml(task.task)}">
      <div>
        <div class="task-title">${escapeHtml(task.task)}</div>
        <div class="task-detail">${task.due_date ? `Due ${escapeHtml(task.due_date)}` : "No due date"}${task.due_time ? ` · ${escapeHtml(task.due_time.slice(0, 5))}` : ""}</div>
        <div class="task-badges">
          ${badge(task.priority, task.priority === "High" ? "high" : task.priority === "Medium" ? "medium" : "")}
          ${badge(task.status, completed ? "complete" : "")}
          ${task.category ? badge(task.category) : ""}
          ${locked ? badge("Missed", "missed") : ""}
        </div>
        ${task.notes ? `<div class="task-detail">${escapeHtml(task.notes)}</div>` : ""}
      </div>
      <div>
        <button class="icon-button" data-action="edit-task" data-id="${task.id}" title="Edit task">✎</button>
        <button class="icon-button" data-action="delete-task" data-id="${task.id}" title="Delete task">×</button>
      </div>
    </article>`;
}

function renderToday() {
  const page = document.querySelector("#page-content");
  const todaysRoutines = state.routines.filter(routineIsToday);
  const openTasks = state.tasks.filter(task => task.status !== "Done");
  const completedToday = todaysRoutines.filter(item => routineCompletion(item.id)).length;
  const doneTasks = state.tasks.filter(task => task.status === "Done").length;
  const overdue = state.tasks.filter(task => task.status !== "Done" && task.due_date && task.due_date < localDate()).length;
  const percent = todaysRoutines.length ? Math.round(completedToday / todaysRoutines.length * 100) : 0;

  page.innerHTML = `
    <section class="page-heading">
      <div><div class="eyebrow">Your day at a glance</div><h1>Today</h1><p>Small steps add up. Here’s what’s on your plate.</p></div>
      <button class="button" data-view="tasks">＋ Add a task</button>
    </section>
    <section class="stat-grid">
      ${statCard("Routines today", todaysRoutines.length, `${completedToday} completed`)}
      ${statCard("Open tasks", openTasks.length, "One-time tasks")}
      ${statCard("Tasks completed", doneTasks, "All time")}
      ${statCard("Overdue", overdue, "One-time tasks past due")}
    </section>
    <section class="dashboard-grid">
      <div class="stack">
        <section class="card">
          <div class="card-header"><div><h2>Today's routine</h2><span class="card-subtitle">${completedToday} of ${todaysRoutines.length} completed</span></div><button class="button ghost small" data-view="routines">Manage</button></div>
          <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
          <div class="progress-label"><span>Daily progress</span><strong>${percent}%</strong></div>
          <div class="routine-list">${todaysRoutines.length ? todaysRoutines.map(routineRow).join("") : `<div class="empty-state"><strong>No routines scheduled today</strong>Add routines for this weekday in Routines.</div>`}</div>
        </section>
        <section class="card">
          <div class="card-header"><h2>Coming up</h2><button class="button ghost small" data-view="tasks">View tasks</button></div>
          <div class="task-list">${openTasks.slice(0, 5).length ? openTasks.slice(0, 5).map(taskRow).join("") : `<div class="empty-state"><strong>All caught up</strong>Add a one-time task whenever you need.</div>`}</div>
        </section>
      </div>
      <div class="stack">
        <section class="card">
          <div class="card-header"><h2>Quick look</h2></div>
          <p>Your routines reset on their selected weekdays. A missed cutoff stays recorded for that day.</p>
          <button class="button secondary full" data-view="progress">See my progress</button>
        </section>
        <section class="card ai-card">
          <div class="eyebrow" style="color:#d4e7a1">AI assistant</div>
          <h2>Make a plan that fits your day</h2>
          <p>Get help choosing a realistic order for your tasks and routines.</p>
          <button class="button secondary" data-action="ai-plan">Plan my day ✦</button>
          <div id="ai-result"></div>
        </section>
      </div>
    </section>`;
}

function renderTasks() {
  const page = document.querySelector("#page-content");
  const visible = state.tasks.filter(task => {
    const text = `${task.task} ${task.category || ""} ${task.notes || ""}`.toLowerCase();
    const matchesSearch = text.includes(state.search.toLowerCase());
    const matchesFilter = state.taskFilter === "All" || task.status === state.taskFilter;
    return matchesSearch && matchesFilter;
  });

  page.innerHTML = `
    <section class="page-heading"><div><div class="eyebrow">Your flexible list</div><h1>Tasks</h1><p>Add one-time tasks whenever something new comes up.</p></div></section>
    <section class="dashboard-grid">
      <form class="card" id="task-form">
        <div class="card-header"><h2>Add a task</h2></div>
        <label for="task-name">Task</label><input id="task-name" name="task" maxlength="180" placeholder="What needs doing?" required>
        <div class="field-grid">
          <div><label for="task-priority">Priority</label><select id="task-priority" name="priority"><option>Medium</option><option>High</option><option>Low</option></select></div>
          <div><label for="task-status">Status</label><select id="task-status" name="status"><option>Not started</option><option>In progress</option><option>Done</option></select></div>
          <div><label for="task-date">Due date</label><input id="task-date" name="due_date" type="date"></div>
          <div><label for="task-time">Complete by</label><input id="task-time" name="due_time" type="time"></div>
          <div><label for="task-category">Category</label><input id="task-category" name="category" maxlength="60" placeholder="Work, school…"></div>
          <div><label for="task-estimate">Estimated minutes</label><input id="task-estimate" name="estimated_minutes" type="number" min="1" max="1440" placeholder="Optional"></div>
          <div class="field full"><label for="task-notes">Notes</label><textarea id="task-notes" name="notes" maxlength="1000"></textarea></div>
        </div>
        <button class="button full" type="submit">Add one-time task</button>
      </form>
      <section class="card">
        <div class="card-header"><h2>Task list</h2><span class="card-subtitle">${visible.length} shown</span></div>
        <div class="toolbar">
          <input id="task-search" placeholder="Search tasks…" value="${escapeHtml(state.search)}">
          <select id="task-filter">${["All", "Not started", "In progress", "Done"].map(value => `<option ${state.taskFilter === value ? "selected" : ""}>${value}</option>`).join("")}</select>
        </div>
        <div class="task-list">${visible.length ? visible.map(taskRow).join("") : `<div class="empty-state"><strong>No matching tasks</strong>Try another search or add a task.</div>`}</div>
      </section>
    </section>`;
}

function renderRoutines() {
  const page = document.querySelector("#page-content");
  const todayList = state.routines.filter(routineIsToday);
  const todayDone = todayList.filter(item => routineCompletion(item.id)).length;

  page.innerHTML = `
    <section class="page-heading"><div><div class="eyebrow">Repeat on your terms</div><h1>Routines</h1><p>Choose the weekdays for each routine. The same routine can appear on multiple days.</p></div></section>
    <section class="stat-grid">
      ${statCard("Scheduled today", todayList.length, `${todayDone} completed`)}
      ${statCard("Active routines", state.routines.length, "Across your week")}
      ${statCard("Day", weekdays.find(day => day.n === isoWeekday())?.full || "", "Your local calendar")}
      ${statCard("Timezone", escapeHtml(state.settings.timezone.split("/").pop().replaceAll("_", " ")), "Used for time cutoffs")}
    </section>
    <section class="dashboard-grid">
      <form class="card" id="routine-form">
        <div class="card-header"><h2>Create a routine</h2></div>
        <label for="routine-title">Routine name</label><input id="routine-title" name="title" maxlength="180" placeholder="Wake up, exercise…" required>
        <label>Repeat on</label>${dayPicker("days", [isoWeekday()])}
        <div class="field-grid">
          <div><label for="routine-priority">Priority</label><select id="routine-priority" name="priority"><option>Medium</option><option>High</option><option>Low</option></select></div>
          <div><label for="routine-cutoff">Complete by</label><input id="routine-cutoff" name="complete_by" type="time"></div>
          <div class="field full"><label for="routine-category">Category</label><input id="routine-category" name="category" maxlength="60" placeholder="Health, home, study…"></div>
          <div class="field full"><label for="routine-notes">Notes</label><textarea id="routine-notes" name="notes" maxlength="1000"></textarea></div>
        </div>
        <button class="button full" type="submit">Add routine</button>
      </form>
      <section class="card">
        <div class="card-header"><h2>Your weekly routines</h2><span class="card-subtitle">${state.routines.length} active</span></div>
        <div class="routine-list">${state.routines.length ? state.routines.map(routineRow).join("") : `<div class="empty-state"><strong>No routines yet</strong>Add recurring activities using the form.</div>`}</div>
      </section>
    </section>`;
}

function renderAttendance() {
  const page = document.querySelector("#page-content");
  const attended = state.sessions.filter(row => ["Present", "Late"].includes(row.status)).length;
  const counted = state.sessions.filter(row => ["Present", "Late", "Absent"].includes(row.status)).length;
  const percentage = counted ? Math.round(attended / counted * 100) : 0;
  const todaySessions = state.sessions.filter(row => row.session_date === localDate());

  page.innerHTML = `
    <section class="page-heading"><div><div class="eyebrow">Keep your classes in view</div><h1>Attendance</h1><p>Set up your classes, then record each session.</p></div></section>
    <section class="stat-grid">
      ${statCard("Attendance", `${percentage}%`, `${attended} attended of ${counted} counted sessions`)}
      ${statCard("Target", `${Number(state.settings.attendance_target)}%`, "Change it in Settings")}
      ${statCard("Classes", state.classes.length, "Active classes")}
      ${statCard("Recorded today", todaySessions.length, "Sessions logged")}
    </section>
    <section class="dashboard-grid">
      <form class="card" id="class-form">
        <div class="card-header"><h2>Add a class</h2></div>
        <label for="class-name">Class or subject</label><input id="class-name" name="name" maxlength="120" placeholder="Mathematics" required>
        <label>Weekly schedule</label>${dayPicker("class-days", [isoWeekday()])}
        <div class="field-grid">
          <div><label for="class-start">Starts</label><input id="class-start" name="start_time" type="time"></div>
          <div><label for="class-end">Ends</label><input id="class-end" name="end_time" type="time"></div>
        </div>
        <button class="button full" type="submit">Add class</button>
      </form>
      <section class="card">
        <div class="card-header"><h2>Classes</h2><span class="card-subtitle">Log the session status</span></div>
        ${state.classes.length ? state.classes.map(item => {
          const session = todaySessions.find(row => row.class_id === item.id);
          return `<div class="attendance-row">
            <div><strong>${escapeHtml(item.name)}</strong><div class="task-detail">${(item.days_of_week || []).map(n => weekdays.find(d => d.n === n)?.short).filter(Boolean).join(", ") || "Schedule not set"} ${item.start_time ? `· ${escapeHtml(item.start_time.slice(0, 5))}` : ""}</div>
            ${session ? `<div class="task-badges">${badge(session.status, session.status === "Present" ? "present" : session.status === "Late" ? "late" : "")}</div>` : ""}</div>
            <div class="attendance-actions">
              ${["Present", "Absent", "Late", "Excused", "Cancelled"].map(status => `<button class="button ${status === "Present" ? "" : "ghost"} small" data-action="attendance" data-class="${item.id}" data-status="${status}">${status}</button>`).join("")}
              <button class="icon-button" data-action="delete-class" data-id="${item.id}" title="Remove class">×</button>
            </div>
          </div>`;
        }).join("") : `<div class="empty-state"><strong>No classes added</strong>Add a class and its weekly schedule.</div>`}
      </section>
    </section>`;
}

async function renderProgress() {
  const page = document.querySelector("#page-content");
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const from = localDate(start);
  const to = localDate(end);

  const [historyResult, attendanceResult] = await Promise.all([
    db.from("daily_routine_completions").select("task_date, completed")
      .gte("task_date", from).lte("task_date", to),
    db.from("attendance_sessions").select("status, session_date")
      .gte("session_date", from).lte("session_date", to)
  ]);

  if (historyResult.error || attendanceResult.error) {
    showToast(historyResult.error?.message || attendanceResult.error?.message, true);
    return;
  }

  const history = historyResult.data || [];
  const sessions = attendanceResult.data || [];
  const completed = history.filter(row => row.completed).length;
  const present = sessions.filter(row => ["Present", "Late"].includes(row.status)).length;
  const counted = sessions.filter(row => ["Present", "Late", "Absent"].includes(row.status)).length;
  const attendancePercent = counted ? Math.round(present / counted * 100) : 0;
  const bars = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDate(date);
    const number = history.filter(row => row.task_date === key && row.completed).length;
    const height = Math.max(4, Math.min(100, number * 16));
    return `<div class="chart-column"><div class="chart-bar" style="height:${height}%"></div>${weekdays[(date.getDay() + 6) % 7].short}</div>`;
  }).join("");

  page.innerHTML = `
    <section class="page-heading"><div><div class="eyebrow">Look back, keep growing</div><h1>Progress</h1><p>Your recent routine and class records, saved by date.</p></div></section>
    <section class="stat-grid">
      ${statCard("Routine check-ins", completed, "Completed in the last 7 days")}
      ${statCard("Class attendance", `${attendancePercent}%`, `${present} attended · ${counted} counted sessions`)}
      ${statCard("Tasks completed", state.tasks.filter(task => task.status === "Done").length, "One-time tasks")}
      ${statCard("Active routines", state.routines.length, "Across your schedule")}
    </section>
    <section class="dashboard-grid">
      <section class="card">
        <div class="card-header"><div><h2>Routine activity</h2><span class="card-subtitle">Completed check-ins by day</span></div></div>
        <div class="chart-bars">${bars}</div>
      </section>
      <section class="card">
        <div class="card-header"><h2>Attendance target</h2></div>
        <div class="stat-value">${attendancePercent}%</div>
        <p>${attendancePercent >= Number(state.settings.attendance_target) ? "You’re currently meeting your target." : "You’re below your current target. Keep logging sessions to see your trend."}</p>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, attendancePercent)}%"></div></div>
        <div class="progress-label"><span>Current</span><strong>Target ${Number(state.settings.attendance_target)}%</strong></div>
      </section>
      <section class="card ai-card">
        <div class="eyebrow" style="color:#d4e7a1">AI assistant</div>
        <h2>Reflect on your week</h2>
        <p>Ask for a short summary of your progress and a few practical suggestions.</p>
        <button class="button secondary" data-action="ai-review">Create weekly reflection ✦</button>
        <div id="ai-result"></div>
      </section>
    </section>`;
}

function renderSettings() {
  const page = document.querySelector("#page-content");
  page.innerHTML = `
    <section class="page-heading"><div><div class="eyebrow">Make it yours</div><h1>Settings</h1><p>Set your timezone and attendance goal.</p></div></section>
    <section class="card" style="max-width:600px">
      <form id="settings-form">
        <label for="settings-timezone">Timezone</label>
        <input id="settings-timezone" name="timezone" value="${escapeHtml(state.settings.timezone)}" placeholder="Asia/Kolkata" required>
        <div class="card-subtitle">Time cutoffs use this timezone. Example: Asia/Kolkata</div>
        <label for="attendance-target">Attendance target (%)</label>
        <input id="attendance-target" name="attendance_target" type="number" min="0" max="100" step="1" value="${Number(state.settings.attendance_target)}" required>
        <button class="button full" type="submit">Save settings</button>
      </form>
    </section>`;
}

async function refreshData() {
  if (!state.user) return;
  const [tasks, routines, completions, classes, sessions, settings] = await Promise.all([
    db.from("tasks").select("*").order("created_at", { ascending: false }),
    db.from("daily_routines").select("*").eq("active", true).order("sort_order").order("created_at"),
    db.from("daily_routine_completions").select("*").eq("task_date", localDate()),
    db.from("attendance_classes").select("*").eq("active", true).order("name"),
    db.from("attendance_sessions").select("*").eq("session_date", localDate()),
    db.from("user_settings").select("*").maybeSingle()
  ]);

  const error = tasks.error || routines.error || completions.error || classes.error || sessions.error || settings.error;
  if (error) {
    showToast(error.message, true);
    return;
  }

  state.tasks = tasks.data || [];
  state.routines = routines.data || [];
  state.completions = completions.data || [];
  state.classes = classes.data || [];
  state.sessions = sessions.data || [];
  if (settings.data) state.settings = settings.data;
  render();
}

function render() {
  if (!state.user) return renderAuth();
  shell();
  if (state.view === "today") renderToday();
  if (state.view === "tasks") renderTasks();
  if (state.view === "routines") renderRoutines();
  if (state.view === "attendance") renderAttendance();
  if (state.view === "progress") renderProgress();
  if (state.view === "settings") renderSettings();
}

function checkedDays(form, name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(input => Number(input.value));
}

async function submitForm(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.id === "auth-form") {
    event.preventDefault();
    setBusy(form, true);
    const email = form.querySelector("#auth-email").value.trim();
    const password = form.querySelector("#auth-password").value;
    const response = state.authMode === "signup"
      ? await db.auth.signUp({ email, password })
      : await db.auth.signInWithPassword({ email, password });
    setBusy(form, false);

    if (response.error) return showToast(response.error.message, true);
    if (state.authMode === "signup" && !response.data.session) {
      return renderAuth("Check your email to confirm your account, then sign in here.");
    }
    state.user = response.data.user;
    await refreshData();
    return;
  }

  if (!state.user) return;

  if (form.id === "task-form") {
    event.preventDefault();
    setBusy(form, true);
    const values = new FormData(form);
    const row = {
      task: String(values.get("task")).trim(),
      priority: values.get("priority"),
      status: values.get("status"),
      due_date: values.get("due_date") || null,
      due_time: values.get("due_time") || null,
      timezone: state.settings.timezone,
      category: String(values.get("category") || "").trim() || null,
      notes: String(values.get("notes") || "").trim() || null,
      estimated_minutes: values.get("estimated_minutes") ? Number(values.get("estimated_minutes")) : null
    };
    const response = await db.from("tasks").insert(row);
    if (response.error) { setBusy(form, false); return showToast(response.error.message, true); }
    await refreshData();
    return showToast("Task added.");
  }

  if (form.id === "routine-form") {
    event.preventDefault();
    const days = checkedDays(form, "days");
    if (!days.length) return showToast("Choose at least one weekday.", true);
    setBusy(form, true);
    const values = new FormData(form);
    const response = await db.from("daily_routines").insert({
      title: String(values.get("title")).trim(),
      days_of_week: days,
      complete_by: values.get("complete_by") || null,
      timezone: state.settings.timezone,
      priority: values.get("priority"),
      category: String(values.get("category") || "").trim() || null,
      notes: String(values.get("notes") || "").trim() || null
    });
    if (response.error) { setBusy(form, false); return showToast(response.error.message, true); }
    await refreshData();
    return showToast("Routine added to your week.");
  }

  if (form.id === "class-form") {
    event.preventDefault();
    const days = checkedDays(form, "class-days");
    if (!days.length) return showToast("Choose at least one class weekday.", true);
    setBusy(form, true);
    const values = new FormData(form);
    const response = await db.from("attendance_classes").insert({
      name: String(values.get("name")).trim(),
      days_of_week: days,
      start_time: values.get("start_time") || null,
      end_time: values.get("end_time") || null,
      timezone: state.settings.timezone
    });
    if (response.error) { setBusy(form, false); return showToast(response.error.message, true); }
    await refreshData();
    return showToast("Class added.");
  }

  if (form.id === "settings-form") {
    event.preventDefault();
    setBusy(form, true);
    const values = new FormData(form);
    const response = await db.from("user_settings").upsert({
      user_id: state.user.id,
      timezone: String(values.get("timezone")).trim(),
      attendance_target: Number(values.get("attendance_target"))
    });
    if (response.error) { setBusy(form, false); return showToast(response.error.message, true); }
    await refreshData();
    return showToast("Settings saved.");
  }
}

async function handleClick(event) {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    state.view = viewButton.dataset.view;
    state.search = "";
    render();
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  if (action === "toggle-auth") {
    state.authMode = state.authMode === "signup" ? "signin" : "signup";
    renderAuth();
    return;
  }

  if (action === "signout") {
    await db.auth.signOut();
    state.user = null;
    state.tasks = [];
    state.routines = [];
    state.completions = [];
    state.classes = [];
    return renderAuth();
  }

  if (action === "toggle-routine") {
    const routine = state.routines.find(item => String(item.id) === button.dataset.id);
    if (!routine) return;
    if (missedRoutine(routine)) return showToast("That routine’s cutoff has passed.", true);
    const completed = button.checked;
    const response = await db.from("daily_routine_completions").upsert({
      routine_id: routine.id,
      user_id: state.user.id,
      task_date: localDate(),
      completed,
      completed_at: completed ? new Date().toISOString() : null
    }, { onConflict: "routine_id,task_date" });
    if (response.error) return showToast(response.error.message, true);
    await refreshData();
    return;
  }

  if (action === "toggle-task") {
    const task = state.tasks.find(item => String(item.id) === button.dataset.id);
    if (!task) return;
    if (task.status !== "Done" && (
      (task.due_date && task.due_date < localDate()) ||
      (task.due_date === localDate() && task.due_time && cutoffPassed(task.due_time))
    )) return showToast("This task’s deadline has passed.", true);
    const response = await db.from("tasks").update({
      status: task.status === "Done" ? "Not started" : "Done"
    }).eq("id", task.id);
    if (response.error) return showToast(response.error.message, true);
    await refreshData();
    return;
  }

  if (action === "edit-task") {
    const task = state.tasks.find(item => String(item.id) === button.dataset.id);
    if (!task) return;
    const title = prompt("Edit task name:", task.task);
    if (title === null || !title.trim()) return;
    const response = await db.from("tasks").update({ task: title.trim() }).eq("id", task.id);
    if (response.error) return showToast(response.error.message, true);
    await refreshData();
    return;
  }

  if (action === "delete-task") {
    const task = state.tasks.find(item => String(item.id) === button.dataset.id);
    if (!task || !confirm(`Delete "${task.task}"?`)) return;
    const response = await db.from("tasks").delete().eq("id", task.id);
    if (response.error) return showToast(response.error.message, true);
    await refreshData();
    return showToast("Task deleted.");
  }

  if (action === "archive-routine") {
    const routine = state.routines.find(item => String(item.id) === button.dataset.id);
    if (!routine || !confirm(`Remove "${routine.title}" from your routine?`)) return;
    const response = await db.from("daily_routines").update({ active: false }).eq("id", routine.id);
    if (response.error) return showToast(response.error.message, true);
    await refreshData();
    return showToast("Routine removed.");
  }

  if (action === "attendance") {
    const response = await db.from("attendance_sessions").upsert({
      class_id: Number(button.dataset.class),
      user_id: state.user.id,
      session_date: localDate(),
      status: button.dataset.status
    }, { onConflict: "class_id,session_date" });
    if (response.error) return showToast(response.error.message, true);
    await refreshData();
    return showToast(`Marked ${button.dataset.status.toLowerCase()}.`);
  }

  if (action === "delete-class") {
    const item = state.classes.find(row => String(row.id) === button.dataset.id);
    if (!item || !confirm(`Remove ${item.name} and its attendance history?`)) return;
    const response = await db.from("attendance_classes").delete().eq("id", item.id);
    if (response.error) return showToast(response.error.message, true);
    await refreshData();
    return showToast("Class removed.");
  }

  if (action === "ai-plan" || action === "ai-review") {
    const target = document.querySelector("#ai-result");
    if (!target) return;
    target.innerHTML = `<div class="ai-result">Connecting to your private AI assistant…</div>`;
    const response = await db.functions.invoke("task-assistant", {
      body: { action: action === "ai-plan" ? "plan" : "review" }
    });
    if (response.error) {
      target.innerHTML = `<div class="ai-result">AI setup isn’t finished yet. Your tasks are safe; we’ll connect the secure assistant in a later step.</div>`;
      return;
    }
    target.innerHTML = `<div class="ai-result">${escapeHtml(response.data?.answer || "No suggestion returned.")}</div>`;
  }
}

function handleInput(event) {
  if (event.target.id === "task-search") {
    const position = event.target.selectionStart;
    state.search = event.target.value;
    renderTasks();
    const search = document.querySelector("#task-search");
    search?.focus();
    search?.setSelectionRange(position, position);
  }

  if (event.target.id === "task-filter") {
    state.taskFilter = event.target.value;
    renderTasks();
  }
}

app.addEventListener("submit", submitForm);
app.addEventListener("click", handleClick);
app.addEventListener("input", handleInput);
app.addEventListener("change", handleInput);

async function start() {
  if (SUPABASE_PUBLISHABLE_KEY.includes("PASTE_YOUR_")) {
    app.innerHTML = `<section class="auth-form-wrap"><div class="auth-card"><h2>Setup needed</h2><p>Open app.js in GitHub and replace the publishable key placeholder with your full Supabase publishable key.</p></div></section>`;
    return;
  }

  const { data: { session } } = await db.auth.getSession();
  state.user = session?.user || null;

  if (state.user) await refreshData();
  else renderAuth();

  db.auth.onAuthStateChange((_event, sessionNow) => {
    state.user = sessionNow?.user || null;
    if (state.user) setTimeout(refreshData, 0);
    else renderAuth();
  });
}

start();
