import "reflect-metadata";

import { ObjectType, Field } from "type-graphql";
import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Unique } from "typeorm";
import { BaseWithPrimary } from "./Base";
import { FileDetails } from "./FileDetails";
import { Task } from "./Task";

@ObjectType()
@Entity()
@Unique("UQ_answer_task_id", ["task"])
export class Answer extends BaseWithPrimary {
  @Field(() => String, { nullable: true, description: "Sanitized html" })
  @Column({ nullable: true, type: "text", comment: "Unsanitzed html" })
  description: string;

  @Field(() => Task)
  @ManyToOne(() => Task, (t) => t.answer, {
    nullable: false,
    cascade: false,
    onDelete: "CASCADE",
  })
  @JoinColumn()
  task: Task;

  @Field(() => [FileDetails])
  @OneToMany(() => FileDetails, (d) => d.answer, { cascade: true })
  files: FileDetails[];
}
