const mysql = require('mysql2/promise');
const dbConfig = require('../config/db');

exports.getMessages = async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [m] = await connection.execute('SELECT * FROM chat_messages WHERE project_id=? ORDER BY timestamp ASC', [req.params.projectId]);
        await connection.end();
        res.status(200).json({ messages: m });
    } catch (e) { res.status(500).json({ message: '에러' }); }
};