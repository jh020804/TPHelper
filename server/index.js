require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// 🚨 [수정 1] CORS 설정 강화 (배포된 프론트엔드 주소 필수)
app.use(cors({
    origin: [
        "http://localhost:3000", 
        "https://tp-helper-lcti.vercel.app" // Vercel 배포 주소
    ],
    credentials: true, // 쿠키나 인증 헤더 사용 시 필수
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.io 설정
const io = new Server(server, {
    cors: {
        // 🚨 [수정 2] 소켓 CORS도 프론트엔드 주소로 맞춤
        origin: [
            "http://localhost:3000",
            "https://tp-helper-lcti.vercel.app"
        ],
        methods: ["GET", "POST"]
    }
});

// 🚨🚨 [핵심 수정 3] 이게 없으면 taskController에서 에러남! (502 원인)
// 이제 req.app.get('io')로 컨트롤러에서 io를 쓸 수 있습니다.
app.set('io', io);

// 라우터 불러오기
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');

// API 라우트 연결
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 1. 방 입장 (Join Room)
    socket.on('joinRoom', (projectId) => {
        const room = String(projectId);
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });

    // 2. 메시지 전송 (Send & Broadcast)
    socket.on('sendMessage', (data) => {
        const roomId = data.projectId || data.project_id;

        if (roomId) {
            console.log(`Broadcasting to room ${roomId} (excluding sender):`, data.content);
            
            // 🚨🚨 [가장 핵심적인 수정] 
            // 메시지를 보낸 소켓(socket) 자신을 제외하고 방에 브로드캐스트합니다.
            socket.broadcast.to(String(roomId)).emit('receiveMessage', {
                ...data,
                projectId: roomId
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