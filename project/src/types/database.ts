export interface Product {
  id?: number;
  supplier: string;
  productCode: string;
  productName: string;
  netPrice: number;
  finalPrice: number;
  companyType: 'supplier' | 'competitor';
  date: string;
  createdAt?: string;
}

export interface ProductEquivalence {
  id?: number;
  supplier: string;
  externalCode: string;
  externalName: string;
  internalCode: string;
  internalName: string;
  matchingCriteria: 'manual' | 'name' | 'code';
  date: string;
  createdAt?: string;
}

export interface PriceComparison {
  id?: number;
  internalProduct: string;
  supplier: string;
  finalPrice: number;
  companyType: 'supplier' | 'competitor';
  saleConditions: string;
  priceDifference: number;
}