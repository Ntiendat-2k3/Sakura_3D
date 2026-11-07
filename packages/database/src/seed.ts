import { config } from 'dotenv';
import path from 'node:path';
import { createSequelize, ZoneModel } from './index';
config({ path: path.resolve(process.cwd(), '../../.env') });
const sequelize = createSequelize(process.env.DATABASE_URL ?? '');
async function main() {
  await sequelize.authenticate();
  const zones = [
    { id: 'sakura-square', name: 'Sakura Square', sceneUrl: '/scenes/sakura-square.glb', maxPlayers: 24 },
    { id: 'sakura-club', name: 'Sakura Club', sceneUrl: '/scenes/sakura-club.glb', maxPlayers: 24 },
    { id: 'moon-lounge', name: 'Moon Lounge', sceneUrl: '/scenes/moon-lounge.glb', maxPlayers: 20 },
  ];
  for (const zone of zones) await ZoneModel.upsert(zone);
  console.log(`Seeded ${zones.length} demo zones`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => sequelize.close());
