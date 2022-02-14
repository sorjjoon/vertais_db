import "reflect-metadata";

import { ObjectType, Field, Int } from "type-graphql";
import { BaseEntity, CreateDateColumn, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Account } from "./Account";

export const dateTimeColumnType = "timestamp with time zone";

@ObjectType()
export abstract class Base extends BaseEntity {
  constructor(data?: any) {
    super();
    Object.assign(this, data);
  }

  @Field(() => Date, { description: "Entity creation date" })
  @CreateDateColumn({ comment: "Created at, intialized by db", nullable: false, type: dateTimeColumnType })
  createdAt?: Date;

  @Field(() => Date, { description: "Entity update date. Will be set to entity creation date by default." })
  @UpdateDateColumn({
    comment: "Updated at, intialized by db",
    nullable: false,
    type: dateTimeColumnType,
  })
  updatedAt?: Date;
}
@ObjectType()
export abstract class BaseWithPrimary extends Base {
  public mapToParent(parent: BaseWithPrimary) {
    const key = parent.constructor.name.toLowerCase();
    const temp: any = this;
    temp[key] = temp[key] ?? { id: parent.id };
  }

  @Field(() => Int, { description: "Integer primary key" })
  @PrimaryGeneratedColumn({ comment: "Base primary key" })
  id: number;
}

@ObjectType()
export abstract class BaseWithOwner extends BaseWithPrimary {
  @Field(() => Account, { description: "Entity owner (entity creator)" })
  @ManyToOne(() => Account, { nullable: false, cascade: false, onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "ownerId" })
  owner: Account;

  ownerId?: number;
}

@ObjectType()
export abstract class BaseWithOwnerNoPrimary extends Base {
  @Field(() => Account, { description: "Entity owner (entity creator)" })
  @ManyToOne(() => Account, { nullable: false, cascade: false, onDelete: "CASCADE", eager: true })
  owner: Account;

  ownerId?: number;
}
