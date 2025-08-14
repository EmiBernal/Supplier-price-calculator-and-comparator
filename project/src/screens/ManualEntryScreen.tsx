import React, { useState } from 'react';
import { Navigation } from '../components/Navigation';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import ImportarListaPrecios from '../components/ImportarListaPrecios';
import { Screen } from '../types';

interface ManualEntryScreenProps {
  onNavigate: (screen: Screen) => void;
}

interface FormData {
  company: string;
  productCode: string;
  productName: string;
  finalPrice: number | '';
  date: string;
}

const BASE_URL = 'http://localhost:4000';

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

export const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useState<FormData>({
    company: '',
    productCode: '',
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

  // Modal Importar
  const [showImport, setShowImport] = useState(false);

  const inferCompanyType = (name: string): 'Gampack' | 'Proveedor' =>
    name.trim().toLowerCase() === 'gampack' ? 'Gampack' : 'Proveedor';

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.company.trim()) newErrors.supplier = 'Proveedor es requerido';
    if (!formData.productName.trim()) newErrors.productName = 'El nombre del producto es requerido';
    if (formData.finalPrice === '' || formData.finalPrice <= 0) newErrors.finalPrice = 'El precio final debe ser mayor a 0';
    if (!formData.date) newErrors.date = 'La fecha es requerida';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkProductExists = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/api/check-product`, {
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
      const res = await fetch(`${BASE_URL}/api/products/search/manual?by=${searchCriteria}&q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSearchResults(data.products || []);
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

    try {
      const response = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companyType,
          finalPrice: Number(formData.finalPrice),
          updateExisting: wantsToUpdate || false,
        }),
      });

      if (!response.ok) throw new Error(await response.text());

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
      setErrors({ general: 'Fallo al subir el producto. Intenta nuevamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitWithLink = async (linkAsEquivalent: boolean) => {
    setIsSubmitting(true);
    setSuccessMessage('');
    setErrors({});

    const companyType = inferCompanyType(formData.company);

    try {
      const response = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companyType,
          finalPrice: Number(formData.finalPrice),
          linkAsEquivalent,
          updateExisting: wantsToUpdate || false,
        }),
      });

      if (!response.ok) throw new Error(await response.text());

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
      setErrors({ general: 'Fallo al subir el producto. Intenta nuevamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkConfirm = (accept: boolean) => {
    handleSubmitWithLink(accept);
  };

  const handleSuggestionClick = (prod: any) => {
    setFormData({
      company: prod.company,
      productCode: prod.productCode,
      productName: prod.productName,
      finalPrice: prod.finalPrice ?? '',
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
            </div>
          </div>
        </div>

        {/* Card principal */}
        <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 sm:p-8">
          {/* Buscador */}
          <div className="mb-6 p-6 border border-gray-300 dark:border-white/10 rounded-2xl bg-white/80 dark:bg-white/5 backdrop-blur-sm shadow-sm relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Buscar productos</h2>
              {/* Import visible en mobile dentro de la card */}
              <div className="sm:hidden">
                <ImportButton onClick={() => setShowImport(true)} />
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-end md:space-x-6 space-y-5 md:space-y-0">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-2">Buscar por</label>
                <select
                  className="w-full border border-gray-300 dark:border-white/10 rounded-xl p-3 text-gray-700 dark:bg-white/10 dark:text-white dark:placeholder-white/60 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                  value={searchCriteria}
                  onChange={(e) => {
                    const value = e.target.value as 'productCode' | 'productName' | 'company';
                    setSearchCriteria(value);
                    setSearchQuery('');
                    setSearchResults([]);
                    handleLiveSearch('');
                  }}
                >
                  <option value="productCode">Código</option>
                  <option value="productName">Nombre</option>
                  <option value="company">Proveedor</option>
                </select>
              </div>

              <div className="flex-1 relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-2">Consulta</label>
                <input
                  className="w-full border border-gray-300 dark:border-white/10 rounded-xl p-3 text-gray-700 dark:bg-white/10 dark:text-white dark:placeholder-white/60 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    handleLiveSearch(val);
                  }}
                  placeholder="Escribí tu búsqueda"
                  autoComplete="off"
                />
                {searchResults.length > 0 && (
                  <ul className="absolute z-50 mt-2 w-full bg-white dark:bg-[#0f1524] border border-gray-300 dark:border-white/10 rounded-xl shadow-xl max-h-64 overflow-y-auto backdrop-blur-sm">
                    {searchResults.map((prod, idx) => (
                      <li
                        key={idx}
                        className="px-5 py-3 text-sm text-gray-800 dark:text-white hover:bg-blue-50 dark:hover:bg-white/10 cursor-pointer"
                        onClick={() => handleSuggestionClick(prod)}
                      >
                        <strong>{prod.productName}</strong> — {prod.productCode} | <span className="italic">{prod.company}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
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

              {/* Código producto */}
              <Input
                label="Código producto"
                value={formData.productCode}
                onChange={(e) => handleInputChange('productCode', e.target.value)}
                error={errors.productCode}
                placeholder="Ingresá el código del producto"
                className="dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20"
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

              {/* Precio Final */}
              <div className="relative">
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

              {/* Fecha */}
              <Input
                label="Fecha"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                error={errors.date}
                className="dark:bg-white/10 dark:text-white dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20"
              />
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

      {/* MODAL Importar Excel: dark/light, blur, card moderna */}
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
              <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent">
                <ImportarListaPrecios onClose={() => setShowImport(false)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
