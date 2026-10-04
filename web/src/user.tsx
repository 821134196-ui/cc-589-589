import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getCurrentUserId } from './api';
import type { User } from './types';

interface UserCtx {
  users: User[];
  current: User | null;
  switchUser: (id: string) => void;
}

const Ctx = createContext<UserCtx>({ users: [], current: null, switchUser: () => {} });

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [uid, setUid] = useState<string>(getCurrentUserId());

  useEffect(() => {
    api<User[]>('/users').then(setUsers).catch(() => setUsers([]));
  }, []);

  const current = users.find((u) => String(u.id) === uid) ?? null;

  const switchUser = (id: string) => {
    setUid(id);
    if (id) localStorage.setItem('uid', id);
    else localStorage.removeItem('uid');
  };

  return <Ctx.Provider value={{ users, current, switchUser }}>{children}</Ctx.Provider>;
}

export const useUsers = () => useContext(Ctx);
