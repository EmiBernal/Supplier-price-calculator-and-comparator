import React, { useState } from 'react';
import { Navigation } from '../components/Navigation';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Screen } from '../types';

interface ManualEntryScreenProps {
  onNavigate: (screen: Screen) => void;
}

interface FormData {
  company: string;
  productCode: string;
  productName: string;
  netPrice: number | '';
  finalPrice: number | '';
  date: string;
}

const BASE_URL = 'http://localhost:4000';

export const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useState<FormData>({
    company: '',
    productCode: '',
    productName: '',
    netPrice: '',
    finalPrice: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [existingProduct, setExistingProduct] = useState<any | null>(null);
  const [wantsToUpdate, setWantsToUpdate] = useState<boolean | null>(null);
  const [crossSuggestedProduct, setCrossSuggestedProduct] = useState<any | null>(null);

  const inferCompanyType = (name: string): 'Gampack' | 'Proveedor' =>
    name.trim().toLowerCase() === 'gampack' ? 'Gampack' : 'Proveedor';

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.company.trim()) newErrors.supplier = 'Proveedor es requerido';
    if (!formData.productCode.trim()) newErrors.productCode = 'El código del producto es requerido';
    if (!formData.productName.trim()) newErrors.productName = 'El nombre del producto es requerido';
    if (formData.netPrice === '' || formData.netPrice <= 0) newErrors.netPrice = 'El precio neto debe ser mayor a 0';
    if (formData.finalPrice === '' || formData.finalPrice <= 0) newErrors.finalPrice = 'El precio final debe ser mayor a 0';
    if (
      formData.finalPrice !== '' &&
      formData.netPrice !== '' &&
      formData.finalPrice < formData.netPrice
    ) {
      newErrors.finalPrice = 'El precio final debe ser mayor o igual al precio neto';
    }
    if (!formData.date) newErrors.date = 'La fecha es requerida';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // No es llamada directamente: solo para referencia
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

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error en respuesta de check-product:', res.status, errorText);
        return false;
      }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSuccessMessage('');
    setErrors({});

    // Si ya hay sugerencia de relación, no hacer nada aquí, se espera confirmación
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
          netPrice: Number(formData.netPrice),
          finalPrice: Number(formData.finalPrice),
          updateExisting: wantsToUpdate || false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error del servidor: ${errorText}`);
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
        netPrice: '',
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
        netPrice: Number(formData.netPrice),
        finalPrice: Number(formData.finalPrice),
        linkAsEquivalent,
        updateExisting: wantsToUpdate || false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error del servidor: ${errorText}`);
    }

    const json = await response.json();

    if (json.success) {
      setSuccessMessage(linkAsEquivalent ? 'Producto relacionado exitosamente!' : 'Producto creado sin relación.');
      setFormData({
        company: '',
        productCode: '',
        productName: '',
        netPrice: '',
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
  <div className="min-h-screen bg-gray-50 p-6">
    <div className="max-w-4xl mx-auto">
      <Navigation onBack={() => onNavigate('home')} title="Registro Manual de Productos" />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {/* Empresa */}
            <Input
              label="Empresa"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              error={errors.supplier}
              placeholder="Ingresa el nombre de la empresa (Gampack si es producto propio)"
            />

            {/* Tipo de empresa detectado */}
            <p className="text-sm text-gray-500 md:col-span-2">
              Tipo de empresa detectado: <strong>{inferCompanyType(formData.company)}</strong>
            </p>

            {/* Código producto */}
            <Input
              label="Código producto"
              value={formData.productCode}
              onChange={(e) => handleInputChange('productCode', e.target.value)}
              error={errors.productCode}
              placeholder="Ingresa el código del producto"
            />

            {/* Nombre producto */}
            <div className="relative md:col-span-2">
              <Input
                label="Nombre del producto"
                value={formData.productName}
                onChange={(e) => handleInputChange('productName', e.target.value)}
                error={errors.productName}
                placeholder="Ingresa el nombre del producto"
              />

              {/* Mensaje si producto ya existe y pregunta actualización precio */}
              {existingProduct && wantsToUpdate === null && (
                <div className="mt-2 bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800 absolute right-0 top-full max-w-md shadow-md z-10">
                  Producto ya existente: <strong>{existingProduct.nom_externo ?? existingProduct.nom_interno}</strong> con código <strong>{existingProduct.cod_externo ?? existingProduct.cod_interno}</strong>.<br />
                  ¿Deseas actualizar su precio?
                  <div className="mt-2 flex space-x-2">
                    <Button type="button" onClick={() => setWantsToUpdate(true)}>Sí</Button>
                    <Button type="button" variant="secondary" onClick={() => setWantsToUpdate(false)}>No</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Precio Neto */}
            <div className="relative">
              <Input
                label="Precio Neto"
                type="number"
                min="0"
                step="0.01"
                value={formData.netPrice}
                onChange={(e) => handleInputChange('netPrice', e.target.value === '' ? '' : parseFloat(e.target.value))}
                error={errors.netPrice}
                className="pl-8"
              />
              <div className="absolute left-3 top-8 text-gray-500">$</div>
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
                className="pl-8"
              />
              <div className="absolute left-3 top-8 text-gray-500">$</div>
            </div>

            {/* Fecha */}
            <Input
              label="Fecha"
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              error={errors.date}
            />
          </div>

          {/* Error general */}
          {errors.general && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{errors.general}</p>
            </div>
          )}

          {/* Mensaje de éxito */}
          {successMessage && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-600">{successMessage}</p>
            </div>
          )}

          {/* Sugerencia para relacionar producto */}
          {crossSuggestedProduct && (
            <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg text-sm mt-4">
              ⚠️ <strong>Advertencia:</strong> el código ingresado ya existe en <strong>{crossSuggestedProduct.companyType}</strong> con el nombre:<br />
              <strong>{crossSuggestedProduct.name}</strong> (Código: {crossSuggestedProduct.code}).<br />
              ¿Deseás relacionar este producto con él?
              <div className="mt-2 flex space-x-2">
                <Button type="button" onClick={() => handleLinkConfirm(true)}>Sí, relacionar productos</Button>
                <Button type="button" variant="secondary" onClick={() => handleLinkConfirm(false)}>No, no hay relación</Button>
              </div>
            </div>
          )}

          {/* Botones final */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="secondary" onClick={() => onNavigate('home')}>
              Volver
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (existingProduct && wantsToUpdate === null)}
              className={isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {isSubmitting ? 'Subiendo...' : 'Subir'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>
)};
