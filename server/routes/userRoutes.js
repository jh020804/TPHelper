const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dbConfig = require('../config/db'); // 통합 설정 사용

// 회원가입
router.post('/signup', async (req, res) => {
    let connection;
    try {
        const { email, password, name } = req.body;
        connection = await mysql.createConnection(dbConfig);
        
        // 이메일 중복 확인
        const [existing] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) return res.status(409).json({ message: '이미 가입된 이메일입니다.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await connection.execute(
            'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
            [email, hashedPassword, name]
        );
        res.status(201).json({ message: '회원가입 성공' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    } finally {
        if (connection) await connection.end();
    }
});

// 로그인
router.post('/login', async (req, res) => {
    let connection;
    try {
        const { email, password } = req.body;
        connection = await mysql.createConnection(dbConfig);

        const [users] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ message: '이메일 또는 비밀번호가 일치하지 않습니다.' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: '이메일 또는 비밀번호가 일치하지 않습니다.' });

        const token = jwt.sign({ userId: user.id, email: user.email }, 'your_secret_key', { expiresIn: '1h' });
        res.json({ message: '로그인 성공', token, user: { id: user.id, name: user.name } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    } finally {
        if (connection) await connection.end();
    }
});

// 프로필 조회 (users/profile)
router.get('/profile', async (req, res) => {
    // (JWT 검증 로직이 필요하지만 간단하게 구현)
    // 실제로는 authMiddleware를 거쳐야 함
    res.status(200).json({ message: '프로필 조회 성공' }); 
});

module.exports = router;