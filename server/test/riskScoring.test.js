const test = require('node:test');
const assert = require('node:assert/strict');
const scoreSignals = require('../src/services/riskScoring');

const signal = (overrides = {}) => ({
  _id: 'signal-1',
  title: 'Example signal',
  severity: 'low',
  type: 'bug',
  status: 'open',
  ...overrides,
});

test('returns zero risk and full health for empty input', () => {
  assert.deepEqual(scoreSignals([]), {
    riskScore: 0,
    healthScore: 100,
    riskLevel: 'low',
    breakdown: [],
    signalCount: 0,
    statusCounts: {
      open: 0,
      in_progress: 0,
      fixed_unverified: 0,
      verified: 0,
      reopened: 0,
    },
  });
});

test('applies every severity and type point mapping', () => {
  const result = scoreSignals([
    signal({ severity: 'low', type: 'failed_test' }),
    signal({ severity: 'medium', type: 'bug' }),
    signal({ severity: 'high', type: 'dependency_alert' }),
    signal({ severity: 'critical', type: 'failed_test' }),
  ]);

  assert.deepEqual(result.breakdown.map(({ basePoints }) => basePoints), [15, 20, 37, 50]);
  assert.equal(result.riskScore, 100);
});

test('applies every status multiplier and reports status counts', () => {
  const statuses = ['open', 'in_progress', 'fixed_unverified', 'verified', 'reopened'];
  const result = scoreSignals(statuses.map((status) => signal({ status })));

  assert.deepEqual(
    result.breakdown.map(({ statusMultiplier }) => statusMultiplier),
    [1, 0.7, 0.5, 0, 1.2]
  );
  assert.deepEqual(result.statusCounts, {
    open: 1,
    in_progress: 1,
    fixed_unverified: 1,
    verified: 1,
    reopened: 1,
  });
});

test('rounds total contribution to the nearest integer', () => {
  const result = scoreSignals([
    signal({ severity: 'low', type: 'bug', status: 'in_progress' }),
    signal({ severity: 'low', type: 'bug', status: 'in_progress' }),
  ]);

  assert.equal(result.breakdown[0].contribution, 9.1);
  assert.equal(result.riskScore, 18);
});

test('caps risk at 100 and derives inverse health', () => {
  const result = scoreSignals(
    Array.from({ length: 3 }, (_, index) => signal({
      _id: `signal-${index}`,
      severity: 'critical',
      type: 'dependency_alert',
      status: 'reopened',
    }))
  );

  assert.equal(result.riskScore, 100);
  assert.equal(result.healthScore, 0);
  assert.equal(result.riskLevel, 'critical');
});

test('uses low, medium, high, and critical threshold boundaries', () => {
  const low = scoreSignals([signal({ severity: 'low', type: 'bug' })]);
  const medium = scoreSignals([
    signal({ severity: 'medium', type: 'bug' }),
    signal({ severity: 'medium', type: 'bug' }),
  ]);
  const high = scoreSignals([
    signal({ severity: 'high', type: 'bug' }),
    signal({ severity: 'high', type: 'bug' }),
  ]);
  const critical = scoreSignals([
    signal({ severity: 'critical', type: 'bug' }),
    signal({ severity: 'critical', type: 'bug' }),
  ]);

  assert.equal(low.riskScore, 13);
  assert.equal(low.riskLevel, 'low');
  assert.equal(medium.riskScore, 40);
  assert.equal(medium.riskLevel, 'medium');
  assert.equal(high.riskScore, 66);
  assert.equal(high.riskLevel, 'high');
  assert.equal(critical.riskScore, 96);
  assert.equal(critical.riskLevel, 'critical');
});

test('includes identifiers, transparent fields, count, and does not mutate input', () => {
  const input = [signal({ id: 'signal-id', title: '  Preserve input  ' })];
  const snapshot = structuredClone(input);
  const result = scoreSignals(input);

  assert.equal(result.breakdown[0].signalId, 'signal-1');
  assert.equal(result.breakdown[0].title, '  Preserve input  ');
  assert.equal(result.signalCount, 1);
  assert.deepEqual(input, snapshot);
});

test('rejects malformed input and unknown values clearly', () => {
  assert.throws(() => scoreSignals(null), /Signals must be an array/);
  assert.throws(() => scoreSignals([null]), /Signal at index 0 must be an object/);
  assert.throws(() => scoreSignals([signal({ title: '' })]), /non-empty title/);
  assert.throws(() => scoreSignals([signal({ severity: 'unknown' })]), /Unknown severity/);
  assert.throws(() => scoreSignals([signal({ type: 'unknown' })]), /Unknown type/);
  assert.throws(() => scoreSignals([signal({ status: 'unknown' })]), /Unknown status/);
});
