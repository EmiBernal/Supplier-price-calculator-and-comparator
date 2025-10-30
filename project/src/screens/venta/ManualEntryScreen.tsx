import React, { useCallback, useState } from 'react';
import { Navigation } from '../../components/Navigation';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import ImportarListaPrecios from '../../components/ImportarListaPrecios';
import { Screen } from '../../types';
import { apiFetch } from '../../lib/api';

type ImportButtonProps = {
  onClick?: () => void;
  className?: string;
};

const ImportButton: React.FC<ImportButtonProps> = ({ onClick, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-xl border border-blue-500/70 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20 ${
      className || ''
    }`}
  >
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 12v6" />
      <path d="M9 15h6" />
    </svg>
    Importar desde Excel
  </button>
);

export const ManualEntryScreen: React.FC<{ onNavigate: (screen: Screen) => void }> = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
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
  const [showImport, setShowImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportStart = useCallback(() => setIsImporting(true), []);
  const handleImportFinish = useCallback(() => setIsImporting(false), []);
  const handleCloseImport = useCallback(() => {
    setShowImport(false);
    setIsImporting(false);
  }, []);

  const inferCompanyType = (name: string): 'Gampack' | 'Proveedor' =>
    name.trim().toLowerCase() === 'gampack' ? 'Gampack' : 'Proveedor';

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.company.trim()) newErrors.supplier = 'Proveedor es requerido';
    if (!formData.productName.trim()) newErrors.productName = 'El nombre del producto es requerido';
    if (!formData.finalPrice || Number(formData.finalPrice) <= 0) newErrors.finalPrice = 'Ingresá un precio válido mayor a 0';
    if (!formData.date) newErrors.date = 'La fecha es requerida';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setSuccessMessage('');
    setErrors({});

    try {
      const response = await apiFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: formData.company.trim(),
          productCode: formData.productCode.trim(),
          productName: formData.productName.trim(),
          date: formData.date,
          companyType: inferCompanyType(formData.company),
          finalPrice: Number(formData.finalPrice),
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const rawBody = await response.text();
      let data: any = null;
      if (rawBody && contentType.includes('application/json')) {
        try {
          data = JSON.parse(rawBody);
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        const errorMessage = data?.message || rawBody || 'Error al subir el producto.';
        throw new Error(errorMessage);
      }

      const statusValue = (data?.status || data?.result || data?.action || '').toString().toLowerCase();
      const alreadyExists = Boolean(
        data?.alreadyExists ||
          data?.already_exists ||
          data?.exists ||
          data?.duplicate ||
          statusValue === 'exists' ||
          statusValue === 'duplicate'
      );
      const priceChanged = Boolean(
        data?.priceChanged ||
          data?.price_changed ||
          data?.updatedPrice ||
          data?.updated_price ||
          data?.wasUpdated ||
          data?.updated ||
          statusValue === 'updated'
      );

      if (alreadyExists && !priceChanged) {
        setSuccessMessage('Producto ya existente');
      } else if (priceChanged) {
        setSuccessMessage('El producto fue actualizado');
      } else {
        setSuccessMessage(data?.message || 'Producto cargado de forma exitosa!');
      }

      setFormData({
        company: '',
        productCode: '',
        productName: '',
        finalPrice: '',
        date: new Date().toISOString().split('T')[0],
      });
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Error uploading product:', error);
      const message = error instanceof Error ? error.message : 'Error al subir el producto. Intenta nuevamente.';
      setErrors({ general: message || 'Error al subir el producto. Intenta nuevamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f1a] p-6">
      <div className="max-w-5xl mx-auto">
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
            <p className="text-sm text-gray-600 dark:text-white/70 truncate">
              Cargá productos manualmente o importá desde Excel.
            </p>
            <div className="hidden sm:block">
              <ImportButton onClick={() => setShowImport(true)} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Empresa"
                value={formData.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                error={errors.supplier}
                placeholder="Ingrese nombre de empresa (Gampack si es propio)"
                className="dark:bg-white/10 dark:text-white"
              />
              <Input
                label="Fecha"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                error={errors.date}
                className="dark:bg-white/10 dark:text-white"
              />
              <Input
                label="Nombre del producto"
                value={formData.productName}
                onChange={(e) => handleInputChange('productName', e.target.value)}
                error={errors.productName}
                placeholder="Ingresá el nombre del producto"
                className="dark:bg-white/10 dark:text-white md:col-span-2"
              />
              <div className="relative md:col-span-2">
                <Input
                  label="Precio Final"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.finalPrice}
                  onChange={(e) => handleInputChange('finalPrice', e.target.value)}
                  error={errors.finalPrice}
                  className="pl-8 dark:bg-white/10 dark:text-white"
                />
                <div className="absolute left-3 top-8 text-gray-500 dark:text-white/70">$</div>
              </div>
            </div>

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

            <div className="flex justify-between items-center gap-3">
              <ImportButton onClick={() => setShowImport(true)} className="sm:hidden" />
              <div className="ml-auto flex items-center gap-3">
                <Button type="button" variant="secondary" onClick={() => onNavigate('home')}>
                  Volver
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Subiendo...' : 'Subir'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showImport && (
        <div
          className="
            fixed inset-0 z-50
            bg-black/50 dark:bg-black/60
            backdrop-blur-sm
            flex items-center justify-center p-4
          "
          role="dialog"
          aria-modal="true"
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
            <div className="sticky top-0 z-10 px-5 py-4 border-b border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-[#0f1524]/90 backdrop-blur">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Importar lista de precios</h3>
                <button
                  onClick={handleCloseImport}
                  className="inline-flex items-center justify-center rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-white/10"
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
            <div className="p-4">
              <div className="relative rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent">
                <ImportarListaPrecios
                  onClose={handleCloseImport}
                  onImportStart={handleImportStart}
                  onImportFinish={handleImportFinish}
                />
                {isImporting && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-black/50 text-white">
                    <svg
                      className="mb-3 h-8 w-8 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span className="text-lg font-semibold">Cargando...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualEntryScreen;
