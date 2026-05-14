import http from 'k6/http';
import exec from 'k6/execution';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Custom metrics allow you to track business-level behavior,
 * not only low-level HTTP timing.
 */
const successfulFlows = new Counter('successful_flows');
const flowDuration = new Trend('flow_duration', true);
const checkFailureRate = new Rate('check_failure_rate');

/**
 * This script is intentionally "kitchen sink" style so you can
 * demo many k6 features in one run:
 * - scenarios with different executors
 * - setup/teardown lifecycle hooks
 * - groups and request tagging
 * - checks and thresholds (global + per tag)
 * - custom metrics
 * - batches, randomized behavior, and custom summary output
 */
export const options = {
  scenarios: {
    // Scenario A: classic virtual-user load shape.
    browser_like_users: {
      executor: 'ramping-vus',
      exec: 'userJourneyScenario',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 10 },
        { duration: '30s', target: 20 },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '5s',
      tags: { scenario_type: 'journey' },
    },

    // Scenario B: request-rate based traffic model.
    api_spike_probe: {
      executor: 'constant-arrival-rate',
      exec: 'apiProbeScenario',
      rate: 12, // 12 iterations per second
      timeUnit: '1s',
      duration: '45s',
      preAllocatedVUs: 20,
      maxVUs: 60,
      tags: { scenario_type: 'probe' },
      startTime: '5s',
    },
  },

  /**
   * Thresholds can be attached to built-in metrics or custom metrics.
   * You can also scope a threshold to tagged subsets of traffic.
   */
  thresholds: {
    // Global latency budget.
    http_req_duration: ['p(95)<800'],

    // A stricter budget only for requests tagged as "home".
    'http_req_duration{page:home}': ['p(95)<500'],

    // Ensure almost all checks pass.
    checks: ['rate>0.98'],

    // Custom metric thresholds.
    check_failure_rate: ['rate<0.02'],
    flow_duration: ['p(90)<1200'],
  },

  // Adds rich metadata to every metric point.
  tags: {
    demo: 'complex-showcase',
    team: 'performance',
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

/**
 * setup() runs once before any VU starts.
 * Use it for one-time test data prep or auth bootstrap.
 */
export function setup() {
  const baseUrl = __ENV.BASE_URL || 'https://test.k6.io';

  // Synthetic "dataset" shared with all VUs.
  const paths = ['/', '/news.php', '/contacts.php', '/flip_coin.php'];

  return {
    baseUrl,
    paths,
    runId: `run-${Date.now()}`,
  };
}

/**
 * teardown() runs once after all scenarios complete.
 * Use it for cleanup or final reporting side effects.
 */
export function teardown(data) {
  console.log(`Teardown complete for ${data.runId}`);
}

/**
 * Scenario A:
 * Simulates a user journey with grouped steps, batches, checks,
 * randomized behavior, and think time.
 */
export function userJourneyScenario(data) {
  const start = Date.now();
  const pickedPath = randomItem(data.paths);
  const vu = exec.vu.idInTest;
  const iteration = exec.scenario.iterationInTest;

  group('01 - Landing + assets', () => {
    const responses = http.batch([
      {
        method: 'GET',
        url: `${data.baseUrl}${pickedPath}`,
        params: {
          tags: {
            flow_step: 'landing',
            page: pickedPath === '/' ? 'home' : 'secondary',
          },
        },
      },
      {
        method: 'GET',
        url: `${data.baseUrl}/static/css/site.css`,
        params: {
          tags: {
            flow_step: 'landing',
            page: 'asset',
          },
        },
      },
    ]);

    const landingOk = check(responses[0], {
      'landing status is 200': (r) => r.status === 200,
      'landing has HTML doctype': (r) => r.body && r.body.includes('<!DOCTYPE html>'),
    });

    // Track failed checks in our custom failure-rate metric.
    checkFailureRate.add(!landingOk);
  });

  group('02 - Read page + optional follow-up', () => {
    const thinkTime = randomIntBetween(1, 3);
    sleep(thinkTime);

    // Add query params just to show data-driven request shaping.
    const res = http.get(`${data.baseUrl}/?vu=${vu}&iter=${iteration}`, {
      tags: { flow_step: 'read', page: 'home' },
    });

    const readOk = check(res, {
      'read page status is 200': (r) => r.status === 200,
      'read page contains title': (r) => r.body && r.body.includes('<title>'),
    });
    checkFailureRate.add(!readOk);

    // 40% of iterations execute an extra request branch.
    if (Math.random() < 0.4) {
      const extra = http.get(`${data.baseUrl}/flip_coin.php`, {
        tags: { flow_step: 'optional-branch', page: 'coin' },
      });

      const extraOk = check(extra, {
        'optional branch status is 200': (r) => r.status === 200,
      });
      checkFailureRate.add(!extraOk);
    }
  });

  const totalFlowMs = Date.now() - start;
  flowDuration.add(totalFlowMs, { scenario: 'userJourneyScenario' });
  successfulFlows.add(1);
}

/**
 * Scenario B:
 * A lighter-weight endpoint probe, tuned for rate-based pressure.
 */
export function apiProbeScenario(data) {
  const path = randomItem(data.paths);

  const res = http.get(`${data.baseUrl}${path}`, {
    tags: { flow_step: 'probe', page: path === '/' ? 'home' : 'secondary' },
    headers: {
      'x-demo-run-id': data.runId,
      'x-vu': String(exec.vu.idInTest),
    },
  });

  const ok = check(res, {
    'probe status is 200': (r) => r.status === 200,
    'probe duration < 1200ms': (r) => r.timings.duration < 1200,
  });

  checkFailureRate.add(!ok);

  // Small jitter prevents perfectly synchronized request bursts.
  sleep(Math.random() * 0.5);
}

/**
 * handleSummary gives complete control over generated output files.
 * k6 will write these files after test execution.
 */
export function handleSummary(data) {
  return {
    stdout: `\nCustom summary: ${data.metrics.http_reqs.values.count} total requests\n`,
    '05-complex-summary.json': JSON.stringify(data, null, 2),
  };
}
