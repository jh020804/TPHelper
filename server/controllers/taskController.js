const mysql = require('mysql2/promise');
const dbConfig = require('../config/db');

// 업무 생성
exports.createTask = async (req, res) => {
    console.log("🔥 서버가 받은 수정 요청 데이터:", req.body);
    try {
        const { projectId } = req.params;
        // 🚨 수정 1: req.body에서 title을 꺼냅니다.
        const { title, content, assignee_id, due_date } = req.body;
        
        // 🚨 수정 2: 제목(title)이 없으면 에러 처리 (필요에 따라 content 체크는 뺄 수도 있음)
        if (!title) return res.status(400).json({ message: '제목 입력 필요' });

        const connection = await mysql.createConnection(dbConfig);

        // 🚨 수정 3: INSERT 쿼리에 title 컬럼 추가
        const sql = 'INSERT INTO tasks (title, content, project_id, assignee_id, due_date, status) VALUES (?,?,?,?,?,?)';
        
        // 🚨 수정 4: 실행 파라미터에 title 추가
        const [result] = await connection.execute(sql, [title, content || '', projectId, assignee_id || null, due_date || null, 'To Do']);
        
        // 🚨 수정 5: 생성된 데이터 조회 시 title 포함
        const [nt] = await connection.execute(`
            SELECT t.id, t.title, t.content, t.status, t.due_date, u.name as assignee_name 
            FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id 
            WHERE t.id = ?
        `, [result.insertId]);
        await connection.end();
        
        const createdTask = nt[0];
        
        // 소켓 방송
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
        // 🚨 수정 6: 조회 쿼리에 t.title 추가
        const [t] = await connection.execute(`
            SELECT t.id, t.title, t.content, t.status, t.due_date, u.name as assignee_name 
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
        
        // 🚨 수정 7: title 업데이트 로직 추가
        if (req.body.title !== undefined) { updates.push('title=?'); params.push(req.body.title); }
        
        if (req.body.content !== undefined) { updates.push('content=?'); params.push(req.body.content); }
        if (req.body.status) { updates.push('status=?'); params.push(req.body.status); }
        if (req.body.due_date !== undefined) { updates.push('due_date=?'); params.push(req.body.due_date || null); }
        if (req.body.assignee_id !== undefined) { updates.push('assignee_id=?'); params.push(req.body.assignee_id || null); }

        if (updates.length > 0) {
            params.push(taskId);
            await connection.execute(`UPDATE tasks SET ${updates.join(', ')} WHERE id=?`, params);
        }

        // 🚨 수정 8: 수정된 데이터 조회 시 title 포함
        const [ut] = await connection.execute(`
            SELECT t.id, t.title, t.content, t.status, t.due_date, u.name as assignee_name 
            FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id 
            WHERE t.id = ?
        `, [taskId]);
        await connection.end();
        
        const updatedTask = ut[0];
        req.app.get('io').to(projectId).emit('taskUpdated', updatedTask);
        
        res.status(200).json({ task: updatedTask });
    } catch (error) {
        console.error(error); // 에러 확인용 로그 추가
        res.status(500).json({ message: '서버 에러' });
    }
};

// 업무 삭제 (수정 없음)
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

// 첨부파일 업로드 (수정 없음)
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

// 첨부파일 목록 조회 (수정 없음)
exports.getTaskFiles = async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [f] = await connection.execute('SELECT * FROM task_attachments WHERE task_id=?', [req.params.taskId]);
        await connection.end();
        res.status(200).json({ files: f });
    } catch (e) { res.status(500).json({ message: '에러' }); }
};