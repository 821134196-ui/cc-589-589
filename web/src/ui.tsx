import { ReactNode, useState } from 'react';

export function Alert({ kind, children }: { kind: 'error' | 'ok' | 'warn'; children: ReactNode }) {
  if (!children) return null;
  return <div className={`alert alert-${kind}`}>{children}</div>;
}

// 统一处理接口错误提示
export function useMessage() {
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const flash = {
    error: (m: string) => {
      setError(m);
      setOk('');
    },
    ok: (m: string) => {
      setOk(m);
      setError('');
    },
    clear: () => {
      setError('');
      setOk('');
    },
  };
  const node = (
    <>
      <Alert kind="error">{error}</Alert>
      <Alert kind="ok">{ok}</Alert>
    </>
  );
  return { flash, node };
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
