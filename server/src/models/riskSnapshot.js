const mongoose = require('mongoose');

const riskSnapshotSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    riskScore: { type: Number, required: true, min: 0, max: 100 },
    healthScore: { type: Number, required: true, min: 0, max: 100 },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    breakdown: { type: [mongoose.Schema.Types.Mixed], default: [] },
    signalCount: { type: Number, required: true, min: 0 },
    statusCounts: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RiskSnapshot', riskSnapshotSchema);
