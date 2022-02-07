import "reflect-metadata";
import { ISession } from "connect-typeorm";
import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { Base } from "./Base";

@Entity()
export class Session extends Base implements ISession {
  @Index()
  @Column("bigint")
  public expiredAt = Date.now();

  @PrimaryColumn("varchar", { length: 255, primary: true })
  public id = "";

  @Column("text")
  public json = "";
}
