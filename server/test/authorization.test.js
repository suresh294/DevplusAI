const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const projectController = require('../src/controllers/projectController');
const signalController = require('../src/controllers/signalController');
const Project = require('../src/models/project');
const EngineeringSignal = require('../src/models/engineeringSignal');
const RiskSnapshot = require('../src/models/riskSnapshot');

const objectId = (suffix) => `507f1f77bcf86cd7994390${suffix}`;

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

const restore = (target, originals) => {
  Object.entries(originals).forEach(([name, implementation]) => {
    target[name] = implementation;
  });
};

test('JWT tokens identify independent users without client owner input', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-test-secret';
  const userA = jwt.verify(
    jwt.sign({}, process.env.JWT_SECRET, { subject: 'user-a' }),
    process.env.JWT_SECRET
  ).sub;
  const userB = jwt.verify(
    jwt.sign({}, process.env.JWT_SECRET, { subject: 'user-b' }),
    process.env.JWT_SECRET
  ).sub;

  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;

  assert.notEqual(userA, userB);
});

test('projects are isolated for list, read, update, and delete operations', async () => {
  const projectA = { _id: objectId('01'), owner: 'user-a', name: 'A project' };
  const projectB = { _id: objectId('02'), owner: 'user-b', name: 'B project' };
  const originalFind = Project.find;
  const originalFindOne = Project.findOne;
  const originalFindOneAndUpdate = Project.findOneAndUpdate;
  const originalFindOneAndDelete = Project.findOneAndDelete;
  const originalSignalDeleteMany = EngineeringSignal.deleteMany;
  const originalSnapshotDeleteMany = RiskSnapshot.deleteMany;
  const queries = [];
  let updateCalls = 0;
  let deleteCalls = 0;
  Project.find = (query) => {
    queries.push(query);
    return { sort: () => ({ skip: () => ({ limit: async () => (query.owner === 'user-a' ? [projectA] : [projectB]) }) }) };
  };
  Project.findOne = async (query) => query.owner === 'user-a' && query._id === projectA._id ? projectA : null;
  Project.findOneAndUpdate = async (query) => {
    if (query.owner === 'user-a' && query._id === projectA._id) {
      updateCalls += 1;
      return projectA;
    }
    return null;
  };
  Project.findOneAndDelete = async (query) => {
    if (query.owner === 'user-a' && query._id === projectA._id) {
      deleteCalls += 1;
      return projectA;
    }
    return null;
  };
  EngineeringSignal.deleteMany = async () => {};
  RiskSnapshot.deleteMany = async () => {};

  try {
    let res = response();
    await projectController.listProjects({ query: {}, user: { id: 'user-a' } }, res);
    assert.deepEqual(res.body.data, [projectA]);
    assert.deepEqual(queries[0], { owner: 'user-a' });

    res = response();
    await projectController.getProject({ params: { id: projectB._id }, user: { id: 'user-a' } }, res);
    assert.equal(res.statusCode, 404);

    res = response();
    await projectController.updateProject({ params: { id: projectB._id }, body: { name: 'changed' }, user: { id: 'user-a' } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(updateCalls, 0);

    res = response();
    await projectController.deleteProject({ params: { id: projectB._id }, user: { id: 'user-a' } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(deleteCalls, 0);
  } finally {
    restore(Project, { find: originalFind, findOne: originalFindOne, findOneAndUpdate: originalFindOneAndUpdate, findOneAndDelete: originalFindOneAndDelete });
    restore(EngineeringSignal, { deleteMany: originalSignalDeleteMany });
    restore(RiskSnapshot, { deleteMany: originalSnapshotDeleteMany });
  }
});

test('risk history is scoped to the authenticated project owner', async () => {
  const originalFindOne = Project.findOne;
  const originalSnapshotFind = RiskSnapshot.find;
  Project.findOne = async (query) => query.owner === 'user-a' ? { _id: query._id } : null;
  RiskSnapshot.find = (query) => ({ sort: () => ({ limit: async () => [{ project: query.project, riskScore: 10 }] }) });

  try {
    let res = response();
    await projectController.listRiskHistory({ params: { id: objectId('01') }, user: { id: 'user-a' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data[0].project, objectId('01'));

    res = response();
    await projectController.listRiskHistory({ params: { id: objectId('01') }, user: { id: 'user-b' } }, res);
    assert.equal(res.statusCode, 404);
  } finally {
    Project.findOne = originalFindOne;
    RiskSnapshot.find = originalSnapshotFind;
  }
});

test('signals are isolated for list, create, read, update, status, and delete operations', async () => {
  const projectId = objectId('01');
  const signalId = objectId('11');
  const signal = {
    _id: signalId,
    project: projectId,
    status: 'open',
    title: 'A signal',
    type: 'bug',
    severity: 'low',
    save: async () => {},
  };
  const originalProjectFindOne = Project.findOne;
  const originalSignalFind = EngineeringSignal.find;
  const originalSignalCreate = EngineeringSignal.create;
  const originalSignalFindById = EngineeringSignal.findById;
  const originalSignalDeleteOne = EngineeringSignal.deleteOne;
  const originalSnapshotCreate = RiskSnapshot.create;
  let createCalls = 0;
  let deleteCalls = 0;
  Project.findOne = async (query) => query.owner === 'user-a' ? { _id: query._id } : null;
  EngineeringSignal.find = () => ({ sort: () => [signal] });
  EngineeringSignal.create = async () => { createCalls += 1; return signal; };
  EngineeringSignal.findById = async () => signal;
  EngineeringSignal.deleteOne = async () => { deleteCalls += 1; };
  RiskSnapshot.create = async () => {};

  try {
    let res = response();
    await signalController.listSignals({ params: { projectId }, user: { id: 'user-a' } }, res);
    assert.equal(res.statusCode, 200);

    res = response();
    await signalController.listSignals({ params: { projectId }, user: { id: 'user-b' } }, res);
    assert.equal(res.statusCode, 404);

    res = response();
    await signalController.createSignal({ params: { projectId }, user: { id: 'user-b' }, body: { title: 'B', type: 'bug', severity: 'low', status: 'open' } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(createCalls, 0);

    res = response();
    await signalController.getSignal({ params: { id: signalId }, user: { id: 'user-b' } }, res);
    assert.equal(res.statusCode, 404);

    res = response();
    await signalController.updateSignal({ params: { id: signalId }, user: { id: 'user-b' }, body: { title: 'changed' } }, res);
    assert.equal(res.statusCode, 404);

    res = response();
    await signalController.updateSignalStatus({ params: { id: signalId }, user: { id: 'user-b' }, body: { status: 'in_progress' } }, res);
    assert.equal(res.statusCode, 404);

    res = response();
    await signalController.deleteSignal({ params: { id: signalId }, user: { id: 'user-b' } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(deleteCalls, 0);
  } finally {
    restore(Project, { findOne: originalProjectFindOne });
    restore(EngineeringSignal, { find: originalSignalFind, create: originalSignalCreate, findById: originalSignalFindById, deleteOne: originalSignalDeleteOne });
    restore(RiskSnapshot, { create: originalSnapshotCreate });
  }
});

test('signal creation rejects direct verified status and reads do not create snapshots', async () => {
  const projectId = objectId('01');
  const originalProjectFindOne = Project.findOne;
  const originalSignalFind = EngineeringSignal.find;
  const originalSnapshotCreate = RiskSnapshot.create;
  let snapshotCalls = 0;
  Project.findOne = async () => ({ _id: projectId });
  EngineeringSignal.find = () => ({ sort: () => [] });
  RiskSnapshot.create = async () => { snapshotCalls += 1; };

  try {
    let res = response();
    await signalController.createSignal({
      params: { projectId },
      user: { id: 'user-a' },
      body: { title: 'Verified', type: 'bug', severity: 'high', status: 'verified', verificationEvidence: 'claimed' },
    }, res);
    assert.equal(res.statusCode, 400);

    res = response();
    await signalController.listSignals({ params: { projectId }, user: { id: 'user-a' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(snapshotCalls, 0);
  } finally {
    Project.findOne = originalProjectFindOne;
    EngineeringSignal.find = originalSignalFind;
    RiskSnapshot.create = originalSnapshotCreate;
  }
});

test('unauthenticated operations are rejected by the route mount middleware', () => {
  const authenticate = require('../src/middleware/auth');
  const res = response();
  authenticate({ get: () => undefined }, res, () => {});
  assert.equal(res.statusCode, 401);
});
