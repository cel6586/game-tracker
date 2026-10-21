// Written with Claude Code
// Pop-up windows: confirm, add game, game details. All use the built-in <dialog>
// element, which traps keyboard focus and closes on Escape for us.

import { createGame, deleteGame, updateGame } from "./api.js";
import { el, PLATFORMS, STATUSES, capitalize, daysUntil, icon, isSafeUrl, platformBadge } from "./util.js";

function openDialog(dialog) {
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
}

// Resolves true if the user confirms, false if they cancel.
export function confirmDialog(message, confirmLabel = "Delete") {
  return new Promise((resolve) => {
    const dialog = el("dialog", { attrs: { "aria-label": "Confirm" } });
    const cancel = el("button", { className: "btn", text: "Cancel", attrs: { type: "button" } });
    const ok = el("button", { className: "btn btn-danger", text: confirmLabel, attrs: { type: "button" } });
    cancel.addEventListener("click", () => dialog.close("cancel"));
    ok.addEventListener("click", () => dialog.close("ok"));
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"));
    dialog.append(el("p", { text: message }), el("div", { className: "dialog-actions" }, el("span", { className: "spacer" }), cancel, ok));
    openDialog(dialog);
  });
}

// ---- form pieces ----
function inputField(name, labelText, type = "text", extra = {}) {
  const id = `game-${name}`;
  const input = el("input", { attrs: { id, name, type, ...extra } });
  const error = el("div", { className: "field-error", attrs: { id: `${id}-error`, "aria-live": "polite" } });
  return { name, input, error, wrapper: el("div", { className: "field" }, el("label", { text: labelText, attrs: { for: id } }), input, error) };
}

function selectField(name, labelText, options) {
  const id = `game-${name}`;
  const select = el("select", { attrs: { id, name } });
  for (const [value, label] of options) select.append(el("option", { text: label, attrs: { value } }));
  const error = el("div", { className: "field-error", attrs: { id: `${id}-error`, "aria-live": "polite" } });
  return { name, input: select, error, wrapper: el("div", { className: "field" }, el("label", { text: labelText, attrs: { for: id } }), select, error) };
}

function notesField() {
  const textarea = el("textarea", { attrs: { id: "game-notes", name: "notes" } });
  const error = el("div", { className: "field-error", attrs: { id: "game-notes-error", "aria-live": "polite" } });
  return { name: "notes", input: textarea, error, wrapper: el("div", { className: "field wide" }, el("label", { text: "Notes", attrs: { for: "game-notes" } }), textarea, error) };
}

// Blank text becomes null so an edit can clear a value.
function blankToNull(text) {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

function readForm(fields) {
  const rating = blankToNull(fields.rating.input.value);
  return {
    title: fields.title.input.value.trim(),
    platform: fields.platform.input.value,
    status: fields.status.input.value,
    release_date: blankToNull(fields.release_date.input.value),
    developer: blankToNull(fields.developer.input.value),
    rating: rating === null ? null : Number(rating),
    link: blankToNull(fields.link.input.value),
    notes: blankToNull(fields.notes.input.value),
  };
}

function fillForm(fields, game) {
  fields.title.input.value = game.title;
  fields.platform.input.value = PLATFORMS.some((p) => p.value === game.platform) ? game.platform : "Other";
  fields.status.input.value = game.status;
  fields.release_date.input.value = game.release_date || "";
  fields.developer.input.value = game.developer || "";
  fields.rating.input.value = game.rating ?? "";
  fields.link.input.value = game.link || "";
  fields.notes.input.value = game.notes || "";
}

function clearErrors(fields, banner) {
  banner.hidden = true;
  for (const field of Object.values(fields)) field.error.textContent = "";
}

// Shows API errors: 409 as a banner, 422 next to the field, anything else as a banner.
function showApiError(error, fields, banner) {
  if (error.status === 422 && Array.isArray(error.detail)) {
    const unmatched = [];
    for (const problem of error.detail) {
      const fieldName = problem.loc[problem.loc.length - 1];
      // Pydantic prefixes custom validator messages with "Value error, ".
      const message = problem.msg.replace(/^Value error, /, "");
      if (fields[fieldName]) fields[fieldName].error.textContent = message;
      else unmatched.push(message);
    }
    if (unmatched.length > 0) {
      banner.textContent = unmatched.join(" ");
      banner.hidden = false;
    }
    return;
  }
  banner.textContent = typeof error.detail === "string" ? error.detail : error.message;
  banner.hidden = false;
}

// Checks the things the API doesn't check yet. Returns true if the form is OK.
function validateLocally(values, fields) {
  let ok = true;
  if (!values.title) {
    fields.title.error.textContent = "Title is required.";
    ok = false;
  }
  if (values.link && !isSafeUrl(values.link)) {
    fields.link.error.textContent = "Link must start with http:// or https://";
    ok = false;
  }
  return ok;
}

function buildForm() {
  const fields = {
    title: inputField("title", "Title", "text", { required: true }),
    platform: selectField("platform", "Platform", PLATFORMS.map((p) => [p.value, p.label])),
    status: selectField("status", "Status", STATUSES.map((s) => [s, capitalize(s)])),
    release_date: inputField("release_date", "Release date", "date"),
    developer: inputField("developer", "Developer"),
    rating: inputField("rating", "Rating (0 to 10)", "number", { min: "0", max: "10", step: "0.1" }),
    link: inputField("link", "Store link", "url", { placeholder: "https://" }),
    notes: notesField(),
  };
  fields.title.wrapper.classList.add("wide");
  fields.link.wrapper.classList.add("wide");
  const grid = el("div", { className: "form-grid" });
  for (const field of Object.values(fields)) grid.append(field.wrapper);
  return { fields, grid };
}

function heartButton(game, onToggle) {
  const button = el("button", { className: "btn icon-btn heart", attrs: { type: "button", "aria-label": "Favorite", "aria-pressed": String(Boolean(game.favorite)) } }, icon("heart", Boolean(game.favorite)));
  button.addEventListener("click", onToggle);
  return button;
}

// ---- add / details window ----
// game = null means "add". callbacks: onSaved(game), onDeleted(id).
export function openGameDialog(game, { onSaved, onDeleted }) {
  const isEdit = game !== null;
  const dialog = el("dialog", { attrs: { "aria-label": isEdit ? "Game details" : "Add game" } });
  const banner = el("div", { className: "banner", attrs: { role: "alert", hidden: true } });
  const { fields, grid } = buildForm();
  const form = el("form", { attrs: { novalidate: true } });

  const save = el("button", { className: "btn btn-primary", text: isEdit ? "Save changes" : "Add game", attrs: { type: "submit" } });
  const cancel = el("button", { className: "btn", text: "Cancel", attrs: { type: "button" } });
  cancel.addEventListener("click", () => dialog.close());

  const actions = el("div", { className: "dialog-actions" });
  if (isEdit) {
    const remove = el("button", { className: "btn btn-danger", text: "Delete game", attrs: { type: "button" } });
    remove.addEventListener("click", async () => {
      if (!(await confirmDialog(`Delete "${game.title}"?`))) return;
      try {
        await deleteGame(game.id);
        dialog.close();
        onDeleted(game.id);
      } catch (error) {
        showApiError(error, fields, banner);
      }
    });
    actions.append(remove);
  }
  actions.append(el("span", { className: "spacer" }), cancel, save);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(fields, banner);
    const values = readForm(fields);
    if (!validateLocally(values, fields)) return;
    save.disabled = true;
    try {
      // Edit sends the whole form as a PATCH; add is a POST.
      const saved = isEdit ? await updateGame(game.id, values) : await createGame(values);
      dialog.close();
      onSaved(saved);
    } catch (error) {
      showApiError(error, fields, banner);
    } finally {
      save.disabled = false;
    }
  });

  form.append(banner, grid, actions);
  dialog.append(isEdit ? detailsHead(game, onSaved) : addHead(), form);
  if (isEdit) fillForm(fields, game);
  openDialog(dialog);
}

function addHead() {
  // Placeholder until the RAWG search exists (needs a backend endpoint first).
  // When it does: show results here plus a "Game data from RAWG" link, which RAWG requires.
  const search = el("input", { attrs: { id: "game-find", type: "search", disabled: true, placeholder: "Search coming soon" } });
  return el("div", {}, el("h2", { text: "Add game" }),
    el("div", { className: "field", attrs: { style: "margin-top: 14px" } }, el("label", { text: "Find a game", attrs: { for: "game-find" } }), search));
}

function detailsHead(game, onSaved) {
  const heart = heartButton(game, async () => {
    try {
      const saved = await updateGame(game.id, { favorite: !game.favorite });
      game.favorite = Boolean(saved.favorite);
      heart.setAttribute("aria-pressed", String(game.favorite));
      heart.replaceChildren(icon("heart", game.favorite));
      onSaved(saved);
    } catch {
      // The list screen shows errors; here a failed toggle just stays unchanged.
    }
  });
  const head = el("div", { className: "dialog-head" },
    el("div", { className: "cover-slot", text: "Cover art" }),
    el("div", {}, platformBadge(game.platform, { big: true }), el("h2", { text: game.title })),
    heart);
  const days = daysUntil(game.release_date);
  if (days !== null && days > 0) {
    head.append(el("div", { className: "countdown-box" }, el("b", { text: String(days) }), el("span", { text: days === 1 ? "day to go" : "days to go" })));
  }
  return head;
}
