import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Sequelize } from 'sequelize-typescript';
import { UserModel } from '@metaverse/database';
import { DB_CONNECTION } from '../../../database/database.module';
import type { GuestIdentity, GuestRepository } from '../domain/guest.repository';
@Injectable()
export class SequelizeGuestRepository implements GuestRepository {
  constructor(@Inject(DB_CONNECTION) private readonly db: Sequelize) {}
  async createGuest(): Promise<GuestIdentity> {
    const Model = this.db.models[UserModel.name] as typeof UserModel | undefined;
    if (!Model) throw new Error('UserModel not registered with Sequelize');
    const id = randomUUID();
    const name = `Guest-${id.slice(0, 8)}`;
    const row = await Model.create({ id, username: name, email: `guest+${id}@example.invalid` });
    return { id: row.id, name: row.username };
  }
}
