const mysql = require('mysql2/promise');
const dbConfig = require('../config/db');

// 업무 수정
exports.updateTask = async (req, res) => {
    let connection;
    try {
        const { taskId } = req.params;
        
        // 🔥🔥 [디버깅 로그] 이 로그는 유지하여 혹시 모를 에러 발생 시 추적을 용이하게 합니다.
        console.log(`[DEBUG] 업무 수정 요청 받음 (ID: ${taskId})`);
        console.log(`[DEBUG] 받은 데이터:`, req.body); 
        console.log(`[DEBUG] 제목(title) 값: "${req.body.title}"`);

        connection = await mysql.createConnection(dbConfig);
        
        // 프로젝트 ID 조회
        const [tr] = await connection.execute('SELECT project_id FROM tasks WHERE id = ?', [taskId]);
        if (tr.length === 0) { 
            await connection.end(); 
            return res.status(404).json({message:'업무를 찾을 수 없습니다.'}); 
        }
        const projectId = String(tr[0].project_id);

        const updates = []; 
        const params = [];
        
        // 제목 업데이트 로직
        if (req.body.title !== undefined) { updates.push('title=?'); params.push(req.body.title); }
        if (req.body.content !== undefined) { updates.push('content=?'); params.push(req.body.content); }
        if (req.body.status) { updates.push('status=?'); params.push(req.body.status); }
        if (req.body.due_date !== undefined) { updates.push('due_date=?'); params.push(req.body.due_date || null); }
        if (req.body.assignee_id !== undefined) { updates.push('assignee_id=?'); params.push(req.body.assignee_id || null); }

        // DB 업데이트 실행
        if (updates.length > 0) {
            params.push(taskId);
            // 🔥🔥 [디버깅 로그] 실제 실행될 SQL 확인
            console.log(`[DEBUG] 실행될 SQL: UPDATE tasks SET ${updates.join(', ')} WHERE id=?`);
            await connection.execute(`UPDATE tasks SET ${updates.join(', ')} WHERE id=?`, params);
        } else {
             console.log(`[DEBUG] 업데이트할 내용이 없습니다.`);
        }

        // 수정된 데이터 조회 (title 포함)
        const [ut] = await connection.execute(`
            SELECT t.id, t.title, t.content, t.status, t.due_date, t.project_id, u.name as assignee_name 
            FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id 
            WHERE t.id = ?
        `, [taskId]);
        
        const updatedTask = ut[0];
        
        // 소켓 전송
        req.app.get('io').to(projectId).emit('taskUpdated', updatedTask);
        
        await connection.end();
        res.status(200).json({ task: updatedTask });

    } catch (error) {
        // 🔥🔥 에러가 난다면 여기에 찍힙니다.
        console.error(`[Task Update Error] 서버 에러 발생:`, error);
        res.status(500).json({ message: '서버 에러' });
    } finally {
         if (connection) await connection.end();
    }
};

// 업무 목록 조회
exports.getTasks = async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        // 조회 쿼리에 t.title 포함
        const [t] = await connection.execute(`
            SELECT t.id, t.title, t.content, t.status, t.due_date, u.name as assignee_name 
            FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id 
            WHERE t.project_id = ?
        `, [req.params.projectId]);
        await connection.end();
        res.status(200).json({ tasks: t });
    } catch (error) {
        console.error('[Get Tasks Error]:', error);
        res.status(500).json({ message: '서버 에러' });
    } finally {
        if (connection) await connection.end();
    }
};

// 업무 삭제
exports.deleteTask = async (req, res) => {
    let connection;
    try {
        const { taskId } = req.params;
        connection = await mysql.createConnection(dbConfig);
        
        const [tr] = await connection.execute('SELECT project_id FROM tasks WHERE id = ?', [taskId]);
        if (tr.length === 0) { await connection.end(); return res.status(404).json({message:'없음'}); }
        const projectId = String(tr[0].project_id);

        await connection.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
        
        req.app.get('io').to(projectId).emit('taskDeleted', taskId);
        
        await connection.end();
        res.status(200).json({ message: '삭제 성공' });
    } catch (error) {
        console.error('[Delete Task Error]:', error);
        res.status(500).json({ message: '서버 에러' });
    } finally {
        if (connection) await connection.end();
    }
};

// 첨부파일 업로드
exports.uploadTaskFile = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: '파일 없음' });
    let connection;
    try {
        const url = req.file.path.replace(/\\/g, "/");
        connection = await mysql.createConnection(dbConfig);
        await connection.execute('INSERT INTO task_attachments (task_id, file_url, original_name) VALUES (?, ?, ?)', [req.params.taskId, url, req.file.originalname]);
        await connection.end();
        res.status(200).json({ message: '업로드 성공', file: { file_url: url, original_name: req.file.originalname } });
    } catch (e) { 
        console.error('[Upload File Error]:', e);
        res.status(500).json({ message: '에러' }); 
    } finally {
        if (connection) await connection.end();
    }
};

// 첨부파일 목록 조회
exports.getTaskFiles = async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [f] = await connection.execute('SELECT * FROM task_attachments WHERE task_id=?', [req.params.taskId]);
        await connection.end();
        res.status(200).json({ files: f });
    } catch (e) { 
        console.error('[Get Files Error]:', e);
        res.status(500).json({ message: '에러' }); 
    } finally {
        if (connection) await connection.end();
    }
};