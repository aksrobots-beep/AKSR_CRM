import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
  canApprove: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          const result = await api.login(email, password);
          api.setToken(result.token);
          set({
            user: {
              ...result.user,
              isActive: true,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: 'system',
              updatedBy: 'system',
              canApprove: result.user.can_approve || false,
            } as User,
            token: result.token,
            isAuthenticated: true,
          });
          return { ok: true };
        } catch (err: unknown) {
          console.error('Login failed:', err);
          const message = err instanceof Error ? err.message : 'Login failed';
          return { ok: false, error: message };
        }
      },

      logout: () => {
        api.setToken(null);
        set({ user: null, token: null, isAuthenticated: false });
      },

      hasPermission: (requiredRoles: UserRole[]) => {
        const { user } = get();
        if (!user) return false;
        
        // CEO has access to everything
        if (user.role === 'ceo') return true;
        
        // Admin has access to most things
        if (user.role === 'admin' && !requiredRoles.includes('ceo')) return true;
        
        return requiredRoles.includes(user.role);
      },

      canApprove: () => {
        const { user } = get();
        if (!user) return false;
        return user.canApprove === true;
      },
    }),
    {
      name: 'ak-crm-auth',
      onRehydrateStorage: () => (state) => {
        // Restore token to API service after rehydration
        if (state?.token) {
          api.setToken(state.token);
        }
      },
    }
  )
);
