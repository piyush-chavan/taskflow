// Powers login.html and register.html — whichever form is present gets wired up.
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) wireLoginForm(loginForm);

  const registerForm = document.getElementById("register-form");
  if (registerForm) wireRegisterForm(registerForm);
});

function clearErrorOnInput(input, errorEl) {
  input.addEventListener("input", () => {
    if (input.value.trim()) {
      errorEl.textContent = "";
    }
  });
}

function wireLoginForm(form) {
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const emailError = document.getElementById("login-email-error");
  const passwordError = document.getElementById("login-password-error");

  clearErrorOnInput(emailInput, emailError);
  clearErrorOnInput(passwordInput, passwordError);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    let valid = true;
    if (!email) {
      emailError.textContent = "Email is required.";
      valid = false;
    }
    if (!password) {
      passwordError.textContent = "Password is required.";
      valid = false;
    }
    if (!valid) return;

    const submitBtn = form.querySelector("button[type=submit]");

    try {
      const data = await withButtonLoading(submitBtn, "Logging in...", () =>
        apiRequest("/auth/login", {
          method: "POST",
          auth: false,
          body: { email, password },
        })
      );
      setToken(data.access_token);
      showToast("Logged in successfully", "success");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 500);
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

function wireRegisterForm(form) {
  const nameInput = document.getElementById("register-name");
  const emailInput = document.getElementById("register-email");
  const passwordInput = document.getElementById("register-password");
  const nameError = document.getElementById("register-name-error");
  const emailError = document.getElementById("register-email-error");
  const passwordError = document.getElementById("register-password-error");

  clearErrorOnInput(nameInput, nameError);
  clearErrorOnInput(emailInput, emailError);
  clearErrorOnInput(passwordInput, passwordError);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    let valid = true;
    if (!name) {
      nameError.textContent = "Name is required.";
      valid = false;
    }
    if (!email) {
      emailError.textContent = "Email is required.";
      valid = false;
    }
    if (!password || password.length < 8) {
      passwordError.textContent = "Password must be at least 8 characters.";
      valid = false;
    }
    if (!valid) return;

    const submitBtn = form.querySelector("button[type=submit]");

    try {
      await withButtonLoading(submitBtn, "Creating account...", async () => {
        await apiRequest("/auth/register", {
          method: "POST",
          auth: false,
          body: { name, email, password },
        });

        const loginData = await apiRequest("/auth/login", {
          method: "POST",
          auth: false,
          body: { email, password },
        });
        setToken(loginData.access_token);
      });

      showToast("Account created — welcome to TaskFlow!", "success");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 500);
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}
