// server/routes/projectRoutes.js
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authMiddleware = require('../authMiddleware');

// ✅ DB 설정 직접 입력 (SSL 필수 적용)
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

// -------------------------------------------------------
// 1. 내 프로젝트 목록 조회
// -------------------------------------------------------
router.get('/', authMiddleware, async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            `SELECT p.id, p.name 
             FROM projects p 
             JOIN project_members pm ON p.id = pm.project_id 
             WHERE pm.user_id = ? AND pm.status = 'active'`,
            [req.user.userId]
        );
        res.json({ projects: rows });
    } catch (error) {
        console.error('Projects List Error:', error);
        res.status(500).json({ message: '서버 에러', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// -------------------------------------------------------
// 2. 프로젝트 생성
// -------------------------------------------------------
router.post('/', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { name } = req.body;
        connection = await mysql.createConnection(dbConfig);
        await connection.beginTransaction();

        const [result] = await connection.execute(
            'INSERT INTO projects (name, owner_id) VALUES (?, ?)',
            [name, req.user.userId]
        );
        const projectId = result.insertId;

        await connection.execute(
            'INSERT INTO project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)',
            [projectId, req.user.userId, 'owner', 'active']
        );

        await connection.commit();
        res.status(201).json({ projectId, name });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Create Project Error:', error);
        res.status(500).json({ message: '서버 에러', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// -------------------------------------------------------
// 3. 프로젝트 상세 조회
// -------------------------------------------------------
router.get('/:projectId', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        connection = await mysql.createConnection(dbConfig);
        
        // 권한 확인
        const [members] = await connection.execute(
            'SELECT * FROM project_members WHERE project_id=? AND user_id=? AND status="active"',
            [projectId, req.user.userId]
        );

        if (members.length === 0) {
            return res.status(403).json({ message: '접근 권한이 없습니다.' });
        }

        // 데이터 가져오기
        const [project] = await connection.execute('SELECT * FROM projects WHERE id=?', [projectId]);
        const [tasks] = await connection.execute(
            `SELECT t.*, u.name as assignee_name 
             FROM tasks t 
             LEFT JOIN users u ON t.assignee_id = u.id 
             WHERE t.project_id = ?`, 
            [projectId]
        );
        const [teamMembers] = await connection.execute(
            `SELECT u.id, u.name, u.email 
             FROM project_members pm 
             JOIN users u ON pm.user_id = u.id 
             WHERE pm.project_id = ? AND pm.status = 'active'`,
            [projectId]
        );

        res.json({
            details: {
                project: project[0],
                tasks: tasks,
                members: teamMembers
            }
        });

    } catch (error) {
        console.error('Project Detail Error:', error);
        res.status(500).json({ message: '상세 정보 로드 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// -------------------------------------------------------
// 4. [추가됨] 업무(Task) 생성 (이게 없어서 404 에러!)
// -------------------------------------------------------
router.post('/:projectId/tasks', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        const { content, status, due_date } = req.body; // assignee_id 등 필요시 추가

        connection = await mysql.createConnection(dbConfig);

        await connection.execute(
            'INSERT INTO tasks (project_id, content, status, due_date) VALUES (?, ?, ?, ?)',
            [projectId, content, status || 'To Do', due_date || null]
        );

        // 생성된 태스크 정보를 다시 클라이언트로 보내주면 좋음 (여기선 간단히 메시지만)
        res.status(201).json({ message: '업무 생성 성공' });

    } catch (error) {
        console.error('Create Task Error:', error);
        res.status(500).json({ message: '업무 생성 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// -------------------------------------------------------
// 5. [추가됨] 채팅 메시지 목록 불러오기 (이게 없어서 404 에러!)
// -------------------------------------------------------
router.get('/:projectId/messages', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        connection = await mysql.createConnection(dbConfig);

        const [messages] = await connection.execute(
            `SELECT * FROM chat_messages 
             WHERE project_id = ? 
             ORDER BY timestamp ASC`,
            [projectId]
        );

        res.json({ messages });

    } catch (error) {
        console.error('Chat Messages Error:', error);
        res.status(500).json({ message: '메시지 로드 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

module.exports = router;