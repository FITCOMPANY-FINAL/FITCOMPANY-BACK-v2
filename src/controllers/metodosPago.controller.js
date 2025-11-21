import db from '../config/db.js';

// ========== HELPERS ==========

/**
 * Normalizar espacios en strings
 */
const collapseSpaces = (s) =>
  typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '';

/**
 * Verificar si un nombre de método de pago ya existe (canónico)
 * Ignora mayúsculas y espacios
 */
async function existeNombreCanonico(nombre, excludeId = null) {
  const nombreLimpio = nombre.toLowerCase().replace(/\s+/g, '');

  let query = db('metodos_pago')
    .whereRaw(`LOWER(REPLACE(nombre_metodo_pago, ' ', '')) = ?`, [nombreLimpio])
    .where('activo', true);

  if (excludeId) {
    query = query.whereNot('id_metodo_pago', excludeId);
  }

  const resultado = await query.first();
  return !!resultado;
}

// ========== ENDPOINTS ==========

/**
 * GET /api/metodos-pago
 * Listar todos los métodos de pago activos
 */
export const listarMetodosPago = async (req, res) => {
  try {
    const metodos = await db('metodos_pago')
      .select('*')
      .where('activo', true)
      .orderBy('nombre_metodo_pago');

    res.json(metodos);
  } catch (error) {
    console.error('Error al listar métodos de pago:', error);
    res.status(500).json({ message: 'Error al listar métodos de pago.' });
  }
};

/**
 * POST /api/metodos-pago
 * Crear un nuevo método de pago
 */
export const crearMetodoPago = async (req, res) => {
  const { nombre_metodo_pago, descripcion_metodo_pago } = req.body;

  // Validar nombre
  const nombreNormalizado = collapseSpaces(nombre_metodo_pago);

  if (!nombreNormalizado) {
    return res.status(400).json({ message: 'El nombre del método de pago es obligatorio.' });
  }

  if (nombreNormalizado.length > 50) {
    return res.status(400).json({ message: 'El nombre del método de pago no puede superar 50 caracteres.' });
  }

  try {
    // Verificar unicidad canónica
    if (await existeNombreCanonico(nombreNormalizado)) {
      return res.status(409).json({
        message: 'Ya existe un método de pago con ese nombre.'
      });
    }

    // Crear método de pago
    const [nuevoMetodo] = await db('metodos_pago')
      .insert({
        nombre_metodo_pago: nombreNormalizado,
        descripcion_metodo_pago: descripcion_metodo_pago || null,
        activo: true
      })
      .returning('*');

    console.log(`✅ Método de pago creado: ${nuevoMetodo.nombre_metodo_pago} (ID: ${nuevoMetodo.id_metodo_pago})`);

    res.status(201).json({
      message: 'Método de pago creado correctamente.',
      metodo_pago: nuevoMetodo
    });
  } catch (error) {
    console.error('Error al crear método de pago:', error);
    res.status(500).json({ message: 'Error al crear método de pago.' });
  }
};

/**
 * PUT /api/metodos-pago/:id
 * Actualizar un método de pago
 */
export const actualizarMetodoPago = async (req, res) => {
  const { id } = req.params;
  const { nombre_metodo_pago, descripcion_metodo_pago } = req.body;

  // Validar nombre
  const nombreNormalizado = collapseSpaces(nombre_metodo_pago);

  if (!nombreNormalizado) {
    return res.status(400).json({ message: 'El nombre del método de pago es obligatorio.' });
  }

  if (nombreNormalizado.length > 50) {
    return res.status(400).json({ message: 'El nombre del método de pago no puede superar 50 caracteres.' });
  }

  try {
    // Verificar que existe
    const metodoExistente = await db('metodos_pago')
      .where('id_metodo_pago', id)
      .where('activo', true)
      .first();

    if (!metodoExistente) {
      return res.status(404).json({ message: 'Método de pago no encontrado.' });
    }

    // Verificar unicidad canónica (excluyendo el propio registro)
    if (await existeNombreCanonico(nombreNormalizado, id)) {
      return res.status(409).json({
        message: 'Ya existe un método de pago con ese nombre.'
      });
    }

    // Actualizar
    const [metodoActualizado] = await db('metodos_pago')
      .where('id_metodo_pago', id)
      .update({
        nombre_metodo_pago: nombreNormalizado,
        descripcion_metodo_pago: descripcion_metodo_pago || null
      })
      .returning('*');

    console.log(`✅ Método de pago actualizado: ${metodoActualizado.nombre_metodo_pago}`);

    res.json({
      message: 'Método de pago actualizado correctamente.',
      metodo_pago: metodoActualizado
    });
  } catch (error) {
    console.error('Error al actualizar método de pago:', error);
    res.status(500).json({ message: 'Error al actualizar método de pago.' });
  }
};

/**
 * DELETE /api/metodos-pago/:id
 * Eliminar (soft delete) un método de pago
 */
export const eliminarMetodoPago = async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar que existe
    const metodo = await db('metodos_pago')
      .where('id_metodo_pago', id)
      .where('activo', true)
      .first();

    if (!metodo) {
      return res.status(404).json({ message: 'Método de pago no encontrado.' });
    }

    // Verificar si está siendo usado en ventas_pagos
    const usosEnVentas = await db('ventas_pagos')
      .where('id_metodo_pago', id)
      .count('* as total')
      .first();

    const totalUsos = parseInt(usosEnVentas.total) || 0;

    if (totalUsos > 0) {
      return res.status(409).json({
        message: `No se puede eliminar el método de pago porque está asociado a ${totalUsos} pago(s) de ventas.`,
        usos: totalUsos
      });
    }

    // Soft delete (cambiar activo a false)
    await db('metodos_pago')
      .where('id_metodo_pago', id)
      .update({ activo: false });

    console.log(`✅ Método de pago eliminado (soft delete): ${metodo.nombre_metodo_pago} (ID: ${id})`);

    res.json({ message: 'Método de pago eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar método de pago:', error);

    // Error de constraint FK (aunque ya validamos arriba)
    if (error.code === '23503') {
      return res.status(409).json({
        message: 'No se puede eliminar el método de pago porque está siendo usado en ventas.'
      });
    }

    res.status(500).json({ message: 'Error al eliminar método de pago.' });
  }
};
