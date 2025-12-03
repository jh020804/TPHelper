const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dbConfig = require('../config/db');

// 회원가입
exports.signup = async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password || !name) return res.status(400).json({ message: '모든 정보를 입력해주세요.' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const connection = await mysql.createConnection(dbConfig);
        
        const sql = 'INSERT INTO users (email, password, name) VALUES (?, ?, ?)';
        const [result] = await connection.execute(sql, [email, hashedPassword, name]);
        await connection.end();
        
        res.status(201).json({ userId: result.insertId, email, name });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' });
        console.error('Signup Error:', error);
        res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
};

// 로그인
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' });
        
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        if (rows.length === 0) {
            await connection.end();
            return res.status(401).json({ message: '인증 실패' });
        }
        
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            await connection.end();
            return res.status(401).json({ message: '인증 실패' });
        }
        
        const token = jwt.sign({ userId: user.id, name: user.name, email: user.email }, 'YOUR_SECRET_KEY', { expiresIn: '1h' });
        await connection.end();
        
        res.status(200).json({ message: '로그인 성공!', token });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: '서버 에러' });
    }
};

// 프로필 조회
exports.getProfile = async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT id, email, name, profile_image FROM users WHERE id = ?', [req.user.userId]);
        await connection.end();
        
        if (rows.length === 0) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        
        res.status(200).json({ user: rows[0] });
    } catch (error) {
        res.status(500).json({ message: '서버 에러' });
    }
};

// 프로필 이미지 업로드
exports.updateProfileImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });
        
        const userId = req.user.userId;
        const fileUrl = req.file.path.replace(/\\/g, "/"); 

        const connection = await mysql.createConnection(dbConfig);
        await connection.execute('UPDATE users SET profile_image = ? WHERE id = ?', [fileUrl, userId]);
        await connection.end();

        res.status(200).json({ message: '업데이트 완료', profileImage: fileUrl });
    } catch (error) {
        console.error('Profile Upload Error:', error);
        res.status(500).json({ message: '서버 에러' });
    }
};