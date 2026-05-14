import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 50 }, // In 30 seconds we want to ramp up to 0 to 50 users.
    { duration: '45s', target: 50 }, // In 1 minute we want to hold 50 users.
    { duration: '15s', target: 0 }, // In 30 seconds we want to ramp down to 0 users.
  ],
};

export default function () {
  http.get('https://test.k6.io');
  sleep(1);
}

