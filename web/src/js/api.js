// Written with Claude Code
// Every call to the API lives in this file. Nothing else calls fetch.

import { clearToken, getToken } from "./auth.js";

const BASE = "/api/v1";

// status 0 means the request never reached the API (network error).
export class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : "Request failed");
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, { method = "GET", body, form = false, auth = true } = {}) {
  const headers = {};
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = new URLSearchParams(body); // sent as application/x-www-form-urlencoded
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(BASE + path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // A 401 on a protected call means the token expired. Login itself also
    // returns 401 for a wrong password, so that call opts out with auth: false.
    if (response.status === 401 && auth) {
      clearToken();
      window.dispatchEvent(new Event("session-expired"));
    }
    throw new ApiError(response.status, data?.detail ?? "Something went wrong.");
  }
  return data;
}

// ---- auth ----
export function register(email, password, name = "") {
  // The name is optional, so a blank one is left out instead of sent as "".
  const body = { email, password, ...(name.trim() ? { name: name.trim() } : {}) };
  return request("/auth/register", { method: "POST", body, auth: false });
}

export function login(email, password) {
  // The API's login expects form fields, and calls the email "username".
  return request("/auth/login", {
    method: "POST",
    body: { username: email, password },
    form: true,
    auth: false,
  });
}

// ---- user ----
export const getMe = () => request("/users/me");
export const updateMe = (fields) => request("/users/me", { method: "PATCH", body: fields });
export const changePassword = (current_password, new_password) =>
  request("/users/me/password", { method: "PATCH", body: { current_password, new_password } });
export const deleteMe = () => request("/users/me", { method: "DELETE" });

// ---- games ----
// params: search, platform, status, released, favorite, sort. Empty values are left out.
export async function listGames(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== "" && value !== undefined && value !== null && value !== false) query.set(key, value);
  }
  const text = query.toString();
  const data = await request(text ? `/games/?${text}` : "/games/");
  return data.games;
}
// Unfiltered counts: {total, by_status: {playing: 2, ...}, by_platform: {PC: 3, ...}}.
// Not in the API yet, see "Backend changes" in design.md.
export const getGameSummary = () => request("/games/summary");
export const createGame = (game) => request("/games/", { method: "POST", body: game });
export const updateGame = (id, fields) => request(`/games/${id}`, { method: "PATCH", body: fields });
export const deleteGame = (id) => request(`/games/${id}`, { method: "DELETE" });
