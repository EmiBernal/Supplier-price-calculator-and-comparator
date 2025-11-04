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
  id_lista_precios: number;
  id_productos_gampack: number;
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

export interface CompraComparisonProvider {
  id: number | null;
  provider: string;
  price: number | null;
  date: string | null;
  code: string | null;
  name: string | null;
}

export interface CompraComparisonGroup {
  key: string;
  name: string | null;
  code: string | null;
  providerCount: number;
  bestPrice: number | null;
  bestProvider: string | null;
  worstPrice: number | null;
  worstProvider: string | null;
  priceSpread: number | null;
  priceSpreadPercent: number | null;
  lastUpdated: string | null;
  nameAlternatives: string[];
  codes: string[];
  providers: CompraComparisonProvider[];
}

export interface CompraComparisonSummary {
  totalGroups: number;
  totalProviders: number;
  potentialSavings: number;
  averageSpread: number;
  averageSpreadPercent: number;
  bestOpportunity: {
    key: string;
    name: string | null;
    priceSpread: number | null;
    priceSpreadPercent: number | null;
    bestProvider: string | null;
    worstProvider: string | null;
  } | null;
}

export interface CompraComparisonResponse {
  page: number;
  pageSize: number;
  totalGroups: number;
  totalPages: number;
  summary: CompraComparisonSummary;
  items: CompraComparisonGroup[];
}
