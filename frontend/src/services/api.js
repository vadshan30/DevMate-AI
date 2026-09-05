// Lightweight fetch-based API client for the DevMate AI backend.
// No axios, no duplicate request logic inside pages — every chat call
// goes through this module so error handling and auth stay consistent.

import { auth } from '../firebase/firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Build the full URL for a backend endpoint.
 * @param {string} path - e.g. '/api/chat'
 */
function url(path) {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

/**
 * @typedef {{ status: 'unauthenticated' | 'invalid' | 'unavailable' | 'network' | 'unknown',
 *            message: string, statusCode: number }} ApiError
 */

/**
 * Send a chat message to the DevMate AI backend.
 *
 * The Firebase ID token is fetched from the current authenticated user.
 * If no user is signed in, or `getIdToken()` fails, throws an
 * `ApiError` with `status: 'unauthenticated'`.
 *
 * Server error mapping (status → friendly message):
 *   400 → 'invalid'   → "Please enter a valid message."
 *   401 → 'unauthenticated' → "Your session has expired. Please sign in again."
 *   503 → 'unavailable' → "AI service is temporarily unavailable."
 *   other → 'unknown' → "Something went wrong. Please try again."
 *
 * @param {string} message - The user's developer question.
 * @param {'debug'|'optimize'|'secure'} [mode='debug'] - DevMate AI mode.
 * @param {Array<{role: 'user'|'assistant', content: string}>} [history] -
 *   Previous turns of the active conversation, in chronological order.
 *   Should NOT include the current `message`; the server appends the
 *   current user turn and forwards the whole sequence to Gemini.
 * @returns {Promise<{ response: string, model: string, mode: string }>}
 */
export async function sendChatMessage(message, mode = 'debug', history = []) {
  if (!auth.currentUser) {
    const err = new Error('Not signed in.');
    err.status = 'unauthenticated';
    err.statusCode = 401;
    throw err;
  }

  let token;
  try {
    token = await auth.currentUser.getIdToken();
  } catch (tokenErr) {
    console.error('[api] getIdToken failed:', tokenErr);
    const err = new Error('Could not obtain authentication token.');
    err.status = 'unauthenticated';
    err.statusCode = 401;
    throw err;
  }

  // Sanitize history before sending: only keep well-shaped user/assistant
  // turns with string content. Never trust client-shaped data blindly.
  const safeHistory = Array.isArray(history)
    ? history
        .filter(
          (t) =>
            t &&
            typeof t === 'object' &&
            typeof t.content === 'string' &&
            (t.role === 'user' || t.role === 'assistant')
        )
        .map((t) => ({ role: t.role, content: t.content }))
    : [];

  let response;
  try {
    response = await fetch(url('/api/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, mode, history: safeHistory }),
    });
  } catch (networkErr) {
    console.error('[api] network error:', networkErr);
    const err = new Error('Network error. Please check your connection and try again.');
    err.status = 'network';
    err.statusCode = 0;
    throw err;
  }

  // Try to parse JSON regardless of status — the backend always returns JSON.
  let payload = null;
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === 'object') {
      payload = parsed;
    }
  } catch {
    payload = null;
  }

  if (response.ok && payload?.success) {
    return {
      response: payload.response ?? '',
      model: payload.model ?? 'unknown',
      mode: payload.mode ?? 'debug',
    };
  }

  // Map HTTP status to a friendly error category.
  const apiError = new Error(payload?.error || `Request failed (${response.status}).`);
  apiError.statusCode = response.status;
  if (response.status === 401) {
    apiError.status = 'unauthenticated';
  } else if (response.status === 400) {
    apiError.status = 'invalid';
  } else if (response.status === 503) {
    apiError.status = 'unavailable';
  } else {
    apiError.status = 'unknown';
  }
  throw apiError;
}

export { API_BASE_URL };
