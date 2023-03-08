const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'web_disk',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

async function query(sql, params) {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query(sql, params);
        return rows;
    } finally {
        connection.release();
    }
}

module.exports = { pool, query }; 
