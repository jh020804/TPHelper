const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authMiddleware = require('../authMiddleware');
const upload = require('../config/upload');

router.use(authMiddleware);

// URL: /api/files/:fileId (삭제)
router.delete('/:fileId', fileController.deleteFile);

// URL: /api/chat/upload (채팅 파일) -> index.js에서 /api/chat으로 라우팅 예정
// 여기서는 컨트롤러 함수만 export하거나 별도 라우터 구성
// 구조상 /api/files로 통합하기 애매하므로, 일단 chatUpload는 별도 처리하거나 여기서 함.
// 여기서는 /api/chat/upload를 위해 별도 라우터 파일을 만들지 않고 index.js에서 처리하거나
// fileRoutes에 포함시키고 URL을 맞춥니다.

module.exports = router;