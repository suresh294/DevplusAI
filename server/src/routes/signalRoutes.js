const express = require('express');
const {
  updateSignalStatus,
  getSignal,
  updateSignal,
  deleteSignal,
} = require('../controllers/signalController');

const router = express.Router();

router.patch('/:id/status', updateSignalStatus);
router.get('/:id', getSignal);
router.patch('/:id', updateSignal);
router.delete('/:id', deleteSignal);

module.exports = router;
