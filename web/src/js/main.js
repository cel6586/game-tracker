// Written with Claude Code
// Starts the app and switches screens when the URL hash changes (#/login, #/list, #/settings).

import { getMe } from "./api.js";
import { getCachedUser, isSignedIn, logout, setCachedUser } from "./auth.js";
import { renderList } from "./list.js";
import { renderLogin } from "./login.js";
import { applyTheme, renderSettings } from "./settings.js";
import { el, icon } from "./util.js";

const root = document.getElementById("root");

// Sidebar plus a main area. Returns the main area for the screen to fill.
function renderShell(activeRoute) {
  const link = (href, text, route, iconName) =>
    el("a", { className: route === activeRoute ? "nav-item active" : "nav-item", attrs: { href, "aria-current": route === activeRoute ? "page" : false } },
      icon(iconName, false, 20), text);

  const email = el("div", { className: "user-email", text: getCachedUser()?.email || "" });
  const signOut = el("button", { className: "btn icon-btn", attrs: { type: "button", "aria-label": "Sign out" } }, icon("logout", false, 20));
  signOut.addEventListener("click", logout);

  const sidebar = el("nav", { className: "sidebar", attrs: { "aria-label": "Main" } },
    el("div", { className: "brand" }, icon("gamepad", false, 26), el("span", { className: "brand-name", text: "GAME TRACKER" })),
    link("#/list", "My List", "list", "list"),
    link("#/settings", "Settings", "settings", "settings"),
    el("span", { className: "nav-item disabled", attrs: { "aria-disabled": "true" } }, icon("users", false, 20), "Browse lists", el("span", { className: "nav-later", text: "Later" })),
    el("div", { className: "sidebar-bottom" }, email, signOut));

  const main = el("main", { className: "main" });
  root.replaceChildren(el("div", { className: "app" }, sidebar, main));
  return { main, email };
}

async function route() {
  const name = window.location.hash.replace("#/", "") || "list";

  if (!isSignedIn()) {
    if (name !== "login") window.location.hash = "#/login";
    else renderLogin(root, () => { window.location.hash = "#/list"; });
    return;
  }
  if (name === "login") {
    window.location.hash = "#/list";
    return;
  }

  if (name !== "list" && name !== "settings") {
    window.location.hash = "#/list"; // unknown route
    return;
  }
  const screen = name;
  const { main, email } = renderShell(screen);
  if (screen === "settings") renderSettings(main);
  else renderList(main);

  // Load the user in the background so the screen shows right away.
  // A failed call here (e.g. 401) is handled by the session-expired listener.
  if (!getCachedUser()) {
    try {
      const user = await getMe();
      setCachedUser(user);
      if (!main.isConnected) return; // user navigated away while we waited
      email.textContent = user.email;
      // Fill in the settings email box without re-rendering, so nothing the user typed is lost.
      const emailInput = document.getElementById("s-email");
      if (emailInput && !emailInput.value) emailInput.value = user.email;
      const nameInput = document.getElementById("s-name");
      if (nameInput && !nameInput.value) nameInput.value = user.name || "";
    } catch {
      // network errors are shown by the list screen
    }
  }
}

window.addEventListener("hashchange", route);
// api.js fires this when any call gets a 401 (token expired after 40 minutes).
window.addEventListener("session-expired", () => {
  if (window.location.hash === "#/login") route();
  else window.location.hash = "#/login";
});

applyTheme();
route();
