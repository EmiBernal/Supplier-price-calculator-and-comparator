import { useCallback, useEffect, useState } from 'react';
import type { DependencyList, Dispatch, SetStateAction } from 'react';

export type ProgressiveBatchPage<T> = {
  items: T[];
  total?: number | null;
  hasMore?: boolean;
};

export type ProgressiveBatchResult<T> = {
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  total: number | null;
  setTotal: Dispatch<SetStateAction<number | null>>;
  loadedCount: number;
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  error: string | null;
  reload: () => void;
};

type LoaderOptions<T> = {
  fetchPage: (offset: number, limit: number, signal: AbortSignal) => Promise<ProgressiveBatchPage<T>>;
  limit?: number;
  enabled: boolean;
  deps?: DependencyList;
};

export function useProgressiveBatchLoader<T>({
  fetchPage,
  limit = 1000,
  enabled,
  deps = [],
}: LoaderOptions<T>): ProgressiveBatchResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setTotal(null);
      setLoadedCount(0);
      setIsLoadingInitial(false);
      setIsLoadingMore(false);
      setError(null);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setIsLoadingInitial(true);
    setIsLoadingMore(false);
    setError(null);
    setItems([]);
    setTotal(null);
    setLoadedCount(0);

    const load = async () => {
      let offsetValue = 0;
      let isFirstBatch = true;

      while (isMounted && !controller.signal.aborted) {
        setIsLoadingMore(!isFirstBatch);
        try {
          const page = await fetchPage(offsetValue, limit, controller.signal);
          if (!isMounted || controller.signal.aborted) {
            return;
          }
          const chunk = Array.isArray(page?.items) ? page.items : [];
          setItems((prev) => (isFirstBatch ? chunk : [...prev, ...chunk]));
          if (typeof page?.total === 'number') {
            setTotal(page.total);
          }
          setIsLoadingInitial(false);

          const hasMore =
            typeof page?.hasMore === 'boolean'
              ? page.hasMore
              : typeof page?.total === 'number'
              ? offsetValue + chunk.length < page.total
              : chunk.length === limit;

          if (!hasMore || chunk.length === 0) {
            break;
          }

          offsetValue += limit;
          isFirstBatch = false;
        } catch (err) {
          if (!isMounted || controller.signal.aborted) {
            return;
          }
          console.error('Progressive batch loader error:', err);
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos.');
          break;
        }
      }

      if (isMounted && !controller.signal.aborted) {
        setIsLoadingInitial(false);
        setIsLoadingMore(false);
      }
    };

    load();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [enabled, fetchPage, limit, reloadToken, ...deps]);

  useEffect(() => {
    setLoadedCount(items.length);
  }, [items]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return {
    items,
    setItems,
    total,
    setTotal,
    loadedCount,
    isLoadingInitial,
    isLoadingMore,
    error,
    reload,
  };
}
