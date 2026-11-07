import { AllowNull, Column, DataType, Default, Model, PrimaryKey, Table, Unique } from 'sequelize-typescript';
import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';

@Table({ tableName: 'users', timestamps: true, underscored: true })
export class UserModel extends Model<InferAttributes<UserModel>, InferCreationAttributes<UserModel>> {
  @PrimaryKey @Default(DataType.UUIDV4) @Column(DataType.UUID)
  declare id: CreationOptional<string>;

  @AllowNull(false) @Unique @Column(DataType.STRING(64))
  declare username: string;

  @AllowNull(false) @Unique @Column(DataType.STRING(255))
  declare email: string;

  @AllowNull(false) @Default('ACTIVE') @Column(DataType.STRING(20))
  declare status: CreationOptional<string>;
}
