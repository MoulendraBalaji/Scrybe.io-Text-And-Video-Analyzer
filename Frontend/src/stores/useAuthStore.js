/* ============================================================
   Scrybe — auth/user store (zustand)
   Single source of truth for session + user identity. Replaces
   prop-drilling through the old App.jsx monolith.
   ============================================================ */

import { create } from 'zustand';
import { authApi, meApi, setAuthToken } from '../services/api';

const STORAGE_KEY = 'scrybeUser';

function persist(user, remember) {
  const store = remember ? localStorage : sessionStorage;
  try { store.setItem(STORAGE_KEY, JSON.stringify(user)); } catch { /* quota */ }
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function clearStoredUser() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* noop */ }
}

export const useAuthStore = create((set, get) => ({
  user: null,
  streak: null,
  tier: null,
  hydrated: false,

  hydrate: async () => {
    const user = readStoredUser();
    if (user) {
      setAuthToken(user.token);
      set({ user, hydrated: true });
      await get().refreshProfile();
    } else {
      set({ hydrated: true });
    }
  },

  login: async (username, password, remember = false) => {
    const data = await authApi.login({ username, password });
    const user = {
      username: data.username,
      first_name: data.first_name,
      last_name: data.last_name,
      token: data.access_token,
    };
    setAuthToken(user.token);
    persist(user, remember);
    set({ user });
    await get().refreshProfile();
    return user;
  },

  register: async (payload) => authApi.register(payload),

  logout: () => {
    setAuthToken(null);
    clearStoredUser();
    set({ user: null, streak: null, tier: null });
  },

  /* Re-pull profile details (name, email, avatar) from the server
     without losing the session token. */
  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;
    try {
      const profile = await authApi.me();
      if (!profile) return;
      const merged = {
        ...user,
        first_name: profile.first_name || user.first_name,
        last_name: profile.last_name || user.last_name,
        email: profile.email,
        role: profile.role || user.role,
        avatar: profile.avatar,
      };
      const remember = Boolean(localStorage.getItem(STORAGE_KEY));
      persist(merged, remember);
      set({ user: merged });
    } catch { /* non-critical — keep the stored session */ }
  },

  /* Merge a server-returned user snapshot (e.g. after avatar/profile save). */
  updateUser: (patch) => {
    const { user } = get();
    if (!user) return;
    const merged = { ...user, ...patch };
    const remember = Boolean(localStorage.getItem(STORAGE_KEY));
    persist(merged, remember);
    set({ user: merged });
  },

  refreshStreak: async () => {
    const { user } = get();
    if (!user) return;
    try {
      set({ streak: await meApi.streak() });
    } catch { /* non-critical — badge stays hidden */ }
  },

  refreshTier: async () => {
    const { user } = get();
    if (!user) return;
    try {
      set({ tier: await meApi.tier() });
    } catch { /* non-critical */ }
  },
}));
