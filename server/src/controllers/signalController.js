const mongoose = require('mongoose');
const EngineeringSignal = require('../models/engineeringSignal');
const Project = require('../models/project');
const scoreSignals = require('../services/riskScoring');
const { saveRiskSnapshot } = require('../services/riskHistory');

const signalTypes = ['failed_test', 'bug', 'dependency_alert'];
const signalSeverities = ['low', 'medium', 'high', 'critical'];
const signalStatuses = ['open', 'in_progress', 'fixed_unverified', 'verified', 'reopened'];
const allowedTransitions = {
  open: ['in_progress', 'fixed_unverified', 'reopened'],
  in_progress: ['fixed_unverified', 'reopened'],
  fixed_unverified: ['verified', 'in_progress', 'reopened'],
  verified: ['reopened'],
  reopened: ['in_progress', 'fixed_unverified'],
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const sendDatabaseError = (res) => {
  res.status(500).json({
    success: false,
    error: 'Database operation failed',
  });
};

const findOwnedProject = async (projectId, owner) =>
  Project.findOne({ _id: projectId, owner });

const createSignal = async (req, res) => {
  const { title, type, severity, status, description, verificationEvidence } = req.body;

  if (
    !isValidObjectId(req.params.projectId) ||
    typeof title !== 'string' ||
    !title.trim() ||
    !signalTypes.includes(type) ||
    !signalSeverities.includes(severity) ||
    !signalStatuses.includes(status) ||
    (description !== undefined && typeof description !== 'string') ||
    (verificationEvidence !== undefined && typeof verificationEvidence !== 'string') ||
    (status === 'verified' && (!verificationEvidence || !verificationEvidence.trim()))
  ) {
    return res.status(400).json({
      success: false,
      error: 'Valid title, type, severity, and status are required',
    });
  }

  try {
    const project = await findOwnedProject(req.params.projectId, req.user.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    const signal = await EngineeringSignal.create({
      project: project._id,
      title,
      type,
      severity,
      status,
      description,
      verificationEvidence,
      verifiedAt: status === 'verified' ? new Date() : undefined,
    });
    const signals = await EngineeringSignal.find({ project: project._id });
    await saveRiskSnapshot(project._id, scoreSignals(signals));

    return res.status(201).json({ success: true, data: signal });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Signal data is invalid',
      });
    }

    return sendDatabaseError(res);
  }
};

const listSignals = async (req, res) => {
  if (!isValidObjectId(req.params.projectId)) {
    return res.status(400).json({
      success: false,
      error: 'A valid project id is required',
    });
  }

  try {
    const project = await findOwnedProject(req.params.projectId, req.user.id);

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
    await saveRiskSnapshot(project._id, risk);

    return res.status(200).json({ success: true, data: signals, risk });
  } catch (error) {
    return sendDatabaseError(res);
  }
};

const updateSignalStatus = async (req, res) => {
  const { status } = req.body;

  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      error: 'A valid status is required',
    });
  }

  try {
    const signal = await EngineeringSignal.findById(req.params.id);

    if (!signal) {
      return res.status(404).json({
        success: false,
        error: 'Signal not found',
      });
    }

    if (
      !signalStatuses.includes(status) ||
      (status !== signal.status && !allowedTransitions[signal.status].includes(status))
    ) {
      return res.status(400).json({
        success: false,
        error: 'A valid status is required',
      });
    }

    const project = await findOwnedProject(signal.project, req.user.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Signal not found',
      });
    }

    if (status === 'verified' && !signal.verificationEvidence) {
      return res.status(400).json({ success: false, error: 'Verification evidence is required' });
    }
    signal.status = status;
    signal.verifiedAt = status === 'verified' ? new Date() : undefined;
    await signal.save();
    const signals = await EngineeringSignal.find({ project: signal.project });
    await saveRiskSnapshot(signal.project, scoreSignals(signals));

    return res.status(200).json({ success: true, data: signal });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Signal data is invalid',
      });
    }

    return sendDatabaseError(res);
  }
};

const getSignal = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, error: 'A valid signal id is required' });
  }
  try {
    const signal = await EngineeringSignal.findById(req.params.id);
    if (!signal) return res.status(404).json({ success: false, error: 'Signal not found' });
    const project = await findOwnedProject(signal.project, req.user.id);
    if (!project) return res.status(404).json({ success: false, error: 'Signal not found' });
    return res.status(200).json({ success: true, data: signal });
  } catch (error) {
    return sendDatabaseError(res);
  }
};

const updateSignal = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, error: 'A valid signal id is required' });
  }
  try {
    const signal = await EngineeringSignal.findById(req.params.id);
    if (!signal) return res.status(404).json({ success: false, error: 'Signal not found' });
    const project = await findOwnedProject(signal.project, req.user.id);
    if (!project) return res.status(404).json({ success: false, error: 'Signal not found' });
    const updates = {};
    ['title', 'type', 'severity', 'description', 'verificationEvidence'].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    const nextStatus = req.body.status || signal.status;
    const nextVerificationEvidence =
      req.body.verificationEvidence !== undefined
        ? req.body.verificationEvidence
        : signal.verificationEvidence;
    if (!signalStatuses.includes(nextStatus) ||
        (nextStatus !== signal.status && !allowedTransitions[signal.status].includes(nextStatus))) {
      return res.status(400).json({ success: false, error: 'Invalid signal status transition' });
    }
    if (
      nextStatus === 'verified' &&
      (typeof nextVerificationEvidence !== 'string' || !nextVerificationEvidence.trim())
    ) {
      return res.status(400).json({ success: false, error: 'Verification evidence is required' });
    }
    Object.assign(signal, updates, { status: nextStatus });
    if (nextStatus === 'verified') signal.verifiedAt = new Date();
    if (nextStatus !== 'verified') signal.verifiedAt = undefined;
    await signal.save();
    const signals = await EngineeringSignal.find({ project: project._id });
    await saveRiskSnapshot(project._id, scoreSignals(signals));
    return res.status(200).json({ success: true, data: signal });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: 'Signal data is invalid' });
    }
    return sendDatabaseError(res);
  }
};

const deleteSignal = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, error: 'A valid signal id is required' });
  }
  try {
    const signal = await EngineeringSignal.findById(req.params.id);
    if (!signal) return res.status(404).json({ success: false, error: 'Signal not found' });
    const project = await findOwnedProject(signal.project, req.user.id);
    if (!project) return res.status(404).json({ success: false, error: 'Signal not found' });
    await EngineeringSignal.deleteOne({ _id: signal._id });
    const signals = await EngineeringSignal.find({ project: project._id });
    await saveRiskSnapshot(project._id, scoreSignals(signals));
    return res.status(204).send();
  } catch (error) {
    return sendDatabaseError(res);
  }
};

module.exports = {
  createSignal,
  listSignals,
  updateSignalStatus,
  getSignal,
  updateSignal,
  deleteSignal,
};
