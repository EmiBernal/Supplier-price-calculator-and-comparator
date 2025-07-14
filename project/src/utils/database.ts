import { Product, ProductEquivalence, PriceComparison } from '../types/database';

class DatabaseManager {
  private db: any = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize SQLite WASM
      const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default;
      const sqlite3 = await sqlite3InitModule();
      
      this.db = new sqlite3.oo1.DB();
      
      // Create tables
      await this.createTables();
      await this.seedData();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Database initialization failed:', error);
      // Use in-memory fallback
      this.initializeInMemory();
    }
  }

  private async createTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier TEXT NOT NULL,
        productCode TEXT NOT NULL,
        productName TEXT NOT NULL,
        netPrice REAL NOT NULL,
        finalPrice REAL NOT NULL,
        companyType TEXT NOT NULL,
        date TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS product_equivalences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier TEXT NOT NULL,
        externalCode TEXT NOT NULL,
        externalName TEXT NOT NULL,
        internalCode TEXT NOT NULL,
        internalName TEXT NOT NULL,
        matchingCriteria TEXT NOT NULL,
        date TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS price_comparisons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        internalProduct TEXT NOT NULL,
        supplier TEXT NOT NULL,
        finalPrice REAL NOT NULL,
        companyType TEXT NOT NULL,
        saleConditions TEXT NOT NULL,
        priceDifference REAL NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    queries.forEach(query => {
      this.db.exec(query);
    });
  }

  private async seedData() {
    // Sample data for demonstration
    const sampleProducts = [
      {
        supplier: 'TechSupply Inc.',
        productCode: 'TS001',
        productName: 'Gaming Mouse Pro',
        netPrice: 45.00,
        finalPrice: 55.00,
        companyType: 'supplier',
        date: '2024-01-15'
      },
      {
        supplier: 'ElectroWorld',
        productCode: 'EW002',
        productName: 'Mechanical Keyboard',
        netPrice: 120.00,
        finalPrice: 150.00,
        companyType: 'competitor',
        date: '2024-01-16'
      }
    ];

    const sampleEquivalences = [
      {
        supplier: 'TechSupply Inc.',
        externalCode: 'TS001',
        externalName: 'Gaming Mouse Pro',
        internalCode: 'GM001',
        internalName: 'Gaming Mouse Premium',
        matchingCriteria: 'name',
        date: '2024-01-15'
      }
    ];

    // Insert sample data if tables are empty
    try {
      const productCount = this.db.exec("SELECT COUNT(*) as count FROM products")[0]?.values[0]?.[0];
      if (productCount === 0) {
        sampleProducts.forEach(product => {
          this.insertProduct(product);
        });
      }

      const equivalenceCount = this.db.exec("SELECT COUNT(*) as count FROM product_equivalences")[0]?.values[0]?.[0];
      if (equivalenceCount === 0) {
        sampleEquivalences.forEach(equivalence => {
          this.insertEquivalence(equivalence);
        });
      }
    } catch (error) {
      console.error('Error seeding data:', error);
    }
  }

  private initializeInMemory() {
    // Fallback to in-memory storage
    this.db = {
      products: [],
      equivalences: [],
      comparisons: []
    };
    this.isInitialized = true;
  }

  async insertProduct(product: Omit<Product, 'id' | 'createdAt'>): Promise<number> {
    try {
      if (this.db.exec) {
        const result = this.db.exec({
          sql: `INSERT INTO products (supplier, productCode, productName, netPrice, finalPrice, companyType, date) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          bind: [product.supplier, product.productCode, product.productName, product.netPrice, product.finalPrice, product.companyType, product.date]
        });
        return result.insertId || Date.now();
      } else {
        const newProduct = { ...product, id: Date.now() };
        this.db.products.push(newProduct);
        return newProduct.id;
      }
    } catch (error) {
      console.error('Error inserting product:', error);
      throw error;
    }
  }

  async getProducts(): Promise<Product[]> {
    try {
      if (this.db.exec) {
        const result = this.db.exec("SELECT * FROM products ORDER BY createdAt DESC");
        return result[0]?.values?.map((row: any[]) => ({
          id: row[0],
          supplier: row[1],
          productCode: row[2],
          productName: row[3],
          netPrice: row[4],
          finalPrice: row[5],
          companyType: row[6],
          date: row[7],
          createdAt: row[8]
        })) || [];
      } else {
        return this.db.products || [];
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  async insertEquivalence(equivalence: Omit<ProductEquivalence, 'id' | 'createdAt'>): Promise<number> {
    try {
      if (this.db.exec) {
        const result = this.db.exec({
          sql: `INSERT INTO product_equivalences (supplier, externalCode, externalName, internalCode, internalName, matchingCriteria, date) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          bind: [equivalence.supplier, equivalence.externalCode, equivalence.externalName, equivalence.internalCode, equivalence.internalName, equivalence.matchingCriteria, equivalence.date]
        });
        return result.insertId || Date.now();
      } else {
        const newEquivalence = { ...equivalence, id: Date.now() };
        this.db.equivalences.push(newEquivalence);
        return newEquivalence.id;
      }
    } catch (error) {
      console.error('Error inserting equivalence:', error);
      throw error;
    }
  }

  async getEquivalences(searchTerm?: string): Promise<ProductEquivalence[]> {
    try {
      if (this.db.exec) {
        let query = "SELECT * FROM product_equivalences";
        let params: any[] = [];
        
        if (searchTerm) {
          query += " WHERE externalName LIKE ? OR internalName LIKE ? OR externalCode LIKE ? OR internalCode LIKE ?";
          const searchPattern = `%${searchTerm}%`;
          params = [searchPattern, searchPattern, searchPattern, searchPattern];
        }
        
        query += " ORDER BY createdAt DESC";
        
        const result = this.db.exec({ sql: query, bind: params });
        return result[0]?.values?.map((row: any[]) => ({
          id: row[0],
          supplier: row[1],
          externalCode: row[2],
          externalName: row[3],
          internalCode: row[4],
          internalName: row[5],
          matchingCriteria: row[6],
          date: row[7],
          createdAt: row[8]
        })) || [];
      } else {
        let equivalences = this.db.equivalences || [];
        if (searchTerm) {
          equivalences = equivalences.filter((eq: ProductEquivalence) =>
            eq.externalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            eq.internalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            eq.externalCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            eq.internalCode.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        return equivalences;
      }
    } catch (error) {
      console.error('Error fetching equivalences:', error);
      return [];
    }
  }

  async getPriceComparisons(searchTerm?: string): Promise<PriceComparison[]> {
    try {
      // Generate price comparisons based on products
      const products = await this.getProducts();
      const comparisons: PriceComparison[] = [];
      
      // Group products by similar names to create comparisons
      const productGroups = new Map<string, Product[]>();
      
      products.forEach(product => {
        const key = product.productName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!productGroups.has(key)) {
          productGroups.set(key, []);
        }
        productGroups.get(key)!.push(product);
      });
      
      // Create comparisons for each group
      productGroups.forEach((group, key) => {
        if (group.length > 1) {
          const prices = group.map(p => p.finalPrice);
          const minPrice = Math.min(...prices);
          
          group.forEach(product => {
            const priceDifference = ((product.finalPrice - minPrice) / minPrice) * 100;
            comparisons.push({
              id: product.id,
              internalProduct: product.productName,
              supplier: product.supplier,
              finalPrice: product.finalPrice,
              companyType: product.companyType,
              saleConditions: product.companyType === 'supplier' ? 'Standard Terms' : 'Competitive Rate',
              priceDifference: Math.round(priceDifference * 100) / 100
            });
          });
        }
      });
      
      // Filter by search term if provided
      let filteredComparisons = comparisons;
      if (searchTerm) {
        filteredComparisons = comparisons.filter(comp =>
          comp.internalProduct.toLowerCase().includes(searchTerm.toLowerCase()) ||
          comp.supplier.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      // Sort by lowest price
      return filteredComparisons.sort((a, b) => a.finalPrice - b.finalPrice);
    } catch (error) {
      console.error('Error generating price comparisons:', error);
      return [];
    }
  }
}

export const database = new DatabaseManager();