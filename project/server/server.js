const app = require('./index');
const { ensureMesActualizacionColumn } = require('./utils/ensureMesActualizacion');

const PORT = process.env.PORT || 4000;

ensureMesActualizacionColumn()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error al preparar la columna mes_actualizacion:', error);
    process.exit(1);
  });
