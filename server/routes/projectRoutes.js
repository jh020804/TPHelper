// server/routes/projectRoutes.js
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const dbConfig = require('../config/db'); // ⬅️ 1단계에서 만든 설정 파일 불러오기
const authMiddleware = require('../authMiddleware'); // (위치에 따라 '../' 개수 확인 필요)

// 1. 프로젝트 목록 조회
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
        res.status(500).json({ message: '서버 에러' });
    } finally {
        if (connection) await connection.end();
    }
});

// 3. 프로젝트 상세 조회 (여기가 500 에러 나던 곳!)
router.get('/:projectId', authMiddleware, async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        connection = await mysql.createConnection(dbConfig); // SSL 적용된 설정 사용

        // 권한 확인
        const [members] = await connection.execute(
            'SELECT * FROM project_members WHERE project_id=? AND user_id=? AND status="active"',
            [projectId, req.user.userId]
        );

        if (members.length === 0) {
            return res.status(403).json({ message: '접근 권한이 없습니다.' });
        }

        // 프로젝트 정보
        const [project] = await connection.execute('SELECT * FROM projects WHERE id=?', [projectId]);
        
        // 업무(Task) 목록
        const [tasks] = await connection.execute(
            `SELECT t.*, u.name as assignee_name 
             FROM tasks t 
             LEFT JOIN users u ON t.assignee_id = u.id 
             WHERE t.project_id = ?`, 
            [projectId]
        );

        // 멤버 목록
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
        res.status(500).json({ message: '상세 정보 로드 실패' });
    } finally {
        if (connection) await connection.end();
    }
});

module.exports = router;