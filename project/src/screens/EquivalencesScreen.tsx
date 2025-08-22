import React, { useState, useEffect, useRef } from 'react';
import { Input } from '../components/Input';
import { Table, Column } from '../components/Table';
import { ProductEquivalence } from '../tipos/database';
import { Search, ArrowLeft, ArrowUp, Pencil, Save, X } from 'lucide-react';
import { Screen } from '../types';

interface EquivalencesScreenProps {
  onNavigate: (screen: Screen) => void;
}

// Utilidad para formatear fecha a yyyy-MM-dd para <input type="date">
const toDateInput = (value: any) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const EquivalencesScreen: React.FC<EquivalencesScreenProps> = ({ onNavigate }) => {
  const [equivalences, setEquivalences] = useState<ProductEquivalence[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<keyof ProductEquivalence | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filtro por criterio
  const [criteriaFilter, setCriteriaFilter] = useState<string>(''); // '', 'manual', 'name', 'codigo'
  // Botón “Top”
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Edición
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<ProductEquivalence | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Toast básico
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const searchInputId = 'equiv-search-input';
  const topAnchorRef = useRef<HTMLDivElement>(null);

  const fetchEquivalences = async (search: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/equivalencias?search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error('Error al obtener equivalencias');
      const data = await res.json();
      setEquivalences(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching equivalences:', error);
      setEquivalences([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEquivalences(''); }, []);
  useEffect(() => {
    const timeout = setTimeout(() => { fetchEquivalences(searchTerm.trim()); }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  // Cerrar <details> abiertos con click afuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('details')) {
        document.querySelectorAll('details[open]').forEach((d) => ((d as HTMLDetailsElement).open = false));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Atajos (sin "r") protegidos si estoy escribiendo
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

      if (e.key === 'Escape' && !editOpen) {
        onNavigate('home' as Screen);
        return;
      }

      // Atajo "/" para enfocar buscador (solo si no estoy escribiendo en otro campo)
      if (!targetIsEditable && e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        (document.getElementById(searchInputId) as HTMLInputElement | null)?.focus();
        return;
      }

      // Atajo "t" => Top (solo si no estoy escribiendo)
      if (!targetIsEditable && e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNavigate, editOpen]);

  // Mostrar/ocultar botón Top
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Ordenamiento
  const handleSort = (key: keyof ProductEquivalence) => {
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDirection(newDirection);
    const sorted = [...equivalences].sort((a, b) => {
      const aValue = (a[key] ?? '').toString().toLowerCase();
      const bValue = (b[key] ?? '').toString().toLowerCase();
      if (aValue < bValue) return newDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return newDirection === 'asc' ? 1 : -1;
      return 0;
    });
    setEquivalences(sorted);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:4000/api/relacion/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data?.success) {
        setEquivalences((prev) => prev.filter((eq) => (eq as any).id !== id));
        showToast('🗑️ Relación eliminada');
      } else {
        alert('Error eliminando relación');
      }
    } catch (error) {
      console.error('❌ Error eliminando relación:', error);
      alert('Error eliminando relación');
    }
  };

  // Abrir modal de edición y precargar formulario
  const openEdit = (row: ProductEquivalence) => {
    setEditRow(row);
    setEditForm({
      supplier: (row as any).supplier ?? '',
      externalCode: (row as any).externalCode ?? '',
      externalName: (row as any).externalName ?? '',
      externalDate: toDateInput((row as any).externalDate),
      internalCode: (row as any).internalCode ?? '',
      internalName: (row as any).internalName ?? '',
      internalDate: toDateInput((row as any).internalDate),
      matchingCriteria: (row as any).matchingCriteria ?? '',
    });
    setEditOpen(true);
  };

  const closeEdit = () => { setEditOpen(false); setEditRow(null); };

  const handleEditChange = (key: string, value: any) => {
    setEditForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleUpdate = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      const relationId = (editRow as any).id;
      const externalId =
        (editRow as any).id_lista_precios ?? (editRow as any).idListaPrecios;
      const internalId =
        (editRow as any).id_lista_interna ?? (editRow as any).idListaInterna;

      if (!externalId || !internalId) {
        alert(
          'Faltan IDs para actualizar (id_lista_precios / id_lista_interna). ' +
          'Asegurate de que /api/equivalencias los devuelva.'
        );
        setSaving(false);
        return;
      }

      // Enviar YYYY-MM-DD tal cual del <input type="date">
      const payload = {
        matchingCriteria: editForm.matchingCriteria || null,
        lista_precios: {
          id_externo: Number(externalId),
          proveedor: editForm.supplier || null,
          cod_externo: editForm.externalCode || null,
          nom_externo: editForm.externalName || null,
          fecha: editForm.externalDate || null, // YYYY-MM-DD o ''
        },
        lista_interna: {
          id_interno: Number(internalId),
          cod_interno: editForm.internalCode || null,
          nom_interno: editForm.internalName || null,
          fecha: editForm.internalDate || null, // YYYY-MM-DD o ''
        },
      };

      const res = await fetch(`http://localhost:4000/api/relacion/${relationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || 'No se pudo actualizar');
      }

      // Actualización en memoria
      setEquivalences((prev) =>
        prev.map((eq) =>
          (eq as any).id === relationId
            ? ({
                ...eq,
                supplier: payload.lista_precios.proveedor,
                externalCode: payload.lista_precios.cod_externo,
                externalName: payload.lista_precios.nom_externo,
                externalDate: payload.lista_precios.fecha,
                internalCode: payload.lista_interna.cod_interno,
                internalName: payload.lista_interna.nom_interno,
                internalDate: payload.lista_interna.fecha,
                matchingCriteria: payload.matchingCriteria,
              } as any)
            : eq
        )
      );

      showToast('✅ Relación actualizada');
      closeEdit();
    } catch (err: any) {
      console.error('❌ Error actualizando relación:', err);
      alert(err?.message || 'Error actualizando relación');
    } finally {
      setSaving(false);
    }
  };


  // Filtro por criterio + búsqueda
  const filteredEquivalences = () => {
    const q = searchTerm.trim().toLowerCase();
    return equivalences.filter((r) => {
      const byCriteria = criteriaFilter ? ((r as any).matchingCriteria || '').toLowerCase() === criteriaFilter : true;
      if (!q) return byCriteria;
      const values = [(r as any).supplier, (r as any).externalCode, (r as any).externalName, (r as any).internalCode, (r as any).internalName]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase());
      return byCriteria && values.some((v) => v.includes(q));
    });
  };

  const columns: Column<ProductEquivalence>[] = [
    { key: 'supplier', label: 'Proveedor Externo', sortable: true },
    { key: 'externalName', label: 'Nombre Externo', sortable: true },
    { key: 'externalDate', label: 'Fecha Agregado Externo', sortable: true },
    { key: 'internalName', label: 'Nombre Interno', sortable: true },
    { key: 'internalDate', label: 'Fecha Agregado Interno', sortable: true },
    {
      key: 'matchingCriteria',
      label: 'Criterio de Relación',
      sortable: true,
      render: (value?: string) => {
        if (!value) {
          return (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/80">
              Sin criterio
            </span>
          );
        }
        const colors: Record<string, string> = {
          manual: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
          name: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200',
          codigo: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200',
        };
        const color = colors[value] || 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-white';
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{value.charAt(0).toUpperCase() + value.slice(1)}</span>;
      },
    },
    {
      key: 'actions' as keyof ProductEquivalence,
      label: '',
      sortable: false,
      render: (_value: any, row: ProductEquivalence) => (
        <div className="relative">
          <details className="relative">
            <summary className="list-none text-gray-600 hover:text-black dark:text-white/70 dark:hover:text-white px-2 py-1 text-lg cursor-pointer">⋮</summary>
            <div className="absolute right-0 mt-2 min-w-[180px] bg-white dark:bg-[#0e1526] border border-gray-200 dark:border-white/10 rounded shadow-md z-10 backdrop-blur-sm">
              <button
                className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2"
                onClick={(e) => { e.preventDefault(); openEdit(row); }}
              >
                <Pencil size={16} /> Editar
              </button>
              <button
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:text-red-300 dark:hover:bg-white/10"
                onClick={(e) => { e.preventDefault(); handleDelete((row as any).id); }}
              >
                Eliminar
              </button>
            </div>
          </details>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f1a] p-6">
      <div ref={topAnchorRef} />
      <div className="max-w-7xl mx-auto">
        {/* Header con botón Volver */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => onNavigate('home' as Screen)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/15 px-3 py-2 text-sm font-medium text-gray-700 dark:text-white/80 shadow-sm transition"
            aria-label="Volver a la pantalla principal"
          >
            <ArrowLeft size={18} />
            <span>Volver</span>
          </button>
        </div>

        <div className="bg-white dark:bg-[#0e1526] rounded-lg shadow-sm border border-gray-200 dark:border-white/10 p-6">
          {/* Buscador + acciones */}
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Input
                id={searchInputId}
                placeholder="Buscá por nombre o por código…  (atajo: /)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white dark:bg-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/60 border-gray-200 dark:border-white/10 focus:border-blue-300 dark:focus:border-white/30 focus:ring-blue-200/50 dark:focus:ring-white/20"
              />
              <Search
                size={20}
                className="absolute left-3 top-2.5 text-gray-400 dark:text-white/70 cursor-pointer"
                onClick={() => fetchEquivalences(searchTerm.trim())}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="ml-1 text-xs text-gray-600 dark:text-white/60">
                {filteredEquivalences().length} registros
              </span>
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            {loading ? (
              <p className="text-sm text-gray-600 dark:text:white/70">Cargando…</p>
            ) : filteredEquivalences().length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-white/70">No hay equivalencias para mostrar</p>
            ) : (
              <Table
                columns={columns}
                data={filteredEquivalences()}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                getRowKey={(row) => (row as any).id}
              />
            )}
          </div>
        </div>
      </div>

      {/* Botón flotante: volver al top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition"
          title="Volver arriba (atajo: t)"
          aria-label="Volver arriba"
        >
          <ArrowUp size={18} /> Top
        </button>
      )}

      {/* Modal de edición */}
      {editOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeEdit} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-50 w-[min(900px,96vw)] max-h-[90vh] overflow-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e1526] shadow-xl p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold">Editar relación</h3>
              <button
                onClick={closeEdit}
                className="text-gray-500 hover:text-gray-800 dark:text-white/70 dark:hover:text-white"
              >
                <X />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-xs text-gray-600 dark:text-white/60">Proveedor</label>
                <Input
                  value={editForm.supplier || ''}
                  onChange={(e) => handleEditChange('supplier', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-white/60">Código externo</label>
                <Input
                  value={editForm.externalCode || ''}
                  onChange={(e) => handleEditChange('externalCode', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-white/60">Nombre externo</label>
                <Input
                  value={editForm.externalName || ''}
                  onChange={(e) => handleEditChange('externalName', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-white/60">Código interno</label>
                <Input
                  value={editForm.internalCode || ''}
                  onChange={(e) => handleEditChange('internalCode', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-white/60">Nombre interno</label>
                <Input
                  value={editForm.internalName || ''}
                  onChange={(e) => handleEditChange('internalName', e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeEdit}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15"
              >
                <X size={16} /> Cancelar
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow disabled:opacity-60"
              >
                <Save size={16} /> {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-3 py-2 rounded-full bg-black/80 text-white text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
};
