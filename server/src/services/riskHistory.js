const RiskSnapshot = require('../models/riskSnapshot');

const saveRiskSnapshot = async (projectId, risk) =>
  RiskSnapshot.create({ project: projectId, ...risk });

module.exports = { saveRiskSnapshot };
