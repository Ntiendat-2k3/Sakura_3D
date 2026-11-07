import type { Zone } from '../domain/zone';
import type { ZoneRepository } from '../domain/zone.repository';

export class ListZonesUseCase {
  constructor(private readonly zones: ZoneRepository) {}
  execute(): Promise<readonly Zone[]> {
    return this.zones.findAll();
  }
}
