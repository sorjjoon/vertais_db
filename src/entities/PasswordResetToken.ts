import "reflect-metadata";
import { Column, Entity, OneToOne } from "typeorm";

import { randomString } from "../utils/utils";
import { Account } from "./Account";
import { Base, BaseWithOwner } from "./Base";

@Entity()
export class PasswordResetToken extends BaseWithOwner {
  @Column({ nullable: false })
  expires!: Date;

  @Column({ nullable: false, unique: true, length: 300 })
  token!: string;
}
