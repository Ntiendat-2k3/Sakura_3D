import { AllowNull, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table, Unique } from 'sequelize-typescript';
import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import { UserModel } from './user.model';

@Table({ tableName: 'wallets', timestamps: true, underscored: true })
export class WalletModel extends Model<InferAttributes<WalletModel>, InferCreationAttributes<WalletModel>> {
  @PrimaryKey @Default(DataType.UUIDV4) @Column(DataType.UUID)
  declare id: CreationOptional<string>;

  @ForeignKey(() => UserModel) @Unique @AllowNull(false) @Column(DataType.UUID)
  declare userId: string;

  // NOTE: balances require an atomic, immutable ledger before real purchases.
  @AllowNull(false) @Default(0) @Column(DataType.BIGINT)
  declare balanceCoins: CreationOptional<string>;
}
