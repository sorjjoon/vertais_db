import "reflect-metadata";

import { Column, Entity } from "typeorm";
import { BaseWithOwner } from "./Base";

@Entity()
export class PasswordResetToken extends BaseWithOwner {
  @Column({ nullable: false })
  expires!: Date;

  @Column({ nullable: false, unique: true, length: 300 })
  token!: string;
}
