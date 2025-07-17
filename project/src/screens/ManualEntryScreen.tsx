import React, { useState } from 'react';
import { Navigation } from '../components/Navigation';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
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
  companyType: 'Proveedor' | 'Gampack';
  date: string;
}

export const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useState<FormData>({
    company: '',
    productCode: '',
    productName: '',
    netPrice: '',
    finalPrice: '',
    companyType: 'Proveedor',
    date: new Date().toISOString().split('T')[0],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.company.trim()) {
      newErrors.supplier = 'Proveedor es requerido';
    }
    if (!formData.productCode.trim()) {
      newErrors.productCode = 'El codigo del producto es requerido';
    }
    if (!formData.productName.trim()) {
      newErrors.productName = 'El nombre del producto es requerido';
    }
    if (formData.netPrice === '' || formData.netPrice <= 0) {
      newErrors.netPrice = 'El precio neto debe ser mayor a 0';
    }
    if (formData.finalPrice === '' || formData.finalPrice <= 0) {
      newErrors.finalPrice = 'El precio final debe ser mayor a 0';
    }
    if (
      formData.finalPrice !== '' &&
      formData.netPrice !== '' &&
      formData.finalPrice < formData.netPrice
    ) {
      newErrors.finalPrice = 'El precio final debe ser mayor o igual al precio neto';
    }
    if (!formData.date) {
      newErrors.date = 'La fecha es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage('');
    setErrors({});

    try {
      // Aquí haces la llamada a tu API
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // Asegurar que netPrice y finalPrice sean number
          netPrice: Number(formData.netPrice),
          finalPrice: Number(formData.finalPrice),
        }),
      });

      if (!response.ok) {
        throw new Error('La respuesta de la red no fue correcta');
      }

      setSuccessMessage('Producto cargado de forma exitosamente!');

      setFormData({
        company: '',
        productCode: '',
        productName: '',
        netPrice: '',
        finalPrice: '',
        companyType: 'Proveedor',
        date: new Date().toISOString().split('T')[0],
      });

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error uploading product:', error);
      setErrors({ general: 'Failed to upload product. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    field: keyof FormData,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
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

              <Input
                label="Codigo producto"
                value={formData.productCode}
                onChange={(e) => handleInputChange('productCode', e.target.value)}
                error={errors.productCode}
                placeholder="Ingresa el codigo del producto"
              />

              <div className="md:col-span-2">
                <Input
                  label="Nombre del producto "
                  value={formData.productName}
                  onChange={(e) => handleInputChange('productName', e.target.value)}
                  error={errors.productName}
                  placeholder="Ingresa el nombre del producto"
                />
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

              <Select
                label="Tipo de empresa"
                value={formData.companyType}
                onChange={(e) =>
                  handleInputChange('companyType', e.target.value as 'supplier' | 'competitor')
                }
                options={[
                  { value: 'Proveedor', label: 'Proveedor' },
                  { value: 'Gampack', label: 'Gampack' },
                ]}
              />

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
                disabled={isSubmitting}
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
