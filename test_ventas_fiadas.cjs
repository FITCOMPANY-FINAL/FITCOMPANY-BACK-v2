const http = require("http");

const BASE_URL = "localhost";
const PORT = 3000;

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  console.log("🧪 INICIANDO PRUEBAS DE VENTAS FIADAS");
  console.log("=====================================\n");

  try {
    // PRUEBA 1: Login
    console.log("📝 PRUEBA 1: Login");
    const loginRes = await makeRequest("POST", "/api/login", {
      correo: "fitcompany@gmail.com",
      password: "admin123",
    });

    if (loginRes.status !== 200 || !loginRes.data.token) {
      console.log("❌ Login falló:", loginRes.data);
      return;
    }

    const token = loginRes.data.token;
    console.log("✅ Login exitoso");
    console.log(`   Token: ${token.substring(0, 30)}...`);
    console.log("");

    // PRUEBA 2: Crear venta fiada SIN pago
    console.log("📝 PRUEBA 2: Venta Fiada SIN pago inicial (100% crédito)");
    const ventaFiada1 = await makeRequest(
      "POST",
      "/api/ventas",
      {
        fecha_venta: "2025-11-21",
        cliente_desc: "Juan Pérez - CC 123456789",
        detalles: [{ id_producto: 2, cantidad: 3 }],
        pagos: [],
        observaciones: "TEST: Venta fiada sin pago",
      },
      token,
    );

    console.log("   Status:", ventaFiada1.status);
    if (ventaFiada1.data.venta) {
      const v = ventaFiada1.data.venta;
      console.log("   ✅ Venta creada:");
      console.log("      ID:", v.id_venta);
      console.log("      Tipo:", ventaFiada1.data.tipo_venta);
      console.log("      Es Fiada:", v.es_fiado);
      console.log("      Estado:", v.estado);
      console.log("      Total:", v.total);
      console.log("      Saldo Pendiente:", v.saldo_pendiente);
      console.log("      Cliente:", v.cliente_desc);

      const ventaFiadaId = v.id_venta;
      const saldoTotal = parseFloat(v.saldo_pendiente);

      console.log("");

      // PRUEBA 3: Crear venta fiada CON pago inicial
      console.log("📝 PRUEBA 3: Venta Fiada CON pago inicial");
      const ventaFiada2 = await makeRequest(
        "POST",
        "/api/ventas",
        {
          fecha_venta: "2025-11-21",
          cliente_desc: "María González - CC 987654321",
          detalles: [{ id_producto: 2, cantidad: 2 }],
          pagos: [{ id_metodo_pago: 1, monto: 50000 }],
          observaciones: "TEST: Venta fiada con pago inicial",
        },
        token,
      );

      if (ventaFiada2.data.venta) {
        const v2 = ventaFiada2.data.venta;
        console.log("   ✅ Venta creada:");
        console.log("      Tipo:", ventaFiada2.data.tipo_venta);
        console.log("      Total:", v2.total);
        console.log("      Saldo Pendiente:", v2.saldo_pendiente);
        console.log("      Pagos registrados:", ventaFiada2.data.pagos.length);
      }
      console.log("");

      // PRUEBA 4: Registrar primer abono
      console.log("📝 PRUEBA 4: Registrar PRIMER ABONO");
      const abono1 = await makeRequest(
        "POST",
        `/api/ventas/${ventaFiadaId}/abonos`,
        {
          id_metodo_pago: 1,
          monto: Math.floor(saldoTotal / 3),
          observaciones: "TEST: Primer abono",
        },
        token,
      );

      if (abono1.data.abono) {
        console.log("   ✅ Abono registrado:");
        console.log("      Monto:", abono1.data.abono.monto);
        console.log("      Saldo Anterior:", abono1.data.venta.saldo_anterior);
        console.log("      Saldo Nuevo:", abono1.data.venta.saldo_nuevo);
        console.log("      Estado:", abono1.data.venta.estado);
      }
      console.log("");

      // PRUEBA 5: Registrar segundo abono
      console.log("📝 PRUEBA 5: Registrar SEGUNDO ABONO");
      const saldoActual = parseFloat(abono1.data.venta.saldo_nuevo);
      const abono2 = await makeRequest(
        "POST",
        `/api/ventas/${ventaFiadaId}/abonos`,
        {
          id_metodo_pago: 2,
          monto: Math.floor(saldoActual / 2),
          observaciones: "TEST: Segundo abono",
        },
        token,
      );

      if (abono2.data.abono) {
        console.log("   ✅ Abono registrado:");
        console.log("      Saldo Nuevo:", abono2.data.venta.saldo_nuevo);
        console.log("      Estado:", abono2.data.venta.estado);
      }
      console.log("");

      // PRUEBA 6: Registrar abono FINAL (completar pago)
      console.log("📝 PRUEBA 6: Registrar ABONO FINAL (completar pago)");
      const saldoFinal = parseFloat(abono2.data.venta.saldo_nuevo);
      const abonoFinal = await makeRequest(
        "POST",
        `/api/ventas/${ventaFiadaId}/abonos`,
        {
          id_metodo_pago: 4,
          monto: saldoFinal,
          observaciones: "TEST: Pago final",
        },
        token,
      );

      if (abonoFinal.data.venta) {
        console.log("   ✅ Pago final registrado:");
        console.log("      Saldo Nuevo:", abonoFinal.data.venta.saldo_nuevo);
        console.log("      Estado:", abonoFinal.data.venta.estado);
        console.log(
          "      Estado Cambió:",
          abonoFinal.data.venta.estado_cambio,
        );

        if (abonoFinal.data.venta.estado === "PAGADA") {
          console.log("   🎉 ¡Estado cambió automáticamente a PAGADA!");
        }
      }
      console.log("");

      // PRUEBA 7: Ver historial de pagos
      console.log("📝 PRUEBA 7: Ver historial completo de pagos");
      const detalle = await makeRequest("GET", `/api/ventas/${ventaFiadaId}`);

      if (detalle.data.pagos) {
        console.log("   ✅ Venta consultada:");
        console.log("      Total Pagos:", detalle.data.pagos.length);
        console.log("      Resumen Total:", detalle.data.resumen.total);
        console.log("      Resumen Pagado:", detalle.data.resumen.pagado);
        console.log("      Resumen Pendiente:", detalle.data.resumen.pendiente);
        console.log(
          "      Porcentaje Pagado:",
          detalle.data.resumen.porcentaje_pagado + "%",
        );
      }
      console.log("");

      // PRUEBA 8: Listar ventas fiadas
      console.log("📝 PRUEBA 8: Listar ventas fiadas pendientes");
      const listaFiadas = await makeRequest(
        "GET",
        "/api/ventas/fiadas?estado=PENDIENTE",
      );

      if (listaFiadas.data.ventas) {
        console.log("   ✅ Listado obtenido:");
        console.log(
          "      Total ventas fiadas pendientes:",
          listaFiadas.data.total,
        );
      }
      console.log("");

      // PRUEBA 9: ERROR - Venta simple
      console.log(
        "📝 PRUEBA 9: Crear venta SIMPLE (verificar que no se rompió)",
      );
      const ventaSimple = await makeRequest(
        "POST",
        "/api/ventas",
        {
          fecha_venta: "2025-11-21",
          detalles: [{ id_producto: 2, cantidad: 2 }],
          pagos: [{ id_metodo_pago: 1, monto: 100000 }],
        },
        token,
      );

      if (ventaSimple.data.venta) {
        console.log("   ✅ Venta simple creada:");
        console.log("      Tipo:", ventaSimple.data.tipo_venta);
        console.log("      Es Fiada:", ventaSimple.data.venta.es_fiado);
        console.log("      Estado:", ventaSimple.data.venta.estado);

        // PRUEBA 10: ERROR - Abono a venta simple
        console.log("");
        console.log("📝 PRUEBA 10: ERROR - Intentar abono a venta SIMPLE");
        const errorAbono = await makeRequest(
          "POST",
          `/api/ventas/${ventaSimple.data.venta.id_venta}/abonos`,
          {
            id_metodo_pago: 1,
            monto: 10000,
          },
          token,
        );

        if (errorAbono.status === 400) {
          console.log(
            "   ✅ Error detectado correctamente:",
            errorAbono.data.message,
          );
        }
      }
      console.log("");

      // PRUEBA 11: ERROR - Venta fiada sin cliente
      console.log("📝 PRUEBA 11: ERROR - Venta fiada SIN cliente");
      const errorSinCliente = await makeRequest(
        "POST",
        "/api/ventas",
        {
          fecha_venta: "2025-11-21",
          detalles: [{ id_producto: 2, cantidad: 1 }],
          pagos: [{ id_metodo_pago: 1, monto: 20000 }],
        },
        token,
      );

      if (errorSinCliente.status === 400) {
        console.log(
          "   ✅ Error detectado correctamente:",
          errorSinCliente.data.message,
        );
      }
    } else {
      console.log("❌ Error al crear venta fiada:", ventaFiada1.data);
    }

    console.log("");
    console.log("🎉 PRUEBAS COMPLETADAS");
    console.log("=====================");
  } catch (error) {
    console.error("❌ Error en pruebas:", error.message);
  }
}

runTests();
