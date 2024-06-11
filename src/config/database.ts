import admin from 'firebase-admin';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA4VsEz6TrPNv6Fn-mHnbC-D5L5rg_-c-4',
  authDomain: 'proarg-72b36.firebaseapp.com',
  projectId: 'proarg-72b36',
  storageBucket: 'proarg-72b36.appspot.com',
  messagingSenderId: '212150994110',
  appId: '1:212150994110:web:5a23c12d64293c1abf8aef',
  measurementId: 'G-7PQXET9RGV',
};

const accountServiceConfig = {
  type: 'service_account',
  project_id: 'proarg-72b36',
  private_key_id: '523501ed7521949fdcd78fb3cf9e4c54a2c7d517',
  private_key:
    '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDKQHUtWXRsiF8f\nW3dQcNawDd2r16bRgVjPkztXqAKBF1IDCfc/FKDki5AXfnPrWPIwGPF9aWCCJcaI\nb0hy7q+O5CnIsu21Vtq2pkrzS2VfzqDkgDr6SFrgzEnf3ehBzVfhMyrTzrGeemLf\nOclkHqJDT+q0Bc0MncBf8fP0DZwJJnYdyA8IM9erXtPE9KXJzS1OYx0x5SJUak1V\nILEn6xYx5aSvWf76imduzCWskQ97h5j85FC7Cc4GLm1vDV8ZhRvh7sF+U2hst74p\nlw+nFgU4VPoPWFfr6DIjo5IvrR1+fE35jKLyllgUXowqpzwVy9idsezJIlaeeM2q\nXW1AYArtAgMBAAECggEAF9G+5cgK7HFPH/FKEauIYpREzrqHcgBqxjTlIJiv2tDf\n9BhWCb7TMrdhEUiaPFXDCCPCj8OQ/c2XHnWvXEx8rovJLqgr/gGsS9CKiTFlpK1A\nHkkf07QhHSfSF3nEow3yU0UPE9eG7E7Q8CXtGvZ5+QrOGG+Kdk7p23gyWUQfuU/x\nqbjsuMzH9nBR02HPVX+MRNDScvMgsuF2nSWaiEHNP4uXPKkAeiQT+OZSCZFKhJ+S\n4Tnlzf1Lw67uKZoL5WxpMV4XmB7E0kyB1DbiMjCQzd1iKSHB72q09peCX/zT3Af0\nklKFK099yArEe1i1Wp0jxhG7obtCKom4nL2Hk8Q+PQKBgQDrH94WFvg3HeX8JOKj\nRiRkvhD/+jLmUdmBFyKHuyJ1n4J2tD3CJyeMHe7ax2pJQtTLXmk1GnrV2ArSisnV\n1sA05X469aT776u4idMF7B2/QaIYBGnVGMxf7lIRsHHKGGG6FECxyVPVKOMMNsGh\n0p9rp7rpw7pnFUW3o/Z4MIarKwKBgQDcNW2qvefabFEnXto7JMJXZ8O8+OP27quu\nNH/nGA/mKx6NOCoNjpET6XLZIiLYu2BgKTT9fhJa7rXV+p9+cY8HRtj43gVkQrdO\npYvnjdYcVbqy3GwPVvZlL9okrA6LFMhVtTvF5NW6pWnynvsmQ5PJI2B79SKj+bVa\nYSqopQK2RwKBgCpkTH5fFdGaKmUToWketGEVg6sjSRoNl9GWgjtGmifq4nLUfG4M\n8SxqGS6I1bjvu74O/5j7dTopAYqES2+qkGz5E5E9yMlDpQpYjxt6PsLE6py57vrk\nxbRmG5Xk4h811ijejeuACQVdodIJ7U9n0iZuz1xmVa1QQImjnkR9O0qRAoGAfvF9\n6vPW+J+AmQWhIH8sWV7EA+gm4m7sIVy6bun8IF+zGQ3LkE0jbSsivfFjzTUXddfL\naGaJBkqeIGB+GVI1daht4+l5ija7nWbpo+6sA2GYYwuWb7FeES7ovkNBjwPICUCU\n2Jv2acZ5sRfdCE3koAr4z/ycn5KP7S4efWHCknkCgYAsSXA08vB20PhqfgYfLlOa\nAf5JQa7XkIv/Hkr5kjO2tneRe6KSHyUCAUQ4KnQindtK8BfZ8aN7OD+I6VGVMQOC\nX/h0LcjgVX5o7w5HjEoGXySBxQsJ8Pj1hXdSlwmnFzkKME6KViRm6+zhPbDEfvgH\nJAcXFPuw7eYWCrVBjDqcvQ==\n-----END PRIVATE KEY-----\n',
  client_email: 'firebase-adminsdk-cwk9q@proarg-72b36.iam.gserviceaccount.com',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

admin.initializeApp({
  credential: admin.credential.cert({
    privateKey: accountServiceConfig.private_key,
    projectId: accountServiceConfig.project_id,
    clientEmail: accountServiceConfig.client_email,
  }),
  storageBucket: 'proarg-72b36.appspot.com',
});

const bucket = admin.storage().bucket();

export { bucket, db };
