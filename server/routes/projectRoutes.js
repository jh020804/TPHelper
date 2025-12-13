const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authMiddleware = require('../authMiddleware');
const dbConfig = require('../config/db');

// 1. 내 프로젝트 목록 조회 (수락한 'active' 상태만 조회)
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

        const [result] = await connection.execute('INSERT INTO projects (name, owner_id) VALUES (?, ?)', [name, req.user.userId]);
        const projectId = result.insertId;
        // 생성자는 바로 active
        await connection.execute('INSERT INTO project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)', [projectId, req.user.userId, 'owner', 'active']);

        await connection.commit();
        res.status(201).json({ projectId, name });
    } catch (error) {
        if (connection) await connection.rollback();
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
        
        // 권한 확인 (active 상태인 멤버만 접근 가능)
        const [members] = await connection.execute(
            'SELECT * FROM project_members WHERE project_id=? AND user_id=? AND status="active"', 
            [projectId, req.user.userId]
        );
        if (members.length === 0) return res.status(403).json({ message: '접근 권한이 없습니다.' });

        const [project] = await connection.execute('SELECT * FROM projects WHERE id=?', [projectId]);
        const [tasks] = await connection.execute('SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.project_id = ?', [projectId]);
        // 멤버 목록은 active인 사람만 보여줌
        const [teamMembers] = await connection.execute('SELECT u.id, u.name, u.email FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ? AND pm.status = "active"', [projectId]);

        res.json({ details: { project: project[0], tasks: tasks, members: teamMembers } });
    } catch (error) {
        res.status(500).json({ message: '상세 정보 로드 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 4. 업무 생성
router.post('/:projectId/tasks', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        const { content, status, due_date } = req.body;
        connection = await mysql.createConnection(dbConfig);
        await connection.execute('INSERT INTO tasks (project_id, content, status, due_date) VALUES (?, ?, ?, ?)', [projectId, content, status || 'To Do', due_date || null]);
        res.status(201).json({ message: '업무 생성 성공' });
    } catch (error) {
        res.status(500).json({ message: '업무 생성 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 🚨 5. 팀원 초대 (상태를 'pending'으로 저장)
router.post('/:projectId/invite', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        const { email } = req.body;
        connection = await mysql.createConnection(dbConfig);
        
        const [users] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(404).json({ message: '해당 이메일의 유저가 없습니다.' });
        
        const userId = users[0].id;
        const [existing] = await connection.execute('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userId]);
        
        if (existing.length > 0) {
            if (existing[0].status === 'pending') return res.status(409).json({ message: '이미 초대를 보냈습니다.' });
            return res.status(409).json({ message: '이미 프로젝트 멤버입니다.' });
        }

        // status를 'pending'으로 설정하여 초대
        await connection.execute(
            'INSERT INTO project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)',
            [projectId, userId, 'member', 'pending']
        );

        res.json({ message: '초대장을 보냈습니다.' });
    } catch (error) {
        console.error('Invite Error:', error);
        res.status(500).json({ message: '초대 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 🚨 6. 나에게 온 초대 목록 조회
router.get('/invitations/me', authMiddleware, async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        // 상태가 'pending'인 프로젝트 목록 조회
        const [invitations] = await connection.execute(
            `SELECT p.id, p.name, u.name as owner_name
             FROM project_members pm
             JOIN projects p ON pm.project_id = p.id
             JOIN users u ON p.owner_id = u.id
             WHERE pm.user_id = ? AND pm.status = 'pending'`,
            [req.user.userId]
        );
        res.json({ invitations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '초대 목록 로드 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 🚨 7. 초대 수락/거절
router.post('/invitations/:projectId/respond', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        const { accept } = req.body; // true(수락) or false(거절)

        connection = await mysql.createConnection(dbConfig);

        if (accept) {
            // 수락 시 status를 'active'로 변경
            await connection.execute(
                'UPDATE project_members SET status = "active", joined_at = NOW() WHERE project_id = ? AND user_id = ?',
                [projectId, req.user.userId]
            );
            res.json({ message: '프로젝트에 참여했습니다.' });
        } else {
            // 거절 시 목록에서 삭제
            await connection.execute(
                'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
                [projectId, req.user.userId]
            );
            res.json({ message: '초대를 거절했습니다.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '요청 처리 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 8. 채팅 불러오기
router.get('/:projectId/chat', authMiddleware, async (req, res) => {
    // (기존 코드 유지)
    let connection;
    try {
        const { projectId } = req.params;
        connection = await mysql.createConnection(dbConfig);
        const [messages] = await connection.execute('SELECT id, project_id, user_id, sender_name as user_name, message as content, timestamp FROM chat_messages WHERE project_id = ? ORDER BY timestamp ASC', [projectId]);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: '메시지 로드 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 9. 채팅 저장
router.post('/:projectId/chat', authMiddleware, async (req, res) => {
    // (기존 코드 유지)
    let connection;
    try {
        const { projectId } = req.params;
        const { content } = req.body;
        const userId = req.user.userId;
        connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT name FROM users WHERE id = ?', [userId]);
        const senderName = users[0].name;
        const [result] = await connection.execute('INSERT INTO chat_messages (project_id, user_id, sender_name, message, type) VALUES (?, ?, ?, ?, "text")', [projectId, userId, senderName, content]);
        const newMessage = { id: result.insertId, project_id: projectId, user_id: userId, user_name: senderName, content, timestamp: new Date() };
        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ message: '메시지 저장 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

module.exports = router;