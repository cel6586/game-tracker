# Game Tracker frontend: design and build instructions

This is my design doc for the `web/` folder. Claude: read this whole file before writing anything.

The visual mockup is a Claude artifact (private, only I can open it): https://claude.ai/artifact/CoQqfoK1yZoumhdFWgsjnd . If you can't open it, everything you need is written below.

## Rules for Claude when writing this

- Do not touch anything in `api/`. If the frontend needs something the API doesn't have yet, add it to the backend gaps list at the bottom of this file and tell me. I write the backend myself.
- Keep the code easy to read: small functions, plain names, comments that say why, not what.

## Tech choices (decided)

- Plain HTML, CSS, and JavaScript. No React, no Node, no npm, no build step. Reason: I want the DevOps work (Docker, Kubernetes, scanning) to be about nginx and my services. Same approach as the `clearledger` project.
- JavaScript modules (`<script type="module">`) so the code can be split into files without a bundler.
- One `index.html` with hash routes: `#/login`, `#/list`, `#/settings`. Add game and game details open as windows (dialogs) over the list.
- Served by nginx in its own container. nginx also forwards every `/api/` request to the API service, so the browser only talks to one address. That means no CORS setup.
- Dark theme by default. A theme picker in Settings (Dark, Midnight, Light) saved in the browser's `localStorage`.

## Folder layout

```
web/
  design.md          this file
  Dockerfile
  nginx.conf
  src/
    index.html
    css/styles.css   all colors as CSS variables so themes are easy
    js/
      main.js        starts the app, handles routes
      api.js         every fetch call to the API lives here, nothing else calls fetch
      auth.js        login, register, logout, token storage
      list.js        My List screen: filters, grouping, rows
      dialogs.js     add game and game details windows
      settings.js    settings screen
      util.js        helpers (dates, countdown, escaping)
    img/
      platforms/     platform logos, I will supply these (pc.png, ps5.svg, switch.svg, vr.svg, xbox.png; the code looks for these exact names)
```

## Look and feel

Dark, calm, a bit gamey. Fonts: Space Grotesk for headings and Inter for text. Fall back to the system font if they fail to load. Later I may self-host the fonts so nginx can use a stricter Content-Security-Policy.

Colors (dark theme):

| Use | Color |
|---|---|
| Page background | `#0e1116` |
| Sidebar | `#11151b` |
| Cards and panels | `#161b22` |
| Raised surface, active nav item | `#1f2733` |
| Borders | `#2a3340` (soft: `#232b36`, `#1c232d`) |
| Main text | `#e8ecf1` |
| Muted text | `#9aa6b5` |
| Accent (buttons, focus, active toggle) | `#8b7bff` (text on accent: `#0e1116`) |
| Favorite heart | `#ff6b9a` |
| Danger text and border | `#ff9a9a` / `#5a2f35` |

Status colors (text on a 14% tint of the same color): Wishlist `#6cb6ff`, Playing `#f2c04a`, Completed `#5fd4a0`. Always show the status as a word too, never color alone.

Rules: buttons and clickable things are at least 44px tall, text contrast stays readable, every input has a real `<label>`, icon-only buttons have an `aria-label`, toggle buttons use `aria-pressed`. It must work at phone width: the sidebar stacks on top, the toolbar wraps, and the table scrolls sideways inside its own box.

## Screens

### Login (`#/login`)
Split screen. Left panel: a gamepad icon, a huge two-line wordmark "GAME / TRACKER" (accent color on TRACKER), a short description, and a row of colored platform name tiles (PC, PS5, SWITCH, VR, XBOX; text tiles, not logos). The block is centered in the left panel. Right panel (sidebar color): a card with two tabs (Sign in, Create account), email and password fields with placeholders, and one full-width button. The card is 400px wide and grows to at most 520px on big screens. After signing in, go straight to My List. On phone width the two panels stack.

### Layout after login
Left sidebar, fixed to the screen height so the bottom part is always visible: logo, My List, Settings, and a greyed-out "Browse lists" marked "Later" (I may add viewing other people's lists someday). Each nav item has an icon. At the bottom, on every screen: my email and a sign-out icon button (`aria-label="Sign out"`). The main area is capped at 1400px wide.

### My List (`#/list`, the home screen)
- Header: "My List" with the "Add game" button right next to it (not pushed to the far right, so it stays near where the eye starts).
- Count chips: total games (raised chip), then playing, wishlist and completed, each with a small dot in the status color plus the word. "1 game" is singular.
- Filter bar (all inside one panel with a card background): search by title, status dropdown, sort dropdown (Title or Release date), quick filter buttons "Out now" and "Favorites", a "Group by" control (Platform, Status, None) with a plain label above it so it doesn't look clickable, and a "Clear filters" button (greyed out when nothing is filtered). When the list is grouped by platform there is no platform dropdown, because the jump badges do that job. When grouped by Status or None, show the platform dropdown.
- Group by Platform is the default. Each platform has a header with its logo, the game count under it, and a chevron to collapse the group. The logo already contains the platform name (PC, PS5, Switch 2, Xbox, VR), so the name is not repeated as text. "Other" has no logo, so the word "Other" is shown as text in its place. Filters never remove the grouping, they only remove games. A platform with no matching games disappears. When a filter is on, the count reads "1 of 3 games".
- One shared column header (Title, Status, Release, Rating) sits above all the groups, and every group's table uses the same fixed column widths, so the columns line up from group to group. Each group's own header row is kept only for screen readers.
- "Jump to" buttons above the list, one per platform: a small colored tile with the short name (PC, PS5, SWITCH, VR, XBOX) and the game count. Clicking one scrolls to that platform.
- Group by None: one straight list with a small platform logo at the start of every row, plus a Platform column.
- Group by Status: sections Wishlist, Playing, Completed.
- Each row: favorite heart toggle, title (opens the details window), status pill (click to change status, sends a one-field PATCH), release date with a badge under it, rating (like `9/10` or a dash), and actions: store link icon (only if a link exists), edit, delete.
- Rows are compact: 52px tall (group headers 52px), so more games fit on screen. Buttons keep their 44px click size.
- Release badges (beside the date, never next to the title, so long titles keep their space; the release column is wide enough that the badge does not wrap, so every row is the same height):
  - Future release date: outlined "In 87 days" with a small clock icon, in the accent color.
  - Wishlist game whose release date has passed: filled accent "Out now". It is not a link.
  - No release date: no badge.
- The store link is only ever opened from the link icon in the actions column. One place, not two.
- Delete asks for confirmation first.
- Long titles wrap to a second line. Never cut them off.

### Game details window
Opens when I click a game's title or edit icon. Shows a cover art slot (dashed placeholder for now, a real image later), the platform logo, title, a favorite heart, and a bigger countdown box if the game has a future release date. Form fields: title, platform, status, release date, developer, rating (0 to 10), store link, notes. Buttons: Delete game (left, red outline), Cancel, Save changes (sends the whole form as a PATCH).

### Add game window
The same form, empty. At the top is a "Find a game" search box. For now it is just there as a placeholder. Later it will search RAWG and show results (cover, title, year, platforms) with a "Use this" button that fills in the form. Show a "Game data from RAWG" link under the results, because RAWG requires a link back.

### Settings (`#/settings`)
- The whole page is centered, max 720px wide.
- Account: change email, change password (current plus new).
- Appearance: theme buttons (Dark, Midnight, Light), saved in the browser.
- Delete account (red section, confirm first).

### Empty and error states
- New user with no games: a friendly card with "Add your first game".
- A 409 from the API (duplicate game, duplicate email) shows a red banner at the top of the form with the API's message.
- A 401 anywhere means the token expired (it lasts 40 minutes): clear the token and go to the login screen.
- 422 shows the problem next to the field when possible. Network errors show a short message, never a blank page.

## Platforms

Dropdown values and what gets stored in the database (short names), with the full name shown in the UI:

| Stored | Shown | Placeholder badge color | Logo file |
|---|---|---|---|
| `PC` | PC | `#8fa3ba` | `img/platforms/pc.png` |
| `PS5` | PlayStation 5 | `#6f95ff` | `img/platforms/ps5.svg` |
| `Switch 2` | Nintendo Switch 2 | `#ff7a7e` | `img/platforms/switch.svg` |
| `VR` | VR | `#3fd0d4` | `img/platforms/vr.svg` |
| `Xbox` | Xbox Series X | `#5fd07d` | `img/platforms/xbox.png` |
| `Other` | Other | grey | none |

VR is one generic platform, not split by headset. I supply the logo images myself (official ones). Until a file exists, show the colored text badge instead (an `<img>` with an `onerror` fallback, or a check when the page loads). Never hotlink logos from other sites.

Logo sizing: every logo is shown in the same fixed box (20px tall by 44px wide in rows, 32px by 88px in group headers) and scaled to fit, so wide and square logos look alike. Black logos (PS5, VR) are flipped to white on the Dark and Midnight themes with a CSS filter. `vr.svg` is a headset image (my downloaded webp, background removed with an SVG filter) with "VR" drawn next to it. `Other` has no logo and shows the word "Other" as text. The login screen and the "Jump to" buttons use colored name tiles instead of logos.

The page sets `color-scheme` (dark or light) so the browser's own controls (the date picker icon, dropdown arrows, scrollbars) match the theme.

Statuses stored in lowercase: `wishlist`, `playing`, `completed`. Show them capitalized.

## API mapping

All routes start with `/api/v1`. Everything except register and login needs the header `Authorization: Bearer <token>`.

| What | Call |
|---|---|
| Register | `POST /auth/register` with JSON `{email, password, name?}` |
| Login | `POST /auth/login` as form data (`application/x-www-form-urlencoded`) with `username` (my email) and `password`. Returns `{access_token, token_type}` |
| Who am I | `GET /users/me` |
| Update email or name | `PATCH /users/me` |
| List games | `GET /games/` returns `{"games": [...]}`. Optional query params: `search`, `platform`, `status`, `released=true` |
| Add game | `POST /games/` (201) |
| One game | `GET /games/{id}` |
| Save from details window | `PATCH /games/{id}` with the whole form |
| Quick change (status pill, heart) | `PATCH /games/{id}` with just that one field |
| Delete game | `DELETE /games/{id}` (204, no body) |

Game fields from the API: `id`, `title`, `platform`, `status`, `release_date` (`YYYY-MM-DD` or null), `developer`, `rating`, `link`, `notes`, and later `favorite`.

The token goes in `localStorage` for now and is sent in the Authorization header. Moving to an HttpOnly cookie is a security topic I want to do later as its own step.

## Frontend security rules

- Never put game titles, notes, or any user text into the page with `innerHTML`. Use `textContent` or build elements, so nobody can inject a script (XSS).
- Only make a link clickable if it starts with `http://` or `https://`. Open it with `target="_blank" rel="noopener"`. Never use a `javascript:` link.
- No secrets, API keys, or passwords in the JS files or the image.
- nginx sends security headers (copy from `clearledger`): `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and add a Content-Security-Policy once fonts are self-hosted. Hide the nginx version with `server_tokens off`.

## nginx and Docker

Copy the approach from my `clearledger` frontend: `FROM nginx:1.27-alpine`, copy `src/` into `/usr/share/nginx/html/`, run as a non-root user, listen on port 8080, a `HEALTHCHECK`, and a short cache time for static files. Differences from clearledger: add a `location /api/` block that proxies to the API service. The proxy target (the API's service name and port) must be easy to change, because it differs between Docker Compose and Kubernetes. Do not build with Node. Do not enable CORS.

## Later, not for v1

- Search a game database (RAWG) in the Add game window and fill in the details automatically. Needs the backend to add a search endpoint so the RAWG key stays on the server, plus `cover_url` and `rawg_id` columns. Store the image URL only, don't copy their images.
- Real cover art on the details window, and maybe a "Covers" grid view.
- A co-op yes/no flag with a small badge and a "Co-op" filter chip.
- Viewing other people's lists (the "Browse lists" nav item).
- Tags (skipped on purpose for v1), priority (replaced by the favorite heart).

## Backend gaps the frontend needs (for me to build)

Also written in my Claude memory notes (`game-tracker-backend-gaps`).

1. `favorite` yes/no field on games, plus `?favorite=true` filter on `GET /games/`.
2. `sort` query param on `GET /games/` (Title or Release date, anything else is a 422).
3. Password change endpoint (current plus new password).
4. `DELETE /users/me` to delete the account.
5. Restrict `status` to wishlist, playing, completed.
6. Only allow `http://` and `https://` in the `link` field.
7. Small cleanups: the double `db.commit()` in `register`, and `GET /auth/me` duplicates `GET /users/me`.

### Backend changes found while building the frontend

Status checked 2026-10-20 against the running API: items 1, 2, 3, 4 (status only; platform is still free text) and 5 are done and work with the frontend. Still to build: `sort` (item 6) and `GET /games/summary` (item 7).

Needed (the UI breaks or does nothing without these):
1. `favorite` boolean on `Game` (model, `GameCreate`, `GameUpdate`, `GameOutput`, plus an Alembic migration). Default false. The heart sends `PATCH {favorite: true}`; today the API ignores it.
2. DONE: `PATCH /api/v1/users/me/password` with `{current_password, new_password}` (204, or 400 "Incorrect password"). Checked against the frontend.
3. `DELETE /api/v1/users/me` (204). Decide what happens to the user's games (delete them with the account).
4. `GameCreate`/`GameUpdate`: restrict `status` to wishlist, playing, completed (a `Literal` type or validator). Do the same for `platform` (PC, PS5, Switch, VR, Xbox, Other) if you want the database to match the dropdown.
5. `link` field: only accept `http://` or `https://`. The UI checks this too, but the API must not trust the browser.

Filtering, sorting and counts (the list screen now uses the API for these, as a normal API-backed list would):
6. `GET /games/` params the frontend sends: `search`, `status`, `platform`, `released=true`, plus two to build:
   - `favorite=true` (needs the `favorite` field from item 1).
   - `sort=title|released` (anything else is a 422). Release date sorts oldest first with games that have no date last. Always add `Game.id` as a tie-breaker so the order is stable.
7. `GET /api/v1/games/summary` returns unfiltered counts for the current user: `{"total": 12, "by_status": {"wishlist": 5, "playing": 2, "completed": 5}, "by_platform": {"PC": 4, "PS5": 3}}`. Build it with `GROUP BY` queries (`func.count`), not by loading every game into Python. The count chips and the "1 of 3 games" text need it. Declare this route before `/{game_id}`, or FastAPI will read "summary" as a game id.
   - Why a separate endpoint: if the counts came from the filtered list, the chips would shrink whenever the user filters. Until it exists, the chips are hidden and the list still works.
8. "Out now" is sent as `released=true&status=wishlist` (a wishlist game whose release date has passed). `released=true` alone returns games of every status, which is fine; the frontend narrows it.
9. Optional, later: `limit` and `offset` so a long list is returned in pages. The frontend doesn't use them yet.

Other:
- `GET /auth/me` duplicates `GET /users/me`; the frontend only calls `/users/me`.

Worth knowing:
- `PATCH /games/{id}` with `release_date: null` clears the date (the edit form relies on this). It works because `model_dump(exclude_unset=True)` keeps fields that were sent as null.
- A 422 from FastAPI looks like `{"detail": [{"loc": [...], "msg": "..."}]}`; the form shows each message next to the field named in `loc`. Keep error responses in this shape.

Frontend notes:
- Names differ slightly from the layout above: `nginx.conf.template` (nginx fills in the API address from the `API_UPSTREAM` env var) and an extra `js/login.js` for the login screen.
