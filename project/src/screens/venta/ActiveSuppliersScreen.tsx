import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigation } from '../../components/Navigation';
import { Screen } from '../../types';
import { apiFetch } from '../../lib/api';
import { AlertCircle, Building2, CheckCircle2, CircleDot, Loader2, PencilLine, Search, X } from 'lucide-react';

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
  provider?: string | null;
  companyType?: string | null;
  isActive: boolean;
};

type EditFormState = {
  name: string;
  code: string;
  price: string;
  date: string;
  provider: string;
  companyType: string;
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

const toDateInputValue = (value?: string | null) => {
  if (!value) return '';
  return value.slice(0, 10);
};

const parsePriceInput = (value: string) => {
  if (!value) return null;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
  const [editingProduct, setEditingProduct] = useState<ProviderProduct | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const formInputClass =
    'w-full rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-[#0f1624] px-3 py-2 text-sm text-gray-700 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/60 disabled:opacity-50 disabled:cursor-not-allowed';

  useEffect(() => {
    if (!saveSuccess) return undefined;
    if (typeof window === 'undefined') return undefined;
    const timeout = window.setTimeout(() => setSaveSuccess(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [saveSuccess]);

  const loadProviders = useCallback(async (): Promise<ProviderSummary[] | null> => {
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
      return normalized;
    } catch (error) {
      console.error('Error fetching active providers:', error);
      setProvidersError(
        error instanceof Error && error.message
          ? error.message
          : 'No se pudieron cargar los proveedores activos. Intentalo nuevamente.'
      );
      return null;
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

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

  const fetchProviderProducts = useCallback(
    async (providerName: string): Promise<ProviderProduct[] | null> => {
      setLoadingProducts(true);
      setProductsError(null);
      try {
        const response = await apiFetch(`/api/providers/products?name=${encodeURIComponent(providerName)}`);
        if (!response.ok) {
          throw new Error(await parseErrorResponse(response));
        }
        const data = await response.json();
        const providerLabel = typeof data?.provider === 'string' ? data.provider : providerName;
        const normalizedProducts: ProviderProduct[] = Array.isArray(data?.products)
          ? data.products.map((product: any, index: number) => ({
              id: product?.id ?? product?.id_externo ?? `${product?.code ?? ''}-${index}`,
              name: String(product?.name ?? product?.nom_externo ?? 'Producto sin nombre'),
              code: product?.code ?? product?.cod_externo ?? null,
              price: Number(product?.price ?? product?.precio_final ?? 0),
              date: product?.date ?? product?.fecha ?? null,
              provider: product?.provider ?? product?.proveedor ?? providerLabel,
              companyType: product?.companyType ?? product?.tipo_empresa ?? null,
              isActive: Boolean(product?.isActive ?? product?.is_active ?? product?.activo ?? false),
            }))
          : [];
        setProducts(normalizedProducts);
        return normalizedProducts;
      } catch (error) {
        console.error('Error fetching provider products:', error);
        setProductsError(
          error instanceof Error && error.message
            ? error.message
            : 'No se pudieron cargar los productos de este proveedor.'
        );
        return null;
      } finally {
        setLoadingProducts(false);
      }
    },
    []
  );

  const handleOpenProvider = (provider: ProviderSummary) => {
    setSelectedProvider(provider);
    setProducts([]);
    setProductSearch('');
    setEditingProduct(null);
    setEditForm(null);
    setSaveError(null);
    setSaveSuccess(null);
    fetchProviderProducts(provider.name);
  };

  const handleCloseModal = () => {
    setSelectedProvider(null);
    setProducts([]);
    setProductSearch('');
    setProductsError(null);
    setEditingProduct(null);
    setEditForm(null);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const startEditingProduct = (product: ProviderProduct) => {
    const providerLabel = product.provider ?? selectedProvider?.name ?? '';
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      code: product.code ?? '',
      price: Number.isFinite(product.price) ? product.price.toFixed(2) : '',
      date: toDateInputValue(product.date),
      provider: providerLabel,
      companyType: product.companyType ?? '',
    });
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setEditForm(null);
    setSaveError(null);
  };

  const handleEditInputChange = (field: keyof EditFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { value } = event.target;
      setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    };

  const handleSaveProduct = async () => {
    if (!editingProduct || !editForm) return;

    const trimmedName = editForm.name.trim();
    if (!trimmedName) {
      setSaveError('El nombre del producto es obligatorio.');
      return;
    }

    const trimmedProvider = editForm.provider.trim();
    if (!trimmedProvider) {
      setSaveError('Indicá el proveedor del producto.');
      return;
    }

    if (!editForm.date) {
      setSaveError('Seleccioná una fecha válida.');
      return;
    }

    const parsedPrice = parsePriceInput(editForm.price);
    if (parsedPrice == null) {
      setSaveError('Ingresá un precio válido.');
      return;
    }

    setSavingProduct(true);
    setSaveError(null);

    try {
      const response = await apiFetch(`/api/providers/products/${encodeURIComponent(String(editingProduct.id))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: trimmedName,
          productCode: editForm.code.trim() || null,
          finalPrice: parsedPrice,
          date: editForm.date,
          provider: trimmedProvider,
          companyType: editForm.companyType.trim() || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }

      const data = await response.json();
      const updated = data?.product;
      if (!updated) {
        throw new Error('La respuesta del servidor no es válida.');
      }

      const normalized: ProviderProduct = {
        id: updated.id ?? editingProduct.id,
        name: String(updated.name ?? trimmedName),
        code: updated.code ?? null,
        price: Number(updated.price ?? parsedPrice),
        date: updated.date ?? editForm.date,
        provider: updated.provider ?? trimmedProvider,
        companyType: updated.companyType ?? updated.company_type ?? (editForm.companyType.trim() || null),
        isActive: Boolean(updated.isActive ?? updated.is_active ?? editingProduct.isActive),
      };

      const movedProvider =
        normalized.provider &&
        selectedProvider &&
        normalized.provider.trim().toLowerCase() !== selectedProvider.name.trim().toLowerCase();

      setProducts((prev) => {
        if (movedProvider) {
          return prev.filter((product) => product.id !== editingProduct.id);
        }
        return prev.map((product) => (product.id === editingProduct.id ? { ...product, ...normalized } : product));
      });

      if (movedProvider) {
        setEditingProduct(null);
        setEditForm(null);
      } else {
        setEditingProduct((prev) => (prev && prev.id === editingProduct.id ? { ...prev, ...normalized } : prev));
        setEditForm({
          name: normalized.name,
          code: normalized.code ?? '',
          price: Number.isFinite(normalized.price) ? normalized.price.toFixed(2) : '',
          date: toDateInputValue(normalized.date),
          provider: normalized.provider ?? '',
          companyType: normalized.companyType ?? '',
        });
      }

      setSaveSuccess(
        movedProvider
          ? `Producto actualizado y movido al proveedor "${normalized.provider}".`
          : 'Producto actualizado correctamente.'
      );

      const updatedSummaries = await loadProviders();
      if (selectedProvider) {
        const match = updatedSummaries?.find(
          (summary) => summary.name.trim().toLowerCase() === selectedProvider.name.trim().toLowerCase()
        );
        if (match) {
          setSelectedProvider(match);
        } else if (movedProvider) {
          setSelectedProvider((prev) => {
            if (!prev) return prev;
            if (prev.name.trim().toLowerCase() === selectedProvider.name.trim().toLowerCase()) {
              return { ...prev, products: Math.max(prev.products - 1, 0) };
            }
            return prev;
          });
        }
      }
    } catch (error) {
      console.error('Error actualizando producto:', error);
      setSaveError(
        error instanceof Error && error.message ? error.message : 'No se pudo actualizar el producto. Intentalo nuevamente.'
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const displayedProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => {
      const code = product.code?.toLowerCase() ?? '';
      return product.name.toLowerCase().includes(query) || code.includes(query);
    });
  }, [products, productSearch]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f1a] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <Navigation onBack={() => onNavigate('home')} title="Proveedores activos" />

        <section className="rounded-3xl border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-white/70 max-w-xl">
                Visualizá los proveedores activos junto con la cantidad de productos y la fecha de la última actualización.
                Seleccioná un proveedor para ver el detalle completo de su lista de precios.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="rounded-2xl bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200 px-4 py-2 font-medium">
                {providers.length} proveedores
              </div>
              <div className="rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 px-4 py-2 font-medium">
                {activeCount} activos
              </div>
              <div className="rounded-2xl bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/70 px-4 py-2 font-medium">
                {totalProducts.toLocaleString('es-AR')} productos
              </div>
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
                    onClick={() => handleOpenProvider(provider)}
                    className="group relative overflow-hidden text-left rounded-3xl border border-gray-200/60 dark:border-white/10 bg-white/90 dark:bg-white/5 p-6 shadow-sm transition hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-400/40"
                  >
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
              <button
                onClick={handleCloseModal}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 dark:text-white/60 dark:hover:bg-white/10"
                aria-label="Cerrar detalle de proveedor"
              >
                <X size={18} />
              </button>
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
                <div className="space-y-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200/70 dark:divide-white/10 text-sm">
                      <thead className="bg-gray-100/80 dark:bg-white/5">
                        <tr className="text-left text-gray-600 dark:text-white/70">
                          <th className="px-4 py-3 font-medium">Producto</th>
                          <th className="px-4 py-3 font-medium">Código</th>
                          <th className="px-4 py-3 font-medium text-right">Precio</th>
                          <th className="px-4 py-3 font-medium text-right">Fecha</th>
                          <th className="px-4 py-3 font-medium text-right">Estado</th>
                          <th className="px-4 py-3 font-medium text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200/70 dark:divide-white/10">
                        {displayedProducts.map((product) => {
                          const isEditing = editingProduct?.id === product.id;
                          const canEdit =
                            typeof product.id === 'number' || /^\d+$/.test(String(product.id ?? ''));
                          const editButtonClass = [
                            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-400/40',
                            isEditing
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-700'
                              : 'border-blue-200 text-blue-600 hover:bg-blue-50/80 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-500/20',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                          ].join(' ');

                          return (
                            <tr
                              key={product.id}
                              className={`text-gray-700 dark:text-white/80 ${
                                isEditing ? 'bg-blue-50/60 dark:bg-blue-500/10' : ''
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="max-w-[32ch] truncate font-medium">{product.name}</div>
                                {product.companyType && (
                                  <div className="mt-1 text-xs text-gray-500 dark:text-white/50">{product.companyType}</div>
                                )}
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
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  className={editButtonClass}
                                  onClick={() => startEditingProduct(product)}
                                  disabled={!canEdit || savingProduct}
                                  title={
                                    !canEdit
                                      ? 'Este producto no se puede editar porque no tiene un identificador válido.'
                                      : 'Editar producto'
                                  }
                                >
                                  <PencilLine size={14} />
                                  <span className="hidden sm:inline">Editar</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {editingProduct && editForm && (
                    <div className="border-t border-gray-200/60 dark:border-white/10 px-6 pt-6 pb-8">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Editar producto</h4>
                          <p className="text-xs text-gray-500 dark:text-white/60">
                            Los cambios se reflejan inmediatamente en todas las vistas de la aplicación.
                          </p>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-white/50">
                          ID: <span className="font-mono">{String(editingProduct.id)}</span>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-gray-700 dark:text-white/80">Nombre</span>
                          <input
                            value={editForm.name}
                            onChange={handleEditInputChange('name')}
                            className={formInputClass}
                            placeholder="Nombre del producto"
                            disabled={savingProduct}
                          />
                        </label>

                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-gray-700 dark:text-white/80">Código</span>
                          <input
                            value={editForm.code}
                            onChange={handleEditInputChange('code')}
                            className={formInputClass}
                            placeholder="Código interno o externo"
                            disabled={savingProduct}
                          />
                        </label>

                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-gray-700 dark:text-white/80">Precio final</span>
                          <input
                            value={editForm.price}
                            onChange={handleEditInputChange('price')}
                            className={formInputClass}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            disabled={savingProduct}
                          />
                        </label>

                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-gray-700 dark:text-white/80">Fecha</span>
                          <input
                            value={editForm.date}
                            onChange={handleEditInputChange('date')}
                            className={formInputClass}
                            type="date"
                            disabled={savingProduct}
                          />
                        </label>

                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-gray-700 dark:text-white/80">Proveedor</span>
                          <input
                            value={editForm.provider}
                            onChange={handleEditInputChange('provider')}
                            className={formInputClass}
                            placeholder="Nombre del proveedor"
                            disabled={savingProduct}
                          />
                        </label>

                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-gray-700 dark:text-white/80">Tipo de empresa (opcional)</span>
                          <input
                            value={editForm.companyType}
                            onChange={handleEditInputChange('companyType')}
                            className={formInputClass}
                            placeholder="Distribuidor, mayorista, etc."
                            disabled={savingProduct}
                          />
                        </label>
                      </div>

                      <div className="mt-4 space-y-3">
                        {saveError && (
                          <div className="flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                            <AlertCircle size={18} className="mt-0.5" />
                            <div>
                              <p className="font-semibold">No se pudo guardar el producto</p>
                              <p className="text-xs text-red-600/80 dark:text-red-100/80">{saveError}</p>
                            </div>
                          </div>
                        )}

                        {saveSuccess && (
                          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
                            <CheckCircle2 size={18} className="mt-0.5" />
                            <div>
                              <p className="font-semibold">Cambios guardados</p>
                              <p className="text-xs text-emerald-700/80 dark:text-emerald-100/80">{saveSuccess}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="inline-flex items-center justify-center rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/10"
                          disabled={savingProduct}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveProduct}
                          disabled={savingProduct}
                          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingProduct ? (
                            <>
                              <Loader2 size={16} className="mr-2 animate-spin" /> Guardando…
                            </>
                          ) : (
                            'Guardar cambios'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
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
    </div>
  );
};

export default ActiveSuppliersScreen;
