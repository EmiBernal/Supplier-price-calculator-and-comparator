CREATE TABLE lista_precios (
    id_externo INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_externo TEXT,
    cod_externo TEXT UNIQUE,
    precio_neto REAL,
    precio_final REAL,
    tipo_empresa TEXT NOT NULL,  -- 'proveedor' o 'competencia'
    fecha TEXT                  -- fecha como texto (ej: '2025-07-14')
);

CREATE TABLE lista_interna (
    id_interno INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_interno TEXT,
    cod_interno TEXT UNIQUE,
    precio_neto REAL,
    precio_final REAL,
    fecha TEXT
);

CREATE TABLE relacion_articulos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lista_precios INTEGER NOT NULL,
    id_lista_interna INTEGER NOT NULL,
    criterio_relacion TEXT NOT NULL, -- 'nombre', 'codigo' o 'manual'
    FOREIGN KEY (id_lista_precios) REFERENCES lista_precios(id_externo),
    FOREIGN KEY (id_lista_interna) REFERENCES lista_interna(id_interno),
    UNIQUE (id_lista_precios),
    UNIQUE (id_lista_interna)
);

CREATE TABLE articulos_no_relacionados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lista_precios INTEGER NOT NULL,
    motivo TEXT,
    FOREIGN KEY (id_lista_precios) REFERENCES lista_precios(id_externo)
);
