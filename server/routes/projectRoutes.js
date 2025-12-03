const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
// ‼️ 추가된 컨트롤러들
const taskController = require('../controllers/taskController');
const messageController = require('../controllers/messageController');
const authMiddleware = require('../authMiddleware');

router.use(authMiddleware);

// Project
router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.get('/:projectId', projectController.getProjectDetails);
router.delete('/:projectId', projectController.deleteProject);
router.post('/:projectId/invite', projectController.inviteMember);

// ‼️ Task (URL: /api/projects/:projectId/tasks)
router.get('/:projectId/tasks', taskController.getTasks);
router.post('/:projectId/tasks', taskController.createTask);

// ‼️ Message (URL: /api/projects/:projectId/messages)
router.get('/:projectId/messages', messageController.getMessages);

module.exports = router;