import React, { useEffect, useMemo, useState } from 'react';
import { Navigation } from '../../components/Navigation';
import { Screen } from '../../types';
import { apiFetch } from '../../lib/api';
import { AlertCircle, Building2, CheckCircle2, CircleDot, Loader2, LockKeyhole, Search, Trash2, X } from 'lucide-react';

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

  const activeCount = useMemo(() => providers.filter((provider) => provider.is_active).length, [providers]);
  const totalProducts = useMemo(
    () => providers.reduce((sum, provider) => sum + (Number.isFinite(provider.products) ? provider.products : 0), 0),
    [providers]
  );

  const handleOpenProvider = async (provider: ProviderSummary) => {
    setSelectedProvider(provider);
    setLoadingProducts(true);
    setProductsError(null);
    setProducts([]);
    setProductSearch('');
    try {
      const response = await apiFetch(`/api/providers/products?name=${encodeURIComponent(provider.name)}`);
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }
      const data = await response.json();
      const normalizedProducts: ProviderProduct[] = Array.isArray(data?.products)
        ? data.products.map((product: any, index: number) => ({
            id: product?.id ?? product?.id_externo ?? `${product?.code ?? ''}-${index}`,
            name: String(product?.name ?? product?.nom_externo ?? 'Producto sin nombre'),
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
      return product.name.toLowerCase().includes(query) || code.includes(query);
    });
  }, [products, productSearch]);

  const isDeletingSelectedProvider = selectedProvider
    ? deletingProvider === selectedProvider.name
    : false;

  const handleDeleteProvider = async (provider: ProviderSummary) => {
    if (deletingProvider === provider.name) return;
    const confirmed = window.confirm(
      `¿Eliminar la tabla del proveedor ${provider.name}? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setDeletingProvider(provider.name);
    setActionFeedback(null);
    try {
      const response = await apiFetch(`/api/providers/active/${encodeURIComponent(provider.name)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }
      setProviders((current) => current.filter((item) => item.name !== provider.name));
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

  const handleBulkDelete: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (bulkPassword !== 'mariano123') {
      setBulkError('Contraseña incorrecta. Intentalo nuevamente.');
      return;
    }
    const confirmed = window.confirm(
      'Esta acción eliminará todas las tablas de proveedores activos. ¿Confirmás que querés continuar?'
    );
    if (!confirmed) {
      return;
    }
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
        <Navigation onBack={() => onNavigate('home')} title="Proveedores activos" />

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

        <section className="rounded-3xl border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-white/70 max-w-xl">
                Visualizá los proveedores activos junto con la cantidad de productos y la fecha de la última actualización.
                Seleccioná un proveedor para ver el detalle completo de su lista de precios.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="rounded-2xl bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200 px-4 py-2 font-medium">
                {providers.length} proveedores
              </div>
              <div className="rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 px-4 py-2 font-medium">
                {activeCount} activos
              </div>
              <div className="rounded-2xl bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/70 px-4 py-2 font-medium">
                {totalProducts.toLocaleString('es-AR')} productos
              </div>
              <button
                type="button"
                onClick={openBulkDialog}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-200/70 bg-red-100/70 px-4 py-2 font-medium text-red-700 transition hover:bg-red-200/70 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100"
              >
                <Trash2 className="h-4 w-4" /> Eliminar todas
              </button>
            </div>
          </div>

          <div className="mt-6 relative">
            <Search size={18} className="absolute left-3 top-3 text-gray-400 dark:text-white/50" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar proveedor"
              className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-white/5 text-sm text-gray-700 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/60"
            />
          </div>
        </section>

        <section className="space-y-4">
          {providersError && (
            <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4 text-sm text-red-700 dark:text-red-200">
              {providersError}
            </div>
          )}

          {loadingProviders ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {[...Array(6)].map((_, index) => (
                <div
                  key={index}
                  className="h-40 rounded-3xl border border-gray-200/60 dark:border-white/10 bg-gray-100/70 dark:bg-white/5 animate-pulse"
                />
              ))}
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="rounded-3xl border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-white/5 p-10 text-center text-gray-600 dark:text-white/70">
              No se encontraron proveedores con ese criterio.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredProviders.map((provider) => {
                const initials = getInitials(provider.name);
                const recentLabel = provider.recent_products && provider.recent_products > 0
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
                        <span className="text-lg font-semibold tracking-wide">{initials}</span>
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
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                            {provider.name}
                          </h3>
                          <span className={statusBadgeClass(provider.is_active)}>
                            {provider.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-gray-600 dark:text-white/70">
                          {provider.products.toLocaleString('es-AR')} productos cargados
                        </p>
                        <div className="mt-4 flex flex-col gap-1 text-xs text-gray-500 dark:text-white/60">
                          <div>Última actualización: {formatDate(provider.last_update)}</div>
                          <div>{recentLabel}</div>
                        </div>
                      </div>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500/0 via-blue-500/40 to-emerald-500/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-gray-200/60 dark:border-white/10 bg-white dark:bg-[#101729] text-gray-900 dark:text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200/60 dark:border-white/10 px-6 py-4 bg-white/80 dark:bg-[#101729]/80 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedProvider.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-white/60">
                    {selectedProvider.products.toLocaleString('es-AR')} productos · Última actualización {formatDate(selectedProvider.last_update)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteProvider(selectedProvider)}
                  disabled={isDeletingSelectedProvider}
                  className="inline-flex items-center gap-2 rounded-full border border-red-200/70 bg-red-100/80 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-200/70 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                >
                  {isDeletingSelectedProvider ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>Eliminar tabla</span>
                </button>
                <button
                  onClick={handleCloseModal}
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 dark:text-white/60 dark:hover:bg-white/10"
                  aria-label="Cerrar detalle de proveedor"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-b border-gray-200/60 dark:border-white/10 bg-gray-50/80 dark:bg-white/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600 dark:text-white/70">
                  {selectedProvider.is_active
                    ? 'Este proveedor cuenta con precios actualizados recientemente.'
                    : 'No se detectaron actualizaciones recientes para este proveedor.'}
                </div>
                <div className="relative w-full sm:w-72">
                  <Search size={16} className="absolute left-3 top-2.5 text-gray-400 dark:text-white/50" />
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Buscar producto por nombre o código"
                    className="w-full pl-9 pr-3 py-2 rounded-2xl border border-gray-200/60 dark:border-white/10 bg-white dark:bg-[#0f1624] text-sm text-gray-700 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                  />
                </div>
              </div>
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {productsError && (
                <div className="m-6 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4 text-sm text-red-700 dark:text-red-200">
                  {productsError}
                </div>
              )}

              {loadingProducts ? (
                <div className="flex items-center justify-center py-16 text-gray-500 dark:text-white/60">
                  <Loader2 size={20} className="mr-3 animate-spin" /> Cargando productos…
                </div>
              ) : displayedProducts.length === 0 ? (
                <div className="py-16 text-center text-gray-500 dark:text-white/60">
                  No hay productos para mostrar con el filtro seleccionado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200/70 dark:divide-white/10 text-sm">
                    <thead className="bg-gray-100/80 dark:bg-white/5">
                      <tr className="text-left text-gray-600 dark:text-white/70">
                        <th className="px-4 py-3 font-medium">Producto</th>
                        <th className="px-4 py-3 font-medium">Código</th>
                        <th className="px-4 py-3 font-medium text-right">Precio</th>
                        <th className="px-4 py-3 font-medium text-right">Fecha</th>
                        <th className="px-4 py-3 font-medium text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200/70 dark:divide-white/10">
                      {displayedProducts.map((product) => (
                        <tr key={product.id} className="text-gray-700 dark:text-white/80">
                          <td className="px-4 py-3">
                            <div className="max-w-[32ch] truncate font-medium">{product.name}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-white/60">
                            {product.code ? product.code : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                            {currencyFormatter.format(product.price)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500 dark:text-white/60">
                            {formatDate(product.date)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={statusBadgeClass(product.isActive)}>
                              {product.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200/60 dark:border-white/10 px-6 py-4 text-xs text-gray-500 dark:text-white/60">
              <span>
                {displayedProducts.length.toLocaleString('es-AR')} producto{displayedProducts.length === 1 ? '' : 's'} visibles
              </span>
              <button
                onClick={handleCloseModal}
                className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gray-200/60 bg-white text-gray-900 shadow-2xl dark:border-white/10 dark:bg-[#101729] dark:text-white">
            <div className="flex items-center gap-3 border-b border-gray-200/60 bg-white/80 px-6 py-4 dark:border-white/10 dark:bg-[#101729]/80">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-200">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Eliminar todas las tablas</h3>
                <p className="text-xs text-gray-500 dark:text-white/60">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <form onSubmit={handleBulkDelete} className="space-y-5 px-6 py-5">
              <p className="text-sm text-gray-600 dark:text-white/70">
                Confirmá la eliminación ingresando la contraseña administrativa. Se borrarán todas las tablas registradas para los proveedores activos.
              </p>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-white/80">
                  Contraseña de confirmación
                </label>
                <div className="relative flex items-center rounded-2xl border border-gray-200/70 bg-white/90 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#0f1624]">
                  <LockKeyhole className="mr-2 h-4 w-4 text-gray-400 dark:text-white/60" />
                  <input
                    type="password"
                    value={bulkPassword}
                    onChange={(event) => setBulkPassword(event.target.value)}
                    placeholder="Ingresá la contraseña"
                    className="w-full bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white"
                    autoComplete="off"
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-white/50">Contraseña requerida: <code className="rounded bg-gray-100 px-1 py-0.5 text-gray-700 dark:bg-white/10 dark:text-white">mariano123</code></p>
              </div>
              {bulkError && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-100">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <span>{bulkError}</span>
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeBulkDialog}
                  className="inline-flex items-center justify-center rounded-full border border-gray-200/70 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                  disabled={bulkDeleting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={bulkDeleting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500"
                >
                  {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span>{bulkDeleting ? 'Eliminando…' : 'Eliminar todo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveSuppliersScreen;
