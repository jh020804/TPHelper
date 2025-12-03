const mysql = require('mysql2/promise');
const dbConfig = require('../config/db');

// 받은 초대 목록 조회
exports.getInvitations = async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const sql = `
            SELECT p.id, p.name, u.name as inviter_name 
            FROM projects p 
            JOIN project_members pm ON p.id = pm.project_id 
            JOIN users u ON p.owner_id = u.id 
            WHERE pm.user_id = ? AND pm.status = 'pending'
        `;
        const [invitations] = await connection.execute(sql, [req.user.userId]);
        await connection.end();
        res.status(200).json({ invitations });
    } catch (error) { res.status(500).json({ message: '서버 에러' }); }
};

// 초대 응답 (수락/거절)
exports.respondInvitation = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { accept } = req.body;
        const userId = req.user.userId;
        const connection = await mysql.createConnection(dbConfig);
        
        if (accept) {
            await connection.execute('UPDATE project_members SET status = "active" WHERE project_id = ? AND user_id = ?', [projectId, userId]);
        } else {
            await connection.execute('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userId]);
        }
        await connection.end();
        res.status(200).json({ message: accept ? '수락됨' : '거절됨' });
    } catch (error) { res.status(500).json({ message: '서버 에러' }); }
};