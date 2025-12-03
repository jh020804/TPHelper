const mysql = require('mysql2/promise');
const dbConfig = require('../config/db');
// ‼️ server/index.js에서 io 객체를 가져옵니다 (순환 참조 주의: 함수 내부에서 호출하거나 app.set 사용 권장)
// 여기서는 간단히 전역 io를 가져오거나, 함수 내에서 req.app.get('io') 방식을 쓸 수 있습니다.
// 가장 깔끔한 방법은 index.js에서 app.set('io', io)를 하고, 여기서 req.app.get('io')로 쓰는 것입니다.

// 업무 생성
exports.createTask = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { content, assignee_id, due_date } = req.body;
        
        if (!content) return res.status(400).json({ message: '입력 필요' });

        const connection = await mysql.createConnection(dbConfig);
        const sql = 'INSERT INTO tasks (content, project_id, assignee_id, due_date, status) VALUES (?,?,?,?,?)';
        const [result] = await connection.execute(sql, [content, projectId, assignee_id || null, due_date || null, 'To Do']);
        
        const [nt] = await connection.execute(`
            SELECT t.id, t.content, t.status, t.due_date, u.name as assignee_name 
            FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id 
            WHERE t.id = ?
        `, [result.insertId]);
        await connection.end();
        
        const createdTask = nt[0];
        // ‼️ 소켓 방송 (req.app.get 사용)
        req.app.get('io').to(projectId).emit('taskCreated', createdTask);
        
        res.status(201).json({ task: createdTask });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    }
};

// 업무 목록 조회
exports.getTasks = async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [t] = await connection.execute(`
            SELECT t.id, t.content, t.status, t.due_date, u.name as assignee_name 
            FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id 
            WHERE t.project_id = ?
        `, [req.params.projectId]);
        await connection.end();
        res.status(200).json({ tasks: t });
    } catch (error) {
        res.status(500).json({ message: '서버 에러' });
    }
};

// 업무 수정
exports.updateTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        
        const [tr] = await connection.execute('SELECT project_id FROM tasks WHERE id = ?', [taskId]);
        if (tr.length === 0) { await connection.end(); return res.status(404).json({message:'없음'}); }
        const projectId = String(tr[0].project_id);

        const updates = []; const params = [];
        if (req.body.content) { updates.push('content=?'); params.push(req.body.content); }
        if (req.body.status) { updates.push('status=?'); params.push(req.body.status); }
        if (req.body.due_date !== undefined) { updates.push('due_date=?'); params.push(req.body.due_date || null); }
        if (req.body.assignee_id !== undefined) { updates.push('assignee_id=?'); params.push(req.body.assignee_id || null); }

        if (updates.length > 0) {
            params.push(taskId);
            await connection.execute(`UPDATE tasks SET ${updates.join(', ')} WHERE id=?`, params);
        }

        const [ut] = await connection.execute(`
            SELECT t.id, t.content, t.status, t.due_date, u.name as assignee_name 
            FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id 
            WHERE t.id = ?
        `, [taskId]);
        await connection.end();
        
        const updatedTask = ut[0];
        req.app.get('io').to(projectId).emit('taskUpdated', updatedTask);
        
        res.status(200).json({ task: updatedTask });
    } catch (error) {
        res.status(500).json({ message: '서버 에러' });
    }
};

// 업무 삭제
exports.deleteTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        
        const [tr] = await connection.execute('SELECT project_id FROM tasks WHERE id = ?', [taskId]);
        if (tr.length === 0) { await connection.end(); return res.status(404).json({message:'없음'}); }
        const projectId = String(tr[0].project_id);

        await connection.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
        await connection.end();
        
        req.app.get('io').to(projectId).emit('taskDeleted', taskId);
        
        res.status(200).json({ message: '삭제 성공' });
    } catch (error) {
        res.status(500).json({ message: '서버 에러' });
    }
};

// 첨부파일 업로드
exports.uploadTaskFile = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: '파일 없음' });
    try {
        const url = req.file.path.replace(/\\/g, "/");
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute('INSERT INTO task_attachments (task_id, file_url, original_name) VALUES (?, ?, ?)', [req.params.taskId, url, req.file.originalname]);
        await connection.end();
        res.status(200).json({ message: '업로드 성공', file: { file_url: url, original_name: req.file.originalname } });
    } catch (e) { res.status(500).json({ message: '에러' }); }
};

// 첨부파일 목록 조회
exports.getTaskFiles = async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [f] = await connection.execute('SELECT * FROM task_attachments WHERE task_id=?', [req.params.taskId]);
        await connection.end();
        res.status(200).json({ files: f });
    } catch (e) { res.status(500).json({ message: '에러' }); }
};