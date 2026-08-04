// Shared helpers for showing per-button loading state while an API call is
// in flight, so the user always knows a request is running. No innerHTML —
// only the trailing text node (or textContent for icon-only buttons) is touched.

function getButtonText(button) {
  const textNode = Array.from(button.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
  );
  return textNode ? textNode.textContent.trim() : null;
}

function setButtonText(button, text) {
  const textNode = Array.from(button.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
  );
  if (textNode) {
    textNode.textContent = ` ${text}`;
  } else if (button.querySelector("i")) {
    button.appendChild(document.createTextNode(` ${text}`));
  } else {
    button.textContent = text;
  }
}

// For buttons with a leading <i> icon and a text label (e.g. "Add task").
// Disables the button, swaps the icon to a spinner, and swaps the label to
// `loadingLabel` for the duration of `task`, then restores both either way.
async function withButtonLoading(button, loadingLabel, task) {
  const icon = button.querySelector("i");
  const originalIconClass = icon ? icon.className : null;
  const originalText = getButtonText(button);

  button.disabled = true;
  if (icon) icon.className = "fa-solid fa-spinner fa-spin";
  if (originalText !== null) setButtonText(button, loadingLabel);

  try {
    return await task();
  } finally {
    button.disabled = false;
    if (icon && originalIconClass) icon.className = originalIconClass;
    if (originalText !== null) setButtonText(button, originalText);
  }
}

// For icon-only buttons (edit/delete controls) — just spins the icon and
// disables the button; there is no visible label to change.
function setIconButtonLoading(button, isLoading) {
  const icon = button.querySelector("i");
  if (isLoading) {
    if (icon) button.dataset.originalIcon = icon.className;
    button.disabled = true;
    if (icon) icon.className = "fa-solid fa-spinner fa-spin";
  } else {
    button.disabled = false;
    if (icon && button.dataset.originalIcon) {
      icon.className = button.dataset.originalIcon;
    }
    delete button.dataset.originalIcon;
  }
}
