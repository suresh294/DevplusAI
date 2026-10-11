const mongoose = require('mongoose');
const Project = require('../models/project');
const EngineeringSignal = require('../models/engineeringSignal');
const RiskSnapshot = require('../models/riskSnapshot');
const scoreSignals = require('../services/riskScoring');

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const sendDatabaseError = (res) => {
  res.status(500).json({
    success: false,
    error: 'Database operation failed',
  });
};

const createProject = async (req, res) => {
  const { name, description } = req.body;

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    (description !== undefined && typeof description !== 'string')
  ) {
    return res.status(400).json({
      success: false,
      error: 'A project name is required',
    });
  }

  try {
    const project = await Project.create({ name, description, owner: req.user.id });
    return res.status(201).json({ success: true, data: project });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Project data is invalid',
      });
    }

    return sendDatabaseError(res);
  }
};

const listProjects = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const projects = await Project.find({ owner: req.user.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return res.status(200).json({ success: true, data: projects, page, limit });
  } catch (error) {
    return sendDatabaseError(res);
  }
};

const getProject = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      error: 'A valid project id is required',
    });
  }

  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    const signals = await EngineeringSignal.find({
      project: project._id,
    }).sort({ createdAt: -1 });
    const risk = scoreSignals(signals);

    return res.status(200).json({ success: true, data: project, risk });
  } catch (error) {
    return sendDatabaseError(res);
  }
};

const updateProject = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, error: 'A valid project id is required' });
  }
  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (
    (updates.name !== undefined && (typeof updates.name !== 'string' || !updates.name.trim())) ||
    (updates.description !== undefined && typeof updates.description !== 'string')
  ) {
    return res.status(400).json({ success: false, error: 'Project data is invalid' });
  }
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      updates,
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: 'Project data is invalid' });
    }
    return sendDatabaseError(res);
  }
};

const deleteProject = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, error: 'A valid project id is required' });
  }
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    await EngineeringSignal.deleteMany({ project: project._id });
    await RiskSnapshot.deleteMany({ project: project._id });
    return res.status(204).send();
  } catch (error) {
    return sendDatabaseError(res);
  }
};

const listRiskHistory = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, error: 'A valid project id is required' });
  }
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    const history = await RiskSnapshot.find({ project: project._id }).sort({ createdAt: -1 }).limit(100);
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    return sendDatabaseError(res);
  }
};

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  listRiskHistory,
};
