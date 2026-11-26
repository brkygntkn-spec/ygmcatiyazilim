import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AuthStatusResponse, AuthUser, UserPermissions } from './auth';
import type { DepartmentName, UserRole } from './talent';

interface CreateUserPayload {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  department: DepartmentName;
  title: string;
  linkedEmployeeId: string | null;
  permissions: UserPermissions;
}

interface UpdateUserPayload {
  fullName?: string;
  role?: UserRole;
  department?: DepartmentName;
  title?: string;
  linkedEmployeeId?: string | null;
  isActive?: boolean;
  permissions?: UserPermissions;
  newPassword?: string;
}

interface AuthContextValue {
  statusLoading: boolean;
  authStatus: AuthStatusResponse | null;
  currentUser: AuthUser | null;
  users: AuthUser[];
  usersLoading: boolean;
  refreshAuthStatus: () => Promise<void>;
  setupInitialAdmin: (payload: {
    fullName: string;
    email: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  createUser: (payload: CreateUserPayload) => Promise<{ ok: boolean; error?: string }>;
  updateUser: (
    userId: string,
    payload: UpdateUserPayload
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Keep Bearer session token strictly in React memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const clearSessionState = useCallback(() => {
    setToken(null);
    setCurrentUser(null);
    setUsers([]);
  }, []);

  const safeJson = async <T,>(res: Response): Promise<T | null> => {
    try {
      return (await res.json()) as T;
    } catch {
      return null;
    }
  };

  const refreshAuthStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await safeJson<AuthStatusResponse>(res);
        if (data) setAuthStatus(data);
      }
    } catch {
      // Network error handled silently until retry
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuthStatus();
  }, [refreshAuthStatus]);

  const refreshUsers = useCallback(async () => {
    if (!token) return;
    setUsersLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        clearSessionState();
        return;
      }
      if (res.ok) {
        const data = await safeJson<{ users: AuthUser[] }>(res);
        if (data?.users) setUsers(data.users);
      }
    } finally {
      setUsersLoading(false);
    }
  }, [clearSessionState, token]);

  useEffect(() => {
    if (
      token &&
      currentUser &&
      (currentUser.role === 'ADMIN' || currentUser.permissions.actions.canManageUsers)
    ) {
      void refreshUsers();
    } else {
      setUsers([]);
    }
  }, [currentUser, refreshUsers, token]);

  const setupInitialAdmin = useCallback(
    async (payload: { fullName: string; email: string; password: string }) => {
      try {
        const res = await fetch('/api/auth/setup-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await safeJson<{ token?: string; user?: AuthUser; error?: string }>(res);
        if (!res.ok || !data?.token || !data?.user) {
          return { ok: false, error: data?.error || 'Yönetici hesabı oluşturulamadı.' };
        }
        setToken(data.token);
        setCurrentUser(data.user);
        setAuthStatus((prev) =>
          prev
            ? { ...prev, initialized: true, defaultAdminEmail: data.user!.email }
            : { initialized: true, hasEnvAdmin: false, defaultAdminEmail: data.user!.email }
        );
        return { ok: true };
      } catch {
        return { ok: false, error: 'Sunucuya bağlanılamadı. Lütfen tekrar deneyin.' };
      }
    },
    []
  );

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await safeJson<{ token?: string; user?: AuthUser; error?: string }>(res);
      if (!res.ok || !data?.token || !data?.user) {
        return { ok: false, error: data?.error || 'Giriş yapılamadı.' };
      }
      setToken(data.token);
      setCurrentUser(data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Sunucuya bağlanılamadı. Lütfen tekrar deneyin.' };
    }
  }, []);

  const logout = useCallback(async () => {
    const activeToken = token;
    clearSessionState();
    if (activeToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${activeToken}` },
        });
      } catch {
        // Session already cleared client-side
      }
    }
    void refreshAuthStatus();
  }, [clearSessionState, refreshAuthStatus, token]);

  const createUser = useCallback(
    async (payload: CreateUserPayload) => {
      if (!token) return { ok: false, error: 'Oturum bulunamadı.' };
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.status === 401) {
          clearSessionState();
          return { ok: false, error: 'Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.' };
        }
        const data = await safeJson<{ user?: AuthUser; error?: string }>(res);
        if (!res.ok || !data?.user) {
          return { ok: false, error: data?.error || 'Üye oluşturulamadı.' };
        }
        setUsers((prev) => [...prev, data.user!]);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Sunucu hatası oluştu.' };
      }
    },
    [clearSessionState, token]
  );

  const updateUser = useCallback(
    async (userId: string, payload: UpdateUserPayload) => {
      if (!token) return { ok: false, error: 'Oturum bulunamadı.' };
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.status === 401) {
          clearSessionState();
          return { ok: false, error: 'Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.' };
        }
        const data = await safeJson<{ user?: AuthUser; error?: string }>(res);
        if (!res.ok || !data?.user) {
          return { ok: false, error: data?.error || 'Kullanıcı güncellenemedi.' };
        }
        setUsers((prev) => prev.map((u) => (u.id === userId ? data.user! : u)));
        if (currentUser?.id === userId) {
          setCurrentUser(data.user);
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'Sunucu hatası oluştu.' };
      }
    },
    [clearSessionState, currentUser?.id, token]
  );

  const deleteUser = useCallback(
    async (userId: string) => {
      if (!token) return { ok: false, error: 'Oturum bulunamadı.' };
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          clearSessionState();
          return { ok: false, error: 'Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.' };
        }
        const data = await safeJson<{ ok?: boolean; error?: string }>(res);
        if (!res.ok) {
          return { ok: false, error: data?.error || 'Kullanıcı silinemedi.' };
        }
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        return { ok: true };
      } catch {
        return { ok: false, error: 'Sunucu hatası oluştu.' };
      }
    },
    [clearSessionState, token]
  );

  return (
    <AuthContext.Provider
      value={{
        statusLoading,
        authStatus,
        currentUser,
        users,
        usersLoading,
        refreshAuthStatus,
        setupInitialAdmin,
        login,
        logout,
        refreshUsers,
        createUser,
        updateUser,
        deleteUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
