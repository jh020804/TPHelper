const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../authMiddleware');
const upload = require('../config/upload');

router.use(authMiddleware);

// URL: /api/tasks/:taskId (수정, 삭제)
router.patch('/:taskId', taskController.updateTask);
router.delete('/:taskId', taskController.deleteTask);

// URL: /api/tasks/:taskId/files (파일 업로드, 조회)
router.post('/:taskId/files', upload.single('file'), taskController.uploadTaskFile);
router.get('/:taskId/files', taskController.getTaskFiles);

module.exports = router;