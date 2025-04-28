import { registerAs } from '@nestjs/config';
import env from 'env-var';

export const APP_CONFIG_KEY = 'app-config';

export const appConfig = registerAs(APP_CONFIG_KEY, () => ({
  DB_HOST: env.get('DB_HOST').required().asString(),
  DB_PORT: env.get('DB_PORT').required().asPortNumber(),
  DB_USERNAME: env.get('DB_USERNAME').required().asString(),
  DB_PASSWORD: env.get('DB_PASSWORD').required().asString(),
  DB_DATABASE: env.get('DB_DATABASE').required().asString(),
  DB_SYNC: env.get('DB_SYNC').default('false').asBool(),

  PORT: env.get('PORT').default('3000').asPortNumber(),
  SERVER_URL: env.get('SERVER_URL').default('http://localhost').asUrlString(),
  JWT_SECRET: env.get('JWT_SECRET').required().asString(),
}));
