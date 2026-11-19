import { existsSync } from 'node:fs';

// Local runs read backend/.env; CI sets variables directly.
if (existsSync('.env')) process.loadEnvFile('.env');
