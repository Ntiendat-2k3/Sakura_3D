import { config } from 'dotenv';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Umzug, SequelizeStorage } from 'umzug';
import { createSequelize } from './index';

config({ path: path.resolve(process.cwd(), '../../.env') });
const sequelize = createSequelize(process.env.DATABASE_URL ?? '');
const migrator = new Umzug({
  migrations: {
    glob: path.join(__dirname, 'migrations', '*.ts').replaceAll('\\', '/'),
    resolve: ({ name, path: filepath, context }) => ({
      name,
      up: async () => (await import(pathToFileURL(filepath!).href)).up(context),
      down: async () => (await import(pathToFileURL(filepath!).href)).down(context),
    }),
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});
async function main() {
  const cmd = process.argv[2] ?? 'up';
  if (cmd === 'up') await migrator.up();
  else if (cmd === 'down') await migrator.down();
  else if (cmd === 'pending') console.log(await migrator.pending());
  else throw new Error(`Unknown migration command: ${cmd}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => sequelize.close());
