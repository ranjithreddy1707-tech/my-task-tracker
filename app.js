import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://tbdnfhoswqyvodgwxncu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE";
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
  settings: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    attendance_target: 75
  },
  search: "",
  taskFilter: "All",
  authMode: "signin"
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

const countedAttendance = ["Present", "Late", "Absent"];
const attendedAttendance = ["Present", "Late"];

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isoWeekday(date = new Date()) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

function dayName(number) {
  return weekdays.find(day => day.n === Number(number))?.short || "";
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

function badge(text, type = "") {
  return `<span class="badge ${type}">${esc(text)}</span>`;
}

function statCard(label, value, note = "") {
  return `<div class="stat-card">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-footnote">${note}</div>
  </div>`;
}

function picker(name, selected = []) {
  return `<div class="day-picker">${weekdays.map(day => `
    <label class="day-chip">
      <input type="checkbox" name="${name}" value="${day.n}" ${selected.includes(day.n) ? "checked" : ""}>
      ${day.short}
    </label>`).join("")}</div>`;
}

function selectedDays(form, name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)]
    .map(input => Number(input.value));
}

function cutoffPassed(time) {
  if (!time) return false;
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes;
}

function scheduledToday(routine) {
  return Array.isArray(routine.days_of_week) &&
    routine.days_of_week.includes(isoWeekday());
}

function completionFor(routineId) {
  return state.completions.find(row =>
    row.routine_id === routineId && row.completed
  );
}

function missedRoutine(routine) {
  return !completionFor(routine.id) &&
    routine.complete_by &&
    cutoffPassed(routine.complete_by);
}

function taskIsLocked(task) {
  if (task.status === "Done") return false;
  if (task.due_date && task.due_date < localDate()) return true;
  return task.due_date === localDate() &&
    task.due_time &&
    cutoffPassed(task.due_time);
}

function routineRow(routine) {
  const isScheduledToday = scheduledToday(routine);
  const completed = Boolean(completionFor(routine.id));
  const missed = isScheduledToday && missedRoutine(routine);
  const disabled = !isScheduledToday || missed;
  const days = (routine.days_of_week || []).map(dayName).filter(Boolean).join(", ");

  return `<article class="routine-row ${completed ? "done" : ""} ${missed ? "locked" : ""}">
    <input class="task-check" type="checkbox"
      data-action="toggle-routine" data-id="${routine.id}"
      ${completed ? "checked" : ""}
      ${disabled ? "disabled" : ""}
      aria-label="Complete ${esc(routine.title)}">
    <div>
      <div class="task-title">${esc(routine.title)}</div>
      <div class="task-detail">
        ${isScheduledToday ? "Today" : `Scheduled: ${esc(days || "No days selected")}`}
        ${routine.complete_by ? ` · Complete by ${esc(routine.complete_by.slice(0, 5))}` : ""}
      </div>
      <div class="task-badges">
        ${badge(routine.priority, routine.priority === "High" ? "high" : "")}
        ${routine.category ? badge(routine.category) : ""}
        ${completed ? badge("Done", "complete") : ""}
        ${missed ? badge("Missed", "missed") : ""}
      </div>
    </div>
    <button class="icon-button" data-action="archive-routine" data-id="${routine.id}" title="Remove routine">×</button>
  </article>`;
}

function taskRow(task) {
  const completed = task.status === "Done";
  const locked = taskIsLocked(task);
  const late = !completed && locked;

  return `<article class="task-row ${completed ? "done" : ""} ${late ? "locked" : ""}">
    <input class="task-check" type="checkbox" data-action="toggle-task"
      data-id="${task.id}" ${completed ? "checked" : ""}
      ${locked ? "disabled" : ""}
      aria-label="Complete ${esc(task.task)}">
    <div>
      <div class="task-title">${esc(task.task)}</div>
      <div class="task-detail">
        ${task.due_date ? `Due ${esc(task.due_date)}` : "No due date"}
        ${task.due_time ? ` · ${esc(task.due_time.slice(0, 5))}` : ""}
      </div>
      <div class="task-badges">
        ${badge(task.priority, task.priority === "High" ? "high" : task.priority === "Medium" ? "medium" : "")}
        ${badge(task.status, completed ? "complete" : "")}
        ${task.category ? badge(task.category) : ""}
        ${late ? badge("Missed", "missed") : ""}
      </div>
      ${task.notes ? `<div class="task-detail">${esc(task.notes)}</div>` : ""}
    </div>
    <div>
      <button class="icon-button" data-action="edit-task" data-id="${task.id}" title="Edit task">✎</button>
      <button class="icon-button" data-action="delete-task" data-id="${task.id}" title="Delete task">×</button>
    </div>
  </article>`;
}

function renderAuth(message = "") {
  app.innerHTML = `<section class="auth-layout">
    <div class="auth-art">
      <div class="brand"><span class="brand-mark">✦</span><span class="brand-name">Daymark</span></div>
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
        <p>Sign in on your laptop or phone to access the same saved planner.</p>
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
        ${message ? `<div class="notice success" style="margin-top:12px">${esc(message)}</div>` : ""}
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

function renderShell() {
  const tabs = [
    ["today", "◷", "Today"],
    ["tasks", "✓", "Tasks"],
    ["routines", "↻", "Routines"],
    ["attendance", "▦", "Attendance"],
    ["progress", "↗", "Progress"]
  ];

  app.innerHTML = `<div class="app-shell">
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
          <div class="avatar">${esc((state.user?.email || "U").slice(0, 1).toUpperCase())}</div>
          <div style="min-width:0">
            <div class="profile-email">${esc(state.user?.email)}</div>
            <span class="profile-hint">Personal workspace</span>
          </div>
        </div>
      </div>
    </aside>
    <main class="main-area">
      <header class="topbar">
        <div class="mobile-brand brand"><span class="brand-mark">✦</span><span class="brand-name">Daymark</span></div>
        <div class="topbar-date">${esc(new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()))}</div>
        <div class="topbar-actions">
          <button class="button ghost small" data-view="settings">Settings</button>
          <button class="button ghost small" data-action="signout">Sign out</button>
        </div>
      </header>
      <div class="page-content" id="page-content"></div>
    </main>
  </div>`;
}

function renderToday() {
  const page = document.querySelector("#page-content");
  const todaysRoutines = state.routines.filter(scheduledToday);
  const completedRoutines = todaysRoutines.filter(item => completionFor(item.id)).length;
  const openTasks = state.tasks.filter(task => task.status !== "Done");
  const completedTasks = state.tasks.filter(task => task.status === "Done").length;
  const overdue = state.tasks.filter(task => task.status !== "Done" && task.due_date && task.due_date < localDate()).length;
  const percent = todaysRoutines.length ? Math.round(completedRoutines / todaysRoutines.length * 100) : 0;

  page.innerHTML = `<section class="page-heading">
    <div><div class="eyebrow">Your day at a glance</div><h1>Today</h1><p>Small steps add up. Here’s what’s on your plate.</p></div>
    <button class="button" data-view="tasks">＋ Add a task</button>
  </section>
  <section class="stat-grid">
    ${statCard("Routines today", todaysRoutines.length, `${completedRoutines} completed`)}
    ${statCard("Open tasks", openTasks.length, "One-time tasks")}
    ${statCard("Tasks completed", completedTasks, "All time")}
    ${statCard("Overdue", overdue, "One-time tasks past due")}
  </section>
  <section class="dashboard-grid">
    <div class="stack">
      <section class="card">
        <div class="card-header">
          <div><h2>Today's routine</h2><span class="card-subtitle">${completedRoutines} of ${todaysRoutines.length} completed</span></div>
          <button class="button ghost small" data-view="routines">Manage</button>
        </div>
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
        <p>Your routines return on their selected weekdays. A missed cutoff stays recorded for that day.</p>
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

  page.innerHTML = `<section class="page-heading">
    <div><div class="eyebrow">Your flexible list</div><h1>Tasks</h1><p>Add one-time tasks whenever something new comes up.</p></div>
  </section>
  <section class="dashboard-grid">
    <form class="card" id="task-form">
      <div class="card-header"><h2>Add a task</h2></div>
      <label for="task-name">Task</label><input id="task-name" name="task" maxlength="180" placeholder="What needs doing?" required>
      <div class="field-grid">
        <div><label for="task-priority">Priority</label><select id="task-priority" name="priority"><option>Medium</option><option>High</option><option>Low</option></select></div>
        <div><label for="task-status">Status</label><select id="task-status" name="status"><option>Not started</option><option>In progress</option></select></div>
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
        <input id="task-search" placeholder="Search tasks…" value="${esc(state.search)}">
        <select id="task-filter">${["All", "Not started", "In progress", "Done"].map(value => `<option ${state.taskFilter === value ? "selected" : ""}>${value}</option>`).join("")}</select>
      </div>
      <div class="task-list">${visible.length ? visible.map(taskRow).join("") : `<div class="empty-state"><strong>No matching tasks</strong>Try another search or add a task.</div>`}</div>
    </section>
  </section>`;
}

function renderRoutines() {
  const page = document.querySelector("#page-content");
  const todays = state.routines.filter(scheduledToday);
  const doneToday = todays.filter(item => completionFor(item.id)).length;

  page.innerHTML = `<section class="page-heading">
    <div><div class="eyebrow">Repeat on your terms</div><h1>Routines</h1><p>Choose one or more weekdays for each routine.</p></div>
  </section>
  <section class="stat-grid">
    ${statCard("Scheduled today", todays.length, `${doneToday} completed`)}
    ${statCard("Active routines", state.routines.length, "Across your week")}
    ${statCard("Today", esc(weekdays.find(day => day.n === isoWeekday())?.full || ""), "Your local calendar")}
    ${statCard("Timezone", esc(state.settings.timezone.split("/").pop().replaceAll("_", " ")), "Used for cutoffs")}
  </section>
  <section class="dashboard-grid">
    <form class="card" id="routine-form">
      <div class="card-header"><h2>Create a routine</h2></div>
      <label for="routine-title">Routine name</label><input id="routine-title" name="title" maxlength="180" placeholder="Wake up, exercise…" required>
      <label>Repeat on</label>${picker("days", [isoWeekday()])}
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
  const counted = state.sessions.filter(row => countedAttendance.includes(row.status)).length;
  const attended = state.sessions.filter(row => attendedAttendance.includes(row.status)).length;
  const percentage = counted ? Math.round(attended / counted * 100) : 0;
  const todaySessions = state.sessions.filter(row => row.session_date === localDate());

  page.innerHTML = `<section class="page-heading">
    <div><div class="eyebrow">Keep your classes in view</div><h1>Attendance</h1><p>Each subject has its own percentage. Cancelled and excused sessions are excluded.</p></div>
  </section>
  <section class="stat-grid">
    ${statCard("Overall attendance", counted ? `${percentage}%` : "—", `${attended} attended · ${counted} counted sessions`)}
    ${statCard("Target", `${Number(state.settings.attendance_target)}%`, "Change it in Settings")}
    ${statCard("Subjects", state.classes.length, "Active classes")}
    ${statCard("Recorded today", todaySessions.length, "Sessions logged")}
  </section>
  <section class="dashboard-grid">
    <form class="card" id="class-form">
      <div class="card-header"><h2>Add a class</h2></div>
      <label for="class-name">Class or subject</label><input id="class-name" name="name" maxlength="120" placeholder="Mathematics" required>
      <label>Weekly schedule</label>${picker("class-days", [isoWeekday()])}
      <div class="field-grid">
        <div><label for="class-start">Starts</label><input id="class-start" name="start_time" type="time"></div>
        <div><label for="class-end">Ends</label><input id="class-end" name="end_time" type="time"></div>
      </div>
      <button class="button full" type="submit">Add class</button>
    </form>
    <section class="card">
      <div class="card-header"><h2>Subjects</h2><span class="card-subtitle">Record today’s result for a subject</span></div>
      ${state.classes.length ? state.classes.map(item => {
        const subjectSessions = state.sessions.filter(row =>
          row.class_id === item.id && countedAttendance.includes(row.status)
        );
        const subjectAttended = subjectSessions.filter(row =>
          attendedAttendance.includes(row.status)
        ).length;
        const subjectPercent = subjectSessions.length
          ? Math.round(subjectAttended / subjectSessions.length * 100)
          : null;
        const todaySession = todaySessions.find(row => row.class_id === item.id);
        const days = (item.days_of_week || []).map(dayName).filter(Boolean).join(", ");

        return `<div class="attendance-row">
          <div>
            <strong>${esc(item.name)}</strong>
            <div class="task-detail">${esc(days || "Schedule not set")}${item.start_time ? ` · ${esc(item.start_time.slice(0, 5))}` : ""}</div>
            <div class="task-badges">
              ${badge(subjectPercent === null ? "No sessions recorded" : `${subjectPercent}% attendance`, subjectPercent !== null && subjectPercent >= Number(state.settings.attendance_target) ? "complete" : "")}
              ${subjectPercent === null ? "" : badge(`${subjectAttended} attended · ${subjectSessions.length} counted`)}
              ${todaySession ? badge(`Today: ${todaySession.status}`, todaySession.status === "Present" ? "present" : "") : ""}
            </div>
          </div>
          <div class="attendance-actions">
            ${["Present", "Absent", "Late", "Excused", "Cancelled"].map(status => `
              <button class="button ${status === "Present" ? "" : "ghost"} small"
                data-action="attendance" data-class="${item.id}" data-status="${status}">
                ${status}
              </button>`).join("")}
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

  const [historyResult, weekSessionsResult] = await Promise.all([
    db.from("daily_routine_completions").select("task_date, completed")
      .gte("task_date", localDate(start)).lte("task_date", localDate(end)),
    db.from("attendance_sessions").select("status, session_date")
      .gte("session_date", localDate(start)).lte("session_date", localDate(end))
  ]);

  if (historyResult.error || weekSessionsResult.error) {
    showToast(historyResult.error?.message || weekSessionsResult.error?.message, true);
    return;
  }

  const history = historyResult.data || [];
  const sessions = weekSessionsResult.data || [];
  const routineDone = history.filter(row => row.completed).length;
  const counted = sessions.filter(row => countedAttendance.includes(row.status)).length;
  const attended = sessions.filter(row => attendedAttendance.includes(row.status)).length;
  const percent = counted ? Math.round(attended / counted * 100) : 0;

  const bars = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDate(date);
    const number = history.filter(row => row.task_date === key && row.completed).length;
    const height = Math.max(4, Math.min(100, number * 16));
    return `<div class="chart-column"><div class="chart-bar" style="height:${height}%"></div>${weekdays[(date.getDay() + 6) % 7].short}</div>`;
  }).join("");

  page.innerHTML = `<section class="page-heading">
    <div><div class="eyebrow">Look back, keep growing</div><h1>Progress</h1><p>Your recent routine and class records, saved by date.</p></div>
  </section>
  <section class="stat-grid">
    ${statCard("Routine check-ins", routineDone, "Completed in the last 7 days")}
    ${statCard("Class attendance", counted ? `${percent}%` : "—", `${attended} attended · ${counted} counted sessions this week`)}
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
      <div class="stat-value">${counted ? `${percent}%` : "—"}</div>
      <p>${counted ? (percent >= Number(state.settings.attendance_target) ? "You’re currently meeting your target." : "You’re below your current target.") : "Record class sessions to see your progress."}</p>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, percent)}%"></div></div>
      <div class="progress-label"><span>Current</span><strong>Target ${Number(state.settings.attendance_target)}%</strong></div>
    </section>
    <section class="card ai-card">
      <div class="eyebrow" style="color:#d4e7a1">AI assistant</div>
      <h2>Reflect on your week</h2>
      <p>Ask for a short summary of your progress and practical suggestions.</p>
      <button class="button secondary" data-action="ai-review">Create weekly reflection ✦</button>
      <div id="ai-result"></div>
    </section>
  </section>`;
}

function renderSettings() {
  const page = document.querySelector("#page-content");
  page.innerHTML = `<section class="page-heading">
    <div><div class="eyebrow">Make it yours</div><h1>Settings</h1><p>Set your timezone and attendance goal.</p></div>
  </section>
  <section class="card" style="max-width:600px">
    <form id="settings-form">
      <label for="settings-timezone">Timezone</label>
      <input id="settings-timezone" name="timezone" value="${esc(state.settings.timezone)}" required>
      <div class="card-subtitle">Example: Asia/Kolkata</div>
      <label for="attendance-target">Attendance target (%)</label>
      <input id="attendance-target" name="attendance_target" type="number" min="0" max="100" step="1" value="${Number(state.settings.attendance_target)}" required>
      <button class="button full" type="submit">Save settings</button>
    </form>
  </section>`;
}

async function refreshData() {
  if (!state.user) return;

  const results = await Promise.all([
    db.from("tasks").select("*").order("created_at", { ascending: false }),
    db.from("daily_routines").select("*").eq("active", true).order("sort_order").order("created_at"),
    db.from("daily_routine_completions").select("*").eq("task_date", localDate()),
    db.from("attendance_classes").select("*").eq("active", true).order("name"),
    db.from("attendance_sessions").select("*"),
    db.from("user_settings").select("*").maybeSingle()
  ]);

  const error = results.find(result => result.error)?.error;
  if (error) return showToast(error.message, true);

  state.tasks = results[0].data || [];
  state.routines = results[1].data || [];
  state.completions = results[2].data || [];
  state.classes = results[3].data || [];
  state.sessions = results[4].data || [];
  if (results[5].data) state.settings = results[5].data;

  render();
}

function render() {
  if (!state.user) return renderAuth();
  renderShell();

  if (state.view === "today") renderToday();
  if (state.view === "tasks") renderTasks();
  if (state.view === "routines") renderRoutines();
  if (state.view === "attendance") renderAttendance();
  if (state.view === "progress") renderProgress();
  if (state.view === "settings") renderSettings();
}

async function submitForm(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.id === "auth-form") {
    event.preventDefault();
    const email = form.querySelector("#auth-email").value.trim();
    const password = form.querySelector("#auth-password").value;
    const response = state.authMode === "signup"
      ? await db.auth.signUp({ email, password })
      : await db.auth.signInWithPassword({ email, password });

    if (response.error) return showToast(response.error.message, true);
    if (state.authMode === "signup" && !response.data.session) {
      return renderAuth("Check your email to confirm your account, then sign in here.");
    }
    state.user = response.data.user;
    return refreshData();
  }

  if (!state.user) return;

  if (form.id === "task-form") {
    event.preventDefault();
    const values = new FormData(form);
    const result = await db.from("tasks").insert({
      task: String(values.get("task")).trim(),
      priority: values.get("priority"),
      status: values.get("status"),
      due_date: values.get("due_date") || null,
      due_time: values.get("due_time") || null,
      timezone: state.settings.timezone,
      category: String(values.get("category") || "").trim() || null,
      notes: String(values.get("notes") || "").trim() || null,
      estimated_minutes: values.get("estimated_minutes") ? Number(values.get("estimated_minutes")) : null
    });
    if (result.error) return showToast(result.error.message, true);
    await refreshData();
    return showToast("Task added.");
  }

  if (form.id === "routine-form") {
    event.preventDefault();
    const days = selectedDays(form, "days");
    if (!days.length) return showToast("Choose at least one weekday.", true);
    const values = new FormData(form);
    const result = await db.from("daily_routines").insert({
      title: String(values.get("title")).trim(),
      days_of_week: days,
      complete_by: values.get("complete_by") || null,
      timezone: state.settings.timezone,
      priority: values.get("priority"),
      category: String(values.get("category") || "").trim() || null,
      notes: String(values.get("notes") || "").trim() || null
    });
    if (result.error) return showToast(result.error.message, true);
    await refreshData();
    return showToast("Routine added.");
  }

  if (form.id === "class-form") {
    event.preventDefault();
    const days = selectedDays(form, "class-days");
    if (!days.length) return showToast("Choose at least one class weekday.", true);
    const values = new FormData(form);
    const result = await db.from("attendance_classes").insert({
      name: String(values.get("name")).trim(),
      days_of_week: days,
      start_time: values.get("start_time") || null,
      end_time: values.get("end_time") || null,
      timezone: state.settings.timezone
    });
    if (result.error) return showToast(result.error.message, true);
    await refreshData();
    return showToast("Class added.");
  }

  if (form.id === "settings-form") {
    event.preventDefault();
    const values = new FormData(form);
    const result = await db.from("user_settings").upsert({
      user_id: state.user.id,
      timezone: String(values.get("timezone")).trim(),
      attendance_target: Number(values.get("attendance_target"))
    });
    if (result.error) return showToast(result.error.message, true);
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
    return renderAuth();
  }

  if (action === "toggle-routine") {
    const routine = state.routines.find(item => String(item.id) === button.dataset.id);
    if (!routine || !scheduledToday(routine)) return;
    if (missedRoutine(routine)) return showToast("That routine’s cutoff has passed.", true);

    const result = await db.from("daily_routine_completions").upsert({
      routine_id: routine.id,
      user_id: state.user.id,
      task_date: localDate(),
      completed: button.checked,
      completed_at: button.checked ? new Date().toISOString() : null
    }, { onConflict: "routine_id,task_date" });

    if (result.error) return showToast(result.error.message, true);
    return refreshData();
  }

  if (action === "toggle-task") {
    const task = state.tasks.find(item => String(item.id) === button.dataset.id);
    if (!task) return;
    if (task.status !== "Done" && taskIsLocked(task)) {
      return showToast("This task’s deadline has passed.", true);
    }
    const result = await db.from("tasks").update({
      status: task.status === "Done" ? "Not started" : "Done"
    }).eq("id", task.id);
    if (result.error) return showToast(result.error.message, true);
    return refreshData();
  }

  if (action === "edit-task") {
    const task = state.tasks.find(item => String(item.id) === button.dataset.id);
    if (!task) return;
    const name = prompt("Edit task name:", task.task);
    if (name === null || !name.trim()) return;
    const result = await db.from("tasks").update({ task: name.trim() }).eq("id", task.id);
    if (result.error) return showToast(result.error.message, true);
    return refreshData();
  }

  if (action === "delete-task") {
    const task = state.tasks.find(item => String(item.id) === button.dataset.id);
    if (!task || !confirm(`Delete "${task.task}"?`)) return;
    const result = await db.from("tasks").delete().eq("id", task.id);
    if (result.error) return showToast(result.error.message, true);
    await refreshData();
    return showToast("Task deleted.");
  }

  if (action === "archive-routine") {
    const routine = state.routines.find(item => String(item.id) === button.dataset.id);
    if (!routine || !confirm(`Remove "${routine.title}" from your routines?`)) return;
    const result = await db.from("daily_routines").update({ active: false }).eq("id", routine.id);
    if (result.error) return showToast(result.error.message, true);
    return refreshData();
  }

  if (action === "attendance") {
    const result = await db.from("attendance_sessions").upsert({
      class_id: Number(button.dataset.class),
      user_id: state.user.id,
      session_date: localDate(),
      status: button.dataset.status
    }, { onConflict: "class_id,session_date" });
    if (result.error) return showToast(result.error.message, true);
    await refreshData();
    return showToast(`Marked ${button.dataset.status.toLowerCase()}.`);
  }

  if (action === "delete-class") {
    const item = state.classes.find(row => String(row.id) === button.dataset.id);
    if (!item || !confirm(`Remove ${item.name} and its attendance history?`)) return;
    const result = await db.from("attendance_classes").delete().eq("id", item.id);
    if (result.error) return showToast(result.error.message, true);
    return refreshData();
  }

  if (action === "ai-plan" || action === "ai-review") {
    const target = document.querySelector("#ai-result");
    if (!target) return;
    target.innerHTML = `<div class="ai-result">Connecting to your secure AI assistant…</div>`;
    const result = await db.functions.invoke("task-assistant", {
      body: { action: action === "ai-plan" ? "plan" : "review" }
    });
    if (result.error) {
      target.innerHTML = `<div class="ai-result">The AI assistant still needs its secure setup. Your planner and attendance features work without it.</div>`;
      return;
    }
    target.innerHTML = `<div class="ai-result">${esc(result.data?.answer || "No suggestion returned.")}</div>`;
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
  if (!SUPABASE_PUBLISHABLE_KEY ||
      SUPABASE_PUBLISHABLE_KEY.includes("PASTE_YOUR_")) {
    app.innerHTML = `<section class="auth-form-wrap"><div class="auth-card">
      <h2>Setup needed</h2>
      <p>Replace the publishable key placeholder in app.js with your full Supabase publishable key.</p>
    </div></section>`;
    return;
  }

  const { data: { session } } = await db.auth.getSession();
  state.user = session?.user || null;

  if (state.user) await refreshData();
  else renderAuth();

  db.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null;
    if (state.user) setTimeout(refreshData, 0);
    else renderAuth();
  });
}

start();
