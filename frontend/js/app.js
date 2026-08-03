// Dashboard logic for index.html: projects list -> tasks list, add/edit/delete,
// AI quick-add, and localStorage caching so the page is never blank on load.

let currentProjects = [];
let currentProject = null;
let currentTasks = [];

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

    const taskCounts = new Map(stats.map((s) => [s.project_id, s.total_tasks]));
    currentProjects = projects.map((project) => ({
      ...project,
      taskCount: taskCounts.get(project.id) ?? 0,
    }));

    setCachedProjects(currentProjects);
    renderProjects(currentProjects);
  } catch (err) {
    showToast(err.message, "error");
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
    handleDeleteProject(project);
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

  card.appendChild(footer);

  card.addEventListener("click", () => selectProject(project));

  return card;
}

function wireAddProjectForm() {
  const form = document.getElementById("add-project-form");
  const nameInput = document.getElementById("project-name-input");
  const descriptionInput = document.getElementById("project-description-input");
  const errorEl = document.getElementById("project-name-error");

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
      const created = await apiRequest("/projects/", {
        method: "POST",
        body: { name, description: descriptionInput.value.trim() || null },
      });
      created.taskCount = 0;
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

async function handleDeleteProject(project) {
  if (!window.confirm(`Delete project "${project.name}" and all its tasks?`)) return;

  try {
    await apiRequest(`/projects/${project.id}`, { method: "DELETE" });
    currentProjects = currentProjects.filter((p) => p.id !== project.id);
    setCachedProjects(currentProjects);
    renderProjects(currentProjects);
    showToast("Project deleted", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* ===================== Tasks ===================== */

function selectProject(project) {
  currentProject = project;

  document.getElementById("projects-view").classList.add("hidden");
  document.getElementById("tasks-view").classList.remove("hidden");
  document.getElementById("tasks-project-name").textContent = project.name;
  document.getElementById("tasks-project-description").textContent = project.description || "";

  // Show the cached copy immediately, then refresh from the live backend.
  const cached = getCachedTasks(project.id);
  currentTasks = cached || [];
  renderTasks(currentTasks);

  loadTasksForProject(project.id);
}

function wireBackButton() {
  document.getElementById("back-to-projects").addEventListener("click", () => {
    currentProject = null;
    document.getElementById("tasks-view").classList.add("hidden");
    document.getElementById("projects-view").classList.remove("hidden");
    loadProjects();
  });
}

async function loadTasksForProject(projectId) {
  try {
    const allTasks = await apiRequest("/tasks/");
    const tasks = allTasks.filter((task) => task.project_id === projectId);
    currentTasks = tasks;
    setCachedTasks(projectId, tasks);
    renderTasks(currentTasks);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function persistTaskCache() {
  if (currentProject) {
    setCachedTasks(currentProject.id, currentTasks);
  }
}

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
  deleteBtn.addEventListener("click", () => handleDeleteTask(task));
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
      const updated = await apiRequest(`/tasks/${task.id}`, {
        method: "PUT",
        body: {
          title: trimmedTitle,
          description: descInput.value.trim() || null,
          due_date: dueInput.value.trim() || null,
          priority: prioritySelect.value,
          status: statusSelect.value,
        },
      });

      const index = currentTasks.findIndex((t) => t.id === task.id);
      if (index !== -1) currentTasks[index] = updated;
      persistTaskCache();
      renderTasks(currentTasks);
      showToast("Task updated", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  item.replaceChildren(form);
}

async function handleDeleteTask(task) {
  if (!window.confirm(`Delete "${task.title}"?`)) return;

  try {
    await apiRequest(`/tasks/${task.id}`, { method: "DELETE" });
    currentTasks = currentTasks.filter((t) => t.id !== task.id);
    persistTaskCache();
    renderTasks(currentTasks);
    showToast("Task deleted", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

function wireAddTaskForm() {
  const form = document.getElementById("add-task-form");
  const titleInput = document.getElementById("task-title-input");
  const titleError = document.getElementById("task-title-error");
  const descriptionInput = document.getElementById("task-description-input");
  const dueDateInput = document.getElementById("task-due-date-input");
  const priorityInput = document.getElementById("task-priority-input");

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
      const created = await apiRequest("/tasks/", {
        method: "POST",
        body: {
          title,
          description: descriptionInput.value.trim() || null,
          priority: priorityInput.value,
          due_date: dueDateInput.value.trim() || null,
          project_id: currentProject.id,
        },
      });

      currentTasks.push(created);
      persistTaskCache();
      renderTasks(currentTasks);
      form.reset();
      priorityInput.value = "medium";
      showToast("Task added", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

function wireQuickAddForm() {
  const form = document.getElementById("quick-add-form");
  const descriptionInput = document.getElementById("quick-add-input");
  const errorEl = document.getElementById("quick-add-error");

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
      const created = await apiRequest("/tasks/quick-add", {
        method: "POST",
        body: { description, project_id: currentProject.id },
      });

      currentTasks.push(created);
      persistTaskCache();
      renderTasks(currentTasks);
      form.reset();
      showToast(`Task added via AI: "${created.title}"`, "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}
