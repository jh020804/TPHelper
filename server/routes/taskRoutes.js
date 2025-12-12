const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authMiddleware = require('../authMiddleware');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const dbConfig = require('../config/db');

// 파일 업로드 설정 (uploads 폴더가 없으면 생성)
try {
    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads');
    }
} catch (err) {
    console.error(err);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    // 한글 파일명 깨짐 방지 처리
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Buffer.from(file.originalname, 'latin1').toString('utf8'))
});
const upload = multer({ storage });

// 1. 업무 상세 정보 수정 (내용, 마감일, 담당자, 상태)
router.patch('/:taskId', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { taskId } = req.params;
        const { content, status, due_date, assignee_id } = req.body;

        connection = await mysql.createConnection(dbConfig);
        
        await connection.execute(
            `UPDATE tasks 
             SET content = ?, status = ?, due_date = ?, assignee_id = ? 
             WHERE id = ?`,
            [content, status, due_date || null, assignee_id || null, taskId]
        );

        res.json({ message: '업무 업데이트 성공' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '업무 수정 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 2. 파일 업로드
router.post('/:taskId/files', authMiddleware, upload.single('file'), async (req, res) => {
    let connection;
    try {
        const { taskId } = req.params;
        const file = req.file;
        
        if (!file) return res.status(400).json({ message: '파일이 없습니다.' });

        const fileUrl = `uploads/${file.filename}`;
        
        connection = await mysql.createConnection(dbConfig);
        await connection.execute(
            'INSERT INTO task_attachments (task_id, file_url, original_name) VALUES (?, ?, ?)',
            [taskId, fileUrl, file.originalname]
        );

        res.status(201).json({ message: '파일 업로드 성공', fileUrl, originalName: file.originalname });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '파일 업로드 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 3. 첨부파일 목록 조회
router.get('/:taskId/files', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { taskId } = req.params;
        connection = await mysql.createConnection(dbConfig);
        const [files] = await connection.execute('SELECT * FROM task_attachments WHERE task_id = ? ORDER BY uploaded_at DESC', [taskId]);
        res.json({ files });
    } catch (error) {
        res.status(500).json({ message: '파일 로드 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 4. 업무 삭제 (🗑️ 추가된 기능)
router.delete('/:taskId', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { taskId } = req.params;
        connection = await mysql.createConnection(dbConfig);
        
        // 데이터베이스에서 해당 업무 삭제
        await connection.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
        
        res.json({ message: '삭제 성공' });
    } catch (error) {
        console.error('Delete Task Error:', error);
        res.status(500).json({ message: '삭제 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

module.exports = router;