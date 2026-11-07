import assert from 'node:assert/strict';
import test from 'node:test';
import { ListZonesUseCase } from '../src/modules/zones/application/list-zones.use-case';
import type { ZoneRepository } from '../src/modules/zones/domain/zone.repository';

test('ListZonesUseCase depends on repository port, not Sequelize', async () => {
  const fake: ZoneRepository = {
    findAll: async () => [{ id: 'sakura', name: 'Sakura', maxPlayers: 40, sceneUrl: '/scene.glb' }],
  };
  const result = await new ListZonesUseCase(fake).execute();
  assert.deepEqual(result, [{ id: 'sakura', name: 'Sakura', maxPlayers: 40, sceneUrl: '/scene.glb' }]);
});
