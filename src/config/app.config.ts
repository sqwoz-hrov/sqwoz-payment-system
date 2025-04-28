import { registerAs } from '@nestjs/config';
import { get } from 'env-var';

export const APP_CONFIG_KEY = 'app-config';

export const appConfig = registerAs(APP_CONFIG_KEY, () => ({
  DB_HOST: get('DB_HOST').required().asString(),
  DB_PORT: get('DB_PORT').required().asPortNumber(),
  DB_USERNAME: get('DB_USERNAME').required().asString(),
  DB_PASSWORD: get('DB_PASSWORD').required().asString(),
  DB_DATABASE: get('DB_DATABASE').required().asString(),
  DB_SYNC: get('DB_SYNC').default('false').asBool(),

  PORT: get('PORT').default('3000').asPortNumber(),
  SERVER_URL: get('SERVER_URL').default('http://localhost').asUrlString(),
  JWT_SECRET: get('JWT_SECRET').required().asString(),
}));
