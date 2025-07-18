-- Tabla lista_precios (productos de proveedores)
CREATE TABLE IF NOT EXISTS lista_precios (
    id_externo INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_externo TEXT NOT NULL,
    cod_externo TEXT NOT NULL,
    precio_neto REAL NOT NULL,
    precio_final REAL NOT NULL,
    tipo_empresa TEXT NOT NULL,  -- 'Proveedor' o 'Competencia' o similar
    fecha TEXT NOT NULL,         -- fecha formato ISO string 'YYYY-MM-DD'
    proveedor TEXT NOT NULL,
    UNIQUE (cod_externo, proveedor)  -- evita duplicados del mismo proveedor y código
);

-- Tabla lista_interna (productos propios Gampack)
CREATE TABLE IF NOT EXISTS lista_interna (
    id_interno INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_interno TEXT NOT NULL,
    cod_interno TEXT NOT NULL,
    precio_neto REAL NOT NULL,
    precio_final REAL NOT NULL,
    fecha TEXT NOT NULL,
    UNIQUE (cod_interno) -- código interno único
);

-- Tabla relacion_articulos (relación 1 a 1 entre producto externo e interno)
CREATE TABLE IF NOT EXISTS relacion_articulos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lista_precios INTEGER NOT NULL,
    id_lista_interna INTEGER NOT NULL,
    criterio_relacion TEXT NOT NULL, -- 'nombre', 'codigo', 'manual', 'automatic'
    FOREIGN KEY (id_lista_precios) REFERENCES lista_precios(id_externo) ON DELETE CASCADE,
    FOREIGN KEY (id_lista_interna) REFERENCES lista_interna(id_interno) ON DELETE CASCADE,
    UNIQUE (id_lista_precios),
    UNIQUE (id_lista_interna)
);

-- Tabla para productos externos no relacionados
CREATE TABLE IF NOT EXISTS articulos_no_relacionados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lista_precios INTEGER NOT NULL,
    motivo TEXT,
    FOREIGN KEY (id_lista_precios) REFERENCES lista_precios(id_externo) ON DELETE CASCADE,
    UNIQUE (id_lista_precios)
);

-- Tabla para productos internos no relacionados 
CREATE TABLE IF NOT EXISTS articulos_gampack_no_relacionados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lista_interna INTEGER NOT NULL,
    motivo TEXT,
    FOREIGN KEY (id_lista_interna) REFERENCES lista_interna(id_interno) ON DELETE CASCADE,
    UNIQUE (id_lista_interna)
);
