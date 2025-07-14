import React, { useState } from 'react';
import { Navigation } from '../components/Navigation';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { database } from '../utils/database';
import { Product } from '../types/database';

interface ManualEntryScreenProps {
  onNavigate: (screen: string) => void;
}

export const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useState<Omit<Product, 'id' | 'createdAt'>>({
    supplier: '',
    productCode: '',
    productName: '',
    netPrice: 0,
    finalPrice: 0,
    companyType: 'supplier',
    date: new Date().toISOString().split('T')[0]
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.supplier.trim()) {
      newErrors.supplier = 'Supplier is required';
    }

    if (!formData.productCode.trim()) {
      newErrors.productCode = 'Product code is required';
    }

    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required';
    }

    if (formData.netPrice <= 0) {
      newErrors.netPrice = 'Net price must be greater than 0';
    }

    if (formData.finalPrice <= 0) {
      newErrors.finalPrice = 'Final price must be greater than 0';
    }

    if (formData.finalPrice < formData.netPrice) {
      newErrors.finalPrice = 'Final price must be greater than or equal to net price';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
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

    try {
      await database.insertProduct(formData);
      setSuccessMessage('Product uploaded successfully!');
      
      // Reset form
      setFormData({
        supplier: '',
        productCode: '',
        productName: '',
        netPrice: 0,
        finalPrice: 0,
        companyType: 'supplier',
        date: new Date().toISOString().split('T')[0]
      });
      
      // Clear success message after 3 seconds
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

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Navigation 
          onBack={() => onNavigate('home')} 
          title="Manual Price Entry"
        />

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Supplier"
                value={formData.supplier}
                onChange={(e) => handleInputChange('supplier', e.target.value)}
                error={errors.supplier}
                placeholder="Enter supplier name"
              />

              <Input
                label="Product Code"
                value={formData.productCode}
                onChange={(e) => handleInputChange('productCode', e.target.value)}
                error={errors.productCode}
                placeholder="Enter product code"
              />

              <div className="md:col-span-2">
                <Input
                  label="Product Name"
                  value={formData.productName}
                  onChange={(e) => handleInputChange('productName', e.target.value)}
                  error={errors.productName}
                  placeholder="Enter product name"
                />
              </div>

              <div className="relative">
                <Input
                  label="Net Price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.netPrice}
                  onChange={(e) => handleInputChange('netPrice', parseFloat(e.target.value) || 0)}
                  error={errors.netPrice}
                  placeholder="0.00"
                />
                <div className="absolute left-3 top-8 text-gray-500">$</div>
              </div>

              <div className="relative">
                <Input
                  label="Final Price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.finalPrice}
                  onChange={(e) => handleInputChange('finalPrice', parseFloat(e.target.value) || 0)}
                  error={errors.finalPrice}
                  placeholder="0.00"
                />
                <div className="absolute left-3 top-8 text-gray-500">$</div>
              </div>

              <Select
                label="Company Type"
                value={formData.companyType}
                onChange={(e) => handleInputChange('companyType', e.target.value as 'supplier' | 'competitor')}
                options={[
                  { value: 'supplier', label: 'Supplier' },
                  { value: 'competitor', label: 'Competitor' }
                ]}
              />

              <Input
                label="Date"
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
              <Button
                type="button"
                variant="secondary"
                onClick={() => onNavigate('home')}
              >
                Back to Home
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className={isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {isSubmitting ? 'Uploading...' : 'Upload Product'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};