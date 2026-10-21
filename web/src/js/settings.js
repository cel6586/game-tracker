// Written with Claude Code
// Settings screen: account, appearance, delete account.

import { changePassword, deleteMe, updateMe } from "./api.js";
import { clearToken, getCachedUser, setCachedUser } from "./auth.js";
import { confirmDialog } from "./dialogs.js";
import { errorMessage } from "./login.js";
import { el } from "./util.js";

const THEME_KEY = "gt_theme";
const THEMES = [["dark", "Dark"], ["midnight", "Midnight"], ["light", "Light"]];

export function applyTheme() {
  let theme = "dark";
  try {
    theme = localStorage.getItem(THEME_KEY) || "dark";
  } catch {
    // storage blocked: keep the default
  }
  document.documentElement.dataset.theme = theme;
  return theme;
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // the theme still applies for this visit
  }
  applyTheme();
}

function labeledInput(id, labelText, type, value = "", extra = {}) {
  const input = el("input", { attrs: { id, type, required: true, ...extra } });
  input.value = value;
  return { input, wrapper: el("div", { className: "field" }, el("label", { text: labelText, attrs: { for: id } }), input) };
}

// A message line that is either an error banner or a green success note.
function messageBox() {
  const box = el("div", { attrs: { role: "status", hidden: true } });
  return {
    box,
    show(text, isError) {
      box.className = isError ? "banner" : "message-ok";
      box.textContent = text;
      box.hidden = false;
    },
    hide() { box.hidden = true; },
  };
}

function accountSection() {
  const user = getCachedUser();
  const name = labeledInput("s-name", "Name", "text", user?.name || "", { required: false, autocomplete: "name", maxlength: "200" });
  const email = labeledInput("s-email", "Email", "email", user?.email || "");
  const message = messageBox();
  const form = el("form", {}, name.wrapper, email.wrapper, message.box, el("button", { className: "btn btn-primary", text: "Save changes", attrs: { type: "submit" } }));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hide();
    try {
      // A blank name is sent as null so it clears the saved one.
      const updated = await updateMe({ name: name.input.value.trim() || null, email: email.input.value });
      setCachedUser(updated);
      const sidebarEmail = document.querySelector(".user-email");
      if (sidebarEmail) sidebarEmail.textContent = updated.email;
      message.show("Account updated.", false);
    } catch (error) {
      message.show(errorMessage(error), true); // includes the 409 "email already exists"
    }
  });

  const current = labeledInput("s-current", "Current password", "password", "", { autocomplete: "current-password" });
  const next = labeledInput("s-new", "New password", "password", "", { autocomplete: "new-password", minlength: "8" });
  const passMessage = messageBox();
  const passForm = el("form", {}, current.wrapper, next.wrapper, passMessage.box, el("button", { className: "btn btn-primary", text: "Change password", attrs: { type: "submit" } }));
  passForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    passMessage.hide();
    try {
      await changePassword(current.input.value, next.input.value);
      current.input.value = "";
      next.input.value = "";
      passMessage.show("Password changed.", false);
    } catch (error) {
      const missing = error.status === 404 || error.status === 405;
      passMessage.show(missing ? "The API doesn't support changing passwords yet." : errorMessage(error), true);
    }
  });

  return el("section", { className: "card settings-section" }, el("h2", { text: "Account" }), form, el("hr", { attrs: { style: "border-color: var(--border-soft); margin: 18px 0" } }), passForm);
}

function appearanceSection() {
  const saved = applyTheme();
  const options = el("div", { className: "theme-options", attrs: { role: "group", "aria-label": "Theme" } });
  const buttons = THEMES.map(([value, label]) => {
    const button = el("button", { className: "btn toggle", text: label, attrs: { type: "button", "aria-pressed": String(value === saved) } });
    button.addEventListener("click", () => {
      saveTheme(value);
      for (const other of buttons) other.setAttribute("aria-pressed", String(other === button));
    });
    return button;
  });
  options.append(...buttons);
  return el("section", { className: "card settings-section" }, el("h2", { text: "Appearance" }), options);
}

function dangerSection() {
  const message = messageBox();
  const button = el("button", { className: "btn btn-danger", text: "Delete account", attrs: { type: "button" } });
  button.addEventListener("click", async () => {
    message.hide();
    if (!(await confirmDialog("Delete your account and all your games? This can't be undone.", "Delete account"))) return;
    try {
      await deleteMe();
      clearToken();
      window.location.hash = "#/login";
    } catch (error) {
      const missing = error.status === 404 || error.status === 405;
      message.show(missing ? "The API doesn't support deleting accounts yet." : errorMessage(error), true);
    }
  });
  return el("section", { className: "card settings-section danger-zone" },
    el("h2", { text: "Delete account" }),
    el("p", { text: "This permanently removes your account and every game on your list." }),
    message.box, button);
}

export function renderSettings(container) {
  container.replaceChildren(
    el("div", { className: "settings-page" },
      el("div", { className: "page-header" }, el("h1", { text: "Settings" })),
      accountSection(), appearanceSection(), dangerSection()));
}
