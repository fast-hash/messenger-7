import { create } from 'zustand';
import * as authApi from '../api/authApi';
import * as usersApi from '../api/usersApi';

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  async fetchCurrentUser() {
    try {
      const { user } = await usersApi.currentUser();
      set({ user, loading: false });
    } catch (error) {
      set({ user: null, loading: false });
    }
  },
  async login(credentials) {
    const { user } = await authApi.login(credentials);
    set({ user });
  },
  async register(payload) {
    const { user } = await authApi.register(payload);
    set({ user });
  },
  async logout() {
    await authApi.logout();
    set({ user: null });
  },
}));
