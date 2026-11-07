import { Module } from '@nestjs/common';
import { ListZonesUseCase } from './application/list-zones.use-case';
import { ZONE_REPOSITORY, type ZoneRepository } from './domain/zone.repository';
import { SequelizeZoneRepository } from './infrastructure/sequelize-zone.repository';
import { ZonesController } from './presentation/zones.controller';

@Module({
  controllers: [ZonesController],
  providers: [
    { provide: ZONE_REPOSITORY, useClass: SequelizeZoneRepository },
    { provide: ListZonesUseCase, useFactory: (repo: ZoneRepository) => new ListZonesUseCase(repo), inject: [ZONE_REPOSITORY] },
  ],
})
export class ZonesModule {}
