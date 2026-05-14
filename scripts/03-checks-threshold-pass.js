import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '20s',
  thresholds: {
    http_req_duration: ['p(95)<300'],
  },
};

export default function () {
  const res = http.get('https://test.k6.io');

  check(res, {
    'status is 200': (r) => r.stastus === 200,
  });

  sleep(1);
}
