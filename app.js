
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://pfvtflfxyzlpbbywnqol.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hhLESHpufBu6oSXqtX31Qw_IUsP_vu0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// --------------------
// Supabase helpers + CRUD
// --------------------
async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user) throw new Error("Not logged in");
  return data.user;
}

// TEMP login (لحد ما نعمل Login UI)
// امسحه بعدين لما نعمل شاشة Login
async function tempLoginIfNeeded() {
  const { data } = await supabase.auth.getSession();
  if (data?.session) return;

  const { error } = await supabase.auth.signInWithPassword({
    email: "mohamedsharkawy383@gmail.com ",
    password: "M@S@1999"
  });

  if (error) {
    console.error(error);
    alert("Login failed: " + error.message);
  }
}

// ---------- Projects ----------
async function sbListProjects() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return data.map(p => ({
    Id: p.id,
    Name: p.name,
    Description: p.description,
    Status: p.status,
    StartDate: p.start_at,
    TargetDate: p.target_at,
    CreatedAt: p.created_at
  }));
}

async function sbCreateProject(payload) {
  const user = await requireUser();
  const row = {
    user_id: user.id,
    name: payload.name,
    description: payload.description || null,
    status: payload.status || "Active",
    start_at: payload.startDate || null,
    target_at: payload.targetDate || null
  };
  const { data, error } = await supabase.from("projects").insert([row]).select("*").single();
  if (error) throw error;

  return {
    Id: data.id,
    Name: data.name,
    Description: data.description,
    Status: data.status,
    StartDate: data.start_at,
    TargetDate: data.target_at,
    CreatedAt: data.created_at
  };
}

async function sbUpdateProject(id, payload) {
  const user = await requireUser();
  const row = {
    name: payload.name,
    description: payload.description || null,
    status: payload.status || "Active",
    start_at: payload.startDate || null,
    target_at: payload.targetDate || null
  };
  const { error } = await supabase.from("projects").update(row).eq("id", id).eq("user_id", user.id);
  if (error) throw error;
}

async function sbDeleteProject(id) {
  const user = await requireUser();
  const { error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
}

// ---------- Tasks + Many-to-many ----------
async function sbListTasks() {
  const user = await requireUser();

  const { data: tasks, error: e1 } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (e1) throw e1;

  const { data: links, error: e2 } = await supabase
    .from("project_tasks")
    .select("project_id, task_id")
    .eq("user_id", user.id);
  if (e2) throw e2;

  const map = new Map();
  for (const l of links) {
    const arr = map.get(l.task_id) || [];
    arr.push(l.project_id);
    map.set(l.task_id, arr);
  }

  return tasks.map(t => ({
    Id: t.id,
    Title: t.title,
    Description: t.description,
    Status: t.status,
    Priority: t.priority,
    Deadline: t.deadline,
    Notes: t.notes,
    Ideas: t.ideas,
    IsImportant: t.is_important,
    EmailReminder: t.email_reminder,
    CustomAlertAt: t.custom_alert_at,
    CreatedAt: t.created_at,
    ProjectIds: map.get(t.id) || []
  }));
}

async function sbCreateTask(payload) {
  const user = await requireUser();
  const row = {
    user_id: user.id,
    title: payload.title,
    description: payload.description || null,
    status: payload.status || "Pending",
    priority: payload.priority || "Medium",
    deadline: payload.deadline || null,
    notes: payload.notes || null,
    ideas: payload.ideas || null,
    is_important: !!payload.isImportant,
    email_reminder: payload.emailReminder !== false,
    custom_alert_at: payload.customAlertAt || null
  };

  const { data, error } = await supabase.from("tasks").insert([row]).select("*").single();
  if (error) throw error;

  const projectIds = Array.isArray(payload.projectIds) ? payload.projectIds : [];
  if (projectIds.length) {
    const linkRows = projectIds.map(pid => ({ user_id: user.id, project_id: pid, task_id: data.id }));
    const { error: e2 } = await supabase.from("project_tasks").insert(linkRows);
    if (e2) throw e2;
  }
}

async function sbUpdateTask(taskId, payload) {
  const user = await requireUser();
  const row = {
    title: payload.title,
    description: payload.description || null,
    status: payload.status || "Pending",
    priority: payload.priority || "Medium",
    deadline: payload.deadline || null,
    notes: payload.notes || null,
    ideas: payload.ideas || null,
    is_important: !!payload.isImportant,
    email_reminder: payload.emailReminder !== false,
    custom_alert_at: payload.customAlertAt || null
  };

  const { error } = await supabase.from("tasks").update(row).eq("id", taskId).eq("user_id", user.id);
  if (error) throw error;

  // replace links
  const { error: eDel } = await supabase.from("project_tasks").delete().eq("task_id", taskId).eq("user_id", user.id);
  if (eDel) throw eDel;

  const projectIds = Array.isArray(payload.projectIds) ? payload.projectIds : [];
  if (projectIds.length) {
    const linkRows = projectIds.map(pid => ({ user_id: user.id, project_id: pid, task_id: taskId }));
    const { error: eIns } = await supabase.from("project_tasks").insert(linkRows);
    if (eIns) throw eIns;
  }
}

async function sbDeleteTask(taskId) {
  const user = await requireUser();
  await supabase.from("project_tasks").delete().eq("task_id", taskId).eq("user_id", user.id);
  const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", user.id);
  if (error) throw error;
}

async function sbSetTaskImportant(taskId, newValue) {
  const user = await requireUser();
  const { error } = await supabase
    .from("tasks")
    .update({ is_important: newValue })
    .eq("id", taskId)
    .eq("user_id", user.id);
  if (error) throw error;
}

// ---------- Discussions ----------
async function sbListDiscussions() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("discussions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return data.map(d => ({
    Id: d.id,
    Title: d.title,
    Content: d.content,
    Status: d.status,
    ProjectId: d.project_id,
    IsImportant: d.is_important,
    FollowUpAt: d.follow_up_at,
    CreatedAt: d.created_at
  }));
}

async function sbCreateDiscussion(payload) {
  const user = await requireUser();
  const row = {
    user_id: user.id,
    title: payload.title,
    content: payload.content || null,
    status: payload.status || "Open",
    project_id: payload.projectId || null,
    is_important: !!payload.isImportant,
    follow_up_at: payload.followUpAt || null
  };
  const { error } = await supabase.from("discussions").insert([row]);
  if (error) throw error;
}

async function sbUpdateDiscussion(id, payload) {
  const user = await requireUser();
  const row = {
    title: payload.title,
    content: payload.content || null,
    status: payload.status || "Open",
    project_id: payload.projectId || null,
    is_important: !!payload.isImportant,
    follow_up_at: payload.followUpAt || null
  };
  const { error } = await supabase.from("discussions").update(row).eq("id", id).eq("user_id", user.id);
  if (error) throw error;
}

async function sbDeleteDiscussion(id) {
  const user = await requireUser();
  const { error } = await supabase.from("discussions").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
}

async function sbSetDiscussionImportant(id, newValue) {
  const user = await requireUser();
  const { error } = await supabase
    .from("discussions")
    .update({ is_important: newValue })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}

// decorate names for UI
function decorateProjectNames() {
  const pMap = new Map(state.projects.map(p => [p.Id, p.Name]));

  state.tasks = state.tasks.map(t => {
    const names = (t.ProjectIds || []).map(pid => pMap.get(pid)).filter(Boolean);
    return { ...t, ProjectName: names.join(", ") || "-" };
  });

  state.discussions = state.discussions.map(d => ({
    ...d,
    ProjectName: d.ProjectId ? (pMap.get(d.ProjectId) || "-") : "-"
  }));
}
// app.js
const $ = (id) => document.getElementById(id);

let state = {
  view: "dashboard",
  projects: [],
  tasks: [],
  projectFilterId: null,
  search: "",
  dueFilter: null,
  importantOnly: false,
    discussions: [],
  discussionFilters: { status: null, importantOnly: false, followup: null },
};

let editingProjectId = null;
let editingTaskId = null;

async function refreshDiscussions() {
  state.discussions = await sbListDiscussions();
  decorateProjectNames();
}
function isoFromLocalInput(val) {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function localInputFromISO(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // datetime-local wants "YYYY-MM-DDTHH:mm"
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function pillForPriority(p) {
  if (p === "High") return `<span class="pill red">High</span>`;
  if (p === "Low") return `<span class="pill green">Low</span>`;
  return `<span class="pill amber">Medium</span>`;
}

function pillForStatus(s) {
  if (s === "Done") return `<span class="pill green">Done</span>`;
  if (s === "Blocked") return `<span class="pill red">Blocked</span>`;
  if (s === "In Progress") return `<span class="pill blue">In Progress</span>`;
  return `<span class="pill">Pending</span>`;
}

function isOverdue(task) {
  if (!task.Deadline) return false;
  if (task.Status === "Done") return false;
  return new Date(task.Deadline) < new Date();
}

function withinDays(task, days) {
  if (!task.Deadline) return false;
  const now = new Date();
  const d = new Date(task.Deadline);
  const max = new Date(now.getTime() + days*24*60*60*1000);
  return d >= now && d <= max;
}


async function loadAll() {
  // login مؤقت (شيله بعد ما نعمل Login UI)
  await tempLoginIfNeeded();

  state.projects = await sbListProjects();
  state.tasks = await sbListTasks();
  state.discussions = await sbListDiscussions();

  decorateProjectNames();
  renderAll();
}

async function refreshTasks() {
  state.tasks = await sbListTasks();
  decorateProjectNames();
}
function setBadges() {
  $("badgeProjects").textContent = state.projects.length;
  $("badgeTasks").textContent = state.tasks.length;
  $("badgeDiscussions").textContent = state.discussions.length;
  const allTasks = state.tasks;
  $("badgeImportant").textContent = allTasks.filter(t => t.IsImportant).length;
  $("badgeToday").textContent = allTasks.filter(t => t.Deadline && (new Date(t.Deadline)).toDateString() === (new Date()).toDateString()).length;
  $("badgeOverdue").textContent = allTasks.filter(isOverdue).length;
  $("badgeAll").textContent = allTasks.length;
}

function showView(view) {
  state.view = view;

  $("dashboardView").style.display = (view === "dashboard") ? "grid" : "none";
  $("projectsView").style.display = (view === "projects") ? "block" : "none";
  $("tasksView").style.display = (["tasks","important","today","overdue"].includes(view)) ? "block" : "none";
  $("discussionsView").style.display = (view === "discussions") ? "block" : "none";

  let title = "Dashboard";
  if (view === "projects") title = "Projects";
  if (view === "tasks") title = "Tasks";
  if (view === "important") title = "Important ⭐";
  if (view === "today") title = "Today";
  if (view === "overdue") title = "Overdue";
if (view === "discussions") title = "Discussions";
  $("viewTitle").textContent = title;
}

function renderDashboard() {
  const upcoming = state.tasks.filter(t => withinDays(t, 7) && t.Status !== "Done").slice(0, 8);
  const overdue = state.tasks.filter(isOverdue).slice(0, 8);
  const important = state.tasks.filter(t => t.IsImportant && t.Status !== "Done").slice(0, 8);
  const projects = state.projects.slice(0, 8);

  $("upcomingList").innerHTML = upcoming.map(taskRowCard).join("") || `<div class="muted">No upcoming tasks.</div>`;
  $("overdueList").innerHTML = overdue.map(taskRowCard).join("") || `<div class="muted">No overdue tasks.</div>`;
  $("importantList").innerHTML = important.map(taskRowCard).join("") || `<div class="muted">No important tasks.</div>`;
  $("projectsMiniList").innerHTML = projects.map(projectMiniCard).join("") || `<div class="muted">No projects yet.</div>`;
}

function projectMiniCard(p) {
  return `
  <div class="row">
    <div>
      <div class="title link" onclick="filterByProject('${p.Id}')">${escapeHtml(p.Name)}</div>
      <div class="meta">${escapeHtml(p.Status)} • Target: ${p.TargetDate ? fmtDate(p.TargetDate) : "-"}</div>
    </div>
    <div>
      <span class="pill blue">${escapeHtml(p.Status)}</span>
    </div>
  </div>`;
}

function taskRowCard(t) {
  const overdue = isOverdue(t);
  return `
  <div class="row">
    <div style="min-width:0;">
      <div class="title link" onclick="openEditTask('${t.Id}')">${escapeHtml(t.Title)}</div>
      <div class="meta">
        ${escapeHtml(t.ProjectName || "")}
        • ${t.Deadline ? fmtDate(t.Deadline) : "No deadline"}
        ${overdue ? " • " + `<span class="pill red">Overdue</span>` : ""}
      </div>
    </div>
    <div style="display:flex; gap:8px; align-items:center;">
      <div class="stars" title="Toggle important" onclick="toggleImportant('${t.Id}')">${t.IsImportant ? "⭐" : "☆"}</div>
      ${pillForPriority(t.Priority)}
    </div>
  </div>`;
}

function renderProjects() {
  $("projectsTable").innerHTML = state.projects.map(p => `
    <tr>
      <td>
        <div class="link" onclick="filterByProject('${p.Id}')">${escapeHtml(p.Name)}</div>
        <div class="muted" style="font-size:12px;">${escapeHtml((p.Description||"").slice(0, 120))}</div>
      </td>
      <td>${pillForStatus(p.Status === "Done" ? "Done" : (p.Status === "On Hold" ? "Blocked" : "In Progress"))}</td>
      <td>${p.TargetDate ? fmtDate(p.TargetDate) : "-"}</td>
      <td>
        <div class="actions">
          <span class="link" onclick="openEditProject('${p.Id}')">Edit</span>
          <span class="link" onclick="filterByProject('${p.Id}')">Open</span>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="muted">No projects.</td></tr>`;
}

function renderTasksTable() {
  $("tasksTable").innerHTML = state.tasks.map(t => `
    <tr>
      <td class="stars" onclick="toggleImportant('${t.Id}')">${t.IsImportant ? "⭐" : "☆"}</td>
      <td>
        <div class="link" onclick="openEditTask('${t.Id}')">${escapeHtml(t.Title)}</div>
        <div class="muted" style="font-size:12px;">${escapeHtml((t.Description||"").slice(0, 110))}</div>
      </td>
      <td>${escapeHtml(t.ProjectName || "-")}</td>
      <td>${pillForStatus(t.Status)}</td>
      <td>${pillForPriority(t.Priority)}</td>
      <td>
        ${t.Deadline ? fmtDate(t.Deadline) : "-"}
        ${isOverdue(t) ? `<div style="margin-top:6px;"><span class="pill red">Overdue</span></div>` : ""}
      </td>
      <td>
        <div class="actions">
          <span class="link" onclick="openEditTask('${t.Id}')">Edit</span>
          <span class="link" onclick="quickDone('${t.Id}')">Done</span>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="muted">No tasks.</td></tr>`;
}

function renderAll() {
  setBadges();

  renderDashboard();
  renderProjects();
  renderTasksTable();
  renderDiscussionsTable();
  // fill project dropdown in task modal
  $("tProjects").innerHTML = state.projects.map(p => `<option value="${p.Id}">${escapeHtml(p.Name)}</option>`).join("");
    // fill project dropdown in discussion modal
  if ($("dProject")) fillDiscussionProjectsDropdown();
}


// --------------------
// Discussion Modal (Frontend only for now)
// --------------------
let editingDiscussionId = null;

$("closeDiscussionModal").addEventListener("click", () => closeModal("discussionModal"));
$("dCancelBtn").addEventListener("click", () => closeModal("discussionModal"));

function fillDiscussionProjectsDropdown() {
  // fill project dropdown
  const opts = ['<option value="">-- None --</option>']
    .concat(state.projects.map(p => `<option value="${p.Id}">${escapeHtml(p.Name)}</option>`));
  $("dProject").innerHTML = opts.join("");
}

window.openNewDiscussion = function () {
  editingDiscussionId = null;
  $("discussionModalTitle").textContent = "New Discussion";
  $("dDeleteBtn").style.display = "none";

  fillDiscussionProjectsDropdown();

  $("dTitle").value = "";
  $("dStatus").value = "Open";
  $("dProject").value = "";
  $("dContent").value = "";
  $("dFollowUp").value = "";
  $("dImportant").value = "0";

  openModal("discussionModal");
};


function renderDiscussionsTable() {
  $("discussionsTable").innerHTML = state.discussions.map(d => `
    <tr>
      <td class="stars" onclick="toggleDiscussionImportant('${d.Id}')">${d.IsImportant ? "⭐" : "☆"}</td>
      <td>
        <div class="link" onclick="openEditDiscussion('${d.Id}')">${escapeHtml(d.Title)}</div>
        <div class="muted" style="font-size:12px;">${escapeHtml((d.Content||"").slice(0, 110))}</div>
      </td>
      <td>${escapeHtml(d.ProjectName || "-")}</td>
      <td>${d.Status === "Closed" ? `<span class="pill green">Closed</span>` : `<span class="pill blue">Open</span>`}</td>
      <td>${d.FollowUpAt ? fmtDate(d.FollowUpAt) : "-"}</td>
      <td>
        <div class="actions">
          <span class="link" onclick="openEditDiscussion('${d.Id}')">Edit</span>
          <span class="link" onclick="quickCloseDiscussion('${d.Id}')">Close</span>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="muted">No discussions.</td></tr>`;
}


// --- Save / Delete Discussion ---
$("dSaveBtn").addEventListener("click", async () => {
  try {
    const payload = {
      title: $("dTitle").value.trim(),
      content: $("dContent").value.trim(),
      status: $("dStatus").value,
      projectId: $("dProject").value ? $("dProject").value : null,
      isImportant: $("dImportant").value === "1",
      followUpAt: isoFromLocalInput($("dFollowUp").value),
    };
    if (!payload.title) return alert("Discussion title required");

    if (!editingDiscussionId) await sbCreateDiscussion(payload);
    else await sbUpdateDiscussion(editingDiscussionId, payload);

    closeModal("discussionModal");
    await loadAll();
  } catch (e) {
    alert(e.message);
  }
});

$("dDeleteBtn").addEventListener("click", async () => {
  if (!editingDiscussionId) return;
  if (!confirm("Delete this discussion?")) return;

  try {
    await sbDeleteDiscussion(editingDiscussionId);
    closeModal("discussionModal");
    await loadAll();
  } catch (e) {
    alert(e.message);
  }
});

window.openEditDiscussion = function (id) {
  const d = state.discussions.find(x => x.Id === id);
  if (!d) return;

  editingDiscussionId = id;
  $("discussionModalTitle").textContent = "Edit Discussion";
  $("dDeleteBtn").style.display = "inline-block";

  fillDiscussionProjectsDropdown();

  $("dTitle").value = d.Title || "";
  $("dStatus").value = d.Status || "Open";
  $("dProject").value = d.ProjectId ? String(d.ProjectId) : "";
  $("dContent").value = d.Content || "";
  $("dFollowUp").value = localInputFromISO(d.FollowUpAt);
  $("dImportant").value = d.IsImportant ? "1" : "0";

  openModal("discussionModal");
};

window.toggleDiscussionImportant = async function (id) {
  try {
    const d = state.discussions.find(x => x.Id === id);
    if (!d) return;
    await sbSetDiscussionImportant(id, !d.IsImportant);
    await loadAll();
  } catch (e) {
    alert(e.message);
  }
};

window.quickCloseDiscussion = async function (id) {
  const d = state.discussions.find(x => x.Id === id);
  if (!d) return;

  try {
    await sbUpdateDiscussion(id, {
      title: d.Title,
      content: d.Content,
      status: "Closed",
      projectId: d.ProjectId,
      isImportant: d.IsImportant,
      followUpAt: d.FollowUpAt
    });
    await loadAll();
  } catch (e) {
    alert(e.message);
  }
};
// --------------------
// Navigation + Filters
// --------------------
function setActiveNav(view) {
  document.querySelectorAll("#nav a").forEach(a => a.classList.remove("active"));
  document.querySelector(`#nav a[data-view="${view}"]`)?.classList.add("active");
}

document.querySelectorAll("#nav a").forEach(a => {
  a.addEventListener("click", async (e) => {
    e.preventDefault();
    const view = a.dataset.view;

    state.projectFilterId = null;
    state.search = $("searchInput").value.trim();
    state.importantOnly = false;
    state.dueFilter = null;

    if (view === "important") state.importantOnly = true;
    if (view === "today") state.dueFilter = "today";
    if (view === "overdue") state.dueFilter = "overdue";
    if (view === "dashboard") state.dueFilter = null;

    setActiveNav(view);
    showView(view);

    await refreshTasks();
    await refreshDiscussions();
    renderAll();
  });
});

$("searchInput").addEventListener("input", debounce(async () => {
  state.search = $("searchInput").value.trim();
  await refreshTasks();
  renderAll();
}, 250));

window.filterByProject = async function (projectId) {
  state.projectFilterId = projectId;
  state.importantOnly = false;
  state.dueFilter = null;

  setActiveNav("tasks");
  showView("tasks");

  await refreshTasks();
  renderAll();
};


// --------------------
// + New Dropdown
// --------------------
const btnNew = $("btnNew");
const newMenu = $("newMenu");

function toggleNewMenu(force) {
  const show = typeof force === "boolean" ? force : (newMenu.style.display !== "block");
  newMenu.style.display = show ? "block" : "none";
}

btnNew?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleNewMenu();
});

document.addEventListener("click", () => toggleNewMenu(false));
newMenu?.addEventListener("click", (e) => {
  e.stopPropagation();
  const item = e.target.closest(".menuItem");
  if (!item) return;
  const action = item.dataset.action;

  toggleNewMenu(false);

  if (action === "newProject") openNewProject();
  if (action === "newTask") openNewTask();
  if (action === "newDiscussion") openNewDiscussion();
});


// --------------------
// Project Modal
// --------------------
function openModal(id) { $(id).classList.add("show"); }
function closeModal(id) { $(id).classList.remove("show"); }

$("btnNewProject")?.addEventListener("click", () => openNewProject());
$("closeProjectModal").addEventListener("click", () => closeModal("projectModal"));
$("pCancelBtn").addEventListener("click", () => closeModal("projectModal"));

function openNewProject() {
  editingProjectId = null;
  $("projectModalTitle").textContent = "New Project";
  $("pDeleteBtn").style.display = "none";
  $("pName").value = "";
  $("pDesc").value = "";
  $("pStatus").value = "Active";
  $("pStart").value = "";
  $("pTarget").value = "";
  openModal("projectModal");
}

window.openEditProject = function (id) {
  const p = state.projects.find(x => x.Id === id);
  if (!p) return;

  editingProjectId = id;
  $("projectModalTitle").textContent = "Edit Project";
  $("pDeleteBtn").style.display = "inline-block";

  $("pName").value = p.Name || "";
  $("pDesc").value = p.Description || "";
  $("pStatus").value = p.Status || "Active";
  $("pStart").value = localInputFromISO(p.StartDate);
  $("pTarget").value = localInputFromISO(p.TargetDate);

  openModal("projectModal");
};

$("pSaveBtn").addEventListener("click", async () => {
  try {
    const payload = {
      name: $("pName").value.trim(),
      description: $("pDesc").value.trim(),
      status: $("pStatus").value,
      startDate: isoFromLocalInput($("pStart").value),
      targetDate: isoFromLocalInput($("pTarget").value),
    };
    if (!payload.name) return alert("Project name required");

    if (!editingProjectId) await sbCreateProject(payload);
    else await sbUpdateProject(editingProjectId, payload);

    closeModal("projectModal");
    await loadAll();
  } catch (e) {
    alert(e.message);
  }
});

$("pDeleteBtn").addEventListener("click", async () => {
  if (!editingProjectId) return;
  if (!confirm("Delete this project (and all its tasks)?")) return;
  try {
    await sbDeleteProject(editingProjectId);
    closeModal("projectModal");
    await loadAll();
  } catch (e) {
    alert(e.message);
  }
});

// --------------------
// Task Modal
// --------------------
$("btnNewTask")?.addEventListener("click", () => openNewTask());
$("closeTaskModal").addEventListener("click", () => closeModal("taskModal"));
$("tCancelBtn").addEventListener("click", () => closeModal("taskModal"));

function openNewTask() {
  editingTaskId = null;
  $("taskModalTitle").textContent = "New Task";
  $("tDeleteBtn").style.display = "none";

  // clear multi-select
  Array.from($("tProjects").options).forEach(o => o.selected = false);

  $("tStatus").value = "Pending";
  $("tTitle").value = "";
  $("tDesc").value = "";
  $("tPriority").value = "Medium";
  $("tDeadline").value = "";
  $("tNotes").value = "";
  $("tIdeas").value = "";
  $("tImportant").value = "0";
  $("tEmailReminder").value = "1";
  $("tCustomAlert").value = "";

  openModal("taskModal");
}

window.openEditTask = function (id) {
  const t = state.tasks.find(x => x.Id === id);
  if (!t) return;

  editingTaskId = id;
  $("taskModalTitle").textContent = "Edit Task";
  $("tDeleteBtn").style.display = "inline-block";

  // select linked projects
  const selected = new Set(t.ProjectIds || []);
  Array.from($("tProjects").options).forEach(o => {
    o.selected = selected.has(o.value);
  });
  $("tStatus").value = t.Status || "Pending";
  $("tTitle").value = t.Title || "";
  $("tDesc").value = t.Description || "";
  $("tPriority").value = t.Priority || "Medium";
  $("tDeadline").value = localInputFromISO(t.Deadline);
  $("tNotes").value = t.Notes || "";
  $("tIdeas").value = t.Ideas || "";
  $("tImportant").value = t.IsImportant ? "1" : "0";
  $("tEmailReminder").value = t.EmailReminder ? "1" : "0";
  $("tCustomAlert").value = localInputFromISO(t.CustomAlertAt);

  openModal("taskModal");
};

$("tSaveBtn").addEventListener("click", async () => {
  try {
    const projectIds = Array.from($("tProjects").selectedOptions).map(o => o.value);

    const payload = {
      projectIds, // optional
      status: $("tStatus").value,
      title: $("tTitle").value.trim(),
      description: $("tDesc").value.trim(),
      priority: $("tPriority").value,
      deadline: isoFromLocalInput($("tDeadline").value),
      notes: $("tNotes").value.trim(),
      ideas: $("tIdeas").value.trim(),
      isImportant: $("tImportant").value === "1",
      emailReminder: $("tEmailReminder").value === "1",
      customAlertAt: isoFromLocalInput($("tCustomAlert").value),
    };

    if (!payload.title) return alert("Task title required");

    if (!editingTaskId) await sbCreateTask(payload);
    else await sbUpdateTask(editingTaskId, payload);

    closeModal("taskModal");
    await loadAll();
  } catch (e) {
    alert(e.message);
  }
});

$("tDeleteBtn").addEventListener("click", async () => {
  if (!editingTaskId) return;
  if (!confirm("Delete this task?")) return;
  try {
    await sbDeleteTask(editingTaskId);
    closeModal("taskModal");
    await loadAll();
  } catch (e) {
    alert(e.message);
  }
});

window.toggleImportant = async function (id) {
  try {
    const t = state.tasks.find(x => x.Id === id);
    if (!t) return;
    await sbSetTaskImportant(id, !t.IsImportant);
    await loadAll();
  } catch (e) {
    alert(e.message);
  }
};

window.quickDone = async function (id) {
  const t = state.tasks.find(x => x.Id === id);
  if (!t) return;
  try {
    await sbUpdateTask(id, {
      projectIds: t.ProjectIds || [],
      title: t.Title,
      description: t.Description,
      status: "Done",
      priority: t.Priority,
      deadline: t.Deadline,
      notes: t.Notes,
      ideas: t.Ideas,
      isImportant: t.IsImportant,
      emailReminder: t.EmailReminder,
      customAlertAt: t.CustomAlertAt
    });
    await loadAll();
  } catch (e) {
    alert(e.message);
  }
};

// --------------------
// Utilities
// --------------------
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// --------------------
// Init
// --------------------
(async function init() {
  showView("dashboard");
  setActiveNav("dashboard");
  try {
    await loadAll();
  } catch (e) {
    console.error(e);
    alert("Backend not running or DB not configured.\n" + e.message);
  }
})();
