const mysql = require('mysql2/promise');

/**
 * Create MySQL connection pool
 * Uses environment variables for security
 */
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // Security & stability
  multipleStatements: false,
  timezone: 'Z'
});

/**
 * Verify database connection on startup
 */
(async () => {
  try {
    const connection = await db.getConnection();
    console.log('Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
})();

module.exports = db;
