// Written with Claude Code
// Small helpers shared by every screen.

// Platforms: stored value -> full name, placeholder color, logo file.
// mono: the logo is plain black, so CSS flips it to white on the dark themes.
// named: the logo already contains the platform's name, so group headers don't repeat it.
// "Other" has no logo, so it always shows the text badge.
export const PLATFORMS = [
  { value: "PC", label: "PC", abbr: "PC", color: "#8fa3ba", logo: "img/platforms/pc.png", named: true },
  { value: "PS5", label: "PlayStation 5", abbr: "PS5", color: "#6f95ff", logo: "img/platforms/ps5.svg", mono: true, named: true },
  { value: "Switch 2", label: "Nintendo Switch 2", abbr: "SWITCH", color: "#ff7a7e", logo: "img/platforms/switch.svg", named: true },
  { value: "VR", label: "VR", abbr: "VR", color: "#3fd0d4", logo: "img/platforms/vr.svg", mono: true, named: true },
  { value: "Xbox", label: "Xbox Series X", abbr: "XBOX", color: "#5fd07d", logo: "img/platforms/xbox.png", named: true },
  { value: "Other", label: "Other", abbr: "OTHER", color: "#9aa6b5", logo: null, named: true },
];

export const STATUSES = ["wishlist", "playing", "completed"];

export function platformInfo(value) {
  return PLATFORMS.find((p) => p.value === value) || PLATFORMS[PLATFORMS.length - 1];
}

export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Builds an element without ever using innerHTML, so user text can't inject HTML.
// props: className, text, attrs (object of attributes), on (object of event listeners).
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text !== undefined) node.textContent = props.text;
  for (const [name, value] of Object.entries(props.attrs || {})) {
    if (value !== false && value !== null && value !== undefined) node.setAttribute(name, value);
  }
  for (const [event, handler] of Object.entries(props.on || {})) {
    node.addEventListener(event, handler);
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

// Colored text badge. Used by itself when the logo file is missing.
function textBadge(info) {
  return el("span", {
    className: "platform-badge",
    text: info.label,
    attrs: { style: `--badge-color: ${info.color}` },
  });
}

// Colored tile with the short name (PC, PS5, ...). Used where a logo would be too busy.
export function platformTile(value) {
  const info = platformInfo(value);
  const tile = el("span", { className: "platform-tile", text: info.abbr });
  tile.style.setProperty("--badge-color", info.color);
  return tile;
}

// Logo image if the file exists, otherwise the text badge.
// The onerror swap is why a missing svg never leaves a broken image icon.
export function platformBadge(value, { big = false } = {}) {
  const info = platformInfo(value);
  if (!info.logo) {
    // No logo: the name itself stands in for it.
    return el("span", { className: `platform-glyph${big ? " big" : ""}`, text: info.label });
  }
  const img = el("img", {
    className: `platform-logo${big ? " big" : ""}${info.mono ? " mono" : ""}`,
    attrs: { src: info.logo, alt: info.label },
  });
  const wrap = el("span", {}, img);
  img.addEventListener("error", () => wrap.replaceChildren(textBadge(info)));
  return wrap;
}

// Only http(s) links may become clickable (blocks javascript: links).
export function isSafeUrl(text) {
  return /^https?:\/\//i.test(text || "");
}

// "YYYY-MM-DD" -> Date at local midnight. new Date("2026-01-05") would be UTC and
// can show the day before in some time zones.
export function parseDate(text) {
  if (!text) return null;
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(text) {
  const date = parseDate(text);
  return date ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export function daysUntil(text) {
  const date = parseDate(text);
  if (!date) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((date - start) / 86400000);
}

export function countdownText(days) {
  return days === 1 ? "In 1 day" : `In ${days} days`;
}

export function formatRating(rating) {
  return rating === null || rating === undefined ? "—" : `${rating}/10`;
}

// Inline SVG icons built with the DOM (no innerHTML).
const ICON_PATHS = {
  heart: "M12 21s-7-4.6-9.5-9C.9 8.7 2.7 5 6.2 5c2 0 3.2 1 3.8 2 .6-1 1.8-2 3.8-2 3.5 0 5.3 3.7 3.7 7-2.5 4.4-9.5 9-9.5 9z",
  edit: "M4 20h4l10.5-10.5-4-4L4 16v4zM14.5 5.5l4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  chevron: "M6 9l6 6 6-6",
  plus: "M12 5v14M5 12h14",
  logout: "M10 5H5v14h5M15 8l4 4-4 4M19 12H9",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  settings: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  users: "M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M18 14c2 .6 3 2.5 3 6",
  gamepad: "M6 8h12a4 4 0 0 1 3.9 4.9l-.9 4a2.5 2.5 0 0 1-4.3 1L15 16.5H9L7.3 17.9a2.5 2.5 0 0 1-4.3-1l-.9-4A4 4 0 0 1 6 8zM8 11v3M6.5 12.5h3M15.5 11.5h.01M17.5 13.5h.01",
};

export function icon(name, filled = false, size = 18) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", filled ? "currentColor" : "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", ICON_PATHS[name]);
  svg.append(path);
  return svg;
}

// "Craig's List", or "My List" when the user has no name saved.
export function listTitle(user) {
  const name = user?.name?.trim();
  if (!name) return "My List";
  return `${name}${name.endsWith("s") ? "'" : "'s"} List`;
}

// Updates everything on screen that shows who is signed in (sidebar name + email, list title).
export function showUser(user) {
  const nameBox = document.querySelector(".user-name");
  if (nameBox) {
    nameBox.textContent = user?.name || "";
    nameBox.hidden = !user?.name;
  }
  const emailBox = document.querySelector(".user-email");
  if (emailBox) emailBox.textContent = user?.email || "";
  const title = document.getElementById("list-title");
  if (title) title.textContent = listTitle(user);
}
