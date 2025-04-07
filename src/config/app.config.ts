import { registerAs } from '@nestjs/config';
import { getOrDefault, getOrThrow } from './utils';

export const APP_CONFIG_KEY = 'app-config';

export const appConfig = registerAs(APP_CONFIG_KEY, () => ({
  DB_HOST: getOrThrow('DB_HOST'),
  DB_PORT: parseInt(getOrThrow('DB_PORT')),
  DB_USERNAME: getOrThrow('DB_USERNAME'),
  DB_PASSWORD: getOrThrow('DB_PASSWORD'),
  DB_DATABASE: getOrThrow('DB_DATABASE'),
  DB_SYNC: getOrDefault('DB_SYNC', 'false') === 'true' ? true : false, // Should be false in production

  PORT: parseInt(getOrDefault('PORT', '3000')),
  JWT_SECRET: getOrThrow('JWT_SECRET'),
  ENV: getOrDefault('NODE_ENV', 'development'),
}));
