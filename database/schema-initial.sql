-- ============================================
-- GIMNASIO V2 - SCHEMA COMPLETO
-- Ejecutar UNA SOLA VEZ para crear estructura inicial
--
-- Decisiones aplicadas:
-- ✅ Sin tabla perfiles
-- ✅ Permisos simples (acceso completo si existe en roles_formularios)
-- ✅ CASCADE donde corresponde (detalles, pagos, permisos)
-- ✅ RESTRICT en referencias importantes (usuarios, productos)
-- ✅ Columna 'activo' en usuarios y productos (soft delete)
-- ✅ Módulo COMPRAS incluido
-- ============================================

-- Limpiar si existe (solo desarrollo)
DROP TABLE IF EXISTS detalle_compra CASCADE;
DROP TABLE IF EXISTS compras CASCADE;
DROP TABLE IF EXISTS ventas_pagos CASCADE;
DROP TABLE IF EXISTS detalle_venta CASCADE;
DROP TABLE IF EXISTS ventas CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS metodos_pago CASCADE;
DROP TABLE IF EXISTS unidades_medida CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS roles_formularios CASCADE;
DROP TABLE IF EXISTS formularios CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS tipos_identificacion CASCADE;

-- ============================================
-- MÓDULO: SEGURIDAD Y AUTENTICACIÓN
-- ============================================

-- Tipos de identificación (CC, CE, Pasaporte, NIT, etc.)
CREATE TABLE tipos_identificacion (
    id_tipo_identificacion SERIAL PRIMARY KEY,
    nombre_tipo_identificacion VARCHAR(50) NOT NULL UNIQUE,
    descripcion_tipo_identificacion VARCHAR(200),
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles del sistema
CREATE TABLE roles (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE,
    descripcion_rol TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Formularios del sistema (para menú dinámico)
CREATE TABLE formularios (
    id_formulario SERIAL PRIMARY KEY,
    titulo_formulario VARCHAR(100) NOT NULL,
    url_formulario VARCHAR(200),
    padre_id INTEGER REFERENCES formularios(id_formulario) ON DELETE CASCADE,
    is_padre BOOLEAN DEFAULT FALSE,
    orden_formulario INTEGER DEFAULT 0,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permisos: qué formularios puede ver cada rol
-- SIMPLE: Si existe el registro = acceso completo al formulario
CREATE TABLE roles_formularios (
    id_rol INTEGER NOT NULL REFERENCES roles(id_rol) ON DELETE CASCADE,
    id_formulario INTEGER NOT NULL REFERENCES formularios(id_formulario) ON DELETE CASCADE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_rol, id_formulario)
);

-- Usuarios del sistema
CREATE TABLE usuarios (
    id_tipo_identificacion INTEGER NOT NULL REFERENCES tipos_identificacion(id_tipo_identificacion),
    identificacion_usuario VARCHAR(20) NOT NULL,
    nombres_usuario VARCHAR(100) NOT NULL,
    apellido1_usuario VARCHAR(50) NOT NULL,
    apellido2_usuario VARCHAR(50),
    email_usuario VARCHAR(100) UNIQUE,
    hash_password_usuario VARCHAR(255) NOT NULL,
    id_rol INTEGER NOT NULL REFERENCES roles(id_rol) ON DELETE RESTRICT,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_tipo_identificacion, identificacion_usuario)
);

-- Índices para optimización de usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email_usuario);
CREATE INDEX idx_usuarios_rol ON usuarios(id_rol);
CREATE INDEX idx_usuarios_activo ON usuarios(activo) WHERE activo = TRUE;

-- ============================================
-- MÓDULO: INVENTARIO
-- ============================================

-- Categorías de productos
CREATE TABLE categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(100) NOT NULL UNIQUE,
    descripcion_categoria TEXT,
    activa BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unidades de medida (UND, KG, LT, etc.)
CREATE TABLE unidades_medida (
    id_unidad_medida SERIAL PRIMARY KEY,
    nombre_unidad_medida VARCHAR(50) NOT NULL,
    abreviatura_unidad_medida VARCHAR(10),
    descripcion_unidad_medida TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Productos del gimnasio
CREATE TABLE productos (
    id_producto SERIAL PRIMARY KEY,
    nombre_producto VARCHAR(150) NOT NULL,
    descripcion_producto TEXT,
    id_categoria INTEGER NOT NULL REFERENCES categorias(id_categoria) ON DELETE RESTRICT,
    id_unidad_medida INTEGER NOT NULL REFERENCES unidades_medida(id_unidad_medida) ON DELETE RESTRICT,
    precio_costo NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (precio_costo >= 0),
    precio_venta NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
    stock_actual NUMERIC(12, 2) DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo NUMERIC(12, 2) DEFAULT 0,
    stock_maximo NUMERIC(12, 2),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para productos
CREATE INDEX idx_productos_categoria ON productos(id_categoria);
CREATE INDEX idx_productos_nombre ON productos(nombre_producto);
CREATE INDEX idx_productos_activo ON productos(activo) WHERE activo = TRUE;

-- ============================================
-- MÓDULO: VENTAS Y PAGOS
-- ============================================

-- Métodos de pago disponibles
CREATE TABLE metodos_pago (
    id_metodo_pago SERIAL PRIMARY KEY,
    nombre_metodo_pago VARCHAR(50) NOT NULL UNIQUE,
    descripcion_metodo_pago TEXT,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ventas (normales y fiadas)
CREATE TABLE ventas (
    id_venta SERIAL PRIMARY KEY,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    es_fiado BOOLEAN DEFAULT FALSE,
    cliente_desc VARCHAR(200),
    saldo_pendiente NUMERIC(12, 2) DEFAULT 0 CHECK (saldo_pendiente >= 0),
    estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PAGADA', 'CANCELADA')),
    id_tipo_identificacion_usuario INTEGER NOT NULL,
    identificacion_usuario VARCHAR(20) NOT NULL,
    observaciones TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_tipo_identificacion_usuario, identificacion_usuario)
        REFERENCES usuarios(id_tipo_identificacion, identificacion_usuario) ON DELETE RESTRICT
);

-- Índices para ventas
CREATE INDEX idx_ventas_fecha ON ventas(fecha_venta DESC);
CREATE INDEX idx_ventas_estado ON ventas(estado);
CREATE INDEX idx_ventas_usuario ON ventas(id_tipo_identificacion_usuario, identificacion_usuario);
CREATE INDEX idx_ventas_fiado ON ventas(es_fiado) WHERE es_fiado = TRUE;

-- Detalle de ventas (productos vendidos)
-- CASCADE: Si se elimina la venta, se eliminan los detalles
CREATE TABLE detalle_venta (
    id_detalle_venta SERIAL PRIMARY KEY,
    id_venta INTEGER NOT NULL REFERENCES ventas(id_venta) ON DELETE CASCADE,
    id_producto INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE RESTRICT,
    cantidad_detalle_venta NUMERIC(12, 2) NOT NULL CHECK (cantidad_detalle_venta > 0),
    precio_unitario_venta NUMERIC(12, 2) NOT NULL CHECK (precio_unitario_venta >= 0),
    subtotal_venta NUMERIC(12, 2) GENERATED ALWAYS AS (cantidad_detalle_venta * precio_unitario_venta) STORED,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_detalle_venta_venta ON detalle_venta(id_venta);
CREATE INDEX idx_detalle_venta_producto ON detalle_venta(id_producto);

-- Pagos de ventas (para pagos mixtos y abonos)
-- CASCADE: Si se elimina la venta, se eliminan los pagos
CREATE TABLE ventas_pagos (
    id_venta_pago SERIAL PRIMARY KEY,
    id_venta INTEGER NOT NULL REFERENCES ventas(id_venta) ON DELETE CASCADE,
    id_metodo_pago INTEGER NOT NULL REFERENCES metodos_pago(id_metodo_pago) ON DELETE RESTRICT,
    monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ventas_pagos_venta ON ventas_pagos(id_venta);
CREATE INDEX idx_ventas_pagos_fecha ON ventas_pagos(fecha_pago DESC);

-- ============================================
-- MÓDULO: COMPRAS
-- ============================================

-- Compras de inventario
CREATE TABLE compras (
    id_compra SERIAL PRIMARY KEY,
    fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    observaciones TEXT,
    id_tipo_identificacion_usuario INTEGER NOT NULL,
    identificacion_usuario VARCHAR(20) NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_tipo_identificacion_usuario, identificacion_usuario)
        REFERENCES usuarios(id_tipo_identificacion, identificacion_usuario) ON DELETE RESTRICT
);

-- Índices para compras
CREATE INDEX idx_compras_fecha ON compras(fecha_compra DESC);
CREATE INDEX idx_compras_usuario ON compras(id_tipo_identificacion_usuario, identificacion_usuario);

-- Detalle de compras (productos comprados)
-- CASCADE: Si se elimina la compra, se eliminan los detalles
CREATE TABLE detalle_compra (
    id_detalle_compra SERIAL PRIMARY KEY,
    id_compra INTEGER NOT NULL REFERENCES compras(id_compra) ON DELETE CASCADE,
    id_producto INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE RESTRICT,
    cantidad_detalle_compra NUMERIC(12, 2) NOT NULL CHECK (cantidad_detalle_compra > 0),
    precio_unitario_compra NUMERIC(12, 2) NOT NULL CHECK (precio_unitario_compra >= 0),
    subtotal_compra NUMERIC(12, 2) GENERATED ALWAYS AS (cantidad_detalle_compra * precio_unitario_compra) STORED,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_detalle_compra_compra ON detalle_compra(id_compra);
CREATE INDEX idx_detalle_compra_producto ON detalle_compra(id_producto);

-- ============================================
-- FUNCIONES Y TRIGGERS
-- ============================================

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar timestamps
CREATE TRIGGER trigger_usuarios_timestamp
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trigger_productos_timestamp
    BEFORE UPDATE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trigger_ventas_timestamp
    BEFORE UPDATE ON ventas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trigger_compras_timestamp
    BEFORE UPDATE ON compras
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE tipos_identificacion IS 'Tipos de documentos de identificación (CC, CE, Pasaporte, etc.)';
COMMENT ON TABLE usuarios IS 'Usuarios del sistema con autenticación JWT';
COMMENT ON TABLE roles IS 'Roles con acceso a diferentes módulos';
COMMENT ON TABLE formularios IS 'Menú dinámico del sistema';
COMMENT ON TABLE roles_formularios IS 'Permisos simples: si existe = acceso completo al formulario';
COMMENT ON TABLE categorias IS 'Categorías de productos del gimnasio';
COMMENT ON TABLE unidades_medida IS 'Unidades de medida (UND, KG, LT, etc.)';
COMMENT ON TABLE productos IS 'Catálogo de productos del gimnasio';
COMMENT ON TABLE metodos_pago IS 'Métodos de pago disponibles (Efectivo, Tarjeta, Nequi, etc.)';
COMMENT ON TABLE ventas IS 'Registro de ventas normales y fiadas';
COMMENT ON TABLE detalle_venta IS 'Detalle de productos vendidos por cada venta';
COMMENT ON TABLE ventas_pagos IS 'Pagos mixtos y abonos de ventas';
COMMENT ON TABLE compras IS 'Registro de compras de inventario';
COMMENT ON TABLE detalle_compra IS 'Detalle de productos comprados por cada compra';

-- ============================================
-- DATOS INICIALES (COMENTADOS - REVISAR ANTES DE USAR)
-- ============================================
-- NOTA: Los INSERT están comentados porque necesitan revisión.
-- Descomentar y corregir según necesites datos de prueba.

/*
-- Tipos de identificación
INSERT INTO tipos_identificacion (nombre_tipo_identificacion, descripcion_tipo_identificacion) VALUES
('CC', 'Cédula de Ciudadanía'),
('CE', 'Cédula de Extranjería'),
('PA', 'Pasaporte'),
('NIT', 'NIT'),
('TI', 'Tarjeta de Identidad');

-- Roles del sistema
INSERT INTO roles (nombre_rol, descripcion_rol) VALUES
('ADMINISTRADOR', 'Acceso total al sistema'),
('VENDEDOR', 'Puede realizar ventas y consultar inventario'),
('BODEGUERO', 'Gestión de inventario y productos');

-- Categorías
INSERT INTO categorias (nombre_categoria, descripcion_categoria) VALUES
('Suplementos', 'Proteínas, creatinas, aminoácidos'),
('Bebidas', 'Bebidas energéticas, isotónicas, jugos'),
('Snacks', 'Barras energéticas, frutos secos'),
('Accesorios', 'Guantes, correas, shakers'),
('Ropa', 'Camisetas, shorts, medias');

-- Unidades de medida
INSERT INTO unidades_medida (nombre_unidad_medida, abreviatura_unidad_medida, descripcion_unidad_medida) VALUES
('Unidad', 'UND', 'Artículo individual'),
('Kilogramo', 'KG', 'Medida de peso'),
('Gramo', 'GR', 'Medida de peso pequeña'),
('Litro', 'LT', 'Medida de volumen'),
('Mililitro', 'ML', 'Medida de volumen pequeña');

-- Métodos de pago
INSERT INTO metodos_pago (nombre_metodo_pago, descripcion_metodo_pago) VALUES
('Efectivo', 'Pago en efectivo'),
('Tarjeta Débito', 'Pago con tarjeta débito'),
('Tarjeta Crédito', 'Pago con tarjeta de crédito'),
('Transferencia', 'Transferencia bancaria'),
('Nequi', 'Pago por Nequi'),
('Daviplata', 'Pago por Daviplata');
*/

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

SELECT 'Base de datos inicializada correctamente ✅' AS mensaje;
