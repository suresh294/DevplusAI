const mongoose = require('mongoose');

const engineeringSignalSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: ['failed_test', 'bug', 'dependency_alert'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'fixed_unverified', 'verified', 'reopened'],
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    verificationEvidence: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    verifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

engineeringSignalSchema.index({ project: 1, status: 1 });
engineeringSignalSchema.index({ project: 1, severity: 1 });

module.exports = mongoose.model('EngineeringSignal', engineeringSignalSchema);
