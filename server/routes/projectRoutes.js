const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authMiddleware = require('../authMiddleware');
const dbConfig = require('../config/db');

// 1. 내 프로젝트 목록 조회
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
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
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
        console.error(error);
        res.status(500).json({ message: '생성 실패' });
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
        
        // 권한 확인
        const [members] = await connection.execute(
            'SELECT * FROM project_members WHERE project_id=? AND user_id=?',
            [projectId, req.user.userId]
        );
        if (members.length === 0) return res.status(403).json({ message: '권한 없음' });

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
             WHERE pm.project_id = ?`,
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
        console.error(error);
        res.status(500).json({ message: '상세 정보 로드 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 4. 업무(Task) 생성
router.post('/:projectId/tasks', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        const { content, status, due_date } = req.body;

        connection = await mysql.createConnection(dbConfig);
        await connection.execute(
            'INSERT INTO tasks (project_id, content, status, due_date) VALUES (?, ?, ?, ?)',
            [projectId, content, status || 'To Do', due_date || null]
        );

        res.status(201).json({ message: '업무 생성 성공' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '업무 생성 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 🚨 5. 팀원 초대 (이 부분이 없어서 404 에러가 났던 것!)
router.post('/:projectId/invite', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        const { email } = req.body;
        
        connection = await mysql.createConnection(dbConfig);
        
        // 1) 초대할 유저가 존재하는지 확인
        const [users] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: '해당 이메일의 유저가 없습니다.' });
        }
        
        const userId = users[0].id;

        // 2) 이미 프로젝트 멤버인지 확인
        const [existing] = await connection.execute(
            'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
            [projectId, userId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: '이미 프로젝트 멤버입니다.' });
        }

        // 3) 멤버로 추가
        await connection.execute(
            'INSERT INTO project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)',
            [projectId, userId, 'member', 'active']
        );

        res.json({ message: '초대 성공' });

    } catch (error) {
        console.error('Invite Error:', error);
        res.status(500).json({ message: '초대 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 6. 채팅 메시지 불러오기
router.get('/:projectId/chat', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        connection = await mysql.createConnection(dbConfig);

        const [messages] = await connection.execute(
            `SELECT id, project_id, user_id, sender_name as user_name, message as content, timestamp 
             FROM chat_messages 
             WHERE project_id = ? 
             ORDER BY timestamp ASC`,
            [projectId]
        );

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: '메시지 로드 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 7. 채팅 메시지 저장
router.post('/:projectId/chat', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        const { content } = req.body;
        const userId = req.user.userId;

        connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT name FROM users WHERE id = ?', [userId]);
        const senderName = users[0].name;

        const [result] = await connection.execute(
            `INSERT INTO chat_messages (project_id, user_id, sender_name, message, type) 
             VALUES (?, ?, ?, ?, 'text')`,
            [projectId, userId, senderName, content]
        );

        const newMessage = {
            id: result.insertId,
            project_id: projectId,
            user_id: userId,
            user_name: senderName,
            content: content,
            timestamp: new Date()
        };
        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ message: '메시지 저장 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

module.exports = router;