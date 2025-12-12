const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dbConfig = require('../config/db');
const authMiddleware = require('../authMiddleware');
const multer = require('multer');
const path = require('path');

// 프로필 이미지 업로드 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// 1. 회원가입
router.post('/signup', async (req, res) => {
    let connection;
    try {
        const { email, password, name } = req.body;
        connection = await mysql.createConnection(dbConfig);
        
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

// 2. 로그인 (🚨 여기가 수정된 부분입니다!)
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
        
        // 🚨 중요: 여기서 user 정보를 같이 보내줘야 프론트엔드 경고가 사라집니다!
        res.json({ 
            message: '로그인 성공', 
            token, 
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email,
                profile_image: user.profile_image 
            } 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    } finally {
        if (connection) await connection.end();
    }
});

// 3. 내 프로필 조회
router.get('/profile', authMiddleware, async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT id, name, email, profile_image FROM users WHERE id = ?', [req.user.userId]);
        if (users.length === 0) return res.status(404).json({ message: '유저 없음' });
        
        res.json({ user: users[0] });
    } catch (error) {
        res.status(500).json({ message: '서버 에러' });
    } finally {
        if (connection) await connection.end();
    }
});

// 4. 프로필 이미지 업로드
router.post('/profile-image', authMiddleware, upload.single('image'), async (req, res) => {
    let connection;
    try {
        if (!req.file) return res.status(400).json({ message: '파일 없음' });
        
        const imageUrl = `uploads/${req.file.filename}`;
        connection = await mysql.createConnection(dbConfig);
        
        await connection.execute('UPDATE users SET profile_image = ? WHERE id = ?', [imageUrl, req.user.userId]);
        
        res.json({ message: '업로드 성공', profileImage: imageUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '업로드 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

module.exports = router;