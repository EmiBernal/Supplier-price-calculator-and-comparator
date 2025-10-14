import React, { useState } from 'react';
import { Navigation } from '../../components/Navigation';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import ImportarListaPrecios from '../../components/ImportarListaPrecios';
import { Screen } from '../../types';
import { apiFetch } from '../../lib/api';

interface ManualEntryScreenProps {
  onNavigate: (screen: Screen) => void;
}

interface FormData {
  company: string;
  productCode: string; // lo dejamos en el estado por compatibilidad, pero sin input
  productName: string;
  finalPrice: number | '';
  date: string;
}

const resolveFinalPriceValue = (value: FormData['finalPrice']) =>
  typeof value === 'number' ? value : Number(value);

// 🔧 NUEVO: normaliza cualquier forma de producto (manual o Excel)
function normalizeProduct(p: any) {
  const company =
    p.company ?? p.proveedor ?? p.supplier ?? p.companyName ?? p.empresa ?? '';

  const productCode =
    p.productCode ?? p.code ?? p.codigo ?? p.cod_externo ?? p.cod_interno ?? '';

  const productName =
    p.productName ??
    p.name ??
    p.descripcion ??
    p.description ??
    p.nom_externo ??
    p.nom_interno ??
    '';

  const finalPrice =
    p.finalPrice ?? p.precio_final ?? p.precio ?? p.price ?? null;

  return {
    ...p,
    company,
    productCode,
    productName,
    finalPrice,
  };
}

// Botón moderno y accesible para importar .xlsx
function ImportButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group inline-flex items-center gap-2 rounded-2xl px-4 py-2",
        "bg-gradient-to-br from-blue-600 to-indigo-600 text-white",
        "dark:from-blue-500 dark:to-indigo-500",
        "shadow-sm hover:shadow md:hover:shadow-lg",
        "ring-1 ring-black/0 dark:ring-white/0 hover:ring-black/5 dark:hover:ring-white/10",
        "backdrop-blur supports-[backdrop-filter]:backdrop-blur",
        "transition-all duration-200 active:scale-[0.98]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
        "dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-0",
        className
      ].join(' ')}
      title="Importar precios desde un archivo Excel"
    >
      <svg
        className="h-5 w-5 transition-transform duration-200 group-hover:translate-y-[1px]"
        viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 10v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V10" />
        <path d="M12 2v12" />
        <path d="m5 8 7-6 7 6" />
      </svg>
      <span className="font-medium">Importar .xlsx</span>
    </button>
  );
}

// --- NUEVO: Card para subir familias/rubros ---
const UploadFamiliesCard: React.FC<{ onDone?: () => void }> = ({ onDone }) => {
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<null | {
    ok: boolean;
    assigned: number;
    missing_products: number;
    missing_rubros: number;
    note?: string;
  }>(null);

  const onPick = (f: File | null) => {
    setError(null);
    setResult(null);
    setFile(f);
  };

  const handleUpload = async () => {
    try {
      setError(null);
      setResult(null);

      if (!file) {
        setError('Elegí un archivo XLSX primero.');
        return;
      }
      const maxSize = 25 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('El archivo supera los 25 MB.');
        return;
      }
      const valid = /\.(xlsx|xls)$/i.test(file.name);
      if (!valid) {
        setError('Debe ser un Excel (.xlsx o .xls).');
        return;
      }

      setLoading(true);
      const fd = new FormData();
      fd.append('file', file);

      const res = await apiFetch('/api/imports/familias', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Error subiendo archivo');
      }
      setResult({
        ok: !!data.ok,
        assigned: Number(data.assigned ?? 0),
        missing_products: Number(data.missing_products ?? 0),
        missing_rubros: Number(data.missing_rubros ?? 0),
        note: data.note,
      });
      if (onDone) onDone();
    } catch (e: any) {
      setError(e?.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 bg-white dark:bg-white/5">
      <h2 className="text-lg font-semibold mb-2 dark:text-white">Importar familias/rubros</h2>
      <p className="text-sm text-gray-600 dark:text-white/70 mb-3">
        Subí el Excel con columnas <strong>Código</strong>, <strong>Nombre</strong> y <strong>Rubro</strong>.
      </p>

      <div className="flex items-center gap-2">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-700 dark:text-white/80 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 dark:file:bg-white/10 dark:file:text-white hover:file:bg-gray-200 dark:hover:file:bg-white/20"
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={loading || !file}
          className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white disabled:opacity-60 dark:bg-white/15 dark:text-white"
        >
          {loading ? 'Subiendo…' : 'Subir'}
        </button>
      </div>

      {error && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {result && (
        <div className="mt-4 text-sm">
          <div className="mb-1">
            <span className="font-medium dark:text-white">Asignados:</span>{' '}
            <span className="dark:text-white/90">{result.assigned}</span>
          </div>
          <div className="mb-1">
            <span className="font-medium dark:text-white">Productos no encontrados:</span>{' '}
            <span className="dark:text-white/90">{result.missing_products}</span>
          </div>
          <div className="mb-1">
            <span className="font-medium dark:text-white">Rubros inexistentes:</span>{' '}
            <span className="dark:text-white/90">{result.missing_rubros}</span>
          </div>
          {result.note && (
            <div className="mt-1 text-gray-600 dark:text-white/70">{result.note}</div>
          )}
        </div>
      )}
    </div>
  );
};

export const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useState<FormData>({
    company: '',
    productCode: '', // sin input, queda vacío a menos que lo completes por código
    productName: '',
    finalPrice: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [existingProduct, setExistingProduct] = useState<any | null>(null);
  const [wantsToUpdate, setWantsToUpdate] = useState<boolean | null>(null);
  const [crossSuggestedProduct, setCrossSuggestedProduct] = useState<any | null>(null);
  const [searchCriteria, setSearchCriteria] = useState<'productCode' | 'productName' | 'company'>('productCode');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showImportFamilies, setShowImportFamilies] = useState(false);

  // Modal Importar
  const [showImport, setShowImport] = useState(false);

  const parseServerError = async (response: Response) => {
    try {
      const text = await response.text();
      if (!text) {
        return response.status >= 500
          ? 'El servidor no pudo guardar el producto.'
          : 'No se pudo completar la solicitud.';
      }
      try {
        const data = JSON.parse(text);
        if (typeof data === 'string') return data;
        if (data?.error) return data.error;
        if (data?.message) return data.message;
      } catch {}
      return text;
    } catch {
      return 'No se pudo interpretar la respuesta del servidor.';
    }
  };

  const formatServerErrorMessage = (message: string) => {
    if (!message) return 'Fallo al subir el producto. Intenta nuevamente.';
    if (/error interno/i.test(message)) {
      return 'El servidor no pudo guardar el producto. Verificá los datos e intentá nuevamente.';
    }
    return message;
  };

  const inferCompanyType = (name: string): 'Gampack' | 'Proveedor' =>
    name.trim().toLowerCase() === 'gampack' ? 'Gampack' : 'Proveedor';

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.company.trim()) newErrors.supplier = 'Proveedor es requerido';
    if (!formData.productName.trim()) newErrors.productName = 'El nombre del producto es requerido';
    const priceValue = resolveFinalPriceValue(formData.finalPrice);
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      newErrors.finalPrice = 'Ingresá un precio válido mayor a 0';
    }
    if (!formData.date) newErrors.date = 'La fecha es requerida';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkProductExists = async (): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/check-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode: formData.productCode,
          productName: formData.productName,
          companyType: inferCompanyType(formData.company),
          company: formData.company,
        }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.found) {
        setExistingProduct(data.product);
        return true;
      }

      setExistingProduct(null);
      return false;
    } catch (error) {
      console.error('Error verificando producto existente:', error);
      setExistingProduct(null);
      return false;
    }
  };

  const handleLiveSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await apiFetch(
        `/api/products/search/manual?by=${searchCriteria}&q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // 🔧 Normalizamos resultados (incluye los venidos de Excel)
      const normalized = (data.products || []).map(normalizeProduct);
      setSearchResults(normalized);
    } catch (error) {
      console.error('Error al buscar productos:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setSuccessMessage('');
    setErrors({});

    if (crossSuggestedProduct) {
      setIsSubmitting(false);
      return;
    }

    const companyType = inferCompanyType(formData.company);
    const finalPriceValue = resolveFinalPriceValue(formData.finalPrice);
    if (!Number.isFinite(finalPriceValue) || finalPriceValue <= 0) {
      setErrors((prev) => ({ ...prev, finalPrice: 'Ingresá un precio válido mayor a 0' }));
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await apiFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: formData.company.trim(),
          productCode: formData.productCode.trim(),
          productName: formData.productName.trim(),
          date: formData.date,
          companyType,
          finalPrice: finalPriceValue,
          updateExisting: wantsToUpdate || false,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseServerError(response));
      }

      const json = await response.json();

      if (json.sameProduct && wantsToUpdate === null) {
        setExistingProduct({
          cod_externo: companyType === 'Proveedor' ? formData.productCode : undefined,
          cod_interno: companyType === 'Gampack' ? formData.productCode : undefined,
          nom_externo: companyType === 'Proveedor' ? formData.productName : undefined,
          nom_interno: companyType === 'Gampack' ? formData.productName : undefined,
        });
        setIsSubmitting(false);
        return;
      }

      if (json.suggestedMatch) {
        setCrossSuggestedProduct(json.suggestedMatch);
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Producto cargado de forma exitosa!');
      setFormData({
        company: '',
        productCode: '',
        productName: '',
        finalPrice: '',
        date: new Date().toISOString().split('T')[0],
      });
      setExistingProduct(null);
      setWantsToUpdate(null);
      setCrossSuggestedProduct(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error uploading product:', error);
      const message =
        error instanceof Error && error.message
          ? formatServerErrorMessage(error.message)
          : 'Fallo al subir el producto. Intenta nuevamente.';
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitWithLink = async (linkAsEquivalent: boolean) => {
    setIsSubmitting(true);
    setSuccessMessage('');
    setErrors({});

    const companyType = inferCompanyType(formData.company);
    const finalPriceValue = resolveFinalPriceValue(formData.finalPrice);
    if (!Number.isFinite(finalPriceValue) || finalPriceValue <= 0) {
      setErrors((prev) => ({ ...prev, finalPrice: 'Ingresá un precio válido mayor a 0' }));
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await apiFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: formData.company.trim(),
          productCode: formData.productCode.trim(),
          productName: formData.productName.trim(),
          date: formData.date,
          companyType,
          finalPrice: finalPriceValue,
          linkAsEquivalent,
          updateExisting: wantsToUpdate || false,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseServerError(response));
      }

      const json = await response.json();

      if (json.success) {
        setSuccessMessage(linkAsEquivalent ? 'Producto relacionado exitosamente!' : 'Producto creado sin relación.');
        setFormData({
          company: '',
          productCode: '',
          productName: '',
          finalPrice: '',
          date: new Date().toISOString().split('T')[0],
        });
        setExistingProduct(null);
        setCrossSuggestedProduct(null);
        setWantsToUpdate(null);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ general: json.error || 'Error al cargar el producto.' });
      }
    } catch (error) {
      console.error('Error uploading product:', error);
      const message =
        error instanceof Error && error.message
          ? formatServerErrorMessage(error.message)
          : 'Fallo al subir el producto. Intenta nuevamente.';
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkConfirm = (accept: boolean) => {
    handleSubmitWithLink(accept);
  };

  const handleSuggestionClick = (prod: any) => {
    const np = normalizeProduct(prod);
    setFormData({
      company: np.company,
      productCode: np.productCode,
      productName: np.productName,
      finalPrice: np.finalPrice ?? '',
      date: new Date().toISOString().split('T')[0],
    });
    setSearchQuery('');
    setSearchResults([]);
    setWantsToUpdate(true);
  };

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (['productCode', 'productName', 'company'].includes(field)) {
      setExistingProduct(null);
      setWantsToUpdate(null);
      setCrossSuggestedProduct(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f1a] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header con acción primaria a la derecha */}
        <Navigation onBack={() => onNavigate('home')} title="Registro Manual de Productos" />
        <div
          className="
            mt-3 mb-4 rounded-2xl px-4 py-3
            bg-white/70 dark:bg-white/5
            border border-gray-200/80 dark:border-white/10
            shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur
          "
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm text-gray-600 dark:text-white/70 truncate">
                Cargá productos manualmente o importá desde Excel.
              </p>
            </div>
            {/* Import en la barra de acciones (desktop/tablet) */}
            <div className="hidden sm:block">
              <ImportButton onClick={() => setShowImport(true)} />
              <button
                type="button"
                onClick={() => setShowImportFamilies(true)}
                className="ml-2 inline-flex items-center gap-2 rounded-2xl px-4 py-2 bg-gray-900 text-white dark:bg-white/15 dark:text-white transition hover:opacity-90"
                title="Importar familias/rubros"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                <span className="font-medium">Importar familias</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card principal */}
        <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 sm:p-8">
          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Grid ajustado SIN huecos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Empresa */}
              <div className="flex flex-col gap-2">
                <Input
                  label="Empresa"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  error={errors.supplier}
                  placeholder="Ingrese nombre de empresa (Gampack si es propio)"
                  className="dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20"
                />
                <p className="text-sm text-gray-600 dark:text-white/70">
                  Tipo detectado: <strong className="dark:text-white">{inferCompanyType(formData.company)}</strong>
                </p>
              </div>

              {/* Fecha (sube a la primera fila para ocupar el lugar del código) */}
              <Input
                label="Fecha"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                error={errors.date}
                className="dark:bg-white/10 dark:text-white dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20"
              />

              {/* Nombre producto (2 columnas) */}
              <div className="relative md:col-span-2">
                <Input
                  label="Nombre del producto"
                  value={formData.productName}
                  onChange={(e) => handleInputChange('productName', e.target.value)}
                  error={errors.productName}
                  placeholder="Ingresá el nombre del producto"
                  className="dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20"
                />
                {existingProduct && wantsToUpdate === null && (
                  <div className="mt-2 bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 rounded-xl p-3 text-sm text-yellow-800 dark:text-yellow-200 absolute right-0 top-full max-w-md shadow-md z-10">
                    Producto ya existente: <strong>{existingProduct.nom_externo ?? existingProduct.nom_interno}</strong> con código <strong>{existingProduct.cod_externo ?? existingProduct.cod_interno}</strong>.<br />
                    ¿Deseás actualizar su precio?
                    <div className="mt-2 flex space-x-2">
                      <Button type="button" onClick={() => setWantsToUpdate(true)}>Sí</Button>
                      <Button type="button" variant="secondary" onClick={() => setWantsToUpdate(false)}>No</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Precio Final (a ancho completo para evitar huecos) */}
              <div className="relative md:col-span-2">
                <Input
                  label="Precio Final"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.finalPrice}
                  onChange={(e) => handleInputChange('finalPrice', e.target.value === '' ? '' : parseFloat(e.target.value))}
                  error={errors.finalPrice}
                  className="pl-8 dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20"
                />
                <div className="absolute left-3 top-8 text-gray-500 dark:text-white/70">$</div>
              </div>
            </div>

            {/* Errores y mensajes */}
            {errors.general && (
              <div className="p-4 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-xl">
                <p className="text-red-600 dark:text-red-300">{errors.general}</p>
              </div>
            )}

            {successMessage && (
              <div className="p-4 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-xl">
                <p className="text-green-600 dark:text-green-300">{successMessage}</p>
              </div>
            )}

            {crossSuggestedProduct && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 rounded-xl text-sm mt-4">
                ⚠️ <strong>Advertencia:</strong> el código ingresado ya existe en <strong>{crossSuggestedProduct.companyType}</strong> con el nombre:<br />
                <strong>{crossSuggestedProduct.name}</strong> (Código: {crossSuggestedProduct.code}).<br />
                ¿Deseás relacionar este producto con él?
                <div className="mt-2 flex space-x-2">
                  <Button type="button" onClick={() => handleLinkConfirm(true)}>Sí, relacionar productos</Button>
                  <Button type="button" variant="secondary" onClick={() => handleLinkConfirm(false)}>No, no hay relación</Button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center gap-3">
              {/* Acceso secundario a importar, por si el usuario scrollea mucho */}
              <ImportButton onClick={() => setShowImport(true)} className="sm:hidden" />
              <div className="ml-auto flex items-center gap-3">
                <Button type="button" variant="secondary" onClick={() => onNavigate('home')}>Volver</Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (existingProduct && wantsToUpdate === null && !crossSuggestedProduct)
                  }
                >
                  {isSubmitting ? 'Subiendo...' : 'Subir'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* MODAL Importar Excel */}
      {showImport && (
        <div
          className="
            fixed inset-0 z-50
            bg-black/50 dark:bg-black/60
            backdrop-blur-sm
            flex items-center justify-center p-4
          "
          role="dialog" aria-modal="true"
        >
          <div
            className="
              relative w-full max-w-5xl
              bg-white dark:bg-[#0f1524]
              text-gray-900 dark:text-white
              border border-gray-200 dark:border-white/10
              rounded-2xl shadow-2xl
              max-h-[90vh] overflow-y-auto
            "
          >
            {/* header del modal */}
            <div className="sticky top-0 z-10 px-5 py-4 border-b border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-[#0f1524]/90 backdrop-blur">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Importar lista de precios</h3>
                <button
                  onClick={() => setShowImport(false)}
                  className="
                    inline-flex items-center justify-center rounded-xl p-2
                    hover:bg-gray-100 dark:hover:bg:white/10
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400
                    transition
                  "
                  aria-label="Cerrar"
                  title="Cerrar"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* contenido del modal */}
            <div className="p-4">
              <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent">
                <ImportarListaPrecios onClose={() => setShowImport(false)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportFamilies && (
        <div
          className="
            fixed inset-0 z-50
            bg-black/50 dark:bg-black/60
            backdrop-blur-sm
            flex items-center justify-center p-4
          "
          role="dialog" aria-modal="true"
        >
          <div
            className="
              relative w-full max-w-3xl
              bg-white dark:bg-[#0f1524]
              text-gray-900 dark:text-white
              border border-gray-200 dark:border-white/10
              rounded-2xl shadow-2xl
              max-h-[90vh] overflow-y-auto
            "
          >
            {/* header del modal */}
            <div className="sticky top-0 z-10 px-5 py-4 border-b border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-[#0f1524]/90 backdrop-blur">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Importar familias / rubros</h3>
                <button
                  onClick={() => setShowImportFamilies(false)}
                  className="
                    inline-flex items-center justify-center rounded-xl p-2
                    hover:bg-gray-100 dark:hover:bg-white/10
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400
                    transition
                  "
                  aria-label="Cerrar"
                  title="Cerrar"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* contenido del modal */}
            <div className="p-4">
              <UploadFamiliesCard onDone={() => {/* opcional: refrescar algo */}} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ManualEntryScreen;
