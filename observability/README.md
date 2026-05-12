# Local Grafana + InfluxDB for k6

## Start the stack

```bash
docker compose -f observability/docker-compose.yml up -d
```

If the stack was already running before provisioning files were added, restart it:

```bash
docker compose -f observability/docker-compose.yml down
docker compose -f observability/docker-compose.yml up -d
```

## Open Grafana

- URL: `http://localhost:3000`
- Username: `admin`
- Password: `admin`
- Datasource `InfluxDB-k6` is provisioned automatically.
- Dashboard `k6 Overview` is provisioned automatically in folder `k6`.

## Stream k6 metrics

```bash
k6 run --out influxdb=http://localhost:8086/k6 scripts/02-load-stages.js
```

Then open **Dashboards > k6 > k6 Overview** to see live charts.

## Stop the stack

```bash
docker compose -f observability/docker-compose.yml down
```
