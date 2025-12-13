const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authMiddleware = require('../authMiddleware');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const dbConfig = require('../config/db');

// 파일 업로드 설정 (기존과 동일)
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
        const { title, content, status, due_date, assignee_id } = req.body;

        const updates = [];
        const params = [];

        // --- 업데이트 필드 준비 ---
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
        if (due_date !== undefined) { 
            // 🚨 [안정화] 프론트엔드에서 빈 문자열이 오면 null로 처리
            updates.push('due_date = ?'); 
            params.push(due_date || null); 
        }
        if (assignee_id !== undefined) { 
            // 🚨 [안정화] 프론트엔드에서 빈 문자열이 오면 null로 처리
            updates.push('assignee_id = ?'); 
            params.push(assignee_id || null); 
        }

        if (updates.length === 0) {
            // 🚨 [수정] 업데이트할 내용이 없는 경우에도 Task 객체를 다시 보내서 프론트엔드가 상태를 갱신할 수 있게 함 (아래 참조)
        }
        
        params.push(taskId);

        connection = await mysql.createConnection(dbConfig);
        
        // 1. DB 업데이트 실행 (업데이트 내용이 있을 경우에만 실행)
        if (updates.length > 0) {
            await connection.execute(
                `UPDATE tasks 
                 SET ${updates.join(', ')} 
                 WHERE id = ?`,
                params
            );
        }
        
        // 2. 수정된 데이터 조회 및 소켓 전송을 위한 준비
        // TaskModal에서 onUpdate에 전달할 최신 Task 객체를 가져옵니다.
        const [ut] = await connection.execute(`
            SELECT 
                t.id, t.title, t.content, t.status, t.due_date, t.project_id, t.created_at,
                u.name as assignee_name 
            FROM tasks t 
            LEFT JOIN users u ON t.assignee_id = u.id 
            WHERE t.id = ?
        `, [taskId]);

        await connection.end();

        // 🚨 [핵심 수정] 조회 결과(ut)에 필터링을 적용하여 null이나 유효하지 않은 객체를 제거
        const safeTasks = ut.filter(t => t && t.id);
        const updatedTask = safeTasks.length > 0 ? safeTasks[0] : null;

        if (updatedTask) { 
            const projectId = String(updatedTask.project_id);
            
            const io = req.app.get('io');
            
            if (io) {
                // 3. 소켓을 통해 변경 사항 알림 (다른 사용자에게 실시간 반영)
                io.to(projectId).emit('taskUpdated', updatedTask);
                console.log(`[Socket Broadcast] Task ${taskId} updated and broadcasted to room ${projectId}`);
            } else {
                console.warn('[Socket Warning] Socket.io instance not found. Real-time update failed.');
            }
        }
        
        // 🚨 [핵심 수정] 4. 프론트엔드가 즉시 상태를 갱신할 수 있도록 Task 객체를 응답에 포함
        res.json({ 
            message: '업무 업데이트 성공',
            task: updatedTask // <--- 이 task 키가 필수입니다!
        }); 
        
    } catch (error) {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! Task Update 500 에러 발생 (SQL/DB 문제) !!!');
        console.error('!!! 상세 에러:', error.message, '!!!');
        console.error('!!! 에러 객체:', error, '!!!');
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        
        res.status(500).json({ message: '업무 수정 실패', error: error.message });
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                console.error('Error closing connection:', e);
            }
        }
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
        
        // 🚨 [추가] 삭제 후 다른 사용자에게 소켓 알림 (필요한 경우)
        // if (req.app.get('io')) {
        //     req.app.get('io').to(projectId).emit('taskDeleted', taskId);
        // }
        
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
            // 2. 서버 디스크에서 파일 삭제 
            try {
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