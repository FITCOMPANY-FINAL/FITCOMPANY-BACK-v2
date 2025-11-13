import oracledb from 'oracledb';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  user: process.env.db_user,
  password: process.env.db_password,
  connectString: process.env.db_connectionString,
};

async function getConnection() {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    console.log('Conexión a Oracle exitosa');
    return connection;
  } catch (error) {
    console.error('❌ Error conectando a Oracle:', error);
    throw error;
  }
}

export { getConnection };
