const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitationController');
const authMiddleware = require('../authMiddleware');

router.use(authMiddleware);

// URL: /api/invitations
router.get('/', invitationController.getInvitations);

// URL: /api/invitations/:projectId/respond
router.post('/:projectId/respond', invitationController.respondInvitation);

module.exports = router;