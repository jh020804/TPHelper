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

// Socket.io 설정
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 1. 방 입장 (Join Room)
    socket.on('joinRoom', (projectId) => {
        // 안전하게 문자열로 변환하여 입장
        const room = String(projectId);
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });

    // 2. 메시지 전송 (Send & Broadcast)
    socket.on('sendMessage', (data) => {
        // 🚨 핵심 수정: projectId 또는 project_id 둘 중 하나라도 있으면 사용
        const roomId = data.projectId || data.project_id;

        if (roomId) {
            console.log(`Broadcasting to room ${roomId}:`, data.content);
            // 해당 방에 있는 모두에게 메시지 전송
            io.to(String(roomId)).emit('receiveMessage', {
                ...data,
                projectId: roomId // 받는 쪽 편의를 위해 projectId로 통일해서 보냄
            });
        } else {
            console.error('Message missing projectId:', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});