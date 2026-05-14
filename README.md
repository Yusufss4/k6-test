# k6 Presentation Demo

This repo contains a live-demo sequence you can present end-to-end.

## Prerequisites

- `k6` installed and available in your shell
- Docker (for Step 4 observability)

## Step 1: Baseline (Smoke Test)

Script: `scripts/01-smoke.js`

Run:

```bash
k6 run scripts/01-smoke.js
```

What to explain in terminal output:

- `http_req_duration`: latency per HTTP request (how long one request takes).
- `http_reqs`: request throughput (how many requests were sent over time).
- A service can have low latency and low throughput, or higher latency and high throughput; these are different dimensions.

## Step 2: Ramping Up (Load Test with Stages)

Script: `scripts/02-load-stages.js`

Traffic model:

- ramp-up: 0 -> 50 VUs in 30 seconds
- steady state: hold 50 VUs for 1 minutes
- ramp-down: 50 -> 0 VUs in 30 seconds

Run:

```bash
k6 run scripts/02-load-stages.js
```

What to call out:

- k6 scales VUs gradually according to `options.stages`.
- The output reflects each stage and final aggregate metrics.

## Step 3: Reliability & CI/CD (Checks + Thresholds)

### 3A. Passing budget

Script: `scripts/03-checks-threshold-pass.js`

Run:

```bash
k6 run scripts/03-checks-threshold-pass.js
echo $?
```

Talking points:

- `check()` validates `status === 200`.
- Failed checks increase an error metric but do not automatically fail the process.
- Threshold `http_req_duration: ['p(95)<300']` enforces a performance SLO and should usually pass for this endpoint.

### 3B. Intentionally failing budget

Script: `scripts/03-checks-threshold-fail.js`

Run:

```bash
k6 run scripts/03-checks-threshold-fail.js
echo $?
```

Talking points:

- Same checks, but threshold is intentionally strict: `p(95)<10`.
- k6 marks threshold as failed, output turns red, and process exits non-zero.
- This is the CI gate that prevents slow code from being merged.

CI example (GitHub Actions style):

```yaml
name: k6-performance-gate
on: [pull_request]
jobs:
  k6:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/setup-k6-action@v1
      - name: Run performance gate
        run: k6 run scripts/03-checks-threshold-pass.js
```

## Step 4: Observability (Optional, high impact)

Setup docs: `observability/README.md`

Start stack:

```bash
docker compose -f observability/docker-compose.yml up -d
```

Run test with streaming output:

```bash
k6 run --out influxdb=http://localhost:8086/k6 scripts/02-load-stages.js
```

Open Grafana at `http://localhost:3000` and go to **Dashboards > k6 > k6 Overview**.
Datasource and dashboard are auto-provisioned at container startup.

Stop stack:

```bash
docker compose -f observability/docker-compose.yml down
```
