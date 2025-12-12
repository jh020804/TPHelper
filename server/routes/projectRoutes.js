// server/routes/projectRoutes.js
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
// ‼️ 주의: authMiddleware 파일 위치가 server 폴더 바로 아래라면 '../authMiddleware'가 맞습니다.
const authMiddleware = require('../authMiddleware'); 

// ✅ DB 설정 직접 입력 (파일 불러오기 에러 방지 & SSL 필수 적용)
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
        console.error('============ [DB ERROR ON PROJECT DETAIL] ============');
        console.error(error); // 서버 로그에 실제 SQL 에러 메시지를 출력
        console.error('======================================================');
        res.status(500).json({ 
            message: '상세 정보 로드 실패 (서버 로그 확인 필요)', 
            error: error.message // 프론트엔드에도 에러 메시지를 전달 (선택 사항)
        });
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
        console.error('Create Project Error:', error);
        res.status(500).json({ message: '서버 에러', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// 3. 프로젝트 상세 조회 (500 에러 해결 핵심 구간)
router.get('/:projectId', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        console.log(`[DEBUG] 프로젝트 조회 시작: ID ${projectId}, User ${req.user.userId}`);

        connection = await mysql.createConnection(dbConfig);
        
        // 1) 권한 확인
        const [members] = await connection.execute(
            'SELECT * FROM project_members WHERE project_id=? AND user_id=? AND status="active"',
            [projectId, req.user.userId]
        );

        if (members.length === 0) {
            return res.status(403).json({ message: '접근 권한이 없습니다.' });
        }

        // 2) 프로젝트 정보 가져오기
        const [project] = await connection.execute('SELECT * FROM projects WHERE id=?', [projectId]);
        
        // 3) 업무(Task) 목록 가져오기 (테이블 없으면 여기서 에러!)
        const [tasks] = await connection.execute(
            `SELECT t.*, u.name as assignee_name 
             FROM tasks t 
             LEFT JOIN users u ON t.assignee_id = u.id 
             WHERE t.project_id = ?`, 
            [projectId]
        );

        // 4) 멤버 목록 가져오기
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
        console.error('============ [PROJECT DETAIL ERROR] ============');
        console.error(error); // Render 로그에 자세히 출력
        console.error('================================================');
        res.status(500).json({ message: '상세 정보 로드 실패', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

module.exports = router;