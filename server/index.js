const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dbConfig = require('./config/db');

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.IO 설정
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] }
});

// ‼️ 컨트롤러에서 io를 사용할 수 있도록 설정
app.set('io', io);

// ‼️ 라우터 불러오기
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const taskRoutes = require('./routes/taskRoutes'); // /api/tasks
const fileRoutes = require('./routes/fileRoutes'); // /api/files
const chatRoutes = require('./routes/chatRoutes'); // /api/chat

// ‼️ 라우터 연결
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/chat', chatRoutes);

// Socket.IO 로직
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('joinRoom', (id) => socket.join(id));
    socket.on('leaveRoom', (id) => socket.leave(id));
    
    socket.on('sendMessage', async (data) => {
        const { projectId, userId, senderName, message, type, original_name } = data;
        const timestamp = new Date();
        const msgType = type || 'text';
        const origName = original_name || null;
        try {
            const connection = await mysql.createConnection(dbConfig);
            await connection.execute(
                'INSERT INTO chat_messages (project_id, user_id, sender_name, message, type, original_name, timestamp) VALUES (?,?,?,?,?,?,?)',
                [projectId, userId, senderName, message, msgType, origName, timestamp]
            );
            await connection.end();
            io.to(projectId).emit('receiveMessage', { ...data, type: msgType, original_name: origName, timestamp });
        } catch (e) { console.error('Socket Error:', e); }
    });
    socket.on('disconnect', () => {});
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on ${PORT}`);
});