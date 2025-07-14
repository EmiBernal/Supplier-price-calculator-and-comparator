export interface PriceComparison {
  internalProduct: string;
  supplier: string;
  finalPrice: number;
  companyType: string;
  saleConditions: string;
  priceDifference: number;
}

export interface ProductEquivalence {
  externalName: string;
  externalCode: string;
  internalName: string;
  internalCode: string;
  supplier: string;
  date: string;
}

export interface Product {
  id: string; // ID único, generado automáticamente por el backend
  supplier: string;
  productCode: string;
  productName: string;
  netPrice: number;
  finalPrice: number;
  companyType: 'supplier' | 'competitor';
  date: string; // ISO date string, ej: "2025-07-14"
  createdAt: string; // Fecha de creación en ISO string
}