import React, { useEffect, useMemo, useState, useDeferredValue, useCallback } from 'react';
import { Button } from '../components/Button';
import { Navigation } from '../components/Navigation';
import { Screen } from '../types';

/* ---------- Similaridad por trigramas + coseno (solo nombres) ---------- */
function sanitizeText(s: string) {
  return `  ${s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')} `;
}
function buildTrigramFreq(s: string) {
  const t: Record<string, number> = {};
  for (let i = 0; i < s.length - 2; i++) {
    const g = s.slice(i, i + 3);
    t[g] = (t[g] || 0) + 1;
  }
  return t;
}
function cosineByTri(aFreq: Record<string, number>, bFreq: Record<string, number>) {
  let dot = 0, nA = 0, nB = 0;
  for (const k in aFreq) { nA += aFreq[k] * aFreq[k]; if (bFreq[k]) dot += aFreq[k] * bFreq[k]; }
  for (const k in bFreq) { nB += bFreq[k] * bFreq[k]; }
  const denom = Math.sqrt(nA) * Math.sqrt(nB);
  return denom ? dot / denom : 0;
}
function tokenizeName(s: string) {
  return sanitizeText(s).split(/\s+/).filter(w => w.length >= 3);
}

type SortDir = 'asc' | 'desc';
type SortKeyExternal = 'cod_externo' | 'nom_externo' | 'proveedor' | 'fecha';
type SortKeyInternal = 'cod_interno' | 'nom_interno' | 'fecha';

type ExternalItem = {
  id_externo: number;
  cod_externo?: string | null;
  nom_externo?: string | null;
  proveedor?: string | null;
  fecha?: string | null;
  precio?: number | null;
};

type InternalItem = {
  id_interno: number;
  cod_interno?: string | null;
  nom_interno?: string | null;
  fecha?: string | null;
  precio?: number | null;
};

type Suggestion = {
  internal: InternalItem;
  external: ExternalItem;
  reason: string;
  score: number;
  id: string;
};

const SIMILARITY_THRESHOLD = 0.60;
const MAX_CANDIDATES_PER_INTERNAL = Infinity;
const BATCH_SIZE = 200;

const sortIcon = (dir?: SortDir) =>
  dir ? <span className="inline-block ml-1 select-none">{dir === 'asc' ? '▲' : '▼'}</span>
      : <span className="inline-block ml-1 opacity-30 select-none">↕</span>;

function classHeader(active: boolean) {
  return `px-6 py-3 text-left font-medium cursor-pointer select-none ${
    active
      ? 'text-blue-700 dark:text-blue-300'
      : 'text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white'
  }`;
}
const normalizeStr = (v: any) => String(v ?? '').toLowerCase().trim();
const cmp = (a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0);

/* ---------- Input de búsqueda ---------- */
const SearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => {
  return (
    <div className="relative rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5
                    focus-within:ring-2 focus-within:ring-blue-400/40 focus-within:border-blue-400/60 transition">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 dark:text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
      <input
        autoComplete="off"
        spellCheck={false}
        className="w-full pl-9 pr-9 py-2 rounded-xl bg-transparent text-sm text-gray-900 dark:text-white
                   placeholder-gray-400 dark:placeholder-white/60 focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onChange('');
          }
        }}
      />
      {value && (
        <button
          type="button"
          className="absolute inset-y-0 right-0 pr-3 text-gray-500 hover:text-gray-700 dark:text-white/60 dark:hover:text-white"
          onClick={() => onChange('')}
          title="Limpiar (Esc)"
          tabIndex={-1}
        >
          ✕
        </button>
      )}
    </div>
  );
};

export const UnmatchedEquivalencesScreen: React.FC<{ onNavigate: (screen: Screen) => void }> = ({ onNavigate }) => {
  const [externals, setExternals] = useState<ExternalItem[]>([]);
  const [internals, setInternals] = useState<InternalItem[]>([]);
  const [selectedExternals, setSelectedExternals] = useState<ExternalItem[]>([]);
  const [selectedInternal, setSelectedInternal] = useState<InternalItem | null>(null);

  // Sugerencias + descartes
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ignoredPairs, setIgnoredPairs] = useState<Set<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [loadingAuto, setLoadingAuto] = useState(false);

  // búsquedas
  const [searchExt, setSearchExt] = useState('');
  const [searchInt, setSearchInt] = useState('');
  const dSearchExt = useDeferredValue(searchExt);
  const dSearchInt = useDeferredValue(searchInt);

  // ordenamientos
  const [sortExtKey, setSortExtKey] = useState<SortKeyExternal>('fecha');
  const [sortExtDir, setSortExtDir] = useState<SortDir>('desc');
  const [sortIntKey, setSortIntKey] = useState<SortKeyInternal>('fecha');
  const [sortIntDir, setSortIntDir] = useState<SortDir>('desc');

  // Top button
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    fetch('http://localhost:4000/api/no-relacionados/proveedores')
      .then(res => res.json())
      .then(data => setExternals(Array.isArray(data) ? data : []))
      .catch(() => setExternals([]));

    fetch('http://localhost:4000/api/no-relacionados/gampack')
      .then(res => res.json())
      .then(data => setInternals(Array.isArray(data) ? data : []))
      .catch(() => setInternals([]));
  }, []);

  // Evitar refresco con Ctrl/Cmd+R y F5 en esta pantalla + atajo 't' para Top
// Evitar refresco con Ctrl/Cmd+R y F5 en esta pantalla + atajo 't' para Top
useEffect(() => {
  const isEditable = (el: EventTarget | null) => {
    const n = (el as HTMLElement | null);
    if (!n) return false;
    const tag = (n.tagName || '').toLowerCase();
    return (
      (tag === 'input' || tag === 'textarea' || tag === 'select') ||
      (n as HTMLElement).isContentEditable
    );
  };

  const onKey = (e: KeyboardEvent) => {
    const targetIsEditable = isEditable(e.target);

    // bloquear refresh sólo con combinaciones de navegador
    const k = e.key.toLowerCase();
    if ((k === 'r' && (e.ctrlKey || e.metaKey)) || e.key === 'F5') {
      e.preventDefault();
      return;
    }

    // atajo "t" => sólo si NO estoy escribiendo en un campo
    if (!targetIsEditable && k === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);


  // Mostrar botón Top al hacer scroll
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ---------- Índice eficiente por tokens + trigramas (externos) ---------- */
  const extIndexed = useMemo(() => {
    type ExtIdx = {
      item: ExternalItem;
      nameSan: string;
      tri: Record<string, number>;
      toks: string[];
    };
    const items: ExtIdx[] = [];
    const inv = new Map<string, number[]>();
    externals.forEach((e, idx) => {
      const nameSan = sanitizeText(e.nom_externo ?? '');
      const tri = buildTrigramFreq(nameSan);
      const toks = Array.from(new Set(tokenizeName(e.nom_externo ?? '')));
      items.push({ item: e, nameSan, tri, toks });
      toks.forEach(t => {
        const arr = inv.get(t) || [];
        arr.push(idx);
        inv.set(t, arr);
      });
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
        const iToks = Array.from(new Set(tokenizeName(iName)));
        if (iToks.length === 0) continue;

        const candidateIdx = new Map<number, number>();
        iToks.forEach(t => {
          const arr = extIndexed.inv.get(t);
          if (!arr) return;
          arr.forEach(idx => candidateIdx.set(idx, (candidateIdx.get(idx) || 0) + 1));
        });

        const ranked = [...candidateIdx.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([idx]) => extIndexed.items[idx]);

        let local: Suggestion[] = [];
        for (const eIdx of ranked) {
          const id = `${i.id_interno}|${eIdx.item.id_externo}`;
          if (ignoredPairs.has(id) || seen.has(id)) continue;
          const score = cosineByTri(iTri, eIdx.tri);
          if (score >= SIMILARITY_THRESHOLD) {
            local.push({
              internal: i,
              external: eIdx.item,
              reason: `Nombre similar (${score.toFixed(2)})`,
              score,
              id
            });
          }
        }

        local.sort((a, b) => b.score - a.score);
        local.slice(0, MAX_CANDIDATES_PER_INTERNAL).forEach(s => {
          seen.add(s.id);
          acc.push(s);
        });
      }
      await new Promise(r => setTimeout(r, 0));
    }

    acc.sort((a, b) => b.score - a.score);
    setSuggestions(acc);
    setReviewOpen(true);
    setLoadingAuto(false);
  }, [internals, extIndexed, ignoredPairs]);

  /* ---------- Aceptar / Eliminar sugerencias ---------- */
  const removeFromStateAfterLink = (i: InternalItem, e: ExternalItem) => {
    setExternals(prev => prev.filter(x => x.id_externo !== e.id_externo));
    setInternals(prev => prev.filter(x => x.id_interno !== i.id_interno));
    setSelectedExternals(prev => prev.filter(x => x.id_externo !== e.id_externo));
    setSelectedInternal(prev => (prev?.id_interno === i.id_interno ? null : prev));
    setSuggestions(prev => prev.filter(s => s.internal.id_interno !== i.id_interno && s.external.id_externo !== e.id_externo));
  };

  const acceptSuggestion = async (s: Suggestion) => {
    const body = {
      id_lista_interna: s.internal.id_interno,
      ids_lista_precios: [s.external.id_externo],
      criterio: 'manual',
    };
    try {
      const res = await fetch('http://localhost:4000/api/relacionar-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        removeFromStateAfterLink(s.internal, s.external);
      } else {
        const error = await res.json().catch(() => ({}));
        alert(`Error: ${error.message || 'No se pudo vincular'}`);
      }
    } catch {
      alert('Error al conectar con el servidor');
    }
  };

  const rejectSuggestion = (s: Suggestion) => {
    setIgnoredPairs(prev => new Set(prev).add(s.id));
    setSuggestions(prev => prev.filter(x => x.id !== s.id));
  };

  /* ---------- Filtrado/sort de tablas ---------- */
  const filteredSortedExternals = useMemo(() => {
    const q = normalizeStr(dSearchExt);
    const filtered = externals.filter((r) => {
      if (!q) return true;
      const code = normalizeStr(r.cod_externo);
      const name = normalizeStr(r.nom_externo);
      const prov = normalizeStr(r.proveedor);
      return code.includes(q) || name.includes(q) || prov.includes(q);
    });
    const sorted = [...filtered].sort((a, b) => {
      let av: any = a[sortExtKey];
      let bv: any = b[sortExtKey];
      if (sortExtKey === 'fecha') {
        av = av ? new Date(av as string).getTime() : 0;
        bv = bv ? new Date(bv as string).getTime() : 0;
      } else {
        av = normalizeStr(av);
        bv = normalizeStr(bv);
      }
      const r = cmp(av, bv);
      return sortExtDir === 'asc' ? r : -r;
    });
    return sorted;
  }, [externals, dSearchExt, sortExtKey, sortExtDir]);

  const filteredSortedInternals = useMemo(() => {
    const q = normalizeStr(dSearchInt);
    const filtered = internals.filter((r) => {
      if (!q) return true;
      const code = normalizeStr(r.cod_interno);
      const name = normalizeStr(r.nom_interno);
      return code.includes(q) || name.includes(q);
    });
    const sorted = [...filtered].sort((a, b) => {
      let av: any = a[sortIntKey];
      let bv: any = b[sortIntKey];
      if (sortIntKey === 'fecha') {
        av = av ? new Date(av as string).getTime() : 0;
        bv = bv ? new Date(bv as string).getTime() : 0;
      } else {
        av = normalizeStr(av);
        bv = normalizeStr(bv);
      }
      const r = cmp(av, bv);
      return sortIntDir === 'asc' ? r : -r;
    });
    return sorted;
  }, [internals, dSearchInt, sortIntKey, sortIntDir]);

  const toggleSortExternal = (key: SortKeyExternal) => {
    if (sortExtKey === key) setSortExtDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortExtKey(key); setSortExtDir(key === 'fecha' ? 'desc' : 'asc'); }
  };
  const toggleSortInternal = (key: SortKeyInternal) => {
    if (sortIntKey === key) setSortIntDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortIntKey(key); setSortIntDir(key === 'fecha' ? 'desc' : 'asc'); }
  };

  const toggleExternalSelection = (item: ExternalItem) => {
    setSelectedExternals(prev =>
      prev.find(e => e.id_externo === item.id_externo)
        ? prev.filter(e => e.id_externo !== item.id_externo)
        : [...prev, item]
    );
  };

  const rowStyle = (selected: boolean) =>
    selected
      ? 'bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-400/30 cursor-pointer'
      : 'hover:bg-gray-50 dark:hover:bg-white/10 cursor-pointer';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f1a] p-6">
      {/* CSS específico para mejorar opciones en modo oscuro */}
      <style>{`
        .dark select option, .dark datalist option {
          color: #0f172a;           /* slate-900 */
          background: #ffffff;
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        <Navigation onBack={() => onNavigate('home')} title="" />

        <header className="relative mt-1 mb-4">
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-[#0e1526]/60 backdrop-blur shadow-sm px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Gampack · Vinculaciones
                </div>

                <h1 className="mt-1 text-2xl md:text-3xl font-extrabold leading-tight tracking-tight">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-fuchsia-500 dark:from-blue-300 dark:via-indigo-300 dark:to-pink-300">
                    Relacionar productos
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">manualmente</span>
                </h1>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Detectá coincidencias por <b>nombre</b>, revisá el motivo y confirmá o descartá cada relación.
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-blue-200 dark:border-blue-400/30 px-2.5 py-1 text-xs text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20">
                    Gampack: <span className="ml-1 font-semibold">{internals.length}</span>
                  </span>
                  <span className="inline-flex items-center rounded-full border border-indigo-200 dark:border-indigo-400/30 px-2.5 py-1 text-xs text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-900/20">
                    Proveedores: <span className="ml-1 font-semibold">{externals.length}</span>
                  </span>
                  {suggestions.length > 0 && (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 dark:border-emerald-400/30 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
                      Sugerencias: <span className="ml-1 font-semibold">{suggestions.length}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0">
                <Button onClick={generateAutoMatches} disabled={loadingAuto}>
                  {loadingAuto ? 'Buscando coincidencias…' : 'Relacionar automáticamente'}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* PANEL DE REVISIÓN */ }
        {reviewOpen && (
          <div className="mt-4 mb-4 rounded-2xl border border-blue-300/40 dark:border-blue-300/20 bg-blue-50/70 dark:bg-blue-900/20 shadow-xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🤖</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-blue-900 dark:text-blue-200">Resultados de auto-relación por nombre</h3>
                  <div className="text-sm text-blue-900/80 dark:text-blue-100/80">
                    {loadingAuto ? 'Calculando…' : `${suggestions.length} sugerencia(s)`}
                  </div>
                </div>
                <p className="text-sm text-blue-900/80 dark:text-blue-100/80 mt-1">
                  Revisá cada coincidencia. <b>Dejar relación</b> vincula como si fuera manual; <b>Eliminar</b> descarta y deja los productos en sus tablas.
                </p>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[420px] overflow-auto pr-1">
                  {suggestions.length === 0 && !loadingAuto && (
                    <div className="col-span-full text-sm text-blue-900/80 dark:text-blue-100/80">
                      No hay coincidencias por encima del umbral ({SIMILARITY_THRESHOLD}).
                    </div>
                  )}
                  {suggestions.map((s) => (
                    <div key={s.id} className="rounded-xl bg-white dark:bg-[#0e1526] border border-blue-200/50 dark:border-white/10 p-4 shadow">
                      <div className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-2">{s.reason}</div>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <div className="font-semibold text-gray-900 dark:text-white">Gampack</div>
                          <div className="text-gray-800 dark:text-gray-200">
                            {s.internal.nom_interno} <span className="text-gray-500">({s.internal.cod_interno || 'sin código'})</span>
                          </div>
                        </div>
                        <div className="text-sm">
                          <div className="font-semibold text-gray-900 dark:text-white">Proveedor</div>
                          <div className="text-gray-800 dark:text-gray-200">
                            {s.external.nom_externo} <span className="text-gray-500">({s.external.cod_externo || 'sin código'})</span>
                          </div>
                          <div className="text-gray-500 text-xs">{s.external.proveedor || 'Proveedor desconocido'}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button onClick={() => acceptSuggestion(s)}>Dejar relación</Button>
                        <Button onClick={() => rejectSuggestion(s)} variant="secondary">Eliminar</Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-end">
                  <Button onClick={() => setReviewOpen(false)} variant="secondary">Ocultar</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Barra fija para vincular manual desde tablas */}
        <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-[#0b0f1a]/95 backdrop-blur py-3 mb-4 flex items-center justify-between border-b border-gray-200 dark:border-white/10">
          <div className="text-sm text-gray-700 dark:text-gray-200">
            {selectedInternal
              ? `Seleccionado: ${selectedInternal.nom_interno} (${selectedInternal.cod_interno || 'Sin código'})`
              : 'Ningún producto Gampack seleccionado'}
            {selectedExternals.length > 0 && ` | ${selectedExternals.length} proveedor(es) seleccionado(s)`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={async () => {
                if (!selectedInternal || selectedExternals.length === 0) {
                  alert('Seleccioná un producto Gampack y al menos un proveedor');
                  return;
                }
                const body = {
                  id_lista_interna: selectedInternal.id_interno,
                  ids_lista_precios: selectedExternals.map(e => e.id_externo),
                  criterio: 'manual',
                };
                try {
                  const res = await fetch('http://localhost:4000/api/relacionar-manual', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                  });
                  if (res.ok) {
                    setExternals(prev => prev.filter(e => !selectedExternals.some(se => se.id_externo === e.id_externo)));
                    setInternals(prev => prev.filter(i => i.id_interno !== selectedInternal.id_interno));
                    setSelectedExternals([]);
                    setSelectedInternal(null);
                    setSuggestions(prev => prev.filter(s => s.internal.id_interno !== selectedInternal.id_interno && !selectedExternals.some(se => se.id_externo === s.external.id_externo)));
                  } else {
                    const error = await res.json().catch(() => ({}));
                    alert(`Error: ${error.message || 'No se pudo vincular'}`);
                  }
                } catch {
                  alert('Error al conectar con el servidor');
                }
              }}
              disabled={selectedExternals.length === 0 || !selectedInternal}
            >
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
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Productos Proveedores no relacionados
                </h2>
              </div>
              <div className="mb-3">
                <SearchInput value={searchExt} onChange={setSearchExt} placeholder="Buscar por código, nombre o proveedor…" />
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10 shadow-sm bg-white dark:bg-[#0f1930]">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10 text-sm">
                  <thead className="bg-gray-50 dark:bg-white/10 dark:text-white">
                    <tr>
                      <th className={classHeader(sortExtKey === 'nom_externo')} onClick={() => toggleSortExternal('nom_externo')}>
                        Nombre {sortExtKey === 'nom_externo' ? sortIcon(sortExtDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortExtKey === 'cod_externo')} onClick={() => toggleSortExternal('cod_externo')}>
                        Código {sortExtKey === 'cod_externo' ? sortIcon(sortExtDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortExtKey === 'proveedor')} onClick={() => toggleSortExternal('proveedor')}>
                        Proveedor {sortExtKey === 'proveedor' ? sortIcon(sortExtDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortExtKey === 'fecha')} onClick={() => toggleSortExternal('fecha')}>
                        Fecha ingreso {sortExtKey === 'fecha' ? sortIcon(sortExtDir) : sortIcon()}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/10 bg-white/80 dark:bg-transparent">
                    {filteredSortedExternals.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-300">
                          {externals.length === 0 ? 'No hay productos no relacionados.' : 'Sin coincidencias.'}
                        </td>
                      </tr>
                    ) : (
                      filteredSortedExternals.map(item => (
                        <tr
                          key={item.id_externo}
                          className={rowStyle(selectedExternals.some(e => e.id_externo === item.id_externo))}
                          onClick={() => toggleExternalSelection(item)}
                        >
                          <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{item.nom_externo ?? ''}</td>
                          <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{item.cod_externo ?? ''}</td>
                          <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{item.proveedor ?? 'Sin proveedor'}</td>
                          <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                            {item.fecha ? new Date(item.fecha).toLocaleDateString() : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">{filteredSortedExternals.length} resultados</div>
            </div>

            {/* INTERNOS */}
            <div>
              <div className="flex items-end justify-between gap-3 mb-3">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Productos Gampack no relacionados
                </h2>
              </div>
              <div className="mb-3">
                <SearchInput value={searchInt} onChange={setSearchInt} placeholder="Buscar por código o nombre…" />
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10 shadow-sm bg-white dark:bg-[#0f1930]">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10 text-sm">
                  <thead className="bg-gray-50 dark:bg-white/10 dark:text-white">
                    <tr>
                      <th className={classHeader(sortIntKey === 'cod_interno')} onClick={() => toggleSortInternal('cod_interno')}>
                        Código {sortIntKey === 'cod_interno' ? sortIcon(sortIntDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortIntKey === 'nom_interno')} onClick={() => toggleSortInternal('nom_interno')}>
                        Nombre {sortIntKey === 'nom_interno' ? sortIcon(sortIntDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortIntKey === 'fecha')} onClick={() => toggleSortInternal('fecha')}>
                        Fecha ingreso {sortIntKey === 'fecha' ? sortIcon(sortIntDir) : sortIcon()}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/10 bg-white/80 dark:bg-transparent">
                    {filteredSortedInternals.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-gray-500 dark:text-gray-300">
                          {internals.length === 0 ? 'No hay productos no relacionados.' : 'Sin coincidencias.'}
                        </td>
                      </tr>
                    ) : (
                      filteredSortedInternals.map(item => (
                        <tr
                          key={item.id_interno}
                          className={rowStyle(selectedInternal?.id_interno === item.id_interno)}
                          onClick={() => setSelectedInternal(item)}
                        >
                          <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{item.cod_interno ?? ''}</td>
                          <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{item.nom_interno ?? ''}</td>
                          <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                            {item.fecha ? new Date(item.fecha).toLocaleDateString() : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">{filteredSortedInternals.length} resultados</div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Button
              onClick={() => {
                const click = document.createElement('span');
                click.click();
              }}
              disabled={selectedExternals.length === 0 || !selectedInternal}
            >
              Vincular manualmente
            </Button>
          </div>
        </div>
      </div>

      {/* Botón flotante Top */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Volver arriba (atajo: T)"
          aria-label="Volver arriba"
          className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition"
        >
          ↑ Top
        </button>
      )}
    </div>
  );
};
