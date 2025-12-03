const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const fileController = require('../controllers/fileController');
const authMiddleware = require('../authMiddleware');
const upload = require('../config/upload');

router.use(authMiddleware);

// URL: /api/chat/upload
router.post('/upload', upload.single('file'), fileController.uploadChatFile);

module.exports = router;