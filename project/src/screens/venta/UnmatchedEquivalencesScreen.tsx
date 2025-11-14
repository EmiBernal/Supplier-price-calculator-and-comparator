import React, { useEffect, useMemo, useState, useDeferredValue, useCallback } from 'react';
import { Button } from '../../components/Button';
import { Navigation } from '../../components/Navigation';
import { Screen } from '../../types';
import { apiFetch } from '../../lib/api';
import { Loader2, Trash2 } from 'lucide-react';
import { useProgressiveBatchLoader } from '../../hooks/useProgressiveBatchLoader';
import { formatYMD, compareYMD, formatYearMonth, compareYearMonth } from '../../utils/date';
import { isFiniteNumber, safeToFixed } from '../../utils/number';
import { getBestSearchRank, normalizeSearchTerm } from '../../utils/search';


/* ---------- Similaridad mejorada: trigramas + Levenshtein + fonética ---------- */

// Limpia texto: minúsculas, sin acentos, sin caracteres raros
function sanitizeText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .trim();
}

// Convierte texto en trigramas (para similitud semántica)
function buildTrigramFreq(s: string) {
  const t: Record<string, number> = {};
  const str = `  ${s}  `;
  for (let i = 0; i < str.length - 2; i++) {
    const tri = str.slice(i, i + 3);
    t[tri] = (t[tri] || 0) + 1;
  }
  return t;
}

// Distancia Levenshtein simple
function levenshteinDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

// 🔥 NUEVA FUNCIÓN DE SIMILITUD: trigramas + Levenshtein + fonética + prefijo/sufijo
function cosineByTri(
  a: Record<string, number>,
  b: Record<string, number>,
  sA?: string,
  sB?: string
) {
  // --- trigram cosine ---
  let dot = 0, nA = 0, nB = 0;
  for (const k in a) { nA += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; }
  for (const k in b) nB += b[k] * b[k];
  const cosine = Math.sqrt(nA * nB) ? dot / Math.sqrt(nA * nB) : 0;

  if (!sA || !sB) return cosine;

  // --- Levenshtein similarity ---
  const lev = levenshteinDistance(sA, sB);
  const maxLen = Math.max(sA.length, sB.length);
  const levSim = 1 - lev / maxLen;

  // --- Fonética mejorada (más tolerante) ---
  const normalizeSound = (txt: string) =>
    txt
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N} ]/gu, "")
      .replace(/[aeiou]/g, "a")
      .replace(/(ll|y)/g, "y")
      .replace(/(c|z|s)/g, "s")
      .replace(/(b|v)/g, "b")
      .replace(/h/g, "")
      .replace(/(q|k)/g, "k")
      .replace(/([rsntd]+)$/g, "");

  const phonA = normalizeSound(sA);
  const phonB = normalizeSound(sB);
  const phonLev = levenshteinDistance(phonA, phonB);
  const phonSim = 1 - phonLev / Math.max(phonA.length, phonB.length);

  // --- Prefijo / Sufijo match (ej: Tenedor ↔ Tendedor) ---
  const prefixMatch = sA.startsWith(sB.slice(0, 4)) || sB.startsWith(sA.slice(0, 4)) ? 0.3 : 0;
  const suffixMatch = sA.endsWith(sB.slice(-3)) || sB.endsWith(sA.slice(-3)) ? 0.3 : 0;
  const partialBonus = Math.min(1, prefixMatch + suffixMatch);

  // --- Ponderación ajustada ---
  // Más peso al trigram + fonética
  const score = cosine * 0.45 + levSim * 0.25 + phonSim * 0.20 + partialBonus * 0.10;

  // 🔍 Limita a [0,1]
  return Math.min(1, Math.max(0, score));
}


// Tokeniza nombre (solo palabras útiles)
function tokenizeName(s: string) {
  return sanitizeText(s).split(/\s+/).filter(w => w.length >= 3);
}

/* ---------- Tipos y helpers ---------- */
type SortDir = 'asc' | 'desc';
type SortKeyExternal = 'cod_externo' | 'nom_externo' | 'proveedor' | 'fecha' | 'mes_actualizacion';
type SortKeyInternal = 'cod_interno' | 'nom_interno' | 'fecha' | 'mes_actualizacion';

type ExternalItem = {
  id_externo: number;
  cod_externo?: string | null;
  nom_externo?: string | null;
  proveedor?: string | null;
  fecha?: string | null;
  mes_actualizacion?: string | null;
  precio?: number | null;
};

type InternalItem = {
  id_interno: number;
  cod_interno?: string | null;
  nom_interno?: string | null;
  fecha?: string | null;
  mes_actualizacion?: string | null;
  precio?: number | null;
};

type Suggestion = {
  internal: InternalItem;
  external: ExternalItem;
  reason: string;
  score: number;
  id: string;
};

type PaginatedResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

const DEFAULT_SIMILARITY_THRESHOLD = 0.40;
const MAX_CANDIDATES_PER_INTERNAL = Infinity;
const BATCH_SIZE = 200;
const PAGINATION_PAGE_SIZE = 1000;

const normalizeExternalRows = (rows: any[]): ExternalItem[] =>
  (Array.isArray(rows) ? rows : [])
    .map((item: any) => ({
      ...item,
      id_externo: Number(item?.id_externo ?? item?.id ?? 0),
      cod_externo: item?.cod_externo ?? item?.codigo ?? null,
    }))
    .filter((item) => Number.isFinite(item.id_externo) && item.id_externo > 0);

const normalizeInternalRows = (rows: any[]): InternalItem[] =>
  (Array.isArray(rows) ? rows : [])
    .map((item: any) => ({
      ...item,
      id_interno: Number(item?.id_interno ?? item?.id ?? 0),
      cod_interno: item?.cod_interno ?? item?.codigo ?? null,
    }))
    .filter((item) => Number.isFinite(item.id_interno) && item.id_interno > 0);

const buildPaginationResult = <T,>(
  data: any,
  fallbackLimit: number,
  fallbackOffset: number
): PaginatedResult<T> => {
  if (Array.isArray(data)) {
    const items = data as T[];
    const limit = fallbackLimit;
    const offset = fallbackOffset;
    const total = offset + items.length;
    const hasMore = items.length === limit;
    return { items, total, limit, offset, hasMore };
  }

  const rawItems = Array.isArray(data?.items) ? (data.items as T[]) : [];
  const limitValue = Number.isFinite(Number(data?.limit))
    ? Number(data.limit)
    : fallbackLimit;
  const offsetValue = Number.isFinite(Number(data?.offset))
    ? Number(data.offset)
    : fallbackOffset;
  const totalValue = Number.isFinite(Number(data?.total))
    ? Number(data.total)
    : offsetValue + rawItems.length;
  const hasMoreValue =
    typeof data?.hasMore === 'boolean'
      ? Boolean(data.hasMore)
      : offsetValue + rawItems.length < totalValue;

  return {
    items: rawItems,
    total: totalValue,
    limit: limitValue,
    offset: offsetValue,
    hasMore: hasMoreValue,
  };
};

const fetchPaginatedChunk = async <T,>(
  path: string,
  offset: number,
  limit: number,
  signal?: AbortSignal
): Promise<PaginatedResult<T>> => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  const res = await apiFetch(`${path}?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`request_failed:${path}`);
  }
  const data = await res.json();
  return buildPaginationResult<T>(data, limit, offset);
};

const sortIcon = (dir?: SortDir) =>
  dir ? <span className="inline-block ml-1 select-none">{dir === 'asc' ? '▲' : '▼'}</span>
      : <span className="inline-block ml-1 opacity-30 select-none">↕</span>;

function classHeader(active: boolean) {
  return `px-6 py-3 text-left font-medium cursor-pointer select-none ${
    active ? 'text-blue-700 dark:text-blue-300'
           : 'text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white'
  }`;
}
const normalizeStr = (v: any) => String(v ?? '').toLowerCase().trim();
const cmp = (a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0);
const formatMonthLabel = (value: unknown) => {
  const normalized = formatYearMonth(value);
  if (!normalized) return '—';
  const [year, month] = normalized.split('-');
  return `${month}/${year}`;
};


/* ---------- Input de búsqueda ---------- */
const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string; }> =
({ value, onChange, placeholder }) => (
  <div className="relative rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 focus-within:ring-2 focus-within:ring-blue-400/40 focus-within:border-blue-400/60 transition">
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 dark:text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </div>
    <input
      autoComplete="off" spellCheck={false}
      className="w-full pl-9 pr-9 py-2 rounded-xl bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/60 focus:outline-none"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onChange(''); } }}
    />
    {value && (
      <button type="button" className="absolute inset-y-0 right-0 pr-3 text-gray-500 hover:text-gray-700 dark:text-white/60 dark:hover:text-white" onClick={() => onChange('')} title="Limpiar (Esc)" tabIndex={-1}>✕</button>
    )}
  </div>
);

export const UnmatchedEquivalencesScreen: React.FC<{ onNavigate: (screen: Screen) => void }> = ({ onNavigate }) => {
  const [selectedExternals, setSelectedExternals] = useState<ExternalItem[]>([]);
  const [selectedInternal, setSelectedInternal] = useState<InternalItem | null>(null);

  /* NUEVO: modo eliminar (sin checkbox) */
  const [deleteModeExt, setDeleteModeExt] = useState(false);
  const [deleteModeInt, setDeleteModeInt] = useState(false);
  const [extDeleteIds, setExtDeleteIds] = useState<Set<number>>(new Set());
  const [intDeleteIds, setIntDeleteIds] = useState<Set<number>>(new Set());

  // Panel de revisión
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ignoredPairs, setIgnoredPairs] = useState<Set<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // búsquedas
  const [searchExt, setSearchExt] = useState('');
  const [searchInt, setSearchInt] = useState('');
  const dSearchExt = useDeferredValue(searchExt);
  const dSearchInt = useDeferredValue(searchInt);

  const fetchExternalPage = useCallback(
    async (offset: number, limit: number, signal: AbortSignal) => {
      const page = await fetchPaginatedChunk<any>(
        '/api/no-relacionados/proveedores',
        offset,
        limit,
        signal
      );
      return {
        items: normalizeExternalRows(page.items),
        total: page.total,
        hasMore: page.hasMore,
      };
    },
    []
  );

  const {
    items: externals,
    setItems: setExternals,
    total: externalTotal,
    setTotal: setExternalTotal,
    loadedCount: externalLoadedCount,
    isLoadingInitial: loadingExternals,
    isLoadingMore: loadingMoreExternals,
    error: externalsError,
    reload: reloadExternals,
  } = useProgressiveBatchLoader<ExternalItem>({
    enabled: true,
    limit: PAGINATION_PAGE_SIZE,
    fetchPage: fetchExternalPage,
  });

  const fetchInternalPage = useCallback(
    async (offset: number, limit: number, signal: AbortSignal) => {
      const page = await fetchPaginatedChunk<any>('/api/gampack', offset, limit, signal);
      return {
        items: normalizeInternalRows(page.items),
        total: page.total,
        hasMore: page.hasMore,
      };
    },
    []
  );

  const {
    items: internals,
    setItems: setInternals,
    total: internalTotal,
    setTotal: setInternalTotal,
    loadedCount: internalLoadedCount,
    isLoadingInitial: loadingInternals,
    isLoadingMore: loadingMoreInternals,
    error: internalsError,
    reload: reloadInternals,
  } = useProgressiveBatchLoader<InternalItem>({
    enabled: true,
    limit: PAGINATION_PAGE_SIZE,
    fetchPage: fetchInternalPage,
  });

  // ordenamientos
  const [sortExtKey, setSortExtKey] = useState<SortKeyExternal>('fecha');
  const [sortExtDir, setSortExtDir] = useState<SortDir>('desc');
  const [sortIntKey, setSortIntKey] = useState<SortKeyInternal>('fecha');
  const [sortIntDir, setSortIntDir] = useState<SortDir>('desc');

  // umbral similitud
  const [threshold, setThreshold] = useState<number>(DEFAULT_SIMILARITY_THRESHOLD);
  const thresholdLabel = safeToFixed(threshold, 2);

  // Top button
  const [showTop, setShowTop] = useState(false);


  // accesos rápidos teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const editable = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable;
      const k = e.key.toLowerCase();
      if ((k === 'r' && (e.ctrlKey || e.metaKey)) || e.key === 'F5') { e.preventDefault(); return; }
      if (!editable && k === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // botón top al hacer scroll
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ---------- Índice para sugerencias ---------- */
  const extIndexed = useMemo(() => {
    type ExtIdx = { item: ExternalItem; nameSan: string; tri: Record<string, number>; toks: string[]; };
    const items: ExtIdx[] = [];
    const inv = new Map<string, number[]>();
    externals.forEach((e, idx) => {
      const nameSan = sanitizeText(e.nom_externo ?? '');
      const tri = buildTrigramFreq(nameSan);
      const toks = Array.from(new Set(tokenizeName(e.nom_externo ?? '')));
      items.push({ item: e, nameSan, tri, toks });
      toks.forEach(t => { const arr = inv.get(t) || []; arr.push(idx); inv.set(t, arr); });
    });
    return { items, inv };
  }, [externals]);

/* ---------- Auto-relación por nombre ---------- */
const generateAutoMatches = useCallback(async () => {
  if (internals.length === 0 || extIndexed.items.length === 0) {
    setSuggestions([]);
    setReviewOpen(true);
    return;
  }

  console.log('🧠 Generando auto-matches con threshold:', threshold);
  setLoadingAuto(true);
  const acc: Suggestion[] = [];
  const seen = new Set<string>();

  for (let start = 0; start < internals.length; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE, internals.length);

    for (let k = start; k < end; k++) {
      const i = internals[k];

      const iName = i.nom_interno ?? '';
      if (!iName.trim()) continue;

      const iSan = sanitizeText(iName);
      const iTri = buildTrigramFreq(iSan);

      for (const eIdx of extIndexed.items) {
        const e = eIdx.item;
        const eName = e.nom_externo ?? '';
        if (!eName.trim()) continue;

        const id = `${i.id_interno}|${e.id_externo}`;
        if (ignoredPairs.has(id) || seen.has(id)) continue;

        const rawScore = cosineByTri(
          iTri,
          eIdx.tri,
          iSan,
          sanitizeText(eName)
        );

        if (!isFiniteNumber(rawScore)) {
          continue;
        }

        const score = rawScore;

        // 🔍 Muestra los puntajes en consola
        const scoreForLog = safeToFixed(score, 3);
        console.log(
          `Comparando "${iName}" ↔ "${eName}" → score: ${scoreForLog}`
        );

        if (score >= threshold) {
          acc.push({
            internal: i,
            external: e,
            reason: `Nombre similar (${safeToFixed(score, 2)})`,
            score,
            id,
          });
          seen.add(id);
        }
      }
    }

    // Evita congelar la UI durante lotes grandes
    await new Promise((r) => setTimeout(r, 0));
  }

  // Ordena los resultados por mejor score
  acc.sort((a, b) => b.score - a.score);
  setSuggestions(acc);
  setReviewOpen(true);
  setLoadingAuto(false);

  console.log('✅ Total de sugerencias generadas:', acc.length);
}, [internals, extIndexed, ignoredPairs, threshold]);

  /* ---------- Aceptar / Rechazar sugerencias ---------- */
  const removeFromStateAfterLink = (i: InternalItem, e: ExternalItem) => {
    setExternals((prev) => prev.filter((x) => x.id_externo !== e.id_externo)); // solo quitamos el externo
    setExternalTotal((current) =>
      typeof current === 'number' ? Math.max(0, current - 1) : current
    );
    setSelectedExternals((prev) => prev.filter((x) => x.id_externo !== e.id_externo));
    setSelectedInternal((prev) => (prev?.id_interno === i.id_interno ? null : prev));
    setSuggestions((prev) =>
      prev.filter(
        (s) => s.internal.id_interno !== i.id_interno && s.external.id_externo !== e.id_externo
      )
    );
  };

  const acceptSuggestion = async (s: Suggestion) => {
    try {
      const res = await apiFetch('/api/relacionar-manual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_lista_interna: s.internal.id_interno, ids_lista_precios: [s.external.id_externo], criterio: 'manual' }),
      });
      if (res.ok) removeFromStateAfterLink(s.internal, s.external);
      else alert(`Error: ${(await res.json().catch(() => ({} as any)))?.message || 'No se pudo vincular'}`);
    } catch { alert('Error al conectar con el servidor'); }
  };

  const rejectSuggestion = (s: Suggestion) => {
    setIgnoredPairs(prev => new Set(prev).add(s.id));
    setSuggestions(prev => prev.filter(x => x.id !== s.id));
  };

  const acceptAllVisible = async () => {
    if (suggestions.length === 0) return;
    setBulkBusy(true);
    try {
      const byInternal = new Map<number, { internal: InternalItem; extIds: number[] }>();
      suggestions.forEach(s => {
        const key = s.internal.id_interno;
        if (!byInternal.has(key)) byInternal.set(key, { internal: s.internal, extIds: [] });
        byInternal.get(key)!.extIds.push(s.external.id_externo);
      });

      for (const { internal, extIds } of byInternal.values()) {
        const res = await apiFetch('/api/relacionar-manual', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_lista_interna: internal.id_interno, ids_lista_precios: extIds, criterio: 'manual' }),
        });
        if (!res.ok) throw new Error('No se pudo vincular en lote');
        setExternals(prev => prev.filter(e => !extIds.includes(e.id_externo)));
        setInternals(prev => prev.filter(i => i.id_interno !== internal.id_interno));
        setExternalTotal((current) =>
          typeof current === 'number' ? Math.max(0, current - extIds.length) : current
        );
        setInternalTotal((current) =>
          typeof current === 'number' ? Math.max(0, current - 1) : current
        );
        setSuggestions(prev => prev.filter(s => s.internal.id_interno !== internal.id_interno));
      }
      toast(`✔ Vinculadas ${suggestions.length} sugerencias`);
      setReviewOpen(false);
    } catch (e: any) { alert(e?.message || 'Error al vincular en lote'); }
    finally { setBulkBusy(false); }
  };

  const rejectAllVisible = () => {
    if (suggestions.length === 0) return;
    const ids = suggestions.map(s => s.id);
    setIgnoredPairs(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
    setSuggestions([]);
    toast('🗑 Sugerencias descartadas');
    setReviewOpen(false);
  };

  /* ---------- Filtrado/sort ---------- */
  const filteredSortedExternals = useMemo(() => {
    const normalizedQuery = normalizeSearchTerm(dSearchExt);
    const ranked = externals
      .map((item) => ({
        item,
        rank: normalizedQuery
          ? getBestSearchRank([item.cod_externo, item.nom_externo, item.proveedor], normalizedQuery)
          : null,
      }))
      .filter((entry) => (normalizedQuery ? entry.rank != null : true));

    const sorted = [...ranked].sort((a, b) => {
      if (normalizedQuery && a.rank !== b.rank) {
        return (a.rank ?? 0) - (b.rank ?? 0);
      }
      const av: any = a.item[sortExtKey];
      const bv: any = b.item[sortExtKey];
      let r: number;
      if (sortExtKey === 'fecha') r = compareYMD(av, bv);
      else if (sortExtKey === 'mes_actualizacion') r = compareYearMonth(av, bv);
      else r = cmp(normalizeStr(av), normalizeStr(bv));
      return sortExtDir === 'asc' ? r : -r;
    });

    return sorted.map((entry) => entry.item);
  }, [externals, dSearchExt, sortExtKey, sortExtDir]);

  const filteredSortedInternals = useMemo(() => {
    const normalizedQuery = normalizeSearchTerm(dSearchInt);
    const ranked = internals
      .map((item) => ({
        item,
        rank: normalizedQuery
          ? getBestSearchRank([item.cod_interno, item.nom_interno], normalizedQuery)
          : null,
      }))
      .filter((entry) => (normalizedQuery ? entry.rank != null : true));

    const sorted = [...ranked].sort((a, b) => {
      if (normalizedQuery && a.rank !== b.rank) {
        return (a.rank ?? 0) - (b.rank ?? 0);
      }
      const av: any = a.item[sortIntKey];
      const bv: any = b.item[sortIntKey];
      let r: number;
      if (sortIntKey === 'fecha') r = compareYMD(av, bv);
      else if (sortIntKey === 'mes_actualizacion') r = compareYearMonth(av, bv);
      else r = cmp(normalizeStr(av), normalizeStr(bv));
      return sortIntDir === 'asc' ? r : -r;
    });

    return sorted.map((entry) => entry.item);
  }, [internals, dSearchInt, sortIntKey, sortIntDir]);

  const toggleSortExternal = (key: SortKeyExternal) => {
    if (sortExtKey === key) setSortExtDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortExtKey(key); setSortExtDir(key === 'fecha' || key === 'mes_actualizacion' ? 'desc' : 'asc'); }
  };
  const toggleSortInternal = (key: SortKeyInternal) => {
    if (sortIntKey === key) setSortIntDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortIntKey(key); setSortIntDir(key === 'fecha' || key === 'mes_actualizacion' ? 'desc' : 'asc'); }
  };

  /* ---------- Selecciones ---------- */
  const toggleExternalSelection = (item: ExternalItem) => {
    setSelectedExternals(prev => prev.find(e => e.id_externo === item.id_externo)
      ? prev.filter(e => e.id_externo !== item.id_externo)
      : [...prev, item]);
  };

  const onExternalRowClick = (item: ExternalItem) => {
    if (deleteModeExt) {
      setExtDeleteIds(prev => { const n = new Set(prev); n.has(item.id_externo) ? n.delete(item.id_externo) : n.add(item.id_externo); return n; });
    } else {
      toggleExternalSelection(item);
    }
  };
  const onInternalRowClick = (item: InternalItem) => {
    if (deleteModeInt) {
      setIntDeleteIds(prev => { const n = new Set(prev); n.has(item.id_interno) ? n.delete(item.id_interno) : n.add(item.id_interno); return n; });
    } else {
      setSelectedInternal(item);
    }
  };

  const rowStyle = (linkSelected: boolean, deleteSelected: boolean) => {
    if (deleteSelected) return 'bg-red-50 dark:bg-red-900/20 ring-1 ring-red-400/30 cursor-pointer';
    return linkSelected
      ? 'bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-400/30 cursor-pointer'
      : 'hover:bg-gray-50 dark:hover:bg-white/10 cursor-pointer';
  };

  /* ---------- Toast ---------- */
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2000); };

  const deleteSelectedExternals = async () => {
    if (extDeleteIds.size === 0) return;
    if (!confirm(`¿Eliminar ${extDeleteIds.size} producto(s) de proveedores?`)) return;
    const ids = Array.from(extDeleteIds);
    try {
      const res = await apiFetch('/api/no-relacionados/externos/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error('bulk_failed');
    } catch {
      for (const id of ids) await apiFetch(`/api/no-relacionados/externos/${id}`, { method: 'DELETE' }).catch(() => {});
    } finally {
      setExternals(prev => prev.filter(x => !extDeleteIds.has(x.id_externo)));
      setExternalTotal((current) =>
        typeof current === 'number' ? Math.max(0, current - ids.length) : current
      );
      setSelectedExternals(prev => prev.filter(x => !extDeleteIds.has(x.id_externo)));
      setExtDeleteIds(new Set());
      setDeleteModeExt(false);
      toast('🗑 Productos de proveedores eliminados');
    }
  };

  const deleteSelectedInternals = async () => {
    if (intDeleteIds.size === 0) return;
    if (!confirm(`¿Eliminar ${intDeleteIds.size} producto(s) de Gampack?`)) return;
    const ids = Array.from(intDeleteIds);
    try {
      const res = await apiFetch('/api/no-relacionados/internos/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error('bulk_failed');
    } catch {
      for (const id of ids) await apiFetch(`/api/no-relacionados/internos/${id}`, { method: 'DELETE' }).catch(() => {});
    } finally {
      setInternals(prev => prev.filter(x => !intDeleteIds.has(x.id_interno)));
      setInternalTotal((current) =>
        typeof current === 'number' ? Math.max(0, current - ids.length) : current
      );
      if (selectedInternal && intDeleteIds.has(selectedInternal.id_interno)) setSelectedInternal(null);
      setIntDeleteIds(new Set());
      setDeleteModeInt(false);
      toast('🗑 Productos Gampack eliminados');
    }
  };

  // ---------- Acción común: Vincular manualmente ----------
  const handleManualLink = async () => {
    if (!selectedInternal || selectedExternals.length === 0) { alert('Seleccioná un producto Gampack y al menos un proveedor'); return; }
    try {
      const res = await apiFetch('/api/relacionar-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_lista_interna: selectedInternal.id_interno, ids_lista_precios: selectedExternals.map(e => e.id_externo), criterio: 'manual' }),
      });
      if (res.ok) {
        setExternals(prev => prev.filter(e => !selectedExternals.some(se => se.id_externo === e.id_externo)));
        setExternalTotal((current) =>
          typeof current === 'number' ? Math.max(0, current - selectedExternals.length) : current
        );
        setSelectedExternals([]); setSelectedInternal(null);
        setSuggestions(prev => prev.filter(s => s.internal.id_interno !== selectedInternal.id_interno && !selectedExternals.some(se => se.id_externo === s.external.id_externo)));
        toast('✔ Vinculación manual realizada');
      } else {
        const error = await res.json().catch(() => ({}));
        alert(`Error: ${error.message || 'No se pudo vincular'}`);
      }
    } catch { alert('Error al conectar con el servidor'); }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f1a] p-6">
      <style>{`.dark select option, .dark datalist option { color:#0f172a; background:#fff; }`}</style>
      <div className="max-w-7xl mx-auto">
        <Navigation onBack={() => onNavigate('home')} title="" />

        <header className="relative mt-1 mb-4">
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-[#0e1526]/60 backdrop-blur shadow-sm px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Gampack · Vinculaciones</div>
                <h1 className="mt-1 text-2xl md:text-3xl font-extrabold leading-tight tracking-tight">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-fuchsia-500 dark:from-blue-300 dark:via-indigo-300 dark:to-pink-300">Relacionar productos</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">manualmente</span>
                </h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Detectá coincidencias por <b>nombre</b>, revisá el motivo y confirmá o descartá cada relación.</p>
              </div>

              <div className="flex-shrink-0 flex flex-col items-end gap-2">
                <div className="text-xs text-gray-600 dark:text-gray-300">Umbral: <b>{thresholdLabel}</b></div>
                <input type="range" min={0.3} max={0.9} step={0.01} value={threshold} onChange={e => setThreshold(parseFloat(e.target.value))} className="w-40 accent-blue-600" />
                <Button onClick={generateAutoMatches} disabled={loadingAuto}>{loadingAuto ? 'Buscando coincidencias…' : 'Relacionar automáticamente'}</Button>
              </div>
            </div>
          </div>
        </header>

        {/* PANEL DE REVISIÓN */}
        {reviewOpen && (
          <div className="mt-4 mb-4 rounded-2xl border border-blue-300/40 dark:border-blue-300/20 bg-blue-50/70 dark:bg-blue-900/20 shadow-xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🤖</div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-xl font-bold text-blue-900 dark:text-blue-200">Resultados de auto-relación por nombre</h3>
                    <p className="text-sm text-blue-900/80 dark:text-blue-100/80 mt-1">Revisá cada coincidencia. <b>Aceptar</b> vincula; <b>Descartar</b> ignora.</p>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Button onClick={acceptAllVisible} disabled={bulkBusy || suggestions.length === 0}>Aceptar todas</Button>
                    <Button onClick={rejectAllVisible} variant="secondary" disabled={bulkBusy || suggestions.length === 0}>Descartar todas</Button>
                    <Button onClick={() => setReviewOpen(false)} variant="secondary">Ocultar</Button>
                  </div>
                </div>
                {loadingAuto && <div className="mt-3 h-1 w-full bg-blue-200/50 dark:bg-blue-950/50 rounded"><div className="h-1 w-1/3 animate-pulse bg-blue-600 rounded" /></div>}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[420px] overflow-auto pr-1">
                  {suggestions.length === 0 && !loadingAuto && <div className="col-span-full text-sm text-blue-900/80 dark:text-blue-100/80">No hay coincidencias por encima del umbral ({thresholdLabel}).</div>}
                  {suggestions.map((s) => {
                    const scoreBadge = safeToFixed(s.score * 100, 0);
                    return (
                      <div key={s.id} className="rounded-xl bg-white dark:bg-[#0e1526] border border-blue-200/50 dark:border-white/10 p-4 shadow">
                      <div className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-2 flex items-center justify-between">
                        <span>{s.reason}</span><span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[10px] font-semibold">{scoreBadge === '—' ? '—' : `${scoreBadge}%`}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <div className="font-semibold text-gray-900 dark:text-white">Gampack</div>
                          <div className="text-gray-800 dark:text-gray-200">{s.internal.nom_interno} <span className="text-gray-500">({s.internal.cod_interno || 'sin código'})</span></div>
                        </div>
                        <div className="text-sm">
                          <div className="font-semibold text-gray-900 dark:text-white">Proveedor</div>
                          <div className="text-gray-800 dark:text-gray-200">{s.external.nom_externo} <span className="text-gray-500">({s.external.cod_externo || 'sin código'})</span></div>
                          <div className="text-gray-500 text-xs">{s.external.proveedor || 'Proveedor desconocido'}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button onClick={() => acceptSuggestion(s)}>Aceptar</Button>
                        <Button onClick={() => rejectSuggestion(s)} variant="secondary">Descartar</Button>
                      </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Barra fija vincular manual */}
        <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-[#0b0f1a]/95 backdrop-blur py-3 mb-4 flex items-center justify-between border-b border-gray-200 dark:border-white/10">
          <div className="text-sm text-gray-700 dark:text-gray-200">
            {selectedInternal ? `Seleccionado: ${selectedInternal.nom_interno} (${selectedInternal.cod_interno || 'Sin código'})` : 'Ningún producto Gampack seleccionado'}
            {selectedExternals.length > 0 && ` | ${selectedExternals.length} proveedor(es) seleccionado(s)`}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleManualLink} disabled={selectedExternals.length === 0 || !selectedInternal}>
              Vincular manualmente
            </Button>
          </div>
        </div>

        {/* Tablas */}
        <div className="bg-white dark:bg-[#0e1526] rounded-lg shadow-sm border border-gray-200 dark:border-white/10 p-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* EXTERNOS */}
            <div>
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Productos Proveedores no relacionados</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {loadingExternals
                      ? 'Cargando productos…'
                      : typeof externalTotal === 'number'
                        ? `${externalLoadedCount.toLocaleString('es-AR')} de ${externalTotal.toLocaleString('es-AR')} productos`
                        : `${externalLoadedCount.toLocaleString('es-AR')} productos cargados`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={deleteModeExt ? 'primary' : 'secondary'} onClick={() => { setDeleteModeExt(v => !v); if (deleteModeExt) setExtDeleteIds(new Set()); }}>
                    {deleteModeExt ? 'Salir de modo eliminar' : 'Modo eliminar'}
                  </Button>
                  <Button onClick={deleteSelectedExternals} variant="secondary" disabled={extDeleteIds.size === 0}>
                    <span className="inline-flex items-center gap-2"><Trash2 size={16} /> Eliminar seleccionados ({extDeleteIds.size})</span>
                  </Button>
                </div>
              </div>

              {deleteModeExt && (
                <div className="mb-2 text-xs rounded-md px-2 py-1 border border-red-300/40 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/20">
                  Modo eliminar activo: hacé click en las filas para marcarlas en rojo y luego “Eliminar seleccionados”.
                </div>
              )}

              <div className="mb-3">
                <SearchInput value={searchExt} onChange={setSearchExt} placeholder="Buscar por código, nombre o proveedor…" />
              </div>

              {externalsError && (
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  <span>{externalsError}</span>
                  <Button onClick={reloadExternals} variant="secondary">
                    Reintentar
                  </Button>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10 shadow-sm bg-white dark:bg-[#0f1930]">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10 text-sm">
                  <thead className="bg-gray-50 dark:bg-white/10 dark:text-white">
                    <tr>
                      <th className={classHeader(sortExtKey === 'nom_externo')} onClick={() => toggleSortExternal('nom_externo')}>
                        Nombre {sortExtKey === 'nom_externo' ? sortIcon(sortExtDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortExtKey === 'proveedor')} onClick={() => toggleSortExternal('proveedor')}>
                        Proveedor {sortExtKey === 'proveedor' ? sortIcon(sortExtDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortExtKey === 'fecha')} onClick={() => toggleSortExternal('fecha')}>
                        Fecha ingreso {sortExtKey === 'fecha' ? sortIcon(sortExtDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortExtKey === 'mes_actualizacion')} onClick={() => toggleSortExternal('mes_actualizacion')}>
                        Mes actualización {sortExtKey === 'mes_actualizacion' ? sortIcon(sortExtDir) : sortIcon()}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/10 bg-white/80 dark:bg-transparent">
                    {filteredSortedExternals.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-300">
                          {loadingExternals
                            ? 'Cargando productos…'
                            : externals.length === 0
                              ? 'No hay productos no relacionados.'
                              : 'Sin coincidencias.'}
                        </td>
                      </tr>
                    ) : filteredSortedExternals.map(item => {
                      const linkSel = selectedExternals.some(e => e.id_externo === item.id_externo);
                      const delSel = extDeleteIds.has(item.id_externo);
                      return (
                        <tr
                          key={item.id_externo}
                          className={rowStyle(linkSel, delSel)}
                          onClick={() => onExternalRowClick(item)}
                        >
                          <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{item.nom_externo ?? ''}</td>
                          <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{item.proveedor ?? 'Sin proveedor'}</td>
                          <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{formatYMD(item.fecha)}</td>
                          <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{formatMonthLabel(item.mes_actualizacion)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {loadingMoreExternals && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando más productos...
                </div>
              )}
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                {loadingExternals ? 'Cargando productos…' : `${filteredSortedExternals.length} resultados`}
              </div>
            </div>

            {/* INTERNOS */}
            <div>
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Productos Gampack</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {loadingInternals
                      ? 'Cargando productos…'
                      : typeof internalTotal === 'number'
                        ? `${internalLoadedCount.toLocaleString('es-AR')} de ${internalTotal.toLocaleString('es-AR')} productos`
                        : `${internalLoadedCount.toLocaleString('es-AR')} productos cargados`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={deleteModeInt ? 'primary' : 'secondary'} onClick={() => { setDeleteModeInt(v => !v); if (deleteModeInt) setIntDeleteIds(new Set()); }}>
                    {deleteModeInt ? 'Salir de modo eliminar' : 'Modo eliminar'}
                  </Button>
                  <Button onClick={deleteSelectedInternals} variant="secondary" disabled={intDeleteIds.size === 0}>
                    <span className="inline-flex items-center gap-2"><Trash2 size={16} /> Eliminar seleccionados ({intDeleteIds.size})</span>
                  </Button>
                </div>
              </div>

              {deleteModeInt && (
                <div className="mb-2 text-xs rounded-md px-2 py-1 border border-red-300/40 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/20">
                  Modo eliminar activo: hacé click en las filas para marcarlas en rojo y luego “Eliminar seleccionados”.
                </div>
              )}

              <div className="mb-3">
                <SearchInput value={searchInt} onChange={setSearchInt} placeholder="Buscar por código o nombre…" />
              </div>

              {internalsError && (
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  <span>{internalsError}</span>
                  <Button onClick={reloadInternals} variant="secondary">
                    Reintentar
                  </Button>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10 shadow-sm bg-white dark:bg-[#0f1930]">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10 text-sm">
                  <thead className="bg-gray-50 dark:bg-white/10 dark:text-white">
                    <tr>
                      <th className={classHeader(sortIntKey === 'nom_interno')} onClick={() => toggleSortInternal('nom_interno')}>
                        Nombre {sortIntKey === 'nom_interno' ? sortIcon(sortIntDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortIntKey === 'fecha')} onClick={() => toggleSortInternal('fecha')}>
                        Fecha ingreso {sortIntKey === 'fecha' ? sortIcon(sortIntDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortIntKey === 'mes_actualizacion')} onClick={() => toggleSortInternal('mes_actualizacion')}>
                        Mes actualización {sortIntKey === 'mes_actualizacion' ? sortIcon(sortIntDir) : sortIcon()}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/10 bg-white/80 dark:bg-transparent">
                    {filteredSortedInternals.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-gray-500 dark:text-gray-300">
                          {loadingInternals
                            ? 'Cargando productos…'
                            : internals.length === 0
                              ? 'No hay productos Gampack.'
                              : 'Sin coincidencias.'}
                        </td>
                      </tr>
                    ) : filteredSortedInternals.map(item => {
                      const linkSel = selectedInternal?.id_interno === item.id_interno;
                      const delSel = intDeleteIds.has(item.id_interno);
                      return (
                        <tr
                          key={item.id_interno}
                          className={rowStyle(linkSel, delSel)}
                          onClick={() => onInternalRowClick(item)}
                        >
                          {/* NUEVO: columna Nombre */}
                          <td className="px-6 py-4 text-gray-900 dark:text-gray-100">
                            {item.nom_interno ?? ''}
                          </td>
                          {/* Fecha */}
                          <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                            {formatYMD(item.fecha)}
                          </td>
                          <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                            {formatMonthLabel(item.mes_actualizacion)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {loadingMoreInternals && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando más productos...
                </div>
              )}
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                {loadingInternals ? 'Cargando productos…' : `${filteredSortedInternals.length} resultados`}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Button onClick={handleManualLink} disabled={selectedExternals.length === 0 || !selectedInternal}>
              Vincular manualmente
            </Button>
          </div>
        </div>
      </div>

      {/* Botón flotante Top */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Volver arriba (atajo: T)" aria-label="Volver arriba"
          className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition"
        >
          ↑ Top
        </button>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-3 py-2 rounded-full bg-black/80 text-white text-sm shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
};

export default UnmatchedEquivalencesScreen;





