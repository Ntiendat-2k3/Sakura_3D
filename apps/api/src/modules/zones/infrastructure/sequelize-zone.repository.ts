import { Inject, Injectable } from '@nestjs/common';
import type { Sequelize } from 'sequelize-typescript';
import { ZoneModel } from '@metaverse/database';
import { DB_CONNECTION } from '../../../database/database.module';
import type { Zone } from '../domain/zone';
import type { ZoneRepository } from '../domain/zone.repository';

@Injectable()
export class SequelizeZoneRepository implements ZoneRepository {
  constructor(@Inject(DB_CONNECTION) private readonly db: Sequelize) {}
  async findAll(): Promise<readonly Zone[]> {
    // Resolve models from this connection: avoids global static Model calls and enables isolated tests.
    const Model = this.db.models[ZoneModel.name] as typeof ZoneModel | undefined;
    if (!Model) throw new Error('ZoneModel not registered with Sequelize');
    const rows = await Model.findAll({ order: [['name', 'ASC']] });
    return rows.map(row => ({
      id: row.id, name: row.name, maxPlayers: row.maxPlayers, sceneUrl: row.sceneUrl,
    }));
  }
}
