const transitions = Object.freeze({
  open: Object.freeze(['in_progress', 'fixed_unverified', 'reopened']),
  in_progress: Object.freeze(['fixed_unverified', 'reopened']),
  fixed_unverified: Object.freeze(['verified', 'in_progress', 'reopened']),
  verified: Object.freeze(['reopened']),
  reopened: Object.freeze(['in_progress', 'fixed_unverified']),
});

const canTransition = (from, to) => from === to || transitions[from]?.includes(to) === true;

const requiresVerificationEvidence = (status) => status === 'verified';

module.exports = { transitions, canTransition, requiresVerificationEvidence };
