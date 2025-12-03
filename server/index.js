// 1. 라이브러리 가져오기
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dbConfig = require('./config/db'); // DB 설정 분리됨

// 2. 기본 설정
const app = express();
const PORT = 3001;

// ‼️ (중요) 허용할 주소 목록 (로컬 + Vercel)
// 본인의 Vercel 주소를 여기에 꼭 넣어주세요!
const allowedOrigins = [
    "http://localhost:3000",
    "https://tp-helper-uk9r.vercel.app/login" // ⬅️ 본인의 Vercel 주소로 수정
];

app.use(express.json());
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. Socket.IO 서버 생성 및 설정
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins, // ‼️ 소켓에도 동일한 CORS 적용
        methods: ["GET", "POST"],
        credentials: true
    }
});

// ‼️ 컨트롤러에서 io를 사용할 수 있도록 설정
app.set('io', io);

// ‼️ 라우터 불러오기 (리팩토링된 파일들)
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const taskRoutes = require('./routes/taskRoutes');
const fileRoutes = require('./routes/fileRoutes');
const chatRoutes = require('./routes/chatRoutes');

// ‼️ 라우터 연결
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/chat', chatRoutes);

// 5. Socket.IO 실시간 로직 (채팅 저장 및 기본 통신)
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

// 6. 서버 실행
server.listen(PORT, () => {
    console.log(`🚀 Server running on ${PORT}`);
});