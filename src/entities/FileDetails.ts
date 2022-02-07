import "reflect-metadata";

import { Field, ObjectType } from "type-graphql";
import { Assignment } from "./Assignment";
import { Comment } from "./Comment";
import { BaseWithOwner } from "./Base";
import { FileBlob } from "./FileBlob";
import { Column, Entity, ManyToOne, OneToOne } from "typeorm";
import { Task } from "./Task";
import { Answer } from "./Answer";
import { Submit } from "./Submit";

@ObjectType()
@Entity()
export class FileDetails extends BaseWithOwner {
  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  description?: string;

  @Field(() => String, { nullable: false })
  @Column({ nullable: false })
  filename: string;

  @Field(() => String, { nullable: false })
  @Column({ nullable: false })
  mimetype: string;

  @OneToOne(() => FileBlob, { cascade: true })
  file: FileBlob;

  @ManyToOne(() => Comment, { nullable: true, onDelete: "SET NULL" })
  comment?: Comment;

  @ManyToOne(() => Task, { nullable: true, onDelete: "SET NULL" })
  task?: Task;

  @ManyToOne(() => Assignment, { nullable: true, onDelete: "SET NULL" })
  assignment?: Assignment;

  @ManyToOne(() => Answer, { nullable: true, onDelete: "SET NULL" })
  answer?: Answer;

  @ManyToOne(() => Submit, { nullable: true, onDelete: "SET NULL" })
  submit?: Submit;
}
