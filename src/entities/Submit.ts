import "reflect-metadata";

import { ObjectType, Field } from "type-graphql";
import { Entity, Column, OneToMany, ManyToOne, Unique, OneToOne } from "typeorm";
import { BaseWithOwner } from "./Base";
import { FileDetails } from "./FileDetails";
import { Grade } from "./Grade";
import { Task } from "./Task";

@ObjectType()
@Entity()
@Unique("UQ_submit_task_id_owner", ["task", "owner"])
export class Submit extends BaseWithOwner {
  @Field(() => String, { nullable: true, description: "Sanitized html content" })
  @Column({ nullable: true, type: "text" })
  description?: string;

  @Field(() => Task)
  @ManyToOne(() => Task, (t) => t.submits, {
    nullable: false,
    cascade: false,
    onDelete: "CASCADE",
  })
  task: Task;

  @Column()
  taskId: number;

  @Field(() => [FileDetails])
  @OneToMany(() => FileDetails, (d) => d.submit, { cascade: true, eager: true })
  files: FileDetails[];

  @Field(() => Grade, { nullable: true })
  @OneToOne(() => Grade, (t) => t.submit)
  grade?: Grade;
}
