import 'reflect-metadata';
import { config } from 'dotenv';
import path from 'node:path';
import { Controller, Get, Inject, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Sequelize } from 'sequelize-typescript';
import { DatabaseModule, DB_CONNECTION } from './database/database.module';
import { ZonesModule } from './modules/zones/zones.module';
import { AuthModule } from './modules/auth/auth.module';
config({ path: path.resolve(process.cwd(), '../../.env') });
@Controller('api/v1/health')
class HealthController {
  constructor(@Inject(DB_CONNECTION) private readonly db: Sequelize) {}
  @Get() async health() { await this.db.authenticate(); return { ok: true, service: 'api', database: 'connected', orm: 'sequelize' }; }
}
@Module({ imports: [DatabaseModule, ZonesModule, AuthModule], controllers: [HealthController] })
class AppModule {}
async function bootstrap() {
  if (!process.env.DEMO_JWT_SECRET || process.env.DEMO_JWT_SECRET.length < 32) throw new Error('Configure DEMO_JWT_SECRET >=32 characters');
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  // CORS_ORIGIN nhận nhiều origin cách nhau bởi dấu phẩy, vd. thêm https://<máy>.<tailnet>.ts.net khi chơi qua Tailscale.
  const origins = new Set((process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map(origin => origin.trim()).filter(Boolean));
  // Next trên Windows hiển thị URL 127.0.0.1; trình duyệt xem đây là origin khác localhost.
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }
  app.enableCors({ origin: [...origins], methods: ['GET', 'POST'] });
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '127.0.0.1');
  console.log(`API http://localhost:${port}/api/v1/health`);
}
bootstrap().catch(error => { console.error(error); process.exitCode = 1; });
