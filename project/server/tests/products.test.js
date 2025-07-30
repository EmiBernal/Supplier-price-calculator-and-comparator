const request = require('supertest');
const app = require('../index'); // Ajusta si tu archivo está en otra carpeta

describe('API /api/products', () => {
  it('debería insertar un producto nuevo y marcarlo como no relacionado si no hay equivalencia', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({
        productCode: `TEST-${Date.now()}`,
        productName: 'Producto Test',
        netPrice: 100,
        finalPrice: 150,
        companyType: 'Proveedor',
        company: 'Test SA',
        date: '2025-07-30'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/no relacionados/i);
  });

  it('debería devolver error si faltan campos obligatorios', async () => {
    const res = await request(app).post('/api/products').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/faltan campos/i);
  });

  it('debería actualizar un producto existente', async () => {
    const product = {
      productCode: 'ACTUALIZAR-123',
      productName: 'Producto Actualizable',
      netPrice: 100,
      finalPrice: 150,
      companyType: 'Proveedor',
      company: 'Test SA',
      date: '2025-07-30'
    };

    // Primera vez: lo crea
    await request(app).post('/api/products').send(product);

    // Segunda vez: lo actualiza
    const res = await request(app)
      .post('/api/products')
      .send({ ...product, netPrice: 120 }); // Cambiar precio

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.updated).toBe(true);
    expect(res.body.message).toMatch(/actualizado/i);
  });
});
