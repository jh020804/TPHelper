const fs = require('fs');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost', // 배포된 환경(Render)에서는 환경변수 사용, 아니면 로컬
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '[kh3285466]', // 로컬 테스트용 비밀번호
    database: process.env.DB_NAME || 'tphlper_db',
    port: process.env.DB_PORT || 3306,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    },
    connectTimeout: 10000 // 연결 타임아웃 설정
};

module.exports = dbConfig;