require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// 라우터 파일 불러오기
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // 파일 접근 허용

// 라우트 연결
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// 기본 라우트 (서버 상태 확인용)
app.get('/', (req, res) => {
    res.send('TPHelper Server is Running (TiDB Connected)');
});

// 서버 실행
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});