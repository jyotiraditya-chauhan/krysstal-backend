import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ maxInstances: 10 });

export { api } from './features/api/api.functions.js';
export { createUser } from './features/users/users.functions.js';
export { adjustCoinBalance } from './features/coins/coins.functions.js';
export { sendNotification, broadcastNotification } from './features/notifications/notifications.functions.js';
