k6 run scripts/01-smoke.js
k6 run scripts/02-load-stages.js
k6 run scripts/03-checks-threshold-pass.js
echo $?
k6 run scripts/03-checks-threshold-fail.js
echo $?
docker compose -f observability/docker-compose.yml up -d
k6 run --out influxdb=http://localhost:8086/k6 scripts/02-load-stages.js
docker compose -f observability/docker-compose.yml down
k6 run scripts/05-complex-feature-showcase.js