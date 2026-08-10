// Dashboard logic for index.html: projects list -> tasks list, add/edit/delete,
// AI quick-add, sorting, stats, and localStorage caching so the page is never
// blank on load.

let currentProjects = [];
let currentProject = null;
let currentTasks = [];
let currentSort = null; // null | "priority" | "due_date"
let searchDebounceTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  wireHeader();
  wireAddProjectForm();
  wireAddTaskForm();
  wireQuickAddForm();
  wireBackButton();
  wireSortToggle();
  wireSearch();
  wireAddTaskModal();

  // Render whatever we have cached immediately, so the page is never blank
  // while the live request below is in flight.
  const cachedProjects = getCachedProjects();
  if (cachedProjects && cachedProjects.length) {
    currentProjects = cachedProjects;
    renderProjects(currentProjects);
  }

  loadCurrentUser();
  loadProjects();
});

/* ===================== Header ===================== */

function wireHeader() {
  document.getElementById("logout-btn").addEventListener("click", () => {
    clearToken();
    window.location.href = "login.html";
  });
}

async function loadCurrentUser() {
  try {
    const me = await apiRequest("/auth/me");
    document.getElementById("current-user-name").textContent = `Hi, ${me.name}`;
  } catch (err) {
    // apiRequest already redirects to login on 401; nothing else to do here.
  }
}

/* ===================== Projects ===================== */

async function loadProjects() {
  try {
    const [projects, stats] = await Promise.all([
      apiRequest("/projects/"),
      apiRequest("/projects/stats"),
    ]);

    const statsByProject = new Map(stats.map((s) => [s.project_id, s]));
    currentProjects = projects.map((project) => {
      const projectStats = statsByProject.get(project.id) || {
        project_id: project.id,
        project_name: project.name,
        total_tasks: 0,
        by_status: [],
      };
      return { ...project, taskCount: projectStats.total_tasks, stats: projectStats };
    });

    setCachedProjects(currentProjects);
    renderProjects(currentProjects);

    // Keep the open project's stats panel in sync if we're inside a project.
    if (currentProject) {
      const refreshed = currentProjects.find((p) => p.id === currentProject.id);
      if (refreshed) {
        currentProject = refreshed;
        renderProjectStats(currentProject.stats);
      }
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Re-fetches just the stats endpoint and updates the open project's panel +
// its task count badge back on the projects grid, without refetching tasks.
async function refreshCurrentProjectStats() {
  if (!currentProject) return;

  try {
    const stats = await apiRequest("/projects/stats");
    const match = stats.find((s) => s.project_id === currentProject.id) || {
      project_id: currentProject.id,
      project_name: currentProject.name,
      total_tasks: 0,
      by_status: [],
    };

    currentProject.stats = match;
    currentProject.taskCount = match.total_tasks;
    renderProjectStats(match);

    const projectInList = currentProjects.find((p) => p.id === currentProject.id);
    if (projectInList) {
      projectInList.stats = match;
      projectInList.taskCount = match.total_tasks;
      setCachedProjects(currentProjects);
    }
  } catch (err) {
    // Non-fatal: the primary action already succeeded and reported its own
    // toast, so a failed stats refresh just leaves the panel momentarily stale.
  }
}

function renderProjects(projects) {
  const list = document.getElementById("projects-list");
  const empty = document.getElementById("projects-empty");
  list.replaceChildren();

  if (!projects || projects.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  projects.forEach((project) => list.appendChild(createProjectCard(project)));
}

function createProjectCard(project) {
  const card = document.createElement("div");
  card.className = "project-card";

  const header = document.createElement("div");
  header.className = "project-card-header";

  const name = document.createElement("h3");
  name.textContent = project.name;
  header.appendChild(name);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "icon-btn icon-btn-danger";
  deleteBtn.title = "Delete project";
  const trashIcon = document.createElement("i");
  trashIcon.className = "fa-solid fa-trash";
  deleteBtn.appendChild(trashIcon);
  deleteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    handleDeleteProject(project, deleteBtn);
  });
  header.appendChild(deleteBtn);

  card.appendChild(header);

  if (project.description) {
    const description = document.createElement("p");
    description.className = "project-card-description";
    description.textContent = project.description;
    card.appendChild(description);
  }

  const footer = document.createElement("div");
  footer.className = "project-card-footer";

  const countBadge = document.createElement("span");
  countBadge.className = "badge badge-count";
  const listIcon = document.createElement("i");
  listIcon.className = "fa-solid fa-list-check";
  countBadge.appendChild(listIcon);
  const countText = document.createElement("span");
  countText.textContent = `${project.taskCount ?? 0} task${project.taskCount === 1 ? "" : "s"}`;
  countBadge.appendChild(countText);
  footer.appendChild(countBadge);

  const statusCounts = new Map(
    (project.stats?.by_status || []).map((entry) => [entry.status, entry.count])
  );
  ["pending", "in_progress", "completed"].forEach((status) => {
    footer.appendChild(createStatusCountBadge(status, statusCounts.get(status) ?? 0));
  });

  card.appendChild(footer);

  card.addEventListener("click", () => selectProject(project));

  return card;
}

function wireAddProjectForm() {
  const form = document.getElementById("add-project-form");
  const nameInput = document.getElementById("project-name-input");
  const descriptionInput = document.getElementById("project-description-input");
  const errorEl = document.getElementById("project-name-error");
  const submitBtn = form.querySelector("button[type=submit]");

  nameInput.addEventListener("input", () => {
    if (nameInput.value.trim()) errorEl.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();
    if (!name) {
      errorEl.textContent = "Project name is required.";
      return;
    }
    errorEl.textContent = "";

    try {
      const created = await withButtonLoading(submitBtn, "Adding...", () =>
        apiRequest("/projects/", {
          method: "POST",
          body: { name, description: descriptionInput.value.trim() || null },
        })
      );
      created.taskCount = 0;
      created.stats = { project_id: created.id, project_name: created.name, total_tasks: 0, by_status: [] };
      currentProjects.push(created);
      setCachedProjects(currentProjects);
      renderProjects(currentProjects);
      form.reset();
      showToast("Project created", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

async function handleDeleteProject(project, button) {
  if (!window.confirm(`Delete project "${project.name}" and all its tasks?`)) return;

  try {
    setIconButtonLoading(button, true);
    await apiRequest(`/projects/${project.id}`, { method: "DELETE" });
    currentProjects = currentProjects.filter((p) => p.id !== project.id);
    setCachedProjects(currentProjects);
    renderProjects(currentProjects);
    showToast("Project deleted", "success");
  } catch (err) {
    showToast(err.message, "error");
    setIconButtonLoading(button, false);
  }
}

/* ===================== Add task modal ===================== */

function wireAddTaskModal() {
  const modal = document.getElementById("add-task-modal");
  const openBtn = document.getElementById("open-add-task-btn");
  const closeBtn = document.getElementById("close-add-task-modal-btn");

  openBtn.addEventListener("click", () => openAddTaskModal());
  closeBtn.addEventListener("click", () => closeAddTaskModal());

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeAddTaskModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeAddTaskModal();
    }
  });
}

function openAddTaskModal() {
  document.getElementById("add-task-modal").classList.remove("hidden");
}

function closeAddTaskModal() {
  document.getElementById("add-task-modal").classList.add("hidden");
}

/* ===================== Tasks ===================== */

function selectProject(project) {
  currentProject = project;
  currentSort = null;
  resetSortToggleUI();
  resetSearchUI();

  document.getElementById("projects-view").classList.add("hidden");
  document.getElementById("tasks-view").classList.remove("hidden");
  document.getElementById("tasks-project-name").textContent = project.name;
  document.getElementById("tasks-project-description").textContent = project.description || "";

  // Show whatever we already know immediately (cached tasks, cached stats),
  // then refresh both from the live backend.
  const cached = getCachedTasks(project.id);
  currentTasks = cached || [];
  applySearchFilter();
  renderProjectStats(project.stats || { total_tasks: project.taskCount ?? 0, by_status: [] });

  loadTasksForProject(project.id);
  refreshCurrentProjectStats();
}

function wireBackButton() {
  const backBtn = document.getElementById("back-to-projects");

  backBtn.addEventListener("click", async () => {
    currentProject = null;
    document.getElementById("tasks-view").classList.add("hidden");
    document.getElementById("projects-view").classList.remove("hidden");

    await withButtonLoading(backBtn, "Loading...", () => loadProjects());
  });
}

async function loadTasksForProject(projectId) {
  try {
    const query = currentSort ? `?sort=${currentSort}` : "";
    const allTasks = await apiRequest(`/tasks/${query}`);
    const tasks = allTasks.filter((task) => task.project_id === projectId);
    currentTasks = tasks;
    setCachedTasks(projectId, tasks);
    applySearchFilter();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function persistTaskCache() {
  if (currentProject) {
    setCachedTasks(currentProject.id, currentTasks);
  }
}

/* ---------- Sorting ---------- */

function wireSortToggle() {
  const priorityBtn = document.getElementById("sort-priority-btn");
  const dueDateBtn = document.getElementById("sort-due-date-btn");

  priorityBtn.addEventListener("click", () => handleSortToggle("priority", priorityBtn, dueDateBtn));
  dueDateBtn.addEventListener("click", () => handleSortToggle("due_date", dueDateBtn, priorityBtn));
}

function resetSortToggleUI() {
  document.getElementById("sort-priority-btn").classList.remove("active");
  document.getElementById("sort-due-date-btn").classList.remove("active");
}

async function handleSortToggle(sortValue, clickedBtn, otherBtn) {
  if (!currentProject) return;

  currentSort = currentSort === sortValue ? null : sortValue;
  clickedBtn.classList.toggle("active", currentSort === sortValue);
  otherBtn.classList.remove("active");

  otherBtn.disabled = true;
  setIconButtonLoading(clickedBtn, true);
  try {
    await loadTasksForProject(currentProject.id);
  } finally {
    setIconButtonLoading(clickedBtn, false);
    otherBtn.disabled = false;
  }
}

/* ---------- Search ---------- */

function wireSearch() {
  const searchInput = document.getElementById("task-search-input");
  const exactToggle = document.getElementById("exact-search-toggle");

  searchInput.addEventListener("input", () => scheduleSearch());
  exactToggle.addEventListener("change", () => scheduleSearch());
}

function resetSearchUI() {
  document.getElementById("task-search-input").value = "";
  document.getElementById("exact-search-toggle").checked = false;
}

function scheduleSearch() {
  const exactToggle = document.getElementById("exact-search-toggle");
  clearTimeout(searchDebounceTimer);

  if (exactToggle.checked) {
    // Debounce the exact mode since it hits the backend on every change.
    searchDebounceTimer = setTimeout(applySearchFilter, 350);
  } else {
    applySearchFilter();
  }
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Single rendering entry point once a project's tasks are loaded: decides
// whether to show the full list, a partial-match (frontend regex) subset,
// or an exact-match (backend) result, based on the current search UI state.
async function applySearchFilter() {
  const searchInput = document.getElementById("task-search-input");
  const exactToggle = document.getElementById("exact-search-toggle");
  const query = searchInput.value.trim();

  if (!query) {
    renderTasks(currentTasks);
    return;
  }

  if (!exactToggle.checked) {
    let regex = null;
    try {
      regex = new RegExp(escapeRegExp(query), "i");
    } catch (err) {
      regex = null;
    }
    const filtered = currentTasks.filter((task) =>
      regex ? regex.test(task.title) : task.title.toLowerCase().includes(query.toLowerCase())
    );
    renderTasks(filtered);
    return;
  }

  if (!currentProject) return;

  try {
    const result = await apiRequest(`/tasks/search?title=${encodeURIComponent(query)}&algo=binary`);
    if (result && result.project_id === currentProject.id) {
      renderTasks([result]);
    } else {
      renderTasks([]);
    }
  } catch (err) {
    if (err.status === 404) {
      renderTasks([]);
    } else {
      showToast(err.message, "error");
    }
  }
}

/* ---------- Stats panel ---------- */

function renderProjectStats(stats) {
  const panel = document.getElementById("project-stats");
  if (!panel || !stats) return;
  panel.replaceChildren();

  panel.appendChild(
    createStatTile("Total tasks", stats.total_tasks ?? 0, "fa-solid fa-list-check")
  );

  (stats.by_status || []).forEach((entry) => {
    panel.appendChild(
      createStatTile(formatStatusLabel(entry.status), entry.count, statusIcon(entry.status))
    );
  });
}

function createStatTile(label, value, iconClass) {
  const tile = document.createElement("div");
  tile.className = "stat-tile";

  const icon = document.createElement("i");
  icon.className = iconClass;
  tile.appendChild(icon);

  const textWrap = document.createElement("div");
  textWrap.className = "stat-tile-text";

  const valueEl = document.createElement("span");
  valueEl.className = "stat-value";
  valueEl.textContent = value;
  textWrap.appendChild(valueEl);

  const labelEl = document.createElement("span");
  labelEl.className = "stat-label";
  labelEl.textContent = label;
  textWrap.appendChild(labelEl);

  tile.appendChild(textWrap);
  return tile;
}

function formatStatusLabel(status) {
  return status.replace("_", " ");
}

function statusIcon(status) {
  if (status === "completed") return "fa-solid fa-circle-check";
  if (status === "in_progress") return "fa-solid fa-spinner";
  return "fa-solid fa-hourglass-half";
}

function createStatusCountBadge(status, count) {
  const badge = document.createElement("span");
  badge.className = `badge badge-status-${status}`;

  const icon = document.createElement("i");
  icon.className = statusIcon(status);
  badge.appendChild(icon);

  const text = document.createElement("span");
  text.textContent = `${count} ${formatStatusLabel(status)}`;
  badge.appendChild(text);

  return badge;
}

/* ---------- Rendering task items ---------- */

function renderTasks(tasks) {
  const list = document.getElementById("task-list");
  const empty = document.getElementById("task-list-empty");
  list.replaceChildren();

  if (!tasks || tasks.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  tasks.forEach((task) => list.appendChild(createTaskElement(task)));
}

function createTaskElement(task) {
  const item = document.createElement("div");
  item.className = "task-item";
  item.dataset.taskId = task.id;
  renderTaskView(item, task);
  return item;
}

function renderTaskView(item, task) {
  const main = document.createElement("div");
  main.className = "task-main";

  const titleRow = document.createElement("div");
  titleRow.className = "task-title-row";

  const statusDot = document.createElement("span");
  statusDot.className = `status-dot status-${task.status}`;
  titleRow.appendChild(statusDot);

  const title = document.createElement("span");
  title.className = "task-title";
  if (task.status === "completed") title.classList.add("task-title-done");
  title.textContent = task.title;
  titleRow.appendChild(title);

  main.appendChild(titleRow);

  if (task.description) {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    main.appendChild(description);
  }

  const meta = document.createElement("div");
  meta.className = "task-meta";

  const priorityBadge = document.createElement("span");
  priorityBadge.className = `badge badge-priority-${task.priority}`;
  priorityBadge.textContent = task.priority;
  meta.appendChild(priorityBadge);

  const statusBadge = document.createElement("span");
  statusBadge.className = `badge badge-status-${task.status}`;
  statusBadge.textContent = task.status.replace("_", " ");
  meta.appendChild(statusBadge);

  if (task.due_date) {
    const due = document.createElement("span");
    due.className = "badge badge-due";
    const icon = document.createElement("i");
    icon.className = "fa-regular fa-calendar";
    due.appendChild(icon);
    const dueText = document.createElement("span");
    dueText.textContent = task.due_date;
    due.appendChild(dueText);
    meta.appendChild(due);
  }

  main.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "icon-btn";
  editBtn.title = "Edit task";
  const editIcon = document.createElement("i");
  editIcon.className = "fa-solid fa-pen";
  editBtn.appendChild(editIcon);
  editBtn.addEventListener("click", () => renderTaskEdit(item, task));
  actions.appendChild(editBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "icon-btn icon-btn-danger";
  deleteBtn.title = "Delete task";
  const deleteIcon = document.createElement("i");
  deleteIcon.className = "fa-solid fa-trash";
  deleteBtn.appendChild(deleteIcon);
  deleteBtn.addEventListener("click", () => handleDeleteTask(task, deleteBtn));
  actions.appendChild(deleteBtn);

  item.replaceChildren(main, actions);
}

function renderTaskEdit(item, task) {
  const form = document.createElement("form");
  form.className = "task-edit-form";

  const titleField = document.createElement("div");
  titleField.className = "field";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = task.title;
  const titleError = document.createElement("span");
  titleError.className = "field-error";
  titleInput.addEventListener("input", () => {
    if (titleInput.value.trim()) titleError.textContent = "";
  });
  titleField.appendChild(titleInput);
  titleField.appendChild(titleError);
  form.appendChild(titleField);

  const descInput = document.createElement("textarea");
  descInput.rows = 2;
  descInput.value = task.description || "";
  descInput.placeholder = "Description (optional)";
  form.appendChild(descInput);

  const row = document.createElement("div");
  row.className = "field-row";

  const dueInput = document.createElement("input");
  dueInput.type = "text";
  dueInput.value = task.due_date || "";
  dueInput.placeholder = "Due date";
  row.appendChild(dueInput);

  const prioritySelect = document.createElement("select");
  ["low", "medium", "high"].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    if (value === task.priority) option.selected = true;
    prioritySelect.appendChild(option);
  });
  row.appendChild(prioritySelect);

  const statusSelect = document.createElement("select");
  ["pending", "in_progress", "completed"].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value.replace("_", " ");
    if (value === task.status) option.selected = true;
    statusSelect.appendChild(option);
  });
  row.appendChild(statusSelect);

  form.appendChild(row);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "btn btn-primary btn-small";
  saveBtn.textContent = "Save";
  actions.appendChild(saveBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn-ghost btn-small";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => renderTaskView(item, task));
  actions.appendChild(cancelBtn);

  form.appendChild(actions);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const trimmedTitle = titleInput.value.trim();
    if (!trimmedTitle) {
      titleError.textContent = "Title cannot be empty.";
      return;
    }
    titleError.textContent = "";

    try {
      const updated = await withButtonLoading(saveBtn, "Saving...", () =>
        apiRequest(`/tasks/${task.id}`, {
          method: "PUT",
          body: {
            title: trimmedTitle,
            description: descInput.value.trim() || null,
            due_date: dueInput.value.trim() || null,
            priority: prioritySelect.value,
            status: statusSelect.value,
          },
        })
      );

      const index = currentTasks.findIndex((t) => t.id === task.id);
      if (index !== -1) currentTasks[index] = updated;
      persistTaskCache();
      applySearchFilter();
      showToast("Task updated", "success");
      refreshCurrentProjectStats();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  item.replaceChildren(form);
}

async function handleDeleteTask(task, button) {
  if (!window.confirm(`Delete "${task.title}"?`)) return;

  try {
    setIconButtonLoading(button, true);
    await apiRequest(`/tasks/${task.id}`, { method: "DELETE" });
    currentTasks = currentTasks.filter((t) => t.id !== task.id);
    persistTaskCache();
    applySearchFilter();
    showToast("Task deleted", "success");
    refreshCurrentProjectStats();
  } catch (err) {
    showToast(err.message, "error");
    setIconButtonLoading(button, false);
  }
}

function wireAddTaskForm() {
  const form = document.getElementById("add-task-form");
  const titleInput = document.getElementById("task-title-input");
  const titleError = document.getElementById("task-title-error");
  const descriptionInput = document.getElementById("task-description-input");
  const dueDateInput = document.getElementById("task-due-date-input");
  const priorityInput = document.getElementById("task-priority-input");
  const submitBtn = form.querySelector("button[type=submit]");

  titleInput.addEventListener("input", () => {
    if (titleInput.value.trim()) titleError.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentProject) return;

    const title = titleInput.value.trim();
    if (!title) {
      titleError.textContent = "Title is required.";
      return;
    }
    titleError.textContent = "";

    try {
      const created = await withButtonLoading(submitBtn, "Adding...", () =>
        apiRequest("/tasks/", {
          method: "POST",
          body: {
            title,
            description: descriptionInput.value.trim() || null,
            priority: priorityInput.value,
            due_date: dueDateInput.value.trim() || null,
            project_id: currentProject.id,
          },
        })
      );

      currentTasks.push(created);
      persistTaskCache();
      applySearchFilter();
      form.reset();
      priorityInput.value = "medium";
      showToast("Task added", "success");
      refreshCurrentProjectStats();
      closeAddTaskModal();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

function wireQuickAddForm() {
  const form = document.getElementById("quick-add-form");
  const descriptionInput = document.getElementById("quick-add-input");
  const errorEl = document.getElementById("quick-add-error");
  const submitBtn = form.querySelector("button[type=submit]");

  descriptionInput.addEventListener("input", () => {
    if (descriptionInput.value.trim()) errorEl.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentProject) return;

    const description = descriptionInput.value.trim();
    if (!description) {
      errorEl.textContent = "Describe the task first.";
      return;
    }
    errorEl.textContent = "";

    try {
      const created = await withButtonLoading(submitBtn, "Adding...", () =>
        apiRequest("/tasks/quick-add", {
          method: "POST",
          body: { description, project_id: currentProject.id },
        })
      );

      currentTasks.push(created);
      persistTaskCache();
      applySearchFilter();
      form.reset();
      showToast(`Task added via AI: "${created.title}"`, "success");
      refreshCurrentProjectStats();
      closeAddTaskModal();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}
