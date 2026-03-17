import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  driver: require('@mikro-orm/postgresql').PostgreSqlDriver,
  extensions: [Migrator],
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER || 'admin',
  password: process.env.DATABASE_PASSWORD || 'admin123',
  dbName: process.env.DATABASE_NAME || 'bot_history',
  entities: ['dist/**/*.entity.js'],
  entitiesTs: ['src/**/*.entity.ts'],
  debug: process.env.NODE_ENV === 'development',
  migrations: {
    path: path.join(__dirname, 'dist/migrations'),
    pathTs: path.join(__dirname, 'src/migrations'),
    disableForeignKeys: false,
  },
});
