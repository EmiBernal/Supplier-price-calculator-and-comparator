CREATE DATABASE gampackDB;

use gampackDB;

/* Tabla lista_precios */
CREATE TABLE lista_precios (
    id_externo INT AUTO_INCREMENT PRIMARY KEY,
    nom_externo VARCHAR(100),
    cod_externo VARCHAR(40) UNIQUE,
    precio_neto DECIMAL(10,2),
    precio_final DECIMAL(10,2),
    tipo_empresa ENUM('proveedor', 'competencia') NOT NULL,
    fecha DATE
);

/* Tabla lista_interna */
CREATE TABLE lista_interna (
    id_interno INT AUTO_INCREMENT PRIMARY KEY,
    nom_interno VARCHAR(100),
    cod_interno VARCHAR(40) UNIQUE,
    precio_neto DECIMAL(10,2),
    precio_final DECIMAL(10,2),
    fecha DATE
);

/* Tabla relacion_articulos */
CREATE TABLE relacion_articulos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_lista_precios INT NOT NULL,
    id_lista_interna INT NOT NULL,
    criterio_relacion ENUM('nombre', 'codigo', 'manual') NOT NULL,
    FOREIGN KEY (id_lista_precios) REFERENCES lista_precios(id_externo),
    FOREIGN KEY (id_lista_interna) REFERENCES lista_interna(id_interno),
    UNIQUE (id_lista_precios),       /* Un producto externo solo puede estar en una relación */
    UNIQUE (id_lista_interna)        /* Un producto interno solo puede estar en una relación */
);

/* Tabla externos_no_relacionados */
CREATE TABLE externos_no_relacionados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_lista_precios INT NOT NULL,
    motivo VARCHAR(255),
    FOREIGN KEY (id_lista_precios) REFERENCES lista_precios(id_externo)
);
