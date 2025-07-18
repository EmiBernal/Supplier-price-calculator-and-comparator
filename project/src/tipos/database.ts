export interface PriceComparison {
  internalProduct: string;
  externalProduct: string;
  supplier: string;
  internalNetPrice: number;
  externalNetPrice: number;
  internalFinalPrice: number;
  externalFinalPrice: number;
  priceDifference: number;
  internalDate: string;
  externalDate: string;
  companyType: string;
  saleConditions: string;
}


export interface ProductEquivalence {
  id: number;
  supplier?: string | null;
  externalCode: string;
  externalName: string;
  externalDate: string;
  internalSupplier?: string;
  internalCode: string;
  internalName: string;
  internalDate: string;
  matchingCriteria?: string;
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