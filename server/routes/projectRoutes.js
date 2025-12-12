const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authMiddleware = require('../authMiddleware');
const dbConfig = require('../config/db'); // 통합 설정 사용

// 1. 프로젝트 목록
router.get('/', authMiddleware, async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            `SELECT p.id, p.name FROM projects p 
             JOIN project_members pm ON p.id = pm.project_id 
             WHERE pm.user_id = ? AND pm.status = 'active'`,
            [req.user.userId]
        );
        res.json({ projects: rows });
    } catch (error) {
        res.status(500).json({ message: '목록 로드 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// 2. 프로젝트 생성
router.post('/', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { name } = req.body;
        connection = await mysql.createConnection(dbConfig);
        await connection.beginTransaction();

        const [result] = await connection.execute('INSERT INTO projects (name, owner_id) VALUES (?, ?)', [name, req.user.userId]);
        const projectId = result.insertId;
        await connection.execute('INSERT INTO project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)', [projectId, req.user.userId, 'owner', 'active']);

        await connection.commit();
        res.status(201).json({ projectId, name });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: '생성 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// 3. 프로젝트 상세 조회
router.get('/:projectId', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        connection = await mysql.createConnection(dbConfig);
        
        // 권한 체크
        const [members] = await connection.execute('SELECT * FROM project_members WHERE project_id=? AND user_id=?', [projectId, req.user.userId]);
        if (members.length === 0) return res.status(403).json({ message: '권한 없음' });

        const [project] = await connection.execute('SELECT * FROM projects WHERE id=?', [projectId]);
        const [tasks] = await connection.execute(
            'SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.project_id = ?', 
            [projectId]
        );
        const [teamMembers] = await connection.execute(
            'SELECT u.id, u.name, u.email FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?', 
            [projectId]
        );

        res.json({ details: { project: project[0], tasks, members: teamMembers } });
    } catch (error) {
        res.status(500).json({ message: '상세 조회 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// 4. 태스크 생성
router.post('/:projectId/tasks', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        const { content, status, due_date } = req.body;
        connection = await mysql.createConnection(dbConfig);
        await connection.execute('INSERT INTO tasks (project_id, content, status, due_date) VALUES (?, ?, ?, ?)', [projectId, content, status || 'To Do', due_date]);
        res.status(201).json({ message: '업무 생성 성공' });
    } catch (error) {
        res.status(500).json({ message: '업무 생성 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 5. 채팅 내역
router.get('/:projectId/messages', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        connection = await mysql.createConnection(dbConfig);
        const [messages] = await connection.execute('SELECT * FROM chat_messages WHERE project_id = ? ORDER BY timestamp ASC', [projectId]);
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ message: '채팅 로드 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

module.exports = router;