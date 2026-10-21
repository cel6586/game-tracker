// Written with Claude Code
// Token storage and the cached "who am I". No network calls here, those live in api.js.

const TOKEN_KEY = "gt_token";
let cachedUser = null;

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage can be blocked, treat as signed out
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // The login screen shows this message.
    throw new Error("Can't save your sign-in. Allow site data for this page in your browser.");
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // nothing to clear
  }
  cachedUser = null;
}

export function isSignedIn() {
  return Boolean(getToken());
}

export function getCachedUser() {
  return cachedUser;
}

export function setCachedUser(user) {
  cachedUser = user;
}

export function logout() {
  clearToken();
  window.location.hash = "#/login";
}
