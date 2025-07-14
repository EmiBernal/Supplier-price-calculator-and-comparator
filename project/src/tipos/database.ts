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
