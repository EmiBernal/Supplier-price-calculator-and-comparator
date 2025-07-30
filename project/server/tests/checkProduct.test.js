const request = require('supertest');
const app = require('../index');

describe('POST /api/check-product', () => {
  it('debería devolver found: false si el producto no existe', async () => {
    const res = await request(app).post('/api/check-product').send({
      productCode: 'INEXISTENTE',
      companyType: 'Proveedor'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.found).toBe(false);
  });

  it('debería devolver error si faltan campos', async () => {
    const res = await request(app).post('/api/check-product').send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/faltan/i);
  });
});
