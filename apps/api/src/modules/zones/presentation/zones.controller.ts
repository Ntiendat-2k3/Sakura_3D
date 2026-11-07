import { Controller, Get } from '@nestjs/common';
import { ListZonesUseCase } from '../application/list-zones.use-case';

@Controller('api/v1/zones')
export class ZonesController {
  constructor(private readonly listZones: ListZonesUseCase) {}
  @Get() getZones() { return this.listZones.execute(); }
}
