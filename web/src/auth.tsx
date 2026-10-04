import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ApiUser, api, setCurrentUser } from './api';

interface AuthCtx {
  user: ApiUser | null;
  users: ApiUser[];
  switchUser: (id: string) => void;
  hasRole: (...roles: string[]) => boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [user, setUser] = useState<ApiUser | null>(null);

  async function refresh() {
    const list = await api<ApiUser[]>('/users');
    setUsers(list);
    const uid = localStorage.getItem('uid');
    if (uid && list.some((u) => u.id === uid)) {
      setCurrentUser(uid);
      setUser(list.find((u) => u.id === uid) ?? null);
    } else {
      setCurrentUser(null);
      setUser(null);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function switchUser(id: string) {
    if (!id) {
      setCurrentUser(null);
      setUser(null);
      return;
    }
    setCurrentUser(id);
    setUser(users.find((u) => u.id === id) ?? null);
  }

  const hasRole = (...roles: string[]) =>
    !!user && roles.some((r) => user.roles.includes(r));

  return (
    <Ctx.Provider value={{ user, users, switchUser, hasRole, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
