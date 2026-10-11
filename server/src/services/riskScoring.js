const SEVERITY_POINTS = Object.freeze({
  low: 5,
  medium: 12,
  high: 25,
  critical: 40,
});

const TYPE_POINTS = Object.freeze({
  failed_test: 10,
  bug: 8,
  dependency_alert: 12,
});

const STATUS_MULTIPLIERS = Object.freeze({
  open: 1,
  in_progress: 0.7,
  fixed_unverified: 0.5,
  verified: 0,
  reopened: 1.2,
});

const STATUS_VALUES = Object.keys(STATUS_MULTIPLIERS);

const getRiskLevel = (riskScore) => {
  if (riskScore >= 75) return 'critical';
  if (riskScore >= 50) return 'high';
  if (riskScore >= 25) return 'medium';
  return 'low';
};

const assertSignal = (signal, index) => {
  if (!signal || typeof signal !== 'object' || Array.isArray(signal)) {
    throw new TypeError(`Signal at index ${index} must be an object`);
  }

  if (typeof signal.title !== 'string' || !signal.title.trim()) {
    throw new TypeError(`Signal at index ${index} must have a non-empty title`);
  }

  if (!Object.prototype.hasOwnProperty.call(SEVERITY_POINTS, signal.severity)) {
    throw new RangeError(`Unknown severity at index ${index}: ${signal.severity}`);
  }

  if (!Object.prototype.hasOwnProperty.call(TYPE_POINTS, signal.type)) {
    throw new RangeError(`Unknown type at index ${index}: ${signal.type}`);
  }

  if (!Object.prototype.hasOwnProperty.call(STATUS_MULTIPLIERS, signal.status)) {
    throw new RangeError(`Unknown status at index ${index}: ${signal.status}`);
  }
};

const scoreSignals = (signals) => {
  if (!Array.isArray(signals)) {
    throw new TypeError('Signals must be an array');
  }

  const statusCounts = Object.fromEntries(STATUS_VALUES.map((status) => [status, 0]));
  const breakdown = signals.map((signal, index) => {
    assertSignal(signal, index);

    const basePoints = SEVERITY_POINTS[signal.severity] + TYPE_POINTS[signal.type];
    const statusMultiplier = STATUS_MULTIPLIERS[signal.status];
    const contribution = basePoints * statusMultiplier;

    statusCounts[signal.status] += 1;

    return {
      signalId: signal._id ?? signal.id,
      title: signal.title,
      severity: signal.severity,
      type: signal.type,
      status: signal.status,
      basePoints,
      statusMultiplier,
      contribution,
    };
  });

  const riskScore = Math.min(
    100,
    Math.max(0, Math.round(breakdown.reduce((total, signal) => total + signal.contribution, 0)))
  );

  return {
    riskScore,
    healthScore: 100 - riskScore,
    riskLevel: getRiskLevel(riskScore),
    breakdown,
    signalCount: signals.length,
    statusCounts,
  };
};

module.exports = scoreSignals;
