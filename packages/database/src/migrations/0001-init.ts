import { DataTypes, QueryInterface } from 'sequelize';

const timestamp = () => ({ type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW });
const uuidId = () => ({ type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 });
export async function up(q: QueryInterface): Promise<void> {
  await q.createTable('users', {
    id: uuidId(), username: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
    created_at: timestamp(), updated_at: timestamp(),
  });
  await q.createTable('zones', {
    id: { type: DataTypes.STRING(64), primaryKey: true, allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    max_players: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 40 },
    scene_url: { type: DataTypes.STRING(255), allowNull: false },
    created_at: timestamp(), updated_at: timestamp(),
  });
  await q.createTable('avatars', {
    id: uuidId(), user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    name: { type: DataTypes.STRING(80), allowNull: false },
    config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_at: timestamp(), updated_at: timestamp(),
  });
  await q.addIndex('avatars', ['user_id']);
  await q.createTable('wallets', {
    id: uuidId(), user_id: { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    balance_coins: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    created_at: timestamp(), updated_at: timestamp(),
  });
  await q.sequelize.query('ALTER TABLE wallets ADD CONSTRAINT wallets_non_negative_balance CHECK (balance_coins >= 0)');
}
export async function down(q: QueryInterface): Promise<void> {
  for (const table of ['wallets', 'avatars', 'zones', 'users']) await q.dropTable(table);
}
