// Written with Claude Code
// My List screen. Searching, filtering and sorting are done by the API (query params on
// GET /games/); the counts come from GET /games/summary. Only the grouping into
// sections happens here, because that's just how the list is shown.

import { deleteGame, getGameSummary, listGames, updateGame } from "./api.js";
import { confirmDialog, openGameDialog } from "./dialogs.js";
import { errorMessage } from "./login.js";
import {
  PLATFORMS, STATUSES, capitalize, countdownText, daysUntil, el, formatDate, formatRating,
  icon, isSafeUrl, platformBadge, platformInfo, platformTile,
} from "./util.js";

const DEFAULT_FILTERS = { search: "", status: "", platform: "", outNow: false, favorites: false };

export async function renderList(container) {
  const state = {
    games: [], // what the API returned for the current filters
    summary: null, // unfiltered counts, or null if the summary call failed
    loadId: 0, // lets us ignore a slow response that arrives after a newer one
    filters: { ...DEFAULT_FILTERS },
    sort: "title",
    groupBy: "platform",
    collapsed: new Set(),
  };

  const banner = el("div", { className: "banner", attrs: { role: "alert", hidden: true } });
  const chips = el("div", { className: "chips" });
  const jump = el("div", { className: "jump" });
  const groups = el("div", {});

  // ---- toolbar (built once so the search box keeps focus while typing) ----
  const search = el("input", { attrs: { id: "f-search", type: "search", placeholder: "Search titles" } });
  const statusSelect = selectBox("f-status", "Status", [["", "All statuses"], ...STATUSES.map((s) => [s, capitalize(s)])]);
  const platformSelect = selectBox("f-platform", "Platform", [["", "All platforms"], ...PLATFORMS.map((p) => [p.value, p.label])]);
  const sortSelect = selectBox("f-sort", "Sort by", [["title", "Title"], ["released", "Release date"]]);
  const outNow = toggleButton("Out now");
  const favorites = toggleButton("Favorites", icon("heart", false, 16));
  const clear = el("button", { className: "btn link-btn", text: "Clear filters", attrs: { type: "button" } });

  const groupButtons = ["platform", "status", "none"].map((value) => {
    const button = el("button", { className: "btn toggle", text: capitalize(value), attrs: { type: "button", "data-group": value } });
    button.addEventListener("click", () => {
      state.groupBy = value;
      if (value === "platform" && state.filters.platform) {
        // The platform dropdown is hidden in this mode, so a leftover choice would filter invisibly.
        state.filters.platform = "";
        platformSelect.select.value = "";
        refresh();
        return;
      }
      update();
    });
    return button;
  });
  const groupControl = el("div", { className: "field group-field" },
    el("span", { className: "group-label", text: "Group by", attrs: { id: "group-label" } }),
    el("div", { className: "segmented", attrs: { role: "group", "aria-labelledby": "group-label" } }, ...groupButtons));

  // Wait until the user stops typing so we don't send a request on every keystroke.
  let searchTimer;
  search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.filters.search = search.value; refresh(); }, 250);
  });
  statusSelect.select.addEventListener("change", () => { state.filters.status = statusSelect.select.value; refresh(); });
  platformSelect.select.addEventListener("change", () => { state.filters.platform = platformSelect.select.value; refresh(); });
  sortSelect.select.addEventListener("change", () => { state.sort = sortSelect.select.value; refresh(); });
  outNow.addEventListener("click", () => { state.filters.outNow = !state.filters.outNow; refresh(); });
  favorites.addEventListener("click", () => { state.filters.favorites = !state.filters.favorites; refresh(); });
  clear.addEventListener("click", () => {
    clearTimeout(searchTimer);
    state.filters = { ...DEFAULT_FILTERS };
    search.value = "";
    statusSelect.select.value = "";
    platformSelect.select.value = "";
    refresh();
  });

  const toolbar = el("div", { className: "toolbar" },
    el("div", { className: "field search" }, el("label", { text: "Search", attrs: { for: "f-search" } }), search),
    statusSelect.wrapper, platformSelect.wrapper, sortSelect.wrapper, outNow, favorites, groupControl, clear);

  // Next to the title, so the button is right where the eye starts.
  const addButton = el("button", { className: "btn btn-primary", attrs: { type: "button" } }, icon("plus", false, 18), "Add game");
  addButton.addEventListener("click", () => openGameDialog(null, dialogCallbacks()));

  // One column header shared by every group, so the columns line up between groups.
  // Hidden from screen readers: each table has its own (visually hidden) header row.
  const listHead = el("table", { className: "game-table list-head", attrs: { "aria-hidden": "true" } },
    columns(false),
    el("thead", {}, el("tr", {}, ...["Title", "Status", "Release", "Rating", ""].map((text) => el("th", { text })))));

  container.replaceChildren(
    el("div", { className: "page-header" }, el("h1", { text: "My List" }), addButton),
    banner, chips, toolbar, jump,
    el("div", { className: "list-scroll" }, el("div", { className: "list-inner" }, listHead, groups)));

  // ---- data changes ----
  function dialogCallbacks() {
    return {
      // Reload from the API: a change can move a game in or out of the current
      // filters, and it changes the counts.
      onSaved: refresh,
      onDeleted: refresh,
    };
  }

  function showError(error) {
    banner.textContent = errorMessage(error);
    banner.hidden = false;
  }

  async function quickPatch(game, fields) {
    banner.hidden = true;
    try {
      await updateGame(game.id, fields);
    } catch (error) {
      showError(error);
    }
    await refresh(); // also puts the control back to what the server has after a failure
  }

  async function removeGame(game) {
    if (!(await confirmDialog(`Delete "${game.title}"?`))) return;
    try {
      await deleteGame(game.id);
      await refresh();
    } catch (error) {
      showError(error);
    }
  }

  // ---- loading from the API ----
  // Turns the toolbar state into query params. Returns null when the filters
  // can't match anything, so we skip the request.
  function buildParams() {
    const f = state.filters;
    const params = {
      search: f.search.trim(),
      platform: f.platform,
      status: f.status,
      favorite: f.favorites,
      sort: state.sort,
    };
    if (f.outNow) {
      // "Out now" means a wishlist game whose release date has passed.
      if (f.status && f.status !== "wishlist") return null;
      params.released = true;
      params.status = "wishlist";
    }
    return params;
  }

  async function refresh() {
    const loadId = ++state.loadId;
    const params = buildParams();
    banner.hidden = true;
    try {
      const [games, summary] = await Promise.all([
        params ? listGames(params) : [],
        getGameSummary().catch(() => null), // counts are nice to have, the list still works without
      ]);
      if (loadId !== state.loadId) return; // a newer request is already running
      state.games = games;
      state.summary = summary;
    } catch (error) {
      if (loadId !== state.loadId) return;
      showError(error);
      return;
    }
    update();
  }

  function groupedGames(games) {
    if (state.groupBy === "none") return [{ key: "all", games }];
    const keys = state.groupBy === "platform" ? PLATFORMS.map((p) => p.value) : STATUSES;
    const keyOf = state.groupBy === "platform" ? platformKey : (g) => g.status;
    // Groups with no matching games are dropped, so they disappear when filtered out.
    return keys
      .map((key) => ({ key, games: games.filter((g) => keyOf(g) === key) }))
      .filter((group) => group.games.length > 0);
  }

  // ---- drawing ----
  function update() {
    const filtering = JSON.stringify(state.filters) !== JSON.stringify(DEFAULT_FILTERS);

    clear.disabled = !filtering;
    platformSelect.wrapper.hidden = state.groupBy === "platform"; // jump badges do this job
    for (const button of groupButtons) button.setAttribute("aria-pressed", String(button.dataset.group === state.groupBy));
    outNow.setAttribute("aria-pressed", String(state.filters.outNow));
    favorites.setAttribute("aria-pressed", String(state.filters.favorites));

    drawChips();
    if (isListEmpty(filtering)) {
      jump.replaceChildren();
      listHead.hidden = true;
      groups.replaceChildren(emptyState());
      return;
    }
    const grouped = groupedGames(state.games);
    listHead.hidden = state.groupBy === "none" || grouped.length === 0; // "none" shows its own header
    drawJump(grouped);
    drawGroups(grouped, filtering);
  }

  // True only when the user has no games at all (not just none matching the filters).
  function isListEmpty(filtering) {
    if (state.summary) return state.summary.total === 0;
    return state.games.length === 0 && !filtering;
  }

  function drawChips() {
    const summary = state.summary;
    if (!summary) {
      chips.replaceChildren();
      return;
    }
    const count = (status) => summary.by_status?.[status] ?? 0;
    chips.replaceChildren(
      el("span", { className: "chip total", text: `${summary.total} ${gamesWord(summary.total)}` }),
      chip(count("playing"), "playing"), chip(count("wishlist"), "wishlist"), chip(count("completed"), "completed"));
  }

  function drawJump(grouped) {
    jump.hidden = state.groupBy !== "platform";
    if (state.groupBy !== "platform") return;
    jump.replaceChildren(el("span", { className: "group-label", text: "Jump to" }));
    for (const group of grouped) {
      const link = el("button", { className: "btn jump-btn", attrs: { type: "button", "aria-label": `${platformInfo(group.key).label}, ${group.games.length}` } }, platformTile(group.key), el("span", { text: String(group.games.length) }));
      link.addEventListener("click", () => {
        state.collapsed.delete(group.key);
        update();
        document.getElementById(groupId(group.key))?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      jump.append(link);
    }
  }

  function drawGroups(grouped, filtering) {
    if (grouped.length === 0) {
      groups.replaceChildren(el("div", { className: "card empty" }, el("p", { text: "No games match these filters." })));
      return;
    }
    groups.replaceChildren(...grouped.map((group) => groupSection(group, filtering)));
  }

  function groupSection(group, filtering) {
    // Unfiltered size of this group, for "1 of 3 games". Falls back if the summary is missing.
    const totals = state.groupBy === "platform" ? state.summary?.by_platform : state.summary?.by_status;
    const totalInGroup = totals?.[group.key] ?? group.games.length;
    const table = gameTable(group.games, state.groupBy !== "none");
    if (state.groupBy === "none") return el("section", { className: "group" }, table);

    const collapsed = state.collapsed.has(group.key);
    const countText = filtering ? `${group.games.length} of ${totalInGroup} games` : `${totalInGroup} ${gamesWord(totalInGroup)}`;
    const title = state.groupBy === "platform" ? platformInfo(group.key).label : capitalize(group.key);
    // The logo's alt text already gives the name to screen readers.
    const logoHasName = state.groupBy === "platform" && platformInfo(group.key).named;
    const header = el("button", {
      className: "group-header",
      attrs: { type: "button", "aria-expanded": String(!collapsed) },
    },
      state.groupBy === "platform" ? platformBadge(group.key, { big: true }) : null,
      el("span", { className: "group-text" },
        logoHasName ? null : el("span", { className: "group-title", text: title }),
        el("span", { className: "group-count", text: countText })),
      el("span", { className: "chevron" }, icon("chevron", false, 22)));
    header.addEventListener("click", () => {
      if (collapsed) state.collapsed.delete(group.key);
      else state.collapsed.add(group.key);
      update();
    });
    table.hidden = collapsed;
    return el("section", { className: "group", attrs: { id: groupId(group.key) } }, header, table);
  }

  // grouped: the shared header above the groups is what people see, so this table's own
  // header row is kept only for screen readers.
  function gameTable(games, grouped) {
    const showPlatform = state.groupBy === "none";
    const head = el("tr", {},
      el("th", { text: "Title", attrs: { scope: "col" } }),
      showPlatform ? el("th", { text: "Platform", attrs: { scope: "col" } }) : null,
      el("th", { text: "Status", attrs: { scope: "col" } }),
      el("th", { text: "Release", attrs: { scope: "col" } }),
      el("th", { text: "Rating", attrs: { scope: "col" } }),
      el("th", { text: "Actions", attrs: { scope: "col" } }));
    const body = el("tbody", {}, ...games.map((game) => gameRow(game, showPlatform)));
    return el("table", { className: "game-table" }, columns(showPlatform), el("thead", { className: grouped ? "sr-only" : "" }, head), body);
  }

  function gameRow(game, showPlatform) {
    const open = () => openGameDialog(game, dialogCallbacks());

    const heart = el("button", { className: "btn icon-btn heart", attrs: { type: "button", "aria-label": `Favorite ${game.title}`, "aria-pressed": String(Boolean(game.favorite)) } }, icon("heart", Boolean(game.favorite)));
    heart.addEventListener("click", () => quickPatch(game, { favorite: !game.favorite }));

    const titleButton = el("button", { className: "title-btn", text: game.title, attrs: { type: "button" } });
    titleButton.addEventListener("click", open);

    const titleCell = el("td", {}, el("div", { className: "title-cell" },
      heart,
      showPlatform ? platformBadge(game.platform) : null,
      titleButton));

    return el("tr", {},
      titleCell,
      showPlatform ? el("td", { text: platformInfo(platformKey(game)).label }) : null,
      el("td", {}, statusPill(game)),
      el("td", {}, el("div", { className: "release-cell" }, ...releaseCell(game))),
      el("td", { text: formatRating(game.rating) }),
      el("td", {}, actionButtons(game, open)));
  }

  function statusPill(game) {
    // A native select styled as a pill: keyboard and screen reader friendly for free.
    const select = el("select", { className: `pill status-${game.status}`, attrs: { "aria-label": `Status of ${game.title}` } });
    for (const status of STATUSES) select.append(el("option", { text: capitalize(status), attrs: { value: status } }));
    select.value = game.status;
    select.addEventListener("change", () => quickPatch(game, { status: select.value }));
    return select;
  }

  function releaseCell(game) {
    const cell = [el("div", { text: formatDate(game.release_date) })];
    const days = daysUntil(game.release_date);
    if (days !== null && days > 0) {
      cell.push(el("span", { className: "release-badge soon" }, icon("clock"), el("span", { text: countdownText(days) })));
    } else if (days !== null && game.status === "wishlist") {
      // Not a link: the store link only opens from the actions column.
      cell.push(el("span", { className: "release-badge out", text: "Out now" }));
    }
    return cell;
  }

  function actionButtons(game, open) {
    const buttons = [];
    if (isSafeUrl(game.link)) {
      buttons.push(el("a", { className: "btn icon-btn", attrs: { href: game.link, target: "_blank", rel: "noopener", "aria-label": `Open store page for ${game.title}` } }, icon("link")));
    }
    const edit = el("button", { className: "btn icon-btn", attrs: { type: "button", "aria-label": `Edit ${game.title}` } }, icon("edit"));
    edit.addEventListener("click", open);
    const remove = el("button", { className: "btn icon-btn", attrs: { type: "button", "aria-label": `Delete ${game.title}` } }, icon("trash"));
    remove.addEventListener("click", () => removeGame(game));
    return el("div", { className: "actions" }, ...buttons, edit, remove);
  }

  function emptyState() {
    const button = el("button", { className: "btn btn-primary", text: "Add your first game", attrs: { type: "button" } });
    button.addEventListener("click", () => openGameDialog(null, dialogCallbacks()));
    return el("div", { className: "card empty" }, el("h2", { text: "Your list is empty" }), el("p", { text: "Add a game to start tracking." }), button);
  }

  // ---- load ----
  try {
    const [games, summary] = await Promise.all([listGames({ sort: state.sort }), getGameSummary().catch(() => null)]);
    state.games = games;
    state.summary = summary;
  } catch (error) {
    showError(error);
    // Don't show "Your list is empty" when we simply couldn't load it.
    const retry = el("button", { className: "btn", text: "Try again", attrs: { type: "button" } });
    retry.addEventListener("click", () => renderList(container));
    groups.replaceChildren(el("div", { className: "card empty" }, el("p", { text: "Couldn't load your games." }), retry));
    return;
  }
  update();
}

// ---- small helpers ----
function selectBox(id, labelText, options) {
  const select = el("select", { attrs: { id } });
  for (const [value, label] of options) select.append(el("option", { text: label, attrs: { value } }));
  return { select, wrapper: el("div", { className: "field" }, el("label", { text: labelText, attrs: { for: id } }), select) };
}

function toggleButton(text, iconNode) {
  return el("button", { className: "btn toggle quick", attrs: { type: "button", "aria-pressed": "false" } }, iconNode, text);
}

// A status count with a colored dot (the word is there too, so color is never the only cue).
function chip(number, status) {
  return el("span", { className: `chip status-${status}` }, el("span", { className: "chip-dot" }), `${number} ${status}`);
}

function gamesWord(count) {
  return count === 1 ? "game" : "games";
}

// Same column widths in every table (see the .col-* rules) so groups line up.
function columns(showPlatform) {
  const names = ["title", showPlatform ? "platform" : null, "status", "release", "rating", "actions"];
  return el("colgroup", {}, ...names.filter(Boolean).map((name) => el("col", { className: `col-${name}` })));
}

// Unknown stored platform values are shown under "Other".
function platformKey(game) {
  return PLATFORMS.some((p) => p.value === game.platform) ? game.platform : "Other";
}

// Platform names can contain a space ("Switch 2"), which isn't valid in an element id.
function groupId(key) {
  return `group-${key.replace(/\s+/g, "-")}`;
}
