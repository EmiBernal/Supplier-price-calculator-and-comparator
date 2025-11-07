import React, { useEffect, useMemo, useState } from 'react';
import { Navigation } from '../../components/Navigation';
import { Screen } from '../../types';
import { apiFetch } from '../../lib/api';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';

type ActiveSuppliersScreenProps = {
  onNavigate: (screen: Screen) => void;
};

type ProviderSummary = {
  name: string;
  products: number;
  last_update?: string | null;
  is_active: boolean;
  recent_products?: number;
};

type ProviderProduct = {
  id: number | string;
  name: string;
  code?: string | null;
  price: number;
  date?: string | null;
  companyType?: string | null;
  family?: string | null;
  isActive: boolean;
};

type ActionFeedback = {
  type: 'success' | 'error';
  message: string;
};

type ProductDraft = {
  name?: string;
  price?: string;
  date?: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const trimmedValue = value.trim();

  const date = (() => {
    const simpleDateMatch = trimmedValue.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
    if (simpleDateMatch) {
      const [, year, month, day] = simpleDateMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
    const parsed = new Date(trimmedValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  })();

  if (!date) return '—';

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const parseErrorResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return response.status >= 500
      ? 'El servidor no pudo completar la solicitud.'
      : 'No se pudo completar la solicitud.';
  }
  try {
    const data = JSON.parse(text);
    if (typeof data === 'string') return data;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
  } catch {}
  return text;
};

const getInitials = (value: string) => {
  const clean = value.trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
};

const statusBadgeClass = (isActive: boolean) =>
  [
    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition',
    isActive
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
      : 'bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-white/60',
  ].join(' ');

const DATABASE_RESET_PHRASE = 'Quiero borrar la base de datos';

const ActiveSuppliersScreen: React.FC<ActiveSuppliersScreenProps> = ({ onNavigate }) => {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [selectedProvider, setSelectedProvider] = useState<ProviderSummary | null>(null);
  const [products, setProducts] = useState<ProviderProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductDraft>>({});
  const [savingProducts, setSavingProducts] = useState<Record<string, boolean>>({});
  const [productErrors, setProductErrors] = useState<Record<string, string | null>>({});
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkPassword, setBulkPassword] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      setProvidersError(null);
      try {
        const response = await apiFetch('/api/providers/active');
        if (!response.ok) {
          throw new Error(await parseErrorResponse(response));
        }
        const data = await response.json();
        const normalized: ProviderSummary[] = Array.isArray(data)
          ? data.map((item: any) => ({
              name: String(item?.name ?? item?.proveedor ?? ''),
              products: Number(item?.products ?? item?.count ?? 0),
              last_update: item?.last_update ?? item?.ultima_fecha ?? null,
              is_active: Boolean(item?.is_active ?? item?.activo ?? false),
              recent_products: Number(item?.recent_products ?? item?.recientes ?? 0),
            }))
          : [];
        setProviders(normalized);
      } catch (error) {
        console.error('Error fetching active providers:', error);
        setProvidersError(
          error instanceof Error && error.message
            ? error.message
            : 'No se pudieron cargar los proveedores activos. Intentalo nuevamente.'
        );
      } finally {
        // no-op
      }
    };

    fetchProviders();
  }, []);

  useEffect(() => {
    if (!actionFeedback) return;
    const timeout = window.setTimeout(() => {
      setActionFeedback(null);
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [actionFeedback]);

  const filteredProviders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return providers;
    return providers.filter((provider) => provider.name.toLowerCase().includes(query));
  }, [providers, search]);

  const activeCount = useMemo(
    () => providers.filter((provider) => provider.is_active).length,
    [providers]
  );

  const totalProducts = useMemo(
    () =>
      providers.reduce(
        (sum, provider) =>
          sum + (Number.isFinite(provider.products) ? provider.products : 0),
        0
      ),
    [providers]
  );

  const handleOpenProvider = async (provider: ProviderSummary) => {
    setSelectedProvider(provider);
    setLoadingProducts(true);
    setProductsError(null);
    setProducts([]);
    setProductSearch('');
    setProductDrafts({});
    setSavingProducts({});
    setProductErrors({});
    try {
      const response = await apiFetch(
        `/api/providers/products?name=${encodeURIComponent(provider.name)}`
      );
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }
      const data = await response.json();
      const normalizedProducts: ProviderProduct[] = Array.isArray(data?.products)
        ? data.products.map((product: any, index: number) => ({
            id:
              product?.id ??
              product?.id_externo ??
              `${product?.code ?? ''}-${index}`,
            name: String(
              product?.name ?? product?.nom_externo ?? 'Producto sin nombre'
            ),
            code: product?.code ?? product?.cod_externo ?? null,
            price: Number(product?.price ?? product?.precio_final ?? 0),
            date: product?.date ?? product?.fecha ?? null,
            companyType:
              product?.companyType ?? product?.tipo_empresa ?? null,
            family: product?.family ?? product?.familia ?? null,
            isActive: Boolean(product?.isActive ?? product?.is_active ?? false),
          }))
        : [];
      setProducts(normalizedProducts);
    } catch (error) {
      console.error('Error fetching provider products:', error);
      setProductsError(
        error instanceof Error && error.message
          ? error.message
          : 'No se pudieron cargar los productos de este proveedor.'
      );
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedProvider(null);
    setProducts([]);
    setProductsError(null);
    setProductDrafts({});
    setSavingProducts({});
    setProductErrors({});
  };

  const displayedProducts = products;

  const getOriginalComparableValue = (
    product: ProviderProduct,
    field: keyof ProductDraft
  ) => {
    switch (field) {
      case 'price':
        return Number.isFinite(product.price)
          ? Number(product.price.toFixed(4))
          : null;
      case 'date':
        return product.date ? product.date.slice(0, 10) : '';
      case 'name':
      default:
        return product.name.trim();
    }
  };

  const normalizeComparableValue = (
    field: keyof ProductDraft,
    value: string
  ) => {
    if (field === 'price') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number.parseFloat(trimmed.replace(',', '.'));
      return Number.isFinite(parsed) ? Number(parsed.toFixed(4)) : trimmed;
    }
    if (field === 'date') {
      return value || '';
    }
    return value.trim();
  };

  const updateDraftValue = (
    product: ProviderProduct,
    field: keyof ProductDraft,
    rawValue: string
  ) => {
    const key = String(product.id);
    setProductDrafts((current) => {
      const currentDraft = current[key] ?? {};
      const originalComparable = getOriginalComparableValue(product, field);
      const newComparable = normalizeComparableValue(field, rawValue);

      let shouldRemove = false;
      if (field === 'price') {
        if (
          typeof newComparable === 'number' &&
          typeof originalComparable === 'number'
        ) {
          shouldRemove = Math.abs(newComparable - originalComparable) < 0.0001;
        } else if (newComparable == null && originalComparable == null) {
          shouldRemove = true;
        }
      } else {
        shouldRemove = String(newComparable ?? '') === String(originalComparable ?? '');
      }

      if (shouldRemove) {
        if (!Object.prototype.hasOwnProperty.call(currentDraft, field)) {
          return current;
        }
        const { [field]: _removed, ...rest } = currentDraft;
        if (Object.keys(rest).length === 0) {
          const { [key]: _omit, ...restDrafts } = current;
          return restDrafts;
        }
        return { ...current, [key]: rest };
      }

      return { ...current, [key]: { ...currentDraft, [field]: rawValue } };
    });

    setProductErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleResetProduct = (product: ProviderProduct) => {
    const key = String(product.id);
    setProductDrafts((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setProductErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSaveProduct = async (product: ProviderProduct) => {
    const key = String(product.id);
    const draft = productDrafts[key];
    if (!draft || Object.keys(draft).length === 0) return;

    const payload: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(draft, 'name')) {
      payload.name = draft.name?.trim() ?? '';
    }
    if (Object.prototype.hasOwnProperty.call(draft, 'price')) {
      payload.price = draft.price;
    }
    if (Object.prototype.hasOwnProperty.call(draft, 'date')) {
      payload.date = draft.date;
    }
    setSavingProducts((current) => ({ ...current, [key]: true }));
    setProductErrors((current) => ({ ...current, [key]: null }));

    try {
      const response = await apiFetch(`/api/providers/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await parseErrorResponse(response);
        setProductErrors((current) => ({ ...current, [key]: message }));
        return;
      }

      const updated = await response.json();
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                name: String(updated?.name ?? item.name),
                price: Number(updated?.price ?? item.price ?? 0),
                date: updated?.date ?? item.date ?? null,
                companyType:
                  updated?.companyType ?? item.companyType ?? null,
                family: updated?.family ?? item.family ?? null,
              }
            : item
        )
      );

      setProductDrafts((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });

      setProductErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });

      setActionFeedback({
        type: 'success',
        message: `Se actualizó el producto "${product.name}".`,
      });
    } catch (error) {
      console.error('Error updating provider product:', error);
      setProductErrors((current) => ({
        ...current,
        [key]: 'No se pudo actualizar el producto. Intentalo nuevamente.',
      }));
    } finally {
      setSavingProducts((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };

  const baseInputClasses =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/10 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/30';

  const handleDeleteProvider = async (provider: ProviderSummary) => {
    if (deletingProvider === provider.name) return;
    const confirmed = window.confirm(
      `¿Eliminar la tabla del proveedor ${provider.name}? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setDeletingProvider(provider.name);
    setActionFeedback(null);
    try {
      const response = await apiFetch(
        `/api/providers/active/${encodeURIComponent(provider.name)}`,
        {
          method: 'DELETE',
        }
      );
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }
      setProviders((current) =>
        current.filter((item) => item.name !== provider.name)
      );
      if (selectedProvider?.name === provider.name) {
        handleCloseModal();
      }
      setActionFeedback({
        type: 'success',
        message: `Se eliminó la tabla del proveedor ${provider.name}.`,
      });
    } catch (error) {
      console.error('Error deleting provider table:', error);
      setActionFeedback({
        type: 'error',
        message:
          error instanceof Error && error.message
            ? error.message
            : 'No se pudo eliminar la tabla de este proveedor.',
      });
    } finally {
      setDeletingProvider(null);
    }
  };

  const openBulkDialog = () => {
    setBulkError(null);
    setBulkPassword('');
    setBulkDialogOpen(true);
  };

  const closeBulkDialog = () => {
    if (bulkDeleting) return;
    setBulkDialogOpen(false);
    setBulkPassword('');
    setBulkError(null);
  };

  const handleBulkDelete: React.FormEventHandler<HTMLFormElement> = async (
    event
  ) => {
    event.preventDefault();
    if (bulkPassword !== 'mariano123') {
      setBulkError('Contraseña incorrecta. Intentalo nuevamente.');
      return;
    }
    const confirmed = window.confirm(
      'Esta acción eliminará todas las tablas de proveedores activos. ¿Confirmás que querés continuar?'
    );
    if (!confirmed) return;

    setBulkDeleting(true);
    setBulkError(null);
    setActionFeedback(null);
    try {
      const response = await apiFetch('/api/providers/active/delete-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: bulkPassword }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }
      setProviders([]);
      handleCloseModal();
      setActionFeedback({
        type: 'success',
        message: 'Se eliminaron todas las tablas de proveedores activos.',
      });
      setBulkDialogOpen(false);
      setBulkPassword('');
    } catch (error) {
      console.error('Error deleting all provider tables:', error);
      setBulkError(
        error instanceof Error && error.message
          ? error.message
          : 'No se pudieron eliminar las tablas. Intentalo nuevamente.'
      );
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleCancelReset = () => {
    setShowResetForm(false);
    setResetPassword('');
    setResetPhrase('');
    setResetError(null);
  };

  const handleDatabaseReset: React.FormEventHandler<HTMLFormElement> = async (
    event
  ) => {
    event.preventDefault();
    if (resetPassword !== 'mariano1275' || resetPhrase !== DATABASE_RESET_PHRASE) {
      setResetError('Contraseña o frase incorrecta');
      return;
    }

    setResetLoading(true);
    setResetError(null);
    setActionFeedback(null);

    try {
      const response = await apiFetch('/api/products/reset', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: resetPassword,
          confirmation: resetPhrase,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }

      setProviders([]);
      setSelectedProvider(null);
      setProducts([]);
      setSearch('');
      setProductSearch('');
      setProductDrafts({});
      setSavingProducts({});
      setProductErrors({});
      setShowResetForm(false);
      setResetPassword('');
      setResetPhrase('');
      setActionFeedback({
        type: 'success',
        message: 'Base de datos eliminada correctamente.',
      });
    } catch (error) {
      console.error('Error resetting database:', error);
      setResetError(
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo eliminar la base de datos. Intentalo nuevamente.'
      );
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f1a] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <Navigation
          onBack={() => onNavigate('home')}
          title="Proveedores activos"
        />

        {actionFeedback && (
          <div
            className={`flex items-start gap-3 rounded-3xl border p-4 text-sm shadow-sm transition ${
              actionFeedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-100'
            }`}
          >
            <div className="mt-0.5">
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1">{actionFeedback.message}</div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="rounded-full px-2 py-1 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* CONTENEDOR PRINCIPAL */}
        <section className="space-y-4">
          <div className="rounded-3xl border border-red-300 bg-red-50/90 p-6 shadow-sm dark:border-red-500/40 dark:bg-red-500/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-500/20 dark:text-red-200">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-red-800 dark:text-red-100">
                    Acción peligrosa
                  </h2>
                  <p className="text-sm text-red-700 dark:text-red-200/90">
                    Eliminará todos los productos cargados, pero mantendrá las tablas para volver a empezar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResetForm(true);
                  setResetError(null);
                }}
                disabled={resetLoading || showResetForm}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500 bg-red-600 px-5 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/60 dark:bg-red-500"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" /> Eliminar base de datos
                  </>
                )}
              </button>
            </div>

            {showResetForm && (
              <form onSubmit={handleDatabaseReset} className="mt-5 space-y-4">
                <div className="space-y-1">
                  <label htmlFor="reset-password" className="text-sm font-medium text-red-800 dark:text-red-100">
                    Contraseña
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    value={resetPassword}
                    onChange={(event) => {
                      setResetPassword(event.target.value);
                      if (resetError) setResetError(null);
                    }}
                    disabled={resetLoading}
                    className="w-full rounded-2xl border border-red-200/80 bg-white px-4 py-3 text-sm shadow-inner transition focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed dark:border-red-500/30 dark:bg-[#0b0f1a] dark:text-red-100"
                    placeholder="Ingresa la contraseña"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="reset-phrase" className="text-sm font-medium text-red-800 dark:text-red-100">
                    Frase de confirmación
                  </label>
                  <input
                    id="reset-phrase"
                    type="text"
                    value={resetPhrase}
                    onChange={(event) => {
                      setResetPhrase(event.target.value);
                      if (resetError) setResetError(null);
                    }}
                    disabled={resetLoading}
                    className="w-full rounded-2xl border border-red-200/80 bg-white px-4 py-3 text-sm shadow-inner transition focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed dark:border-red-500/30 dark:bg-[#0b0f1a] dark:text-red-100"
                    placeholder={DATABASE_RESET_PHRASE}
                    autoComplete="off"
                  />
                </div>

                {resetError && (
                  <div className="rounded-2xl border border-red-300 bg-red-100/80 px-4 py-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-100">
                    {resetError}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500 bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/60 dark:bg-red-500"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Eliminando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" /> Confirmar eliminación
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelReset}
                    disabled={resetLoading}
                    className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-white px-5 py-3 text-sm font-medium text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:bg-transparent dark:text-red-100 dark:hover:bg-red-500/10"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>

          {providersError && (
            <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4 text-sm text-red-700 dark:text-red-200">
              {providersError}
            </div>
          )}

          {/* Tarjetas de proveedores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProviders.map((provider) => {
              const initials = getInitials(provider.name);
              const recentLabel =
                provider.recent_products && provider.recent_products > 0
                  ? `${provider.recent_products} precios recientes`
                  : 'Sin actualizaciones recientes';

              return (
                <button
                  key={provider.name}
                  type="button"
                  onClick={() => handleOpenProvider(provider)}
                  disabled={deletingProvider === provider.name}
                  className="group relative overflow-hidden text-left rounded-3xl border border-gray-200/60 dark:border-white/10 bg-white/90 dark:bg-white/5 p-6 shadow-sm transition hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-400/40 disabled:opacity-60 disabled:cursor-wait"
                >
                  {/* Botón eliminar */}
                  <div className="absolute right-4 top-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDeleteProvider(provider);
                      }}
                      disabled={deletingProvider === provider.name}
                      className="rounded-full border border-red-200/70 bg-red-100/80 p-2 text-red-600 transition hover:bg-red-200/80 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                      aria-label={`Eliminar tabla del proveedor ${provider.name}`}
                      title={`Eliminar tabla del proveedor ${provider.name}`}
                    >
                      {deletingProvider === provider.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/10 via-blue-500/20 to-emerald-500/10 text-blue-700 dark:text-blue-200 dark:from-blue-500/20 dark:via-blue-400/20 dark:to-emerald-400/20">
                      <span className="text-lg font-semibold tracking-wide">
                        {initials}
                      </span>
                      <CircleDot
                        size={16}
                        className={`absolute -right-1 -bottom-1 ${
                          provider.is_active
                            ? 'text-emerald-500 dark:text-emerald-400'
                            : 'text-gray-400 dark:text-white/40'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {provider.name}
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-white/70">
                        {provider.products.toLocaleString('es-AR')} productos
                        cargados
                      </p>
                      <div className="mt-4 flex flex-col gap-1 text-xs text-gray-500 dark:text-white/60">
                        <div>
                          Última actualización:{' '}
                          {formatDate(provider.last_update)}
                        </div>
                        <div>{recentLabel}</div>
                      </div>
                    </div>
                  </div>

                  {/* Badge de estado abajo a la derecha */}
                  <div className="absolute bottom-4 right-4">
                    <span className={statusBadgeClass(provider.is_active)}>
                      {provider.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {selectedProvider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">
            <div
              className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10172a]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="provider-products-title"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 bg-gray-50 px-6 py-5 dark:border-white/10 dark:bg-white/5">
                <div className="space-y-1">
                  <h2
                    id="provider-products-title"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    {selectedProvider.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-white/70">
                    <span>
                      {selectedProvider.products.toLocaleString('es-AR')} productos cargados
                    </span>
                    <span className="hidden text-gray-400 dark:text-white/40 md:inline">•</span>
                    <span>Última actualización {formatDate(selectedProvider.last_update)}</span>
                    {typeof selectedProvider.recent_products === 'number' && (
                      <span className="hidden text-gray-400 dark:text-white/40 md:inline">•</span>
                    )}
                    {typeof selectedProvider.recent_products === 'number' && (
                      <span>
                        {selectedProvider.recent_products > 0
                          ? `${selectedProvider.recent_products} precios recientes`
                          : 'Sin actualizaciones recientes'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={statusBadgeClass(selectedProvider.is_active)}>
                    {selectedProvider.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 transition hover:border-gray-300 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-white/10 dark:bg-white/10 dark:text-white/70 dark:hover:text-white"
                    aria-label="Cerrar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex max-h-[calc(90vh-140px)] flex-col gap-4 overflow-y-auto px-6 py-5">
                <div className="flex w-full items-center justify-end">
                  <div className="text-sm text-gray-600 dark:text-white/70 text-right">
                    {displayedProducts.length.toLocaleString('es-AR')} de {products.length.toLocaleString('es-AR')} productos
                  </div>
                </div>

                {productsError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    {productsError}
                  </div>
                )}

                {loadingProducts ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando productos del proveedor...
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {displayedProducts.map((product) => {
                        const key = String(product.id);
                        const draft = productDrafts[key] ?? {};
                        const hasDraft = draft && Object.keys(draft).length > 0;
                        const isSaving = Boolean(savingProducts[key]);
                        const errorMessage = productErrors[key] ?? null;
                        const nameValue = draft.name ?? product.name;
                        const priceValue = draft.price ?? (Number.isFinite(product.price) ? product.price.toString() : '');
                        const dateValue = draft.date ?? (product.date ? product.date.slice(0, 10) : '');
                        const containerClasses = [
                          'rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition dark:border-white/10 dark:bg-white/5',
                          hasDraft ? 'ring-2 ring-blue-200 dark:ring-blue-500/40' : '',
                          isSaving ? 'opacity-90' : '',
                        ]
                          .filter(Boolean)
                          .join(' ');

                        return (
                          <div key={key} className={containerClasses}>
                            <div className="grid gap-4 lg:grid-cols-4">
                              <div className="lg:col-span-2">
                                <label className="text-xs font-medium text-gray-500 dark:text-white/60">
                                  Nombre del producto
                                </label>
                                <input
                                  type="text"
                                  value={nameValue}
                                  onChange={(event) =>
                                    updateDraftValue(product, 'name', event.target.value)
                                  }
                                  className={baseInputClasses}
                                  disabled={isSaving}
                                />
                                <div className="mt-2 text-xs text-gray-500 dark:text-white/60">
                                  Código externo: <span className="font-medium text-gray-700 dark:text-white">{product.code ?? '—'}</span>
                                </div>
                              </div>

                              <div className="lg:col-span-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-white/60">
                                  Precio final (ARS)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={priceValue}
                                  onChange={(event) =>
                                    updateDraftValue(product, 'price', event.target.value)
                                  }
                                  className={[baseInputClasses, 'text-right'].join(' ')}
                                  disabled={isSaving}
                                />
                              </div>

                              <div className="lg:col-span-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-white/60">
                                  Fecha
                                </label>
                                <input
                                  type="date"
                                  value={dateValue}
                                  onChange={(event) =>
                                    updateDraftValue(product, 'date', event.target.value)
                                  }
                                  className={baseInputClasses}
                                  disabled={isSaving}
                                />
                              </div>

                              <div className="lg:col-span-4 flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-white/10">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-white/70">
                                    <span className={statusBadgeClass(product.isActive)}>
                                      {product.isActive ? 'Precio reciente' : 'Sin actualización reciente'}
                                    </span>
                                    <span>
                                      Actualizado el {product.date ? formatDate(product.date) : '—'}
                                    </span>
                                  </div>
                                  {(product.companyType || product.family) && (
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-white/60">
                                      {product.companyType && (
                                        <span>
                                          Tipo de empresa:{' '}
                                          <span className="font-medium text-gray-700 dark:text-white">
                                            {product.companyType}
                                          </span>
                                        </span>
                                      )}
                                      {product.family && (
                                        <span>
                                          Familia:{' '}
                                          <span className="font-medium text-gray-700 dark:text-white">
                                            {product.family}
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleResetProduct(product)}
                                      disabled={!hasDraft || isSaving}
                                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-white/10 dark:bg-transparent dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                      Restablecer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveProduct(product)}
                                      disabled={!hasDraft || isSaving}
                                      className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400/60 dark:bg-blue-500 dark:hover:bg-blue-400"
                                    >
                                      {isSaving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Save className="h-4 w-4" />
                                      )}
                                      Guardar cambios
                                    </button>
                                  </div>
                                </div>
                                {errorMessage && (
                                  <p className="text-sm text-red-600 dark:text-red-400">
                                    {errorMessage}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {displayedProducts.length === 0 && (
                      <div className="rounded-3xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-white/10 dark:text-white/60">
                        No se encontraron productos para el criterio de búsqueda actual.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveSuppliersScreen;
