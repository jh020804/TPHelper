const mysql = require('mysql2/promise');
const dbConfig = require('../config/db');
const fs = require('fs');

exports.deleteFile = async (req, res) => {
    try {
        const { fileId } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        
        const [rows] = await connection.execute('SELECT file_url FROM task_attachments WHERE id = ?', [fileId]);
        if (rows.length === 0) {
            await connection.end();
            return res.status(404).json({ message: '파일 없음' });
        }
        
        const filePath = rows[0].file_url;
        await connection.execute('DELETE FROM task_attachments WHERE id = ?', [fileId]);
        await connection.end();

        fs.unlink(filePath, (err) => {
            if (err) console.error('Failed to delete local file:', err);
        });

        res.status(200).json({ message: '삭제 성공' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: '서버 에러' });
    }
};

// 채팅 이미지 업로드 (메시지 전송은 소켓이 하므로 여기선 파일만 저장하고 URL 리턴)
exports.uploadChatFile = (req, res) => {
    if (!req.file) return res.status(400).json({ message: '파일 없음' });
    const fileUrl = req.file.path.replace(/\\/g, "/");
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';
    res.status(200).json({ fileUrl, fileType, originalName: req.file.originalname });
};