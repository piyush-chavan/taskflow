// localStorage keys and helpers, kept in one place.
const STORAGE_KEYS = {
  TOKEN: "taskflow_auth_token",
  PROJECTS_CACHE: "taskflow_projects_cache",
  taskCache(projectId) {
    return `taskflow_tasks_cache_${projectId}`;
  },
};

function getToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

function setToken(token) {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
}

function clearToken() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
}

function getCachedProjects() {
  const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS_CACHE);
  return raw ? JSON.parse(raw) : null;
}

function setCachedProjects(projects) {
  localStorage.setItem(STORAGE_KEYS.PROJECTS_CACHE, JSON.stringify(projects));
}

function getCachedTasks(projectId) {
  const raw = localStorage.getItem(STORAGE_KEYS.taskCache(projectId));
  return raw ? JSON.parse(raw) : null;
}

function setCachedTasks(projectId, tasks) {
  localStorage.setItem(STORAGE_KEYS.taskCache(projectId), JSON.stringify(tasks));
}
