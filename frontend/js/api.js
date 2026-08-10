// Thin fetch wrapper: attaches the JWT, parses JSON, and normalizes errors
// so every caller can just `await` and `catch (err) { err.message }`.
async function apiRequest(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (auth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  let response;
  try {
    response = await fetch(`${CONFIG.BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error("Could not reach the server. Is the backend running?");
  }

  if (auth && response.status === 401) {
    clearToken();
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.href = "login.html";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (response.status === 204) {
    return null;
  }

  let data = null;
  try {
    data = await response.json();
  } catch (parseErr) {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(extractErrorMessage(data, response.status));
    error.status = response.status;
    throw error;
  }

  return data;
}

function extractErrorMessage(data, status) {
  if (data && typeof data.detail === "string") {
    return data.detail;
  }
  if (data && Array.isArray(data.detail)) {
    return data.detail.map((item) => item.msg || JSON.stringify(item)).join("; ");
  }
  return `Request failed (${status})`;
}
