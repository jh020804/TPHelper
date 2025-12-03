const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../authMiddleware'); // server 폴더 바로 아래에 있다고 가정
const upload = require('../config/upload');

// POST /api/users/signup
router.post('/signup', userController.signup);

// POST /api/users/login
router.post('/login', userController.login);

// GET /api/profile -> (주의: index.js에서 경로를 맞출 예정이므로 여기선 /profile로 둡니다. 최종 URL은 /api/users/profile이 되거나 index.js 설정에 따라 달라집니다. 기존 프론트엔드와 맞추기 위해 index.js에서 조정할 것입니다.)
// ‼️ 프론트엔드 코드 수정을 최소화하기 위해 기존 URL 구조를 유지하는 방향으로 index.js를 수정할 예정입니다.
// 일단 여기서는 기능별로 묶습니다.

// 프로필 관련 (authMiddleware 필요)
router.get('/profile', authMiddleware, userController.getProfile);
router.post('/profile-image', authMiddleware, upload.single('image'), userController.updateProfileImage);

module.exports = router;