// Written with Claude Code
// Login / register screen.

import { login, register } from "./api.js";
import { setToken } from "./auth.js";
import { el, icon, PLATFORMS, platformTile } from "./util.js";

function field(id, labelText, type, extra = {}) {
  const input = el("input", { attrs: { id, type, required: true, ...extra } });
  const error = el("div", { className: "field-error", attrs: { id: `${id}-error`, "aria-live": "polite" } });
  const wrapper = el("div", { className: "field" }, el("label", { text: labelText, attrs: { for: id } }), input, error);
  return { wrapper, input, error };
}

// Turns an API error into one message. A 422 detail is a list of {loc, msg}.
export function errorMessage(error) {
  if (Array.isArray(error.detail)) {
    return error.detail.map((d) => d.msg).join(" ");
  }
  return error.message;
}

export function renderLogin(root, onSignedIn) {
  let mode = "signin";

  // Only shown on the Create account tab. Optional: the API accepts an account without a name.
  const name = field("login-name", "Name (optional)", "text", { autocomplete: "name", maxlength: "200", required: false, placeholder: "Your name" });
  const email = field("login-email", "Email", "email", { autocomplete: "email", placeholder: "you@example.com" });
  const password = field("login-password", "Password", "password", { placeholder: "Your password" });
  const banner = el("div", { className: "banner", attrs: { role: "alert", hidden: true } });
  const submit = el("button", { className: "btn btn-primary", attrs: { type: "submit" } });

  const signinTab = el("button", { className: "tab", text: "Sign in", attrs: { type: "button" } });
  const registerTab = el("button", { className: "tab", text: "Create account", attrs: { type: "button" } });

  function setMode(next) {
    mode = next;
    signinTab.setAttribute("aria-pressed", String(mode === "signin"));
    registerTab.setAttribute("aria-pressed", String(mode === "register"));
    submit.textContent = mode === "signin" ? "Sign in" : "Create account";
    name.wrapper.hidden = mode !== "register";
    password.input.autocomplete = mode === "signin" ? "current-password" : "new-password";
    // The API requires 8+ characters for a new password (not for signing in).
    if (mode === "register") password.input.setAttribute("minlength", "8");
    else password.input.removeAttribute("minlength");
    banner.hidden = true;
  }
  signinTab.addEventListener("click", () => setMode("signin"));
  registerTab.addEventListener("click", () => setMode("register"));

  const form = el("form", { attrs: { novalidate: false } }, name.wrapper, email.wrapper, password.wrapper, banner, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    banner.hidden = true;
    submit.disabled = true;
    try {
      if (mode === "register") {
        await register(email.input.value, password.input.value, name.input.value);
        // The account exists now. If the login below fails, a retry must not register again (409).
        setMode("signin");
      }
      const result = await login(email.input.value, password.input.value);
      setToken(result.access_token);
      onSignedIn();
    } catch (error) {
      banner.textContent = errorMessage(error); // textContent, never innerHTML
      banner.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  const badges = el("div", { className: "badges" });
  for (const platform of PLATFORMS.filter((p) => p.value !== "Other")) {
    // Colored name tiles, not logos: they keep the row even and match the design.
    badges.append(platformTile(platform.value));
  }

  const wordmark = el("h1", { className: "wordmark", text: "GAME" }, el("br"), el("span", { text: "TRACKER" }));
  const card = el(
    "div",
    { className: "card login-card" },
    el("div", { className: "tabs" }, signinTab, registerTab),
    form,
  );

  setMode("signin");
  root.replaceChildren(
    el("main", { className: "login-page" },
      el("div", { className: "login-hero" },
        el("div", { className: "login-hero-inner" },
          el("div", { className: "login-mark" }, icon("gamepad", false, 44)),
          wordmark,
          el("p", { className: "tagline", text: "Your backlog and wishlist, sorted by platform. See what you are playing, what you finished, and what is coming out next." }),
          badges)),
      el("div", { className: "login-panel" }, card)),
  );
}
