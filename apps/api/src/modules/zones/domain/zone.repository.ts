import type { Zone } from './zone';
export const ZONE_REPOSITORY = Symbol('ZONE_REPOSITORY');
export interface ZoneRepository {
  findAll(): Promise<readonly Zone[]>;
}
