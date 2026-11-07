import { AllowNull, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import { UserModel } from './user.model';

@Table({ tableName: 'avatars', timestamps: true, underscored: true })
export class AvatarModel extends Model<InferAttributes<AvatarModel>, InferCreationAttributes<AvatarModel>> {
  @PrimaryKey @Default(DataType.UUIDV4) @Column(DataType.UUID)
  declare id: CreationOptional<string>;

  @ForeignKey(() => UserModel) @AllowNull(false) @Column(DataType.UUID)
  declare userId: string;

  @AllowNull(false) @Column(DataType.STRING(80))
  declare name: string;

  @AllowNull(false) @Default({}) @Column(DataType.JSONB)
  declare config: CreationOptional<Record<string, unknown>>;
}
