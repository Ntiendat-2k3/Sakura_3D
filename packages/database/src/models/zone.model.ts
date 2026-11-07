import { AllowNull, Column, DataType, Default, Model, PrimaryKey, Table } from 'sequelize-typescript';
import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';

@Table({ tableName: 'zones', timestamps: true, underscored: true })
export class ZoneModel extends Model<InferAttributes<ZoneModel>, InferCreationAttributes<ZoneModel>> {
  @PrimaryKey @Column(DataType.STRING(64))
  declare id: string;

  @AllowNull(false) @Column(DataType.STRING(120))
  declare name: string;

  @AllowNull(false) @Default(40) @Column(DataType.INTEGER)
  declare maxPlayers: CreationOptional<number>;

  @AllowNull(false) @Column(DataType.STRING(255))
  declare sceneUrl: string;
}
