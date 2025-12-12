require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// 라우터 불러오기
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API 라우트 연결
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// 🚨 Socket.io 설정 (실시간 통신의 핵심)
const io = new Server(server, {
    cors: {
        origin: "*", // 모든 도메인에서 접속 허용 (배포 시 프론트엔드 도메인으로 제한 권장)
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 1. 방 입장 (Join Room)
    socket.on('joinRoom', (projectId) => {
        socket.join(String(projectId)); // 숫자일 수 있으므로 문자열로 변환
        console.log(`User ${socket.id} joined room: ${projectId}`);
    });

    // 2. 메시지 전송 및 중계 (Send & Broadcast)
    socket.on('sendMessage', (data) => {
        console.log(`Message in room ${data.projectId}:`, data.content);
        
        // 중요: 해당 방(projectId)에 있는 *모든* 사람에게 메시지 전송
        io.to(String(data.projectId)).emit('receiveMessage', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});