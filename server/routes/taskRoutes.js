const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authMiddleware = require('../authMiddleware');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const dbConfig = require('../config/db');

// 파일 업로드 설정
try {
    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads');
    }
} catch (err) {
    console.error(err);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Buffer.from(file.originalname, 'latin1').toString('utf8'))
});
const upload = multer({ storage });

// 1. 업무 상세 정보 수정 (PATCH /api/tasks/:taskId)
router.patch('/:taskId', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { taskId } = req.params;
        // 🚨🚨 [핵심 수정 1] req.body에서 title을 받도록 추가
        const { title, content, status, due_date, assignee_id } = req.body;

        // 동적 쿼리 생성 (업데이트할 필드만 처리)
        const updates = [];
        const params = [];

        // 🚨🚨 [핵심 수정 2] title 업데이트 로직 추가
        if (title !== undefined) { 
            updates.push('title = ?'); 
            params.push(title); 
        }
        
        if (content !== undefined) { 
            updates.push('content = ?'); 
            params.push(content); 
        }
        if (status) { 
            updates.push('status = ?'); 
            params.push(status); 
        }
        // null 값 처리를 위해 due_date와 assignee_id도 if(x !== undefined)로 처리
        if (due_date !== undefined) { 
            updates.push('due_date = ?'); 
            params.push(due_date || null); 
        }
        if (assignee_id !== undefined) { 
            updates.push('assignee_id = ?'); 
            params.push(assignee_id || null); 
        }

        if (updates.length === 0) {
            return res.json({ message: '업데이트할 내용이 없습니다.' });
        }
        
        // WHERE 절의 taskId를 params의 마지막에 추가
        params.push(taskId);

        connection = await mysql.createConnection(dbConfig);
        
        // 🚨🚨 [핵심 수정 3] SQL 쿼리 실행
        await connection.execute(
            `UPDATE tasks 
             SET ${updates.join(', ')} 
             WHERE id = ?`,
            params
        );
        
        // 🚨 [추가] 수정 후 클라이언트에게 최신 데이터를 보내거나 소켓을 보내는 로직이 여기에 추가되면 좋습니다.
        // (현재는 TaskModal이 onUpdate를 호출하므로 일단 메시지만 보냅니다.)
        
        res.json({ message: '업무 업데이트 성공' });
        
    } catch (error) {
        console.error('Task Update Error:', error);
        // 에러 로그에 SQL 에러가 찍히도록 console.error를 유지합니다.
        res.status(500).json({ message: '업무 수정 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// 2. 파일 업로드 (router.post('/:taskId/files'))
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
        console.error('File Upload Error:', error);
        res.status(500).json({ message: '파일 업로드 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// 3. 첨부파일 목록 조회 (router.get('/:taskId/files'))
router.get('/:taskId/files', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { taskId } = req.params;
        connection = await mysql.createConnection(dbConfig);
        const [files] = await connection.execute(
            'SELECT * FROM task_attachments WHERE task_id = ? ORDER BY uploaded_at DESC', 
            [taskId]
        );
        res.json({ files });
    } catch (error) {
        console.error('Get Task Files Error:', error);
        res.status(500).json({ message: '파일 로드 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// 4. 업무 삭제 (router.delete('/:taskId'))
router.delete('/:taskId', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { taskId } = req.params;
        connection = await mysql.createConnection(dbConfig);
        await connection.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
        res.json({ message: '삭제 성공' });
    } catch (error) {
        console.error('Delete Task Error:', error);
        res.status(500).json({ message: '삭제 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// 5. 특정 첨부파일 삭제 (router.delete('/files/:attachmentId'))
router.delete('/files/:attachmentId', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { attachmentId } = req.params;
        connection = await mysql.createConnection(dbConfig);

        // 1. 파일 정보 조회 (실제 파일 삭제를 위해 경로 필요)
        const [files] = await connection.execute('SELECT file_url FROM task_attachments WHERE id = ?', [attachmentId]);
        
        if (files.length > 0) {
            const filePath = files[0].file_url;
            // 2. 서버 디스크에서 파일 삭제 (에러나도 DB 삭제는 진행하도록 try-catch 감쌈)
            try {
                // 주의: 배포 환경이 파일 시스템을 지원하는지 확인 필요 (Render는 임시 파일 시스템)
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (err) {
                console.error('File unlink error:', err);
            }
        }

        // 3. DB에서 기록 삭제
        await connection.execute('DELETE FROM task_attachments WHERE id = ?', [attachmentId]);

        res.json({ message: '파일 삭제 성공' });
    } catch (error) {
        console.error('Delete File Error:', error);
        res.status(500).json({ message: '파일 삭제 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

module.exports = router;