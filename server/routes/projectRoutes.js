const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authMiddleware = require('../authMiddleware');
const dbConfig = require('../config/db');

// Task 배열의 유효성을 검사하는 헬퍼 함수 (필요한 경우 배열이 아닌 곳에서도 사용)
const filterSafeTasks = (tasks) => {
    if (!Array.isArray(tasks)) return [];
    return tasks.filter(t => t && t.id);
};

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
        console.error('Project List Error:', error);
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
        console.error('Project Creation Error:', error);
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
        
        // (권한 확인 로직)
        const [members] = await connection.execute(
            'SELECT * FROM project_members WHERE project_id=? AND user_id=? AND status="active"', 
            [projectId, req.user.userId]
        );
        if (members.length === 0) return res.status(403).json({ message: '접근 권한이 없습니다.' });

        const [project] = await connection.execute('SELECT * FROM projects WHERE id=?', [projectId]);
        
        // Task 목록 조회
        const [tasks] = await connection.execute('SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.project_id = ?', [projectId]);
        
        // 🚨 [핵심 수정 1] 프론트엔드로 보내기 전에 Tasks 배열 필터링
        const safeTasks = filterSafeTasks(tasks); 
        
        const [teamMembers] = await connection.execute(
            `SELECT u.id, u.name, u.email, u.profile_image 
             FROM project_members pm 
             JOIN users u ON pm.user_id = u.id 
             WHERE pm.project_id = ? AND pm.status = "active"`,
            [projectId]
        );

        // 🚨 [수정] 필터링된 safeTasks 배열을 응답에 포함
        res.json({ details: { project: project[0], tasks: safeTasks, members: teamMembers } });
    } catch (error) {
        console.error('Project Details Load Error:', error);
        res.status(500).json({ message: '상세 정보 로드 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

// 4. 업무 생성 (수정된 로직)
router.post('/:projectId/tasks', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        const { title, content, status, due_date, assignee_id } = req.body;
        const userId = req.user.userId; // 현재 사용자 ID

        connection = await mysql.createConnection(dbConfig);
        
        // 1. DB INSERT 실행 (title 포함)
        const [result] = await connection.execute(
            'INSERT INTO tasks (project_id, title, content, status, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)', 
            [projectId, title || '', content || '', status || 'To Do', due_date || null, userId]
        );
        const taskId = result.insertId;

        // 2. 생성된 Task 상세 정보 조회 (프론트엔드 반영 및 소켓 전송을 위해)
        const [tasks] = await connection.execute(`
            SELECT 
                t.id, t.title, t.content, t.status, t.due_date, t.project_id, t.created_at,
                u.name as assignee_name 
            FROM tasks t 
            LEFT JOIN users u ON t.assignee_id = u.id 
            WHERE t.id = ?
        `, [taskId]);
        
        // 🚨 [핵심 수정 2] Task 조회 결과에 필터링을 적용하고, 유효한 Task만 사용
        const safeTasks = filterSafeTasks(tasks);
        const newTask = safeTasks.length > 0 ? safeTasks[0] : null;

        // 3. 소켓을 통해 다른 사용자에게 알림
        const io = req.app.get('io');
        if (io && newTask) {
            io.to(String(projectId)).emit('taskUpdated', newTask);
            console.log(`[Socket] New Task ${taskId} broadcasted to room ${projectId}`);
        }
        
        // 4. 프론트엔드가 기대하는 Task 객체를 응답에 포함
        res.status(201).json({ 
            message: '업무 생성 성공',
            task: newTask // 🚨 newTask가 null일 수도 있지만, 프론트엔드는 여기서 유효성을 체크해야 함
        }); 
        
    } catch (error) {
        console.error('Task Creation Error:', error);
        res.status(500).json({ message: '업무 생성 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// 5. 팀원 초대 (상태를 'pending'으로 저장)
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

// 6. 나에게 온 초대 목록 조회
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

// 7. 초대 수락/거절
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