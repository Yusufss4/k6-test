import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '20s',
  thresholds: {
    http_req_duration: ['p(95)<100'],
  },
};

export default function () {
  const res = http.get('https://test.k6.io');

  check(res, {
    'status is 200': (r) => r.status === 200, 
  });

  sleep(1);
}
