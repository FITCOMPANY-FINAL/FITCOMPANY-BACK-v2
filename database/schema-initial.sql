-- ============================================
-- GIMNASIO V2 - SCHEMA COMPLETO
-- Ejecutar UNA SOLA VEZ para crear estructura inicial
-- 
-- Decisiones aplicadas:
-- ✅ Sin tabla perfiles
-- ✅ Permisos simples (acceso completo si existe en roles_formularios)
-- ✅ CASCADE donde corresponde (detalles, pagos, permisos)
-- ✅ RESTRICT en referencias importantes (usuarios, productos)
-- ============================================

-- Limpiar si existe (solo desarrollo)
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
    descripcion_tipo_identificacion VARCHAR(50),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles del sistema
CREATE TABLE roles (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE,
    descripcion_rol TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Formularios del sistema (para menú dinámico)
CREATE TABLE formularios (
    id_formulario SERIAL PRIMARY KEY,
    titulo_formulario VARCHAR(100) NOT NULL,
    url_formulario VARCHAR(200),
    padre_id INTEGER REFERENCES formularios(id_formulario) ON DELETE CASCADE,
    isPadre BOOLEAN,
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
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_tipo_identificacion, identificacion_usuario)
);

-- Índices para optimización
CREATE INDEX idx_usuarios_email ON usuarios(email);
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
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Productos del gimnasio
CREATE TABLE productos (
    id_producto SERIAL PRIMARY KEY,
    nombre_producto VARCHAR(150) NOT NULL,
    descripcion_producto  TEXT,
    id_categoria INTEGER NOT NULL REFERENCES categorias(id_categoria) ON DELETE RESTRICT,
    id_unidad_medida INTEGER NOT NULL REFERENCES unidades_medida(id_unidad_medida) ON DELETE RESTRICT,
    precio_costo NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (precio_costo >= 0),
    precio_venta NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
    stock_actual NUMERIC(12, 2) DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo NUMERIC(12, 2) DEFAULT 0,
    stock_maximo NUMERIC(12, 2),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_productos_categoria ON productos(id_categoria);
CREATE INDEX idx_productos_codigo ON productos(codigo_barras) WHERE codigo_barras IS NOT NULL;
CREATE INDEX idx_productos_nombre ON productos(nombre);
CREATE INDEX idx_productos_activo ON productos(activo) WHERE activo = TRUE;

-- ============================================
-- MÓDULO: VENTAS Y PAGOS
-- ============================================

-- Métodos de pago disponibles
CREATE TABLE metodos_pago (
    id_metodo_pago SERIAL PRIMARY KEY,
    nombre_metodo_pago VARCHAR(50) NOT NULL UNIQUE,
    descripcion_metodo_pago TEXT,
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
    cantidad_detalle_venta NUMERIC(12, 2) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal NUMERIC(12, 2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
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

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Tipos de identificación
INSERT INTO tipos_identificacion (descripcion) VALUES
('Cédula de Ciudadanía'),
('Cédula de Extranjería'),
('Pasaporte'),
('NIT'),
('Tarjeta de Identidad');

-- Roles del sistema
INSERT INTO roles (nombre, descripcion) VALUES
('ADMINISTRADOR', 'Acceso total al sistema'),
('VENDEDOR', 'Puede realizar ventas y consultar inventario'),
('BODEGUERO', 'Gestión de inventario y productos');

-- Formularios principales
INSERT INTO formularios (nombre, ruta, padre_id, orden, icono) VALUES
('Dashboard', '/dashboard', NULL, 1, 'dashboard'),
('Ventas', NULL, NULL, 2, 'shopping_cart'),
('Inventario', NULL, NULL, 3, 'inventory'),
('Reportes', NULL, NULL, 4, 'assessment'),
('Configuración', NULL, NULL, 5, 'settings');

-- Submenús de Ventas
INSERT INTO formularios (nombre, ruta, padre_id, orden, icono) VALUES
('Nueva Venta', '/ventas/nueva', 2, 1, 'add_shopping_cart'),
('Historial Ventas', '/ventas/historial', 2, 2, 'history'),
('Fiados Pendientes', '/ventas/fiados', 2, 3, 'account_balance_wallet'),
('Registrar Abono', '/ventas/abonos', 2, 4, 'payment');

-- Submenús de Inventario
INSERT INTO formularios (nombre, ruta, padre_id, orden, icono) VALUES
('Productos', '/inventario/productos', 3, 1, 'category'),
('Categorías', '/inventario/categorias', 3, 2, 'label'),
('Unidades', '/inventario/unidades', 3, 3, 'straighten');

-- Submenús de Reportes
INSERT INTO formularios (nombre, ruta, padre_id, orden, icono) VALUES
('Ventas por Período', '/reportes/ventas', 4, 1, 'bar_chart'),
('Rentabilidad', '/reportes/rentabilidad', 4, 2, 'trending_up'),
('Productos Más Vendidos', '/reportes/productos', 4, 3, 'star');

-- Submenús de Configuración
INSERT INTO formularios (nombre, ruta, padre_id, orden, icono) VALUES
('Usuarios', '/config/usuarios', 5, 1, 'people'),
('Roles y Permisos', '/config/roles', 5, 2, 'security'),
('Métodos de Pago', '/config/metodos-pago', 5, 3, 'payment');

-- Permisos para ADMINISTRADOR (acceso total)
INSERT INTO roles_formularios (id_rol, id_formulario)
SELECT 1, id_formulario FROM formularios;

-- Permisos para VENDEDOR
INSERT INTO roles_formularios (id_rol, id_formulario) VALUES
(2, 1),  -- Dashboard
(2, 2),  -- Ventas (módulo)
(2, 6),  -- Nueva Venta
(2, 7),  -- Historial Ventas
(2, 8),  -- Fiados Pendientes
(2, 9),  -- Registrar Abono
(2, 3),  -- Inventario (módulo)
(2, 10); -- Productos (consulta)

-- Permisos para BODEGUERO
INSERT INTO roles_formularios (id_rol, id_formulario) VALUES
(3, 1),  -- Dashboard
(3, 3),  -- Inventario (módulo)
(3, 10), -- Productos
(3, 11), -- Categorías
(3, 12); -- Unidades

-- Categorías
INSERT INTO categorias (nombre, descripcion) VALUES
('Suplementos', 'Proteínas, creatinas, aminoácidos'),
('Bebidas', 'Bebidas energéticas, isotónicas, jugos'),
('Snacks', 'Barras energéticas, frutos secos'),
('Accesorios', 'Guantes, correas, shakers'),
('Ropa', 'Camisetas, shorts, medias');

-- Unidades de medida
INSERT INTO unidades_medida (nombre, abreviatura, descripcion) VALUES
('Unidad', 'UND', 'Artículo individual'),
('Kilogramo', 'KG', 'Medida de peso'),
('Gramo', 'GR', 'Medida de peso pequeña'),
('Litro', 'LT', 'Medida de volumen'),
('Mililitro', 'ML', 'Medida de volumen pequeña');

-- Métodos de pago
INSERT INTO metodos_pago (nombre, descripcion) VALUES
('Efectivo', 'Pago en efectivo'),
('Tarjeta Débito', 'Pago con tarjeta débito'),
('Tarjeta Crédito', 'Pago con tarjeta de crédito'),
('Transferencia', 'Transferencia bancaria'),
('Nequi', 'Pago por Nequi'),
('Daviplata', 'Pago por Daviplata');

-- Productos de ejemplo (opcional)
INSERT INTO productos (nombre, descripcion, id_categoria, id_unidad, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_barras) VALUES
('Proteína Whey 2lb', 'Proteína de suero de leche sabor chocolate', 1, 1, 80000, 120000, 15, 5, '7501234567890'),
('Creatina 300g', 'Creatina monohidratada pura', 1, 1, 45000, 70000, 20, 5, '7501234567891'),
('Gatorade 500ml', 'Bebida isotónica sabor naranja', 2, 1, 2500, 4000, 50, 10, '7501234567892'),
('Barra Proteica', 'Barra energética con 20g de proteína', 3, 1, 3000, 5000, 30, 10, '7501234567893'),
('Guantes Gym', 'Guantes para entrenamiento con pesas', 4, 1, 15000, 25000, 10, 3, '7501234567894');

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE usuarios IS 'Usuarios del sistema con autenticación JWT';
COMMENT ON TABLE roles IS 'Roles con acceso a diferentes módulos';
COMMENT ON TABLE formularios IS 'Menú dinámico del sistema';
COMMENT ON TABLE roles_formularios IS 'Permisos simples: si existe = acceso completo';
COMMENT ON TABLE productos IS 'Catálogo de productos del gimnasio';
COMMENT ON TABLE ventas IS 'Registro de ventas normales y fiadas';
COMMENT ON TABLE ventas_pagos IS 'Pagos mixtos y abonos de ventas';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

SELECT 'Base de datos inicializada correctamente ✅' AS mensaje;