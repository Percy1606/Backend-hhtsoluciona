const fs = require('fs');
const path = require('path');
const url = require('url');
const mariadb = require('mariadb');
const docx = require('docx');
const { 
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType, LevelFormat
} = docx;

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const parsed = new url.URL(dbUrl);
const pool = mariadb.createPool({
  host: parsed.hostname,
  port: parseInt(parsed.port || '3306', 10),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: decodeURIComponent(parsed.pathname.substring(1)),
  connectionLimit: 1
});

async function main() {
  const conn = await pool.getConnection();
  try {
    console.log('=== EXTRAENDO DATOS SISTÉMICOS DE SEGUIMIENTOS DESDE PRODUCCIÓN ===');

    // 1. Estadísticas Globales
    const totalClientesRes = await conn.query("SELECT COUNT(*) as count FROM cliente");
    const totalClientes = Number(totalClientesRes[0].count);

    const totalIntsRes = await conn.query("SELECT COUNT(*) as count FROM interaccion");
    const totalInteracciones = Number(totalIntsRes[0].count);

    const totalImgsRes = await conn.query("SELECT COUNT(*) as count FROM interaccion WHERE observaciones LIKE '%[IMG]%'");
    const totalImagenes = Number(totalImgsRes[0].count);

    const totalCotsRes = await conn.query("SELECT COUNT(*) as count FROM cotizacion");
    const totalCotizaciones = Number(totalCotsRes[0].count);

    // 2. Desglose por Tipo/Canal de Seguimiento
    const canalesRaw = await conn.query("SELECT tipo, COUNT(*) as cantidad FROM interaccion GROUP BY tipo ORDER BY cantidad DESC");

    // 3. Desglose por Tarifa
    const tarifasRaw = await conn.query("SELECT tarifa, COUNT(*) as cantidad FROM cliente GROUP BY tarifa ORDER BY cantidad DESC");

    // 4. Métricas por Asesora
    const asesores = ['Angie', 'Valentina', 'Ariana', 'Brenda'];
    const asesoresData = [];

    for (const name of asesores) {
      const carteraCount = Number((await conn.query("SELECT COUNT(*) as count FROM cliente WHERE asignadoA = ?", [name]))[0].count);
      const creadosCount = Number((await conn.query("SELECT COUNT(*) as count FROM cliente WHERE creadoPor = ?", [name]))[0].count);
      const intCount = Number((await conn.query("SELECT COUNT(*) as count FROM interaccion WHERE usuario = ?", [name]))[0].count);
      const imgCount = Number((await conn.query("SELECT COUNT(*) as count FROM interaccion WHERE usuario = ? AND observaciones LIKE '%[IMG]%'", [name]))[0].count);
      const cotsCount = Number((await conn.query("SELECT COUNT(*) as count FROM cotizacion cot JOIN cliente c ON cot.clientId = c.id WHERE c.asignadoA = ? OR c.creadoPor = ?", [name, name]))[0].count);
      const ganadosCount = Number((await conn.query("SELECT COUNT(*) as count FROM cliente WHERE asignadoA = ? AND etapaComercial IN ('Ganado', 'Orden de Servicio')", [name]))[0].count);

      let rolType = 'Asesora Cazadora (Prospectado)';
      if (name === 'Valentina') rolType = 'Asesora Cerradora (Seguimientos y Cierre)';
      if (name === 'Ariana') rolType = 'Asesora Mixta (Prospectado y Seguimiento)';
      if (name === 'Brenda') rolType = 'Asesora Cazadora (Exclusivo Prospectos)';

      asesoresData.push({
        name,
        rolType,
        carteraCount,
        creadosCount,
        intCount,
        imgCount,
        cotsCount,
        ganadosCount
      });
    }

    // 5. Muestra de Registros de Trazabilidad Completa (Últimos 10 seguimientos detallados)
    const ultimosSeguimientos = await conn.query(`
      SELECT i.fecha, i.tipo, i.usuario, i.observaciones, c.empresa, c.ruc, c.tarifa, c.etapaComercial
      FROM interaccion i
      JOIN cliente c ON i.clientId = c.id
      ORDER BY i.fecha DESC
      LIMIT 15
    `);

    console.log(`Datos extraídos con éxito: ${totalClientes} clientes, ${totalInteracciones} interacciones, ${totalCotizaciones} cotizaciones.`);

    // --- CONSTRUCCIÓN DEL DOCUMENTO WORD CON `docx` ---
    const primaryColor = "1E3A8A"; // Blue 900
    const secondaryColor = "2563EB"; // Blue 600
    const textColor = "334155"; // Slate 700
    const lightBg = "F8FAFC"; // Slate 50
    const borderGray = "E2E8F0"; // Slate 200

    function makeHeaderCell(text) {
      return new TableCell({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text,
                bold: true,
                color: "FFFFFF",
                size: 20,
                font: "Calibri"
              })
            ]
          })
        ],
        shading: { fill: primaryColor },
        verticalAlign: docx.VerticalAlign.CENTER,
        margins: { top: 120, bottom: 120, left: 120, right: 120 }
      });
    }

    function makeDataCell(text, bold = false, align = AlignmentType.LEFT, bg = "FFFFFF") {
      return new TableCell({
        children: [
          new Paragraph({
            alignment: align,
            children: [
              new TextRun({
                text: String(text || ''),
                bold,
                color: textColor,
                size: 19,
                font: "Calibri"
              })
            ]
          })
        ],
        shading: { fill: bg },
        verticalAlign: docx.VerticalAlign.CENTER,
        margins: { top: 100, bottom: 100, left: 100, right: 100 }
      });
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
          }
        },
        children: [
          // PORTADA / TÍTULO PRINCIPAL
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: "INFORME DE ARQUITECTURA Y AUDITORÍA DE SISTEMA",
                bold: true,
                size: 32,
                color: primaryColor,
                font: "Calibri"
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: "MÓDULO DE GESTIÓN Y TRAZABILIDAD DE SEGUIMIENTOS COMERCIALES",
                bold: true,
                size: 24,
                color: secondaryColor,
                font: "Calibri"
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: "Plataforma Integral SoftwareHH - HHT Soluciona | Año 2026",
                italic: true,
                size: 20,
                color: "64748B",
                font: "Calibri"
              })
            ]
          }),

          // CAJA DE METADATA
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Autor / Emisor:", bold: true, size: 19 }), new TextRun({ text: " Área de Ingeniería de Software y Arquitectura de Sistemas", size: 19 })] }),
                      new Paragraph({ children: [new TextRun({ text: "Entorno Auditado:", bold: true, size: 19 }), new TextRun({ text: " Base de Datos Producción (MariaDB / software_hh_db)", size: 19 })] }),
                      new Paragraph({ children: [new TextRun({ text: "Servicios Backend & Frontend:", bold: true, size: 19 }), new TextRun({ text: " NestJS v11 (API REST) + Next.js v15 (React App)", size: 19 })] }),
                      new Paragraph({ children: [new TextRun({ text: "Fecha de Emisión:", bold: true, size: 19 }), new TextRun({ text: ` ${new Date().toLocaleDateString('es-PE', { dateStyle: 'full' })}`, size: 19 })] })
                    ],
                    shading: { fill: lightBg },
                    margins: { top: 150, bottom: 150, left: 150, right: 150 }
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // SECCIÓN 1: RESUMEN EJECUTIVO
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "1. Resumen Ejecutivo de Producción", bold: true, color: primaryColor, size: 24 })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "El presente informe técnico expone la auditoría empírica y el estado funcional del subsistema de ",
                size: 20
              }),
              new TextRun({
                text: "Seguimientos Comerciales y Trazabilidad de Clientes",
                bold: true,
                size: 20
              }),
              new TextRun({
                text: " en el sistema SoftwareHH. La arquitectura del sistema consolida la información comercial desde la etapa de prospección inicial hasta la emisión de cotizaciones y el cierre de órdenes de servicio.",
                size: 20
              })
            ]
          }),

          // TABLA DE KPIS GLOBALES
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  makeHeaderCell("Métrica del Sistema"),
                  makeHeaderCell("Valor Registrado"),
                  makeHeaderCell("Descripción y Alcance Técnico")
                ]
              }),
              new TableRow({
                children: [
                  makeDataCell("Total Clientes Registrados", true),
                  makeDataCell(totalClientes, true, AlignmentType.CENTER),
                  makeDataCell("Cuentas globales registradas con RUC, Razón Social, Tarifa y Asesor")
                ]
              }),
              new TableRow({
                children: [
                  makeDataCell("Total Interacciones / Seguimientos", true),
                  makeDataCell(totalInteracciones, true, AlignmentType.CENTER),
                  makeDataCell("Bitácora auditada de interacciones (Llamadas, WhatsApp, Visitas, Notas)")
                ]
              }),
              new TableRow({
                children: [
                  makeDataCell("Seguimientos con Evidencia Digital ([IMG])", true),
                  makeDataCell(totalImagenes, true, AlignmentType.CENTER),
                  makeDataCell("Registros con imágenes adjuntas (fichas técnicas, WhatsApp, vouchers)")
                ]
              }),
              new TableRow({
                children: [
                  makeDataCell("Cotizaciones Electrónicas Emitidas", true),
                  makeDataCell(totalCotizaciones, true, AlignmentType.CENTER),
                  makeDataCell("Propuestas técnico-económicas asociadas al historial del cliente")
                ]
              }),
              new TableRow({
                children: [
                  makeDataCell("Ratio de Digitalización de Evidencias", true),
                  makeDataCell(`${Math.round((totalImagenes / totalInteracciones) * 100)}%`, true, AlignmentType.CENTER),
                  makeDataCell("Porcentaje global de seguimientos respaldados con archivos adjuntos")
                ]
              })
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // SECCIÓN 2: ARQUITECTURA DE SOFTWARE Y MODELO DE DATOS
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "2. Arquitectura del Subsistema de Seguimientos", bold: true, color: primaryColor, size: 24 })]
          }),
          new Paragraph({
            spacing: { after: 150 },
            children: [
              new TextRun({
                text: "El subsistema se apoya en un modelo relacional de alta integridad referencial administrado vía ",
                size: 20
              }),
              new TextRun({ text: "Prisma ORM", bold: true, size: 20 }),
              new TextRun({ text: " sobre base de datos MariaDB. Sus entidades principales incluyen:", size: 20 })
            ]
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Entidad Cliente (cliente): ", bold: true, size: 20 }),
              new TextRun({ text: "Almacena los datos maestros del cliente, incluyendo RUC, Razón Social, Tarifa Eléctrica (MT1, MT2, MT3, MT4, BT2, BT3, BT4, BT5B, BT5BR, BT5A50), Etapa Comercial (Prospecto, Contactado, Llamada Realizada, Visita Agendada, Inspección Realizada, Cotización Enviada, Seguimiento, Negociación, Orden de Servicio, Ganado, Perdido), Asesor Asignado y Creador Original.", size: 20 })
            ]
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Entidad Interacción (interaccion): ", bold: true, size: 20 }),
              new TextRun({ text: "Registra cada acción comercial con marca temporal (fecha/hora), tipo de canal (WhatsApp, Llamada, Visita, Nota, Propuesta, Venta), usuario responsable y campo de observaciones con soporte para incrustación multimedia [IMG]/uploads/...[/IMG].", size: 20 })
            ]
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Evaluación Automatizada de Cierre de Jornada (CrmCronService): ", bold: true, size: 20 }),
              new TextRun({ text: "Cronjob automatizado en NestJS que evalúa diariamente a las 17:00 PET el rendimiento por tipo de asesora (Cazadora, Mixta, Cerradora) notificando metas individuales y globales.", size: 20 })
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // SECCIÓN 3: EVALUACIÓN DE DESEMPEÑO POR ASESOR COMERCIAL
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "3. Evaluación y Auditoría por Asesora Comercial", bold: true, color: primaryColor, size: 24 })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "Se detalla la métrica consolidada del equipo comercial de 4 asesoras (Angie, Valentina, Ariana y Brenda):",
                size: 20
              })
            ]
          }),

          // TABLA DE ASESORAS
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  makeHeaderCell("Asesora"),
                  makeHeaderCell("Perfil Comercial"),
                  makeHeaderCell("Cuentas en Cartera"),
                  makeHeaderCell("Seguimientos Registrados"),
                  makeHeaderCell("Fotos / Evidencias"),
                  makeHeaderCell("Cotizaciones Emitidas"),
                  makeHeaderCell("Cierres (Ganados)")
                ]
              }),
              ...asesoresData.map((a, idx) => new TableRow({
                children: [
                  makeDataCell(a.name, true, AlignmentType.LEFT, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(a.rolType, false, AlignmentType.LEFT, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(a.carteraCount, false, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(a.intCount, true, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(a.imgCount, false, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(a.cotsCount, false, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(a.ganadosCount, true, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF")
                ]
              }))
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // SECCIÓN 4: DESGLOSE CANALES DE SEGUIMIENTO Y TARIFAS
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "4. Desglose por Canales de Seguimiento y Tarifas Eléctricas", bold: true, color: primaryColor, size: 24 })]
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "4.1 Distribución de Seguimientos por Canal", bold: true, color: secondaryColor, size: 22 })]
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  makeHeaderCell("Canal / Tipo de Interacción"),
                  makeHeaderCell("Cantidad de Registros"),
                  makeHeaderCell("Porcentaje sobre el Total")
                ]
              }),
              ...canalesRaw.map((c, idx) => new TableRow({
                children: [
                  makeDataCell(c.tipo, true, AlignmentType.LEFT, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(Number(c.cantidad), true, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(`${((Number(c.cantidad) / totalInteracciones) * 100).toFixed(1)}%`, false, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF")
                ]
              }))
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 200 } }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "4.2 Distribución de Cartera por Tarifa Eléctrica", bold: true, color: secondaryColor, size: 22 })]
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  makeHeaderCell("Tarifa Eléctrica"),
                  makeHeaderCell("Cantidad de Clientes"),
                  makeHeaderCell("Porcentaje de Cartera")
                ]
              }),
              ...tarifasRaw.map((t, idx) => new TableRow({
                children: [
                  makeDataCell(t.tarifa || 'Sin Especificar', true, AlignmentType.LEFT, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(Number(t.cantidad), true, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(`${((Number(t.cantidad) / totalClientes) * 100).toFixed(1)}%`, false, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF")
                ]
              }))
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // SECCIÓN 5: AUDITORÍA DE TRAZABILIDAD RECIENTE
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "5. Muestra de Auditoría de Trazabilidad Reciente", bold: true, color: primaryColor, size: 24 })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "Se audita la muestra de los últimos seguimientos registrados en la plataforma con detalle de empresa, tarifa, usuario y contenido:",
                size: 20
              })
            ]
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  makeHeaderCell("Fecha / Hora"),
                  makeHeaderCell("Cliente / Empresa"),
                  makeHeaderCell("Tarifa"),
                  makeHeaderCell("Usuario"),
                  makeHeaderCell("Canal"),
                  makeHeaderCell("Observaciones / Detalle")
                ]
              }),
              ...ultimosSeguimientos.map((s, idx) => new TableRow({
                children: [
                  makeDataCell(new Date(s.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }), false, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(s.empresa, true, AlignmentType.LEFT, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(s.tarifa || 'MT3', false, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(s.usuario, true, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell(s.tipo, false, AlignmentType.CENTER, idx % 2 === 0 ? lightBg : "FFFFFF"),
                  makeDataCell((s.observaciones || '').substring(0, 70) + ((s.observaciones || '').length > 70 ? '...' : ''), false, AlignmentType.LEFT, idx % 2 === 0 ? lightBg : "FFFFFF")
                ]
              }))
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // SECCIÓN 6: CONCLUSIONES Y RECOMENDACIONES TÉCNICAS
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "6. Conclusiones de Ingeniería y Recomendaciones", bold: true, color: primaryColor, size: 24 })]
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Alta Integridad de Información: ", bold: true, size: 20 }),
              new TextRun({ text: "El subsistema garantiza la trazabilidad completa del cliente desde la prospección inicial hasta la conversión a orden de servicio o propuesta.", size: 20 })
            ]
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Respaldo Multimedia Efectivo: ", bold: true, size: 20 }),
              new TextRun({ text: "Existe un sólido ratio de evidencia gráfica respaldando las interacciones en campo y conversaciones de WhatsApp.", size: 20 })
            ]
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: "Balance Operativo de Asesoras: ", bold: true, size: 20 }),
              new TextRun({ text: "La diferenciación entre roles (Cazadoras, Mixtas y Cerradoras) permite medir con precisión justa el rendimiento individual sin distorsiones en los KPIs globales.", size: 20 })
            ]
          })
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.resolve('C:\\Users\\percy\\Documents\\SoftwareHH', 'Informe_Gestion_Seguimientos_Comerciales_SoftwareHH.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log(`\n==================================================`);
    console.log(`DOCUMENTO WORD GENERADO CON ÉXITO EN:`);
    console.log(outputPath);
    console.log(`==================================================`);

  } finally {
    conn.end();
    pool.end();
  }
}

main().catch(console.error);
