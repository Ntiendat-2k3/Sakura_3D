import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { createSequelize } from '@metaverse/database';
export const DB_CONNECTION = Symbol('DB_CONNECTION');

@Injectable()
class DatabaseShutdown implements OnApplicationShutdown {
  constructor(@Inject(DB_CONNECTION) private readonly db: Sequelize) {}
  async onApplicationShutdown() { await this.db.close(); }
}

@Global()
@Module({
  providers: [
    {
      provide: DB_CONNECTION,
      useFactory: async (): Promise<Sequelize> => {
        const db = createSequelize(process.env.DATABASE_URL ?? '');
        await db.authenticate();
        return db;
      },
    },
    DatabaseShutdown,
  ],
  exports: [DB_CONNECTION],
})
export class DatabaseModule {}
