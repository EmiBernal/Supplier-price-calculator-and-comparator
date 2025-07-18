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

  const inferCompanyType = (name: string): 'Gampack' | 'Proveedor' => {
    return name.trim().toLowerCase() === 'gampack' ? 'Gampack' : 'Proveedor';
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.company.trim()) newErrors.supplier = 'Proveedor es requerido';
    if (!formData.productCode.trim()) newErrors.productCode = 'El codigo del producto es requerido';
    if (!formData.productName.trim()) newErrors.productName = 'El nombre del producto es requerido';
    if (formData.netPrice === '' || formData.netPrice <= 0) newErrors.netPrice = 'El precio neto debe ser mayor a 0';
    if (formData.finalPrice === '' || formData.finalPrice <= 0) newErrors.finalPrice = 'El precio final debe ser mayor a 0';
    if (
      formData.finalPrice !== '' &&
      formData.netPrice !== '' &&
      formData.finalPrice < formData.netPrice
    ) newErrors.finalPrice = 'El precio final debe ser mayor o igual al precio neto';
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
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error uploading product:', error);
      setErrors({ general: 'Failed to upload product. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'productCode' || field === 'productName' || field === 'company') {
      setExistingProduct(null);
      setWantsToUpdate(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Navigation onBack={() => onNavigate('home')} title="Registro Manual de Productos" />

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Empresa"
                value={formData.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                error={errors.supplier}
                placeholder="Ingresa el nombre de la empresa (Gampack si es producto propio)"
              />
              <p className="text-sm text-gray-500 md:col-span-2">
                Tipo de empresa detectado: <strong>{inferCompanyType(formData.company)}</strong>
              </p>

              <Input
                label="Código producto"
                value={formData.productCode}
                onChange={(e) => handleInputChange('productCode', e.target.value)}
                error={errors.productCode}
                placeholder="Ingresa el código del producto"
              />

              <div className="md:col-span-2 relative">
                <Input
                  label="Nombre del producto"
                  value={formData.productName}
                  onChange={(e) => handleInputChange('productName', e.target.value)}
                  error={errors.productName}
                  placeholder="Ingresa el nombre del producto"
                />
                {existingProduct && wantsToUpdate === null && (
                  <div className="mt-2 bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800 absolute right-0 top-0 max-w-md shadow-md">
                    Producto ya existente: <strong>{existingProduct.nom_externo ?? existingProduct.nom_interno}</strong> con código <strong>{existingProduct.cod_externo ?? existingProduct.cod_interno}</strong>.<br />
                    ¿Deseas actualizar su precio?
                    <div className="mt-2 flex space-x-2">
                      <Button type="button" onClick={() => setWantsToUpdate(true)}>Sí</Button>
                      <Button type="button" variant="secondary" onClick={() => setWantsToUpdate(false)}>No</Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <Input
                  label="Precio Neto"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.netPrice}
                  onChange={(e) =>
                    handleInputChange(
                      'netPrice',
                      e.target.value === '' ? '' : parseFloat(e.target.value)
                    )
                  }
                  error={errors.netPrice}
                />
                <div className="absolute left-3 top-8 text-gray-500">$</div>
              </div>

              <div className="relative">
                <Input
                  label="Precio Final"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.finalPrice}
                  onChange={(e) =>
                    handleInputChange(
                      'finalPrice',
                      e.target.value === '' ? '' : parseFloat(e.target.value)
                    )
                  }
                  error={errors.finalPrice}
                />
                <div className="absolute left-3 top-8 text-gray-500">$</div>
              </div>

              <Input
                label="Fecha"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                error={errors.date}
              />
            </div>

            {errors.general && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600">{errors.general}</p>
              </div>
            )}

            {successMessage && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-600">{successMessage}</p>
              </div>
            )}

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
  );
};
