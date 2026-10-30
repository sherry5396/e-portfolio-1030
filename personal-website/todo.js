// To-do list project: calendar with in-cell chips, priorities, emoji, recurrence
// Persistence: Supabase (primary) + localStorage (fallback cache)

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("todo-app")) {
    initTodoApp();
  }
});

function initTodoApp() {
  const STORAGE_KEY = "todo-tasks-v1";

  /* --- Supabase client --- */
  const SUPABASE_URL = "https://ddudmckdsgjoiqwxfesm.supabase.co";
  const SUPABASE_KEY = "sb_publishable_WUl4QK0LMTSkcs-IKmM07A_rDO__fIU";
  let dbClient = null;
  try {
    const sb = window.supabase;
    if (sb && typeof sb.createClient === "function") {
      dbClient = sb.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
  } catch (e) {
    console.warn("Supabase client init failed", e);
  }

  const PRIORITY_ORDER = ["low", "medium", "high"];
  const PRIORITY_LABELS = { low: "Low", medium: "Medium", high: "High" };

  const els = {
    grid: document.getElementById("cal-grid"),
    title: document.getElementById("cal-title"),
    prev: document.getElementById("cal-prev"),
    next: document.getElementById("cal-next"),
    today: document.getElementById("cal-today"),
    form: document.getElementById("todo-form"),
    input: document.getElementById("todo-input"),
    list: document.getElementById("todo-list"),
    empty: document.getElementById("todo-empty"),
    dateLabel: document.getElementById("todo-date-label"),
    clearBtn: document.getElementById("todo-clear"),
    emojiSelect: document.getElementById("emoji-select"),
    priBtns: Array.from(document.querySelectorAll(".priority-btn")),
    repeatEnabled: document.getElementById("repeat-enabled"),
    repeatFields: document.getElementById("repeat-fields"),
    repeatInterval: document.getElementById("repeat-interval"),
    repeatDuration: document.getElementById("repeat-duration"),
  };

  let tasks = [];
  let selectedPriority = "medium";
  const now = new Date();
  const todayKey = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();
  let selectedKey = todayKey;

  /* --- Date helpers (local time, YYYY-MM-DD) --- */
  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function keyDate(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  /* --- Persistence: Supabase (primary) + localStorage (cache) --- */
  function loadFromLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function cacheLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      /* storage unavailable — app still works for this session */
    }
  }

  function rowToTask(row) {
    return {
      id: String(row.id),
      text: row.text,
      date: row.date,
      done: !!row.done,
      priority: PRIORITY_ORDER.includes(row.priority) ? row.priority : "medium",
      emoji: typeof row.emoji === "string" ? row.emoji : "",
      seriesId: row.series_id != null ? String(row.series_id) : null,
      intervalDays: Number.isInteger(row.interval_days) ? row.interval_days : null,
    };
  }

  function taskToRow(task) {
    return {
      id: task.id,
      text: task.text,
      date: task.date,
      done: task.done,
      priority: task.priority,
      emoji: task.emoji,
      series_id: task.seriesId,
      interval_days: task.intervalDays,
    };
  }

  async function loadTasks() {
    if (!dbClient) return loadFromLocal();
    try {
      const { data, error } = await dbClient
        .from("todos")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map(rowToTask);
    } catch (e) {
      console.warn("Supabase load failed, using localStorage cache", e);
      return loadFromLocal();
    }
  }

  async function dbInsert(task) {
    if (!dbClient) return;
    try {
      const { error } = await dbClient.from("todos").insert(taskToRow(task));
      if (error) throw error;
    } catch (e) {
      console.warn("Supabase insert failed", e);
    }
  }

  async function dbUpdateDone(id, done) {
    if (!dbClient) return;
    try {
      const { error } = await dbClient.from("todos").update({ done }).eq("id", id);
      if (error) throw error;
    } catch (e) {
      console.warn("Supabase update failed", e);
    }
  }

  async function dbDelete(id) {
    if (!dbClient) return;
    try {
      const { error } = await dbClient.from("todos").delete().eq("id", id);
      if (error) throw error;
    } catch (e) {
      console.warn("Supabase delete failed", e);
    }
  }

  async function dbDeleteAll(ids) {
    if (!dbClient || ids.length === 0) return;
    try {
      const { error } = await dbClient.from("todos").delete().in("id", ids);
      if (error) throw error;
    } catch (e) {
      console.warn("Supabase bulk delete failed", e);
    }
  }

  /* Backfill fields for tasks saved before emoji/priority/recurrence existed */
  function normalizeTasks(raw) {
    return raw
      .filter((t) => t && typeof t.text === "string" && t.id && t.date)
      .map((t) => ({
        id: String(t.id),
        text: t.text,
        date: t.date,
        done: !!t.done,
        priority: PRIORITY_ORDER.includes(t.priority) ? t.priority : "medium",
        emoji: typeof t.emoji === "string" ? t.emoji : "",
        seriesId: t.seriesId != null ? String(t.seriesId) : null,
        intervalDays: Number.isInteger(t.intervalDays) && t.intervalDays > 0 ? t.intervalDays : null,
      }));
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function updatePriorityUI() {
    els.priBtns.forEach((btn) => {
      const active = btn.dataset.priority === selectedPriority;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  /* --- Calendar --- */
  function renderCalendar() {
    els.title.textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    els.grid.replaceChildren();

    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    for (let i = 0; i < 42; i++) {
      let cellDate;
      let muted = false;

      if (i < firstWeekday) {
        cellDate = new Date(viewYear, viewMonth - 1, daysInPrevMonth - firstWeekday + 1 + i);
        muted = true;
      } else if (i >= firstWeekday + daysInMonth) {
        cellDate = new Date(viewYear, viewMonth + 1, i - firstWeekday - daysInMonth + 1);
        muted = true;
      } else {
        cellDate = new Date(viewYear, viewMonth, i - firstWeekday + 1);
      }

      const key = dateKey(cellDate);
      const cell = document.createElement("div");
      cell.className = "cal-day";
      cell.setAttribute("role", "gridcell");
      if (muted) cell.classList.add("is-muted");
      if (key === todayKey) cell.classList.add("is-today");
      if (key === selectedKey) cell.classList.add("is-selected");

      /* Day number (also the keyboard-accessible select button) */
      const numBtn = document.createElement("button");
      numBtn.type = "button";
      numBtn.className = "cal-num";
      numBtn.textContent = String(cellDate.getDate());
      numBtn.setAttribute("aria-label", cellDate.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }));
      cell.appendChild(numBtn);

      /* Task chips inside the cell */
      const dayTasks = tasks.filter((t) => t.date === key);
      if (dayTasks.length) {
        const chips = document.createElement("div");
        chips.className = "cal-chips";

        dayTasks.slice(0, 2).forEach((task) => {
          const chip = document.createElement("span");
          chip.className = `cal-chip pri-${task.priority}` + (task.done ? " is-done" : "");
          chip.title =
            (task.seriesId ? "\u{1F501} " : "") +
            (task.emoji ? task.emoji + " " : "") +
            task.text;

          const mark = document.createElement("span");
          mark.className = task.emoji ? "chip-emoji" : "chip-dot";
          mark.textContent = task.emoji || "";
          mark.setAttribute("aria-hidden", "true");

          const label = document.createElement("span");
          label.className = "chip-text";
          label.textContent = task.text;

          chip.append(mark, label);
          chips.appendChild(chip);
        });

        if (dayTasks.length > 2) {
          const more = document.createElement("span");
          more.className = "cal-more";
          more.textContent = `+${dayTasks.length - 2} more`;
          chips.appendChild(more);
        }

        cell.appendChild(chips);
      }

      cell.addEventListener("click", () => {
        selectedKey = key;
        if (muted) {
          viewYear = cellDate.getFullYear();
          viewMonth = cellDate.getMonth();
        }
        renderCalendar();
        renderList();
      });

      els.grid.appendChild(cell);
    }
  }

  /* --- Task list for the selected date --- */
  function renderList() {
    els.list.replaceChildren();
    const dayTasks = tasks.filter((t) => t.date === selectedKey);
    els.empty.hidden = dayTasks.length > 0;

    dayTasks.forEach((task) => {
      /* Checkbox */
      const checkLabel = document.createElement("label");
      checkLabel.className = "todo-check";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.done;
      checkbox.setAttribute(
        "aria-label",
        task.done ? "Mark task as not done" : "Mark task as done"
      );

      const box = document.createElement("span");
      box.className = "todo-box";
      box.setAttribute("aria-hidden", "true");
      checkLabel.append(checkbox, box);

      checkbox.addEventListener("change", () => {
        task.done = checkbox.checked;
        item.classList.toggle("done", task.done);
        checkbox.setAttribute(
          "aria-label",
          task.done ? "Mark task as not done" : "Mark task as done"
        );
        dbUpdateDone(task.id, task.done);
        cacheLocal();
        renderCalendar();
      });

      /* Emoji (optional) */
      let emojiEl = null;
      if (task.emoji) {
        emojiEl = document.createElement("span");
        emojiEl.className = "todo-emoji";
        emojiEl.textContent = task.emoji;
        emojiEl.setAttribute("aria-hidden", "true");
      }

      /* Text */
      const text = document.createElement("span");
      text.className = "todo-text";
      text.textContent = task.text;

      /* Priority badge */
      const pri = document.createElement("span");
      pri.className = `todo-pri pri-${task.priority}`;
      pri.textContent = PRIORITY_LABELS[task.priority];
      pri.title = `${PRIORITY_LABELS[task.priority]} priority`;

      /* Recurring marker */
      let repeatMark = null;
      if (task.seriesId) {
        repeatMark = document.createElement("span");
        repeatMark.className = "todo-repeat-mark";
        repeatMark.innerHTML = "&#128260;";
        repeatMark.title = `Repeats every ${task.intervalDays} day${task.intervalDays === 1 ? "" : "s"}`;
        repeatMark.setAttribute("aria-label", repeatMark.title);
      }

      /* Delete */
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "todo-del";
      delBtn.innerHTML = "&times;";
      delBtn.setAttribute("aria-label", "Delete task");
      delBtn.addEventListener("click", () => {
        tasks = tasks.filter((t) => t.id !== task.id);
        dbDelete(task.id);
        cacheLocal();
        renderList();
        renderCalendar();
      });

      const item = document.createElement("li");
      item.className = "todo-item" + (task.done ? " done" : "");
      item.append(checkLabel);
      if (emojiEl) item.append(emojiEl);
      item.append(text, pri);
      if (repeatMark) item.append(repeatMark);
      item.append(delBtn);
      els.list.appendChild(item);
    });

    /* Date label */
    const d = keyDate(selectedKey);
    let label = d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (selectedKey === todayKey) label += " · Today";
    els.dateLabel.textContent = label;

    els.clearBtn.disabled = tasks.length === 0;
  }

  /* --- Add task (single or recurring) --- */
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text) {
      els.input.focus();
      return;
    }
    const base = {
      text,
      done: false,
      priority: selectedPriority,
      emoji: els.emojiSelect.value,
    };

    if (els.repeatEnabled.checked) {
      /* Repeat every `interval` days for `duration` days, starting on the selected date.
         Instances land on start, start+interval, … while the offset is < duration. */
      const interval = clampInt(els.repeatInterval.value, 1, 365, 1);
      const duration = clampInt(els.repeatDuration.value, 1, 730, 30);
      const seriesId = makeId();
      const start = keyDate(selectedKey);

      for (let offset = 0; offset < duration; offset += interval) {
        const instanceDate = new Date(start);
        instanceDate.setDate(start.getDate() + offset);
        const task = {
          ...base,
          id: makeId(),
          date: dateKey(instanceDate),
          seriesId,
          intervalDays: interval,
        };
        tasks.push(task);
        dbInsert(task);
      }
    } else {
      const task = {
        ...base,
        id: makeId(),
        date: selectedKey,
        seriesId: null,
        intervalDays: null,
      };
      tasks.push(task);
      dbInsert(task);
    }

    els.input.value = "";
    selectedPriority = "medium";
    els.emojiSelect.value = "";
    els.repeatEnabled.checked = false;
    els.repeatFields.hidden = true;
    els.repeatInterval.value = "1";
    els.repeatDuration.value = "30";
    updatePriorityUI();
    cacheLocal();
    renderList();
    renderCalendar();
    els.input.focus();
  });

  /* --- Repeat option: show/hide the fields --- */
  els.repeatEnabled.addEventListener("change", () => {
    els.repeatFields.hidden = !els.repeatEnabled.checked;
  });

  function clampInt(value, min, max, fallback) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  /* --- Priority picker --- */
  els.priBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedPriority = btn.dataset.priority;
      updatePriorityUI();
    });
  });

  /* --- Clear ALL tasks (every date), with confirmation --- */
  els.clearBtn.addEventListener("click", () => {
    if (tasks.length === 0) return;
    const ok = window.confirm(
      `Delete all ${tasks.length} task${tasks.length === 1 ? "" : "s"} for every date? This cannot be undone.`
    );
    if (!ok) return;
    const ids = tasks.map((t) => t.id);
    tasks = [];
    dbDeleteAll(ids);
    cacheLocal();
    renderList();
    renderCalendar();
    els.input.focus();
  });

  /* --- Month navigation --- */
  els.prev.addEventListener("click", () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    renderCalendar();
  });

  els.next.addEventListener("click", () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    renderCalendar();
  });

  els.today.addEventListener("click", () => {
    const d = keyDate(todayKey);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    selectedKey = todayKey;
    renderCalendar();
    renderList();
  });

  /* --- Initial render (empty), then async load from Supabase --- */
  renderCalendar();
  renderList();

  loadTasks().then((loaded) => {
    tasks = normalizeTasks(loaded);
    cacheLocal();
    renderCalendar();
    renderList();
  });
}
