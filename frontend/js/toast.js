// Lightweight toast notifications, built entirely with DOM APIs (no innerHTML).
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icon = document.createElement("i");
  icon.className = `fa-solid ${toastIcon(type)} toast-icon`;
  toast.appendChild(icon);

  const text = document.createElement("span");
  text.textContent = message;
  toast.appendChild(text);

  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3200);
}

function toastIcon(type) {
  if (type === "success") return "fa-circle-check";
  if (type === "error") return "fa-circle-exclamation";
  return "fa-circle-info";
}
