const test = require('node:test');
const assert = require('node:assert/strict');
const {
  transitions,
  canTransition,
  requiresVerificationEvidence,
} = require('../src/services/statusWorkflow');
const projectRoutes = require('../src/routes/projectRoutes');
const signalController = require('../src/controllers/signalController');
const EngineeringSignal = require('../src/models/engineeringSignal');
const Project = require('../src/models/project');
const RiskSnapshot = require('../src/models/riskSnapshot');

const response = () => {
  const result = {};
  result.status = (code) => {
    result.statusCode = code;
    return result;
  };
  result.json = (body) => {
    result.body = body;
    return result;
  };
  result.send = (body) => {
    result.body = body;
    return result;
  };
  return result;
};

test('allows only the documented signal status transitions', () => {
  assert.equal(canTransition('open', 'in_progress'), true);
  assert.equal(canTransition('in_progress', 'fixed_unverified'), true);
  assert.equal(canTransition('fixed_unverified', 'verified'), true);
  assert.equal(canTransition('verified', 'reopened'), true);
  assert.equal(canTransition('open', 'verified'), false);
  assert.equal(canTransition('verified', 'open'), false);
  assert.equal(canTransition('unknown', 'open'), false);
  assert.deepEqual(Object.keys(transitions), [
    'open',
    'in_progress',
    'fixed_unverified',
    'verified',
    'reopened',
  ]);
});

test('requires evidence only for verified status', () => {
  assert.equal(requiresVerificationEvidence('verified'), true);
  assert.equal(requiresVerificationEvidence('fixed_unverified'), false);
  assert.equal(requiresVerificationEvidence('reopened'), false);
});

test('registers risk history before the generic project route', () => {
  const paths = projectRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);

  assert.ok(paths.indexOf('/:id/risk-history') < paths.indexOf('/:id'));
});

test('rejects invalid status values without throwing', async () => {
  const originalFindById = EngineeringSignal.findById;
  EngineeringSignal.findById = async () => ({ status: 'open', project: '507f1f77bcf86cd799439011' });

  try {
    const res = response();
    await signalController.updateSignalStatus(
      { params: { id: '507f1f77bcf86cd799439011' }, body: { status: 'invalid' }, user: { id: 'owner' } },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { success: false, error: 'A valid status is required' });
  } finally {
    EngineeringSignal.findById = originalFindById;
  }
});

test('rejects verification without evidence after ownership checks', async () => {
  const originalFindById = EngineeringSignal.findById;
  const originalProjectFindOne = Project.findOne;
  EngineeringSignal.findById = async () => ({ status: 'fixed_unverified', project: '507f1f77bcf86cd799439011' });
  Project.findOne = async () => ({ _id: '507f1f77bcf86cd799439011' });

  try {
    const res = response();
    await signalController.updateSignalStatus(
      { params: { id: '507f1f77bcf86cd799439012' }, body: { status: 'verified' }, user: { id: 'owner' } },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { success: false, error: 'Verification evidence is required' });
  } finally {
    EngineeringSignal.findById = originalFindById;
    Project.findOne = originalProjectFindOne;
  }
});

test('rejects status updates for a signal owned by another user', async () => {
  const originalFindById = EngineeringSignal.findById;
  const originalProjectFindOne = Project.findOne;
  EngineeringSignal.findById = async () => ({ status: 'open', project: '507f1f77bcf86cd799439011' });
  Project.findOne = async () => null;

  try {
    const res = response();
    await signalController.updateSignalStatus(
      { params: { id: '507f1f77bcf86cd799439012' }, body: { status: 'in_progress' }, user: { id: 'other-owner' } },
      res
    );
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { success: false, error: 'Signal not found' });
  } finally {
    EngineeringSignal.findById = originalFindById;
    Project.findOne = originalProjectFindOne;
  }
});

test('updates a valid status without a pre-load ReferenceError', async () => {
  const signal = {
    status: 'open',
    project: '507f1f77bcf86cd799439011',
    save: async () => {},
  };
  const originalFindById = EngineeringSignal.findById;
  const originalFind = EngineeringSignal.find;
  const originalProjectFindOne = Project.findOne;
  const originalSnapshotCreate = RiskSnapshot.create;
  EngineeringSignal.findById = async () => signal;
  EngineeringSignal.find = () => [];
  Project.findOne = async () => ({ _id: signal.project });
  RiskSnapshot.create = async () => {};

  try {
    const res = response();
    await signalController.updateSignalStatus(
      { params: { id: '507f1f77bcf86cd799439012' }, body: { status: 'in_progress' }, user: { id: 'owner' } },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(signal.status, 'in_progress');
  } finally {
    EngineeringSignal.findById = originalFindById;
    EngineeringSignal.find = originalFind;
    Project.findOne = originalProjectFindOne;
    RiskSnapshot.create = originalSnapshotCreate;
  }
});

test('rejects clearing evidence from an already verified signal without saving', async () => {
  const signal = {
    status: 'verified',
    verificationEvidence: 'reviewed in CI',
    project: '507f1f77bcf86cd799439011',
    save: async () => {
      throw new Error('save should not be called');
    },
  };
  const originalFindById = EngineeringSignal.findById;
  const originalProjectFindOne = Project.findOne;
  EngineeringSignal.findById = async () => signal;
  Project.findOne = async () => ({ _id: signal.project });

  try {
    const res = response();
    await signalController.updateSignal(
      {
        params: { id: '507f1f77bcf86cd799439012' },
        body: { status: 'verified', verificationEvidence: '' },
        user: { id: 'owner' },
      },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Verification evidence is required');
    assert.equal(signal.verificationEvidence, 'reviewed in CI');
  } finally {
    EngineeringSignal.findById = originalFindById;
    Project.findOne = originalProjectFindOne;
  }
});

test('rejects whitespace verification evidence without saving', async () => {
  const signal = {
    status: 'fixed_unverified',
    verificationEvidence: undefined,
    project: '507f1f77bcf86cd799439011',
    save: async () => {
      throw new Error('save should not be called');
    },
  };
  const originalFindById = EngineeringSignal.findById;
  const originalProjectFindOne = Project.findOne;
  EngineeringSignal.findById = async () => signal;
  Project.findOne = async () => ({ _id: signal.project });

  try {
    const res = response();
    await signalController.updateSignal(
      {
        params: { id: '507f1f77bcf86cd799439012' },
        body: { status: 'verified', verificationEvidence: '   ' },
        user: { id: 'owner' },
      },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Verification evidence is required');
  } finally {
    EngineeringSignal.findById = originalFindById;
    Project.findOne = originalProjectFindOne;
  }
});

test('preserves valid evidence when updating an unrelated signal field', async () => {
  const signal = {
    status: 'verified',
    verificationEvidence: 'reviewed in CI',
    title: 'Original title',
    project: '507f1f77bcf86cd799439011',
    save: async () => {},
  };
  const originalFindById = EngineeringSignal.findById;
  const originalProjectFindOne = Project.findOne;
  const originalFind = EngineeringSignal.find;
  const originalSnapshotCreate = RiskSnapshot.create;
  EngineeringSignal.findById = async () => signal;
  Project.findOne = async () => ({ _id: signal.project });
  EngineeringSignal.find = () => [];
  RiskSnapshot.create = async () => {};

  try {
    const res = response();
    await signalController.updateSignal(
      {
        params: { id: '507f1f77bcf86cd799439012' },
        body: { title: 'Updated title' },
        user: { id: 'owner' },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(signal.title, 'Updated title');
    assert.equal(signal.verificationEvidence, 'reviewed in CI');
  } finally {
    EngineeringSignal.findById = originalFindById;
    Project.findOne = originalProjectFindOne;
    EngineeringSignal.find = originalFind;
    RiskSnapshot.create = originalSnapshotCreate;
  }
});

test('verifies a signal with valid evidence', async () => {
  const signal = {
    status: 'fixed_unverified',
    verificationEvidence: undefined,
    project: '507f1f77bcf86cd799439011',
    save: async () => {},
  };
  const originalFindById = EngineeringSignal.findById;
  const originalProjectFindOne = Project.findOne;
  const originalFind = EngineeringSignal.find;
  const originalSnapshotCreate = RiskSnapshot.create;
  EngineeringSignal.findById = async () => signal;
  Project.findOne = async () => ({ _id: signal.project });
  EngineeringSignal.find = () => [];
  RiskSnapshot.create = async () => {};

  try {
    const res = response();
    await signalController.updateSignal(
      {
        params: { id: '507f1f77bcf86cd799439012' },
        body: { status: 'verified', verificationEvidence: 'reviewed in CI' },
        user: { id: 'owner' },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(signal.status, 'verified');
    assert.equal(signal.verificationEvidence, 'reviewed in CI');
  } finally {
    EngineeringSignal.findById = originalFindById;
    Project.findOne = originalProjectFindOne;
    EngineeringSignal.find = originalFind;
    RiskSnapshot.create = originalSnapshotCreate;
  }
});
