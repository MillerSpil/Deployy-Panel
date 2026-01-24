import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import type { AuthUser } from '@deployy/shared';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  needsSetup: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);

      // First check if setup is needed
      const { needsSetup: setupNeeded } = await authApi.setupStatus();
      setNeedsSetup(setupNeeded);

      if (setupNeeded) {
        setUser(null);
        return;
      }

      // Then check if user is authenticated
      try {
        const { authenticated, user: authUser } = await authApi.me();
        setUser(authenticated && authUser ? authUser : null);
      } catch {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const { user: authUser } = await authApi.login(email, password);
    setUser(authUser);
    setNeedsSetup(false);
  };

  const register = async (email: string, password: string) => {
    const { user: authUser } = await authApi.register(email, password);
    // After registration, log in automatically
    await login(email, password);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
