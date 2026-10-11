const express = require('express');
const {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  listRiskHistory,
} = require('../controllers/projectController');
const {
  createSignal,
  listSignals,
} = require('../controllers/signalController');

const router = express.Router();

router.post('/', createProject);
router.get('/', listProjects);
router.get('/:id/risk-history', listRiskHistory);
router.get('/:id', getProject);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);
router.post('/:projectId/signals', createSignal);
router.get('/:projectId/signals', listSignals);

module.exports = router;
