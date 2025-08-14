import React, { useEffect, useMemo, useState, useDeferredValue } from 'react';
import { Button } from '../components/Button';
import { Navigation } from '../components/Navigation';
import { Screen } from '../types';

type SortDir = 'asc' | 'desc';
type SortKeyExternal = 'cod_externo' | 'nom_externo' | 'proveedor' | 'fecha';
type SortKeyInternal = 'cod_interno' | 'nom_interno' | 'fecha';

const sortIcon = (dir?: SortDir) =>
  dir ? (
    <span className="inline-block ml-1 select-none">{dir === 'asc' ? '▲' : '▼'}</span>
  ) : (
    <span className="inline-block ml-1 opacity-30 select-none">↕</span>
  );

function classHeader(active: boolean) {
  return `px-6 py-3 text-left font-medium cursor-pointer select-none ${
    active
      ? 'text-blue-700 dark:text-blue-300'
      : 'text-gray-700 dark:text-white/80 hover:text-gray-900 dark:hover:text-white'
  }`;
}

function normalizeStr(v: any) {
  return String(v ?? '').toLowerCase();
}
function cmp(a: any, b: any) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// Input de búsqueda robusto: evita remount, no usa onKeyDown en el wrapper
const SearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => {
  return (
    <div
      className="relative rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5
                 focus-within:ring-2 focus-within:ring-blue-400/40 focus-within:border-blue-400/60 transition"
    >
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
          className="absolute inset-y-0 right-0 pr-3 text-gray-400 hover:text-gray-600 dark:text-white/60 dark:hover:text-white"
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
  const [externals, setExternals] = useState<any[]>([]);
  const [internals, setInternals] = useState<any[]>([]);
  const [selectedExternals, setSelectedExternals] = useState<any[]>([]);
  const [selectedInternal, setSelectedInternal] = useState<any | null>(null);

  // búsquedas (controladas)
  const [searchExt, setSearchExt] = useState('');
  const [searchInt, setSearchInt] = useState('');
  // difiere el valor para evitar bloquear tipeo en listas grandes
  const dSearchExt = useDeferredValue(searchExt);
  const dSearchInt = useDeferredValue(searchInt);

  // ordenamientos
  const [sortExtKey, setSortExtKey] = useState<SortKeyExternal>('fecha');
  const [sortExtDir, setSortExtDir] = useState<SortDir>('desc');
  const [sortIntKey, setSortIntKey] = useState<SortKeyInternal>('fecha');
  const [sortIntDir, setSortIntDir] = useState<SortDir>('desc');

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

  // --- Filtro + sort: EXTERNALS ---
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
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      } else {
        av = normalizeStr(av);
        bv = normalizeStr(bv);
      }

      const r = cmp(av, bv);
      return sortExtDir === 'asc' ? r : -r;
    });

    return sorted;
  }, [externals, dSearchExt, sortExtKey, sortExtDir]);

  // --- Filtro + sort: INTERNALS ---
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
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      } else {
        av = normalizeStr(av);
        bv = normalizeStr(bv);
      }

      const r = cmp(av, bv);
      return sortIntDir === 'asc' ? r : -r;
    });

    return sorted;
  }, [internals, dSearchInt, sortIntKey, sortIntDir]);

  // handlers de ordenar
  const toggleSortExternal = (key: SortKeyExternal) => {
    if (sortExtKey === key) {
      setSortExtDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortExtKey(key);
      setSortExtDir(key === 'fecha' ? 'desc' : 'asc');
    }
  };
  const toggleSortInternal = (key: SortKeyInternal) => {
    if (sortIntKey === key) {
      setSortIntDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortIntKey(key);
      setSortIntDir(key === 'fecha' ? 'desc' : 'asc');
    }
  };

  const handleLink = async () => {
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
        alert('¡Productos vinculados!');
        setExternals(prev => prev.filter(e => !selectedExternals.some(se => se.id_externo === e.id_externo)));
        setInternals(prev => prev.filter(i => i.id_interno !== selectedInternal.id_interno));
        setSelectedExternals([]);
        setSelectedInternal(null);
      } else {
        const error = await res.json();
        alert(`Error: ${error.message || 'No se pudo vincular'}`);
      }
    } catch {
      alert('Error al conectar con el servidor');
    }
  };

  const toggleExternalSelection = (item: any) => {
    setSelectedExternals(prev =>
      prev.find(e => e.id_externo === item.id_externo)
        ? prev.filter(e => e.id_externo !== item.id_externo)
        : [...prev, item]
    );
  };

  const rowStyle = (selected: boolean) =>
    selected
      ? 'bg-blue-100 dark:bg-white/15 ring-1 ring-white/10 cursor-pointer'
      : 'hover:bg-gray-50 dark:hover:bg-white/10 cursor-pointer';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f1a] p-6">
      <div className="max-w-7xl mx-auto">
        <Navigation onBack={() => onNavigate('home')} title="Relacionar productos manualmente" />

          {/* Barra fija para vincular */}
          <div className="sticky top-0 z-20 bg-gray-50 dark:bg-[#0b0f1a] py-3 mb-4 flex items-center justify-between border-b border-gray-200 dark:border-white/10">
            <div className="text-sm text-gray-700 dark:text-white/80">
              {selectedInternal
                ? `Seleccionado: ${selectedInternal.nom_interno} (${selectedInternal.cod_interno || 'Sin código'})`
                : 'Ningún producto Gampack seleccionado'}
              {selectedExternals.length > 0 && ` | ${selectedExternals.length} proveedor(es) seleccionado(s)`}
            </div>
            <Button
              onClick={handleLink}
              disabled={selectedExternals.length === 0 || !selectedInternal}
            >
              Vincular manualmente
            </Button>
          </div>

        <div className="bg-white dark:bg-white/5 rounded-lg shadow-sm border border-gray-200 dark:border-white/10 p-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* EXTERNOS */}
            <div>
              <div className="flex items-end justify-between gap-3 mb-3">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Productos Proveedores no relacionados
                </h2>
              </div>

              <div className="mb-3">
                <SearchInput
                  value={searchExt}
                  onChange={setSearchExt}
                  placeholder="Buscar por código, nombre o proveedor…"
                />
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10 shadow-sm bg-white dark:bg-white/5">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10 text-sm">
                  <thead className="bg-gray-50 dark:bg-white/10 dark:text-white">
                    <tr>
                      <th className={classHeader(sortExtKey === 'cod_externo')} onClick={() => toggleSortExternal('cod_externo')}>
                        Nombre {sortExtKey === 'cod_externo' ? sortIcon(sortExtDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortExtKey === 'nom_externo')} onClick={() => toggleSortExternal('nom_externo')}>
                        Código {sortExtKey === 'nom_externo' ? sortIcon(sortExtDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortExtKey === 'proveedor')} onClick={() => toggleSortExternal('proveedor')}>
                        Proveedor {sortExtKey === 'proveedor' ? sortIcon(sortExtDir) : sortIcon()}
                      </th>
                      <th className={classHeader(sortExtKey === 'fecha')} onClick={() => toggleSortExternal('fecha')}>
                        Fecha ingreso {sortExtKey === 'fecha' ? sortIcon(sortExtDir) : sortIcon()}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/10 bg-white/80 dark:bg-white/5">
                    {filteredSortedExternals.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-white/70">
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
                          <td className="px-6 py-4 text-gray-800 dark:text-white">{item.cod_externo ?? ''}</td>
                          <td className="px-6 py-4 text-gray-800 dark:text-white">{item.nom_externo ?? ''}</td>
                          <td className="px-6 py-4 text-gray-800 dark:text-white">{item.proveedor ?? 'Sin proveedor'}</td>
                          <td className="px-6 py-4 text-gray-800 dark:text-white">
                            {item.fecha ? new Date(item.fecha).toLocaleDateString() : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-xs text-gray-600 dark:text白/60">{filteredSortedExternals.length} resultados</div>
            </div>

            {/* INTERNOS */}
            <div>
              <div className="flex items-end justify-between gap-3 mb-3">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Productos Gampack no relacionados
                </h2>
              </div>

              <div className="mb-3">
                <SearchInput
                  value={searchInt}
                  onChange={setSearchInt}
                  placeholder="Buscar por código o nombre…"
                />
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10 shadow-sm bg-white dark:bg-white/5">
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
                  <tbody className="divide-y divide-gray-200 dark:divide-white/10 bg-white/80 dark:bg-white/5">
                    {filteredSortedInternals.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-gray-500 dark:text-white/70">
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
                          <td className="px-6 py-4 text-gray-800 dark:text-white">{item.cod_interno ?? ''}</td>
                          <td className="px-6 py-4 text-gray-800 dark:text-white">{item.nom_interno ?? ''}</td>
                          <td className="px-6 py-4 text-gray-800 dark:text-white">
                            {item.fecha ? new Date(item.fecha).toLocaleDateString() : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-xs text-gray-600 dark:text-white/60">{filteredSortedInternals.length} resultados</div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Button onClick={handleLink} disabled={selectedExternals.length === 0 || !selectedInternal}>
              Vincular manualmente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
