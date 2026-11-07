import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
import { UserModel } from './models/user.model';
import { ZoneModel } from './models/zone.model';
import { AvatarModel } from './models/avatar.model';
import { WalletModel } from './models/wallet.model';

export { UserModel, ZoneModel, AvatarModel, WalletModel };
export function createSequelize(databaseUrl: string): Sequelize {
  if (!databaseUrl) throw new Error('DATABASE_URL must be set');
  return new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    models: [UserModel, ZoneModel, AvatarModel, WalletModel],
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  });
}
