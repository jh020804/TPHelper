// server/config/db.js
// 1. dotenv 라이브러리 불러오기 (이게 없으면 환경변수 못 읽음)
require('dotenv').config(); 

// 2. DB 설정 객체 (SSL 필수!)
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 4000,
    waitForConnections: true,
    connectionLimit: 10,
    // ⬇️ TiDB는 이 SSL 설정이 없으면 접속 거부합니다 (500 원인)
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
};

module.exports = dbConfig;