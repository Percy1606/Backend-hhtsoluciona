const mysql = require('mysql2/promise');

async function moverActividadesArianaATrabajadores() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'hh_user',
    password: 'HHT2026Segura',
    database: 'software_hh_db'
  });

  try {
    await connection.execute(
      `UPDATE tarea_estrategica 
       SET etapaProceso = 'TRABAJADORES' 
       WHERE id IN ('task-ariana-1', 'task-ariana-2', 'task-ariana-3', 'task-ariana-4')`
    );
    console.log('✅ Las 4 actividades de Ariana han sido movidas exitosamente a la Agenda de Trabajadores!');
  } catch (err) {
    console.error('Error moviendo tareas:', err);
  } finally {
    await connection.end();
  }
}

moverActividadesArianaATrabajadores();
