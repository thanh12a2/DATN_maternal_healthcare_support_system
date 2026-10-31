import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../services/api';

export type ListState = 'loading' | 'ready' | 'error' | 'unavailable' | 'forbidden';

export interface UseApiListResult<T> {
  state: ListState;
  items: T[];
  error: string;
  reload: () => void;
}

/** Tải một danh sách; tách 403/404/501 khỏi lỗi thường để hiển thị đúng trạng thái. */
export function useApiList<T>(loader: () => Promise<T[]>, deps: ReadonlyArray<unknown>): UseApiListResult<T> {
  const [state, setState] = useState<ListState>('loading');
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let active = true;
    setState('loading');
    setError('');
    loaderRef.current()
      .then((result) => { if (active) { setItems(result); setState('ready'); } })
      .catch((reason: unknown) => {
        if (!active) return;
        setItems([]);
        if (reason instanceof ApiError && reason.statusCode === 403) setState('forbidden');
        else if (reason instanceof ApiError && [404, 501].includes(reason.statusCode)) setState('unavailable');
        else { setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu.'); setState('error'); }
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { state, items, error, reload };
}
