// server/routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authMiddleware = require('../authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ✅ DB 설정 직접 입력 (SSL 필수 적용 - 이게 없어서 500 에러 발생!)
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 4000,
    waitForConnections: true,
    connectionLimit: 10,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
};

// 파일 업로드 설정 (uploads 폴더가 없으면 에러 날 수 있으니 체크)
try {
    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads');
    }
} catch (err) {
    console.error(err);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });


// 1. 특정 업무(Task)의 첨부파일 목록 조회 (여기가 500 에러 원인!)
router.get('/:taskId/files', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { taskId } = req.params;
        connection = await mysql.createConnection(dbConfig);
        
        // task_attachments 테이블 조회
        const [files] = await connection.execute(
            'SELECT * FROM task_attachments WHERE task_id = ? ORDER BY uploaded_at DESC',
            [taskId]
        );

        res.json({ files });
    } catch (error) {
        console.error('Get Task Files Error:', error);
        res.status(500).json({ message: '파일 목록 로드 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// 2. 업무 상태 수정 (드래그 앤 드롭 등)
router.patch('/:taskId', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { taskId } = req.params;
        const { status } = req.body; // 'To Do', 'In Progress', 'Done'

        connection = await mysql.createConnection(dbConfig);
        await connection.execute(
            'UPDATE tasks SET status = ? WHERE id = ?',
            [status, taskId]
        );

        res.json({ message: '상태 업데이트 성공' });
    } catch (error) {
        console.error('Update Task Error:', error);
        res.status(500).json({ message: '업무 수정 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 3. 업무 삭제
router.delete('/:taskId', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { taskId } = req.params;
        connection = await mysql.createConnection(dbConfig);
        
        await connection.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
        
        res.json({ message: '업무 삭제 성공' });
    } catch (error) {
        console.error('Delete Task Error:', error);
        res.status(500).json({ message: '업무 삭제 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

module.exports = router;