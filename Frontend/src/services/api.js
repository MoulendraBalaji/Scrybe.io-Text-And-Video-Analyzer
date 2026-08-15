/* ============================================================
   Scrybe — centralized REST client
   Every backend call goes through here. Auth token is injected
   automatically; errors are normalized into plain, specific
   messages in the interface's voice.
   ============================================================ */

import { API_BASE } from '../types';

let _token = null;

export function setAuthToken(token) {
  _token = token || null;
}

export function getAuthToken() {
  return _token;
}

async function request(path, { method = 'GET', body, isForm = false, headers = {} } = {}) {
  const finalHeaders = { ...headers };
  if (_token) finalHeaders.Authorization = `Bearer ${_token}`;

  let payload = body;
  if (!isForm && body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: payload,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      (data && data.detail) ||
      (data && data.message) ||
      (data && data.error) ||
      (response.status === 429 && "You're moving too fast — slow down for a few seconds and try again.") ||
      (response.status === 401 && 'Your session expired. Sign in again to continue.') ||
      (response.status === 500 && 'The engine hit a snag. Check the backend logs and try again.') ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

/* ---------------- Auth ---------------- */

export const authApi = {
  register: (payload) => request('/register', { method: 'POST', body: payload }),
  login: (payload) => request('/login', { method: 'POST', body: payload }),
  refresh: (refreshToken) => request('/api/v1/auth/refresh', { method: 'POST', body: { refresh_token: refreshToken } }),
  me: () => request('/api/v1/auth/me'),
};

/* ---------------- Evaluation ---------------- */

export const evaluationApi = {
  evaluate: (file, referenceAnswer, question) => {
    const form = new FormData();
    form.append('file', file);
    form.append('reference_answer', referenceAnswer);
    if (question) form.append('question', question);
    return request('/evaluate', { method: 'POST', body: form, isForm: true });
  },

  analyzeFrame: (imageDataUrl) =>
    request('/analyze-frame', { method: 'POST', body: { image: imageDataUrl } }),

  followUp: (payload) =>
    request('/interview/follow-up', { method: 'POST', body: payload }),

  batchEvaluate: (files, referenceAnswer) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    form.append('reference_answer', referenceAnswer);
    return request('/batch/evaluate', { method: 'POST', body: form, isForm: true });
  },
};

/* ---------------- History / Queries ---------------- */

export const queriesApi = {
  list: (username) => request(`/queries/${username}`),
  create: (username, payload) =>
    request(`/queries?username=${encodeURIComponent(username)}`, { method: 'POST', body: payload }),
  update: (id, payload) => request(`/queries/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => request(`/queries/${id}`, { method: 'DELETE' }),
  leaderboard: () => request('/leaderboard'),
};

/* ---------------- Notes (practice journal) ---------------- */

export const notesApi = {
  list: (username) => request(`/notes/${username}`),
  create: (username, content) =>
    request(`/notes?username=${encodeURIComponent(username)}`, {
      method: 'POST',
      body: { content },
    }),
};

/* ---------------- Me / subscription ---------------- */

export const meApi = {
  streak: () => request('/me/streak'),
  tier: () => request('/me/tier'),
  progress: () => request('/progress'),
  exportData: () => request('/me/data'),
  deleteData: () => request('/me/data', { method: 'DELETE' }),
  updateProfile: (payload) => request('/me', { method: 'PUT', body: payload }),
  updateAvatar: (avatar) => request('/me/avatar', { method: 'PUT', body: { avatar } }),
};

/* ---------------- Question Library (1.1) ---------------- */

export const questionsApi = {
  list: (category) => request(category ? `/questions?category=${encodeURIComponent(category)}` : '/questions'),
  create: (payload) => request('/questions', { method: 'POST', body: payload }),
  remove: (id) => request(`/questions/${id}`, { method: 'DELETE' }),
};

/* ---------------- Invite Links (1.4) ---------------- */

export const invitesApi = {
  create: (payload) => request('/invites', { method: 'POST', body: payload }),
  list: () => request('/invites'),
  get: (token) => request(`/invites/${token}`),
  submit: (token, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/invites/${token}/submit`, { method: 'POST', body: form, isForm: true });
  },
};
