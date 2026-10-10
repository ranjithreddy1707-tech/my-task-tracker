import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const configScript = [...document.querySelectorAll('script[type="module"]:not([src])')]
  .find(script => script.textContent.includes("SUPABASE_PUBLISHABLE_KEY"));

if (!configScript) throw new Error("Could not find the Supabase settings in index.html.");

function readSetting(name) {
  const match = configScript.textContent.match(
    new RegExp(`const ${name}\\s*=\\s*"([^"]*)"`)
  );
  if (!match) throw new Error(`Could not find ${name} in index.html.`);
  return match[1];
}

const db = createClient(
  readSetting("SUPABASE_URL"),
  readSetting("SUPABASE_PUBLISHABLE_KEY")
);

const app = document.querySelector("#app");
let userId = null;
let currentDay = "";
let mounting = false;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addStyles() {
  if (document.querySelector("#daily-routine-styles")) return;
  const style = document.createElement("style");
  style.id = "daily-routine-styles";
  style.textContent = `
    #daily-routines { margin: 0 0 18px; }
    #daily-routines .routine-grid { display: grid; gap: 9px; }
    #daily-routines .routine-item {
      display: grid; grid-template-columns: 24px 1fr auto; align-items: center;
      gap: 10px; padding: 12px; border: 1px solid var(--line);
      border-radius: 12px; background: white;
    }
    #daily-routines .routine-item input { width: 18px; height: 18px; accent-color: var(--green); }
    #daily-routines .routine-name { font-weight: 700; }
    #daily-routines .routine-meta { margin-top: 4px; color: var(--muted); font-size: 12px; }
    #daily-routines .routine-done .routine-name { color: var(--muted); text-decoration: line-through; }
    #daily-routines .routine-add { border-top: 1px solid var(--line); margin-top: 16px; padding-top: 6px; }
    #daily-routines .routine-progress { color: var(--muted); font-size: 13px; }
    #daily-routines .routine-error { color: #9f3d2e; font-size: 13px; margin-top: 10px; }
    @media (max-width: 440px) {
      #daily-routines .routine-item { grid-template-columns: 24px 1fr auto; }
    }
  `;
  document.head.append(style);
}

async function mountDailyRoutines() {
  if (mounting || !app.querySelector("#task-form")) return;
  if (app.querySelector("#daily-routines")) return;

  mounting = true;
  const { data: { session } } = await db.auth.getSession();
  userId = session?.user?.id ?? null;

  if (!userId || !app.querySelector("#task-form")) {
    mounting = false;
    return;
  }

  addStyles();
  const section = document.createElement("section");
  section.className = "panel";
  section.id = "daily-routines";
  section.innerHTML = "<h2>Daily routine</h2><p>Loading your routine…</p>";

  const intro = app.querySelector(".intro");
  if (intro) intro.insertAdjacentElement("afterend", section);
  else app.prepend(section);

  mounting = false;
  await renderDailyRoutines();
}

async function renderDailyRoutines() {
  const section = app.querySelector("#daily-routines");
  if (!section || !userId) return;

  const day = localDate();
  currentDay = day;

  const [routineResult, completionResult] = await Promise.all([
    db.from("daily_routines")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .order("created_at"),
    db.from("daily_routine_completions")
      .select("routine_id, completed")
      .eq("task_date", day)
  ]);

  if (routineResult.error || completionResult.error) {
    section.innerHTML = `<h2>Daily routine</h2><p class="routine-error">${escapeHtml(routineResult.error?.message || completionResult.error?.message)}</p>`;
    return;
  }

  const routines = routineResult.data ?? [];
  const completedIds = new Set(
    (completionResult.data ?? []).filter(row => row.completed).map(row => row.routine_id)
  );
  const completedCount = routines.filter(item => completedIds.has(item.id)).length;

  section.innerHTML = `
    <div class="panel-head">
      <div><div class="eyebrow">Today · ${escapeHtml(day)}</div><h2>Daily routine</h2></div>
      <span class="routine-progress">${completedCount} of ${routines.length} done</span>
    </div>
    ${routines.length ? `
      <div class="routine-grid">
        ${routines.map(item => `
          <div class="routine-item ${completedIds.has(item.id) ? "routine-done" : ""}">
            <input type="checkbox" data-routine-toggle="${item.id}" ${completedIds.has(item.id) ? "checked" : ""} aria-label="Mark ${escapeHtml(item.title)} complete">
            <div>
              <div class="routine-name">${escapeHtml(item.title)}</div>
              <div class="routine-meta">${[item.priority, item.category].filter(Boolean).map(escapeHtml).join(" · ")}</div>
            </div>
            <button class="icon-btn" data-routine-archive="${item.id}" title="Remove from daily routine" aria-label="Remove ${escapeHtml(item.title)}">×</button>
          </div>
        `).join("")}
      </div>
    ` : `<div class="empty">Add the everyday things you want to remember.</div>`}
    <form class="routine-add" id="daily-routine-form">
      <label for="routine-title">Add a daily task</label>
      <input id="routine-title" maxlength="180" placeholder="For example, take a walk" required>
      <div class="row">
        <div><label for="routine-priority">Priority</label>
          <select id="routine-priority"><option>Medium</option><option>High</option><option>Low</option></select></div>
        <div><label for="routine-category">Category</label>
          <input id="routine-category" maxlength="60" placeholder="Optional"></div>
      </div>
      <button class="btn full" type="submit">Add to daily routine</button>
      <div class="routine-error" id="routine-error"></div>
    </form>
  `;

  section.querySelector("#daily-routine-form").onsubmit = async event => {
    event.preventDefault();
    const title = section.querySelector("#routine-title").value.trim();
    const priority = section.querySelector("#routine-priority").value;
    const category = section.querySelector("#routine-category").value.trim() || null;

    const { error } = await db.from("daily_routines").insert({
      title, priority, category, user_id: userId
    });

    if (error) {
      section.querySelector("#routine-error").textContent = error.message;
      return;
    }
    await renderDailyRoutines();
  };

  section.querySelectorAll("[data-routine-toggle]").forEach(input => {
    input.onchange = async () => {
      const dayForClick = currentDay;
      const completed = input.checked;
      const { error } = await db.from("daily_routine_completions").upsert({
        routine_id: Number(input.dataset.routineToggle),
        user_id: userId,
        task_date: dayForClick,
        completed,
        completed_at: completed ? new Date().toISOString() : null
      }, { onConflict: "routine_id,task_date" });

      if (error) {
        alert(error.message);
        return;
      }
      await renderDailyRoutines();
    };
  });

  section.querySelectorAll("[data-routine-archive]").forEach(button => {
    button.onclick = async () => {
      const { error } = await db.from("daily_routines")
        .update({ active: false })
        .eq("id", Number(button.dataset.routineArchive));
      if (error) {
        alert(error.message);
        return;
      }
      await renderDailyRoutines();
    };
  });
}

new MutationObserver(() => {
  if (!app.querySelector("#task-form")) return;
  if (currentDay && currentDay !== localDate()) {
    currentDay = localDate();
    renderDailyRoutines();
  }
  mountDailyRoutines();
}).observe(app, { childList: true, subtree: true });

db.auth.onAuthStateChange((_event, session) => {
  userId = session?.user?.id ?? null;
  if (userId) setTimeout(mountDailyRoutines, 0);
});

setInterval(() => {
  if (currentDay && currentDay !== localDate()) renderDailyRoutines();
}, 60_000);

mountDailyRoutines();
