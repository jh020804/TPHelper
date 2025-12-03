const mysql = require('mysql2/promise');
const dbConfig = require('../config/db');

// 내 프로젝트 목록 (Active)
exports.getProjects = async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const sql = `
            SELECT p.id, p.name 
            FROM projects p
            JOIN project_members pm ON p.id = pm.project_id
            WHERE pm.user_id = ? AND pm.status = 'active'
        `;
        const [projects] = await connection.execute(sql, [req.user.userId]);
        await connection.end();
        res.status(200).json({ projects });
    } catch (error) {
        res.status(500).json({ message: '서버 에러' });
    }
};

// 프로젝트 생성
exports.createProject = async (req, res) => {
    try {
        const { name } = req.body;
        const ownerId = req.user.userId;
        const connection = await mysql.createConnection(dbConfig);
        
        await connection.beginTransaction();
        const [result] = await connection.execute('INSERT INTO projects (name, owner_id) VALUES (?, ?)', [name, ownerId]);
        const newProjectId = result.insertId;
        await connection.execute('INSERT INTO project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)', [newProjectId, ownerId, 'owner', 'active']);
        await connection.commit();
        await connection.end();
        
        res.status(201).json({ projectId: newProjectId, projectName: name });
    } catch (error) {
        res.status(500).json({ message: '서버 에러' });
    }
};

// 프로젝트 상세 조회
exports.getProjectDetails = async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;
        connection = await mysql.createConnection(dbConfig);

        const [memberRows] = await connection.execute('SELECT * FROM project_members WHERE project_id = ? AND user_id = ? AND status = "active"', [projectId, userId]);
        if (memberRows.length === 0) return res.status(403).json({ message: '권한이 없습니다.' });

        const [pRes] = await connection.execute('SELECT id, name, owner_id FROM projects WHERE id = ?', [projectId]);
        
        // Tasks 조회 (담당자 이름, 기한 포함)
        const tasksSql = `
            SELECT t.id, t.content, t.status, t.due_date, u.name as assignee_name
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE t.project_id = ?
        `;
        const [tRes] = await connection.execute(tasksSql, [projectId]);
        
        // Members 조회
        const membersSql = `
            SELECT u.id, u.name, u.email 
            FROM project_members pm 
            JOIN users u ON pm.user_id = u.id 
            WHERE pm.project_id = ? AND pm.status = 'active'
        `;
        const [mRes] = await connection.execute(membersSql, [projectId]);

        res.status(200).json({ details: { project: pRes[0], tasks: tRes, members: mRes } });
    } catch (error) {
        res.status(500).json({ message: '서버 에러' });
    } finally {
        if (connection) await connection.end();
    }
};

// 프로젝트 삭제
exports.deleteProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;
        const connection = await mysql.createConnection(dbConfig);
        
        const [rows] = await connection.execute('SELECT owner_id FROM projects WHERE id = ?', [projectId]);
        if (rows.length === 0) { await connection.end(); return res.status(404).json({message:'없음'}); }
        
        if (rows[0].owner_id !== userId) { await connection.end(); return res.status(403).json({message:'권한 없음'}); }
        
        await connection.execute('DELETE FROM projects WHERE id = ?', [projectId]);
        await connection.end();
        res.status(200).json({ message: '삭제 성공' });
    } catch (error) { res.status(500).json({ message: '서버 에러' }); }
};

// 팀원 초대
exports.inviteMember = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { email } = req.body;
        const connection = await mysql.createConnection(dbConfig);
        
        const [uRows] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (uRows.length === 0) { await connection.end(); return res.status(404).json({message: '유저 없음'}); }
        const inviteeId = uRows[0].id;

        await connection.execute('INSERT INTO project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)', [projectId, inviteeId, 'member', 'pending']);
        await connection.end();
        res.status(200).json({ message: '초대 성공' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: '이미 초대됨' });
        res.status(500).json({ message: '서버 에러' });
    }
};