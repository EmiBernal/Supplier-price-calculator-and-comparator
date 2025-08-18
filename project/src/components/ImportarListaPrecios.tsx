import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import Fuse from 'fuse.js';

type Row = Record<string, any>;

// Label prolija para mostrar
function normalizeHeaderLabel(v: any): string {
  return String(v ?? '').trim().replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
}

// Para comparar
function normKey(v: any): string {
  return normalizeHeaderLabel(v).toLowerCase();
}

const KNOWN_HEADERS = {
  nom: ['producto','descripción','descripcion','detalle','articulo','artículo','nombre','item','nom_externo','nom','nom_interno'],
  cod: ['codigo','código','cod','ref','referencia','sku','cod_externo','id','cod_interno'],
  precio: [
    'precio final','precio','importe','total','pvp','unit price','precio_total',
    'preciofinal','preciofinalconiva','pf mayor','pf mayor. 1','pf mayor 1','pn mayor','pn mayor. 1'
  ],
};

// Detecta devolviendo SIEMPRE el HEADER CRUDO (tal cual viene en la hoja)
function detectMappingRaw(headersRaw: any[]): { nom?: string; cod?: string; precio?: string } {
  const labels = headersRaw.map(normalizeHeaderLabel);
  const labelsLower = labels.map(h => h.toLowerCase());
  const fuse = new Fuse(labels.map((h, i) => ({ i, n: h.toLowerCase() })), { keys: ['n'], threshold: 0.3 });

  const pick = (syns: string[]) => {
    for (const syn of syns) {
      const s = syn.toLowerCase();

      const iExact = labelsLower.findIndex(h => h === s);
      if (iExact !== -1) return headersRaw[iExact];

      const iContains = labelsLower.findIndex(h => h && h.includes(s));
      if (iContains !== -1) return headersRaw[iContains];

      const r = fuse.search(s)[0];
      if (r && typeof r.item?.i === 'number' && (r as any).score < 0.25) {
        return headersRaw[r.item.i];
      }
    }
    return undefined;
  };

  return {
    nom:    pick(KNOWN_HEADERS.nom),
    cod:    pick(KNOWN_HEADERS.cod),
    precio: pick(KNOWN_HEADERS.precio),
  };
}

export default function ImportarListaPrecios({ onClose }: { onClose?: () => void }) {
  const [file, setFile] = useState<File | null>(null);

  // Matriz completa de la hoja (header:1)
  const [sheetRows, setSheetRows] = useState<any[][]>([]);
  // Índice 1-based para el usuario (internamente usaremos index 0-based)
  const [headerRowNumber, setHeaderRowNumber] = useState<number>(1);

  // Headers crudos de la fila elegida + labels para mostrar
  const [headersRaw, setHeadersRaw] = useState<any[]>([]);
  const [headersLabel, setHeadersLabel] = useState<string[]>([]);

  // Filas ya en forma de objetos con claves = headers crudos elegidos
  const [rows, setRows] = useState<Row[]>([]);

  // Mapeos (valores = header crudo)
  const [mapNom, setMapNom] = useState<string>('');
  const [mapCod, setMapCod] = useState<string>('');     // opcional
  const [mapPrecio, setMapPrecio] = useState<string>('');

  const [proveedorManual, setProveedorManual] = useState<string>('');
  const isGampack = useMemo(() => proveedorManual.trim().toLowerCase() === 'gampack', [proveedorManual]);

  const labelNom = isGampack ? 'Columna para nom_interno' : 'Columna para nom_externo';
  const labelCod = isGampack ? 'Columna para cod_interno (opcional)' : 'Columna para cod_externo (opcional)';
  const labelPrecio = 'Columna para precio_final';

  // Construye objetos fila a partir de la matriz completa y una fila de headers seleccionada
  const rebuildRowsFromMatrix = (matrix: any[][], hdrIndex0: number) => {
    const hdrRawRow = (matrix[hdrIndex0] || []).map((v) => String(v ?? ''));
    const dataRows = matrix.slice(hdrIndex0 + 1);
    const objs: Row[] = dataRows.map((arr) => {
      const o: Row = {};
      for (let i = 0; i < hdrRawRow.length; i++) {
        const key = String(hdrRawRow[i] ?? '');
        o[key] = arr?.[i] ?? '';
      }
      return o;
    });
    setHeadersRaw(hdrRawRow);
    setHeadersLabel(hdrRawRow.map(normalizeHeaderLabel));
    setRows(objs);

    // Autodetección según los headers crudos de esta fila
    const auto = detectMappingRaw(hdrRawRow);
    setMapNom(String(auto.nom ?? ''));
    setMapCod(String(auto.cod ?? ''));
    setMapPrecio(String(auto.precio ?? ''));
  };

  const onFile = async (f: File) => {
    setFile(f);
    const data = await f.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    // Matriz completa (no asumimos que headers están en la fila 1)
    const matrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' }) as any[][];
    setSheetRows(matrix);

    // Por defecto, headers en fila 1 (index 0)
    setHeaderRowNumber(1);
    rebuildRowsFromMatrix(matrix, 0);
  };

  const onChangeHeaderRow = (val: number) => {
    const max = Math.max(1, sheetRows.length);
    const clamped = Math.min(Math.max(1, val), max);
    setHeaderRowNumber(clamped);
    // Recalcular en base a esa fila (1-based -> 0-based)
    rebuildRowsFromMatrix(sheetRows, clamped - 1);
  };

  const submit = async () => {
    if (!file) return alert('Seleccioná un archivo');
    if (!proveedorManual.trim()) return alert('Ingresá el proveedor');
    if (!mapNom || !mapPrecio) return alert('Asigná columnas para nombre y precio');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('provider_hint', proveedorManual.trim());
    fd.append('source_filename', file.name);
    fd.append('header_row', String(headerRowNumber)); // <— NUEVO: enviamos la fila elegida

    // Enviar SIEMPRE headers CRUDOS
    const mapping: any = { precio_final: mapPrecio };
    if (isGampack) {
      mapping.nom_interno = mapNom;
      if (mapCod) mapping.cod_interno = mapCod;
    } else {
      mapping.nom_externo = mapNom;
      if (mapCod) mapping.cod_externo = mapCod;
    }
    fd.append('mapping', JSON.stringify(mapping));

    const res = await fetch('/api/imports/lista-precios', { method: 'POST', body: fd });

    let data: any = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { data = await res.json(); } catch { data = null; }
    }

    if (!res.ok) {
      const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
      alert('Error: ' + msg);
      return;
    }

    alert(`Importación OK (items: ${data?.processed ?? 0})`);
    onClose && onClose();
  };

  return (
    <div className="g-import-precios p-4 space-y-4 border rounded-2xl bg-white dark:bg-[#0f1524] border-gray-200 dark:border-white/10">
      <style>{`
        .dark .g-import-precios select,
        .dark .g-import-precios select option {
          color: #fff;
          background: #0f1524;
        }
      `}</style>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Importar lista de precios</h3>

      {/* File input */}
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 rounded-xl px-4 py-2 cursor-pointer
          bg-gray-100 text-gray-900 hover:bg-gray-200
          dark:bg-white/10 dark:text-white dark:hover:bg-white/15 transition">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          <span>Seleccionar archivo</span>
        </label>
        {file?.name && <span className="text-sm text-gray-600 dark:text-white/70">{file.name}</span>}
      </div>

      {/* Proveedor */}
      <div>
        <label className="text-sm block mb-2 text-gray-700 dark:text-white/80">Proveedor (obligatorio):</label>
        <input
          className="w-full rounded-xl border px-3 py-2 bg-white text-gray-900 placeholder-gray-400 border-gray-300
                     focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/60
                     dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10
                     dark:focus:ring-blue-500/40 dark:focus:border-blue-500/60"
          placeholder="Ej: Gampack o Ferretería ACME"
          value={proveedorManual}
          onChange={e=>setProveedorManual(e.target.value)}
        />
      </div>

      {/* NUEVO: Fila de encabezados */}
      {sheetRows.length > 0 && (
        <div>
          <label className="text-sm block mb-2 text-gray-700 dark:text-white/80">
            Fila de encabezados (1 = primera fila de la hoja):
          </label>
          <input
            type="number"
            min={1}
            max={sheetRows.length}
            value={headerRowNumber}
            onChange={e => onChangeHeaderRow(Number(e.target.value || 1))}
            className="w-40 rounded-xl border px-3 py-2
                       bg-white text-gray-900 border-gray-300
                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/60
                       dark:bg-white/10 dark:text-white dark:border-white/10
                       dark:focus:ring-blue-500/40 dark:focus:border-blue-500/60"
          />
          <div className="text-xs mt-1 text-gray-600 dark:text-white/60">
            Sugerencia: probá 1, 2, 3... hasta que puedas ver los headers correctos.
          </div>
        </div>
      )}

      {/* Mapeo: usa headers de la fila elegida */}
      {headersRaw.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-sm text-gray-600 dark:text-white/70 mb-1">{labelNom}</div>
            <select
              className="w-full rounded-xl border px-3 py-2 bg-white text-gray-900 border-gray-300
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/60
                         dark:bg-white/10 dark:text-white dark:border-white/10
                         dark:focus:ring-blue-500/40 dark:focus:border-blue-500/60"
              value={mapNom}
              onChange={e => setMapNom(e.target.value)}
            >
              <option value="">(sin asignar)</option>
              {headersRaw.map((raw, i) => {
                const label = headersLabel[i] || '(vacío)';
                const value = String(raw ?? '');
                return <option key={`${i}-${value}`} value={value}>{label || '(vacío)'}</option>;
              })}
            </select>
          </div>

          <div>
            <div className="text-sm text-gray-600 dark:text-white/70 mb-1">{labelCod}</div>
            <select
              className="w-full rounded-xl border px-3 py-2 bg-white text-gray-900 border-gray-300
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/60
                         dark:bg-white/10 dark:text-white dark:border-white/10
                         dark:focus:ring-blue-500/40 dark:focus:border-blue-500/60"
              value={mapCod}
              onChange={e => setMapCod(e.target.value)}
            >
              <option value="">(sin asignar)</option>
              {headersRaw.map((raw, i) => {
                const label = headersLabel[i] || '(vacío)';
                const value = String(raw ?? '');
                return <option key={`${i}-${value}`} value={value}>{label || '(vacío)'}</option>;
              })}
            </select>
          </div>

          <div>
            <div className="text-sm text-gray-600 dark:text-white/70 mb-1">{labelPrecio}</div>
            <select
              className="w-full rounded-xl border px-3 py-2 bg-white text-gray-900 border-gray-300
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/60
                         dark:bg-white/10 dark:text-white dark:border-white/10
                         dark:focus:ring-blue-500/40 dark:focus:border-blue-500/60"
              value={mapPrecio}
              onChange={e => setMapPrecio(e.target.value)}
            >
              <option value="">(sin asignar)</option>
              {headersRaw.map((raw, i) => {
                const label = headersLabel[i] || '(vacío)';
                const value = String(raw ?? '');
                return <option key={`${i}-${value}`} value={value}>{label || '(vacío)'}</option>;
              })}
            </select>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition
                     dark:bg-blue-500 dark:hover:bg-blue-600"
          disabled={!rows.length || !proveedorManual.trim() || !mapNom || !mapPrecio}
          onClick={submit}
        >
          Importar
        </button>
        {onClose && (
          <button className="rounded-xl px-4 py-2 text-gray-700 hover:bg-gray-100
                             dark:text-white dark:hover:bg-white/10 transition"
                  onClick={onClose}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
