require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http'); // 소켓용
const { Server } = require("socket.io"); // 소켓용

const app = express();
const server = http.createServer(app); // HTTP 서버 생성

// 라우터 불러오기
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🚨 라우터 연결 (이 부분이 정확해야 합니다!)
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes); // <-- /api/projects 주소는 projectRoutes가 처리함
app.use('/api/tasks', taskRoutes);

// Socket.io 설정
const io = new Server(server, {
    cors: {
        origin: "*", // 모든 곳에서 접속 허용
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinRoom', (projectId) => {
        socket.join(projectId);
        console.log(`User joined project room: ${projectId}`);
    });

    socket.on('sendMessage', (data) => {
        io.to(data.projectId).emit('receiveMessage', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3001;
// app.listen 대신 server.listen 사용 (소켓 때문)
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});