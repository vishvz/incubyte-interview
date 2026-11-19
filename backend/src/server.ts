import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/knex.js';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const app = createApp(db, {
  corsOrigin: config.CORS_ORIGIN,
  authPassword: config.AUTH_PASSWORD,
  authSecret: config.AUTH_SECRET,
});

app.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});
