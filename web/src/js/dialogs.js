// Written with Claude Code
// Pop-up windows: confirm, add game, game details. All use the built-in <dialog>
// element, which traps keyboard focus and closes on Escape for us.

import { createGame, deleteGame, searchGames, updateGame } from "./api.js";
import { el, PLATFORMS, STATUSES, capitalize, daysUntil, icon, isSafeUrl, platformBadge, platformInfo } from "./util.js";

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
  // Values that have no input in the form. The search fills them in when a game is picked.
  const picked = { cover_url: null, igdb_id: null };
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
    // Only for add. An edit leaves the cover and IGDB id alone.
    if (!isEdit) Object.assign(values, picked);
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
  dialog.append(isEdit ? detailsHead(game, onSaved) : addHead(fields, picked), form);
  if (isEdit) fillForm(fields, game);
  openDialog(dialog);
}

// One row in the search results: cover, title, year and platform.
// One platform (or needPlatform false): the whole row is the button. Several: each
// platform gets its own button, so the user has to pick one and cant skip past it.
function resultRow(game, onPick, needPlatform) {
  const cover = isSafeUrl(game.cover_url)
    ? el("img", { className: "result-cover", attrs: { src: game.cover_url, alt: "", loading: "lazy" } })
    : el("div", { className: "result-cover" });
  const year = game.release_date ? game.release_date.slice(0, 4) : "no date";
  const text = el("div", { className: "result-text" }, el("b", { text: game.title }));

  if (!needPlatform || game.platforms.length === 1) {
    const platform = game.platforms[0];
    const where = needPlatform ? platformInfo(platform).label : game.platforms.map((p) => platformInfo(p).label).join(", ");
    text.append(el("small", { text: `${year} · ${where}` }));
    const row = el("button", { className: "search-result clickable", attrs: { type: "button" } }, cover, text);
    row.addEventListener("click", () => onPick(game, platform));
    return el("li", {}, row);
  }

  const chips = el("div", { className: "platform-chips" });
  for (const platform of game.platforms) {
    const chip = el("button", { className: "platform-chip", text: platformInfo(platform).label, attrs: { type: "button" } });
    chip.addEventListener("click", () => onPick(game, platform));
    chips.append(chip);
  }
  text.append(el("small", { text: `${year} · pick a platform:` }), chips);
  return el("li", {}, el("div", { className: "search-result" }, cover, text));
}

// Search box, status line and results list. Enter runs the search. onPick(game, platform, status)
// runs when the user picks a result. needPlatform false means only the cover matters
// (find cover), so games without a cover are hidden and no platform is asked for.
// TODO: check if IGDB wants a credit link shown near the results.
function searchPanel(onPick, { needPlatform = true, id } = {}) {
  const search = el("input", { attrs: { id, type: "search", autocomplete: "off", placeholder: "Type a game name and press Enter" } });
  const status = el("div", { className: "search-status", attrs: { "aria-live": "polite" } });
  const results = el("ul", { className: "search-results" });
  let latest = 0; // a slow search that finishes after a newer one gets ignored

  function pick(game, platform) {
    results.replaceChildren();
    onPick(game, platform, status);
  }

  async function runSearch() {
    const text = search.value.trim();
    results.replaceChildren();
    if (text.length < 2) {
      status.textContent = "Enter at least 2 characters.";
      return;
    }
    const mine = ++latest;
    status.textContent = "Searching...";
    try {
      const games = await searchGames(text);
      if (mine !== latest) return;
      const shown = needPlatform ? games : games.filter((game) => game.cover_url);
      if (shown.length === 0) {
        status.textContent = "No games found.";
        return;
      }
      status.textContent = needPlatform
        ? `${shown.length} found. Click a platform to pick a game.`
        : `${shown.length} found. Click one to use its cover.`;
      for (const game of shown) results.append(resultRow(game, pick, needPlatform));
    } catch (error) {
      if (mine !== latest) return;
      status.textContent = error.status === 502 ? "Game search is unavailable right now." : error.message;
    }
  }

  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }
  });

  return { search, status, results, runSearch };
}

// Search at the top of the add window. Picking a result fills the form.
function addHead(fields, picked) {
  const preview = el("img", { className: "pick-cover", attrs: { alt: "Cover of the picked game" } });
  preview.hidden = true;

  const panel = searchPanel((game, platform, status) => {
    fields.title.input.value = game.title;
    fields.release_date.input.value = game.release_date || "";
    fields.developer.input.value = game.developer || "";
    fields.platform.input.value = platform;
    picked.cover_url = game.cover_url;
    picked.igdb_id = game.igdb_id;
    status.textContent = `Filled in "${game.title}" for ${platformInfo(platform).label}.`;
    if (isSafeUrl(game.cover_url)) {
      preview.src = game.cover_url;
      preview.hidden = false;
    } else {
      preview.hidden = true;
    }
  }, { id: "game-find" });

  return el("div", {}, el("h2", { text: "Add game" }),
    el("div", { className: "field", attrs: { style: "margin-top: 14px" } },
      el("label", { text: "Find a game", attrs: { for: "game-find" } }), panel.search,
      el("div", { className: "pick-row" }, preview, panel.status)),
    panel.results);
}

// The cover picture, or the grey placeholder when the game has none.
function coverImage(game) {
  return isSafeUrl(game.cover_url)
    ? el("img", { className: "cover-img", attrs: { src: game.cover_url, alt: `Cover of ${game.title}` } })
    : el("div", { className: "cover-slot", text: "Cover art" });
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

  // Find cover: same IGDB search, but picking a result only saves its cover and IGDB id.
  const coverBox = el("div", {}, coverImage(game));
  const findButton = el("button", { className: "btn", text: game.cover_url ? "Change cover" : "Find cover", attrs: { type: "button" } });
  const panel = searchPanel(async (found, _platform, status) => {
    try {
      const saved = await updateGame(game.id, { cover_url: found.cover_url, igdb_id: found.igdb_id });
      game.cover_url = saved.cover_url;
      coverBox.replaceChildren(coverImage(game));
      findButton.textContent = "Change cover";
      status.textContent = `Cover saved from "${found.title}".`;
      onSaved(saved);
    } catch (error) {
      status.textContent = error.message;
    }
  }, { needPlatform: false, id: "cover-find" });
  const finder = el("div", { className: "field finder" },
    el("label", { text: "Search for a cover", attrs: { for: "cover-find" } }), panel.search, panel.status, panel.results);
  finder.hidden = true;
  findButton.addEventListener("click", () => {
    finder.hidden = !finder.hidden;
    if (finder.hidden) return;
    panel.search.value = game.title;
    panel.runSearch();
    panel.search.focus();
  });

  const head = el("div", { className: "dialog-head" },
    coverBox,
    el("div", {}, platformBadge(game.platform, { big: true }), el("h2", { text: game.title }), findButton),
    heart);
  const days = daysUntil(game.release_date);
  if (days !== null && days > 0) {
    head.append(el("div", { className: "countdown-box" }, el("b", { text: String(days) }), el("span", { text: days === 1 ? "day to go" : "days to go" })));
  }
  return el("div", {}, head, finder);
}
