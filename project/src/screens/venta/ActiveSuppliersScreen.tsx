import React, { useEffect, useMemo, useState } from 'react';
import { Navigation } from '../../components/Navigation';
import { Screen } from '../../types';
import { apiFetch } from '../../lib/api';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CircleDot,
  Loader2,
  LockKeyhole,
  Search,
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
  isActive: boolean;
};

type ActionFeedback = {
  type: 'success' | 'error';
  message: string;
};

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
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

const ActiveSuppliersScreen: React.FC<ActiveSuppliersScreenProps> = ({ onNavigate }) => {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [selectedProvider, setSelectedProvider] = useState<ProviderSummary | null>(null);
  const [products, setProducts] = useState<ProviderProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkPassword, setBulkPassword] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      setLoadingProviders(true);
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
        setLoadingProviders(false);
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
    setProductSearch('');
    setProductsError(null);
  };

  const displayedProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => {
      const code = product.code?.toLowerCase() ?? '';
      return (
        product.name.toLowerCase().includes(query) || code.includes(query)
      );
    });
  }, [products, productSearch]);

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
      </div>
    </div>
  );
};

export default ActiveSuppliersScreen;
