import "reflect-metadata";

import { Field, Int, ObjectType } from "type-graphql";
import { Assignment } from "./Assignment";
import { BaseWithOwner } from "./Base";
import { Column, Entity, ManyToOne, OneToMany, OneToOne } from "typeorm";
import { FileDetails } from "./FileDetails";
import { Answer } from "./Answer";
import { Submit } from "./Submit";

@ObjectType()
@Entity()
// @Unique("UQ_number_assignment_id", ["number", "assignment"])
export class Task extends BaseWithOwner {
  @Field(() => String, { nullable: true, description: "Sanitized html content" })
  @Column({ nullable: true, type: "text" })
  description: string;

  @Field(() => Int)
  @Column({ nullable: false, type: "int2" })
  number!: number;

  @Field(() => Assignment)
  @ManyToOne(() => Assignment, (assignment) => assignment.tasks, {
    nullable: false,
    cascade: false,
    onDelete: "CASCADE",
  })
  assignment: Assignment;

  @Field(() => [FileDetails])
  @OneToMany(() => FileDetails, (d) => d.task, { cascade: true })
  files: FileDetails[];

  @Field(() => Answer, { nullable: true })
  @OneToOne(() => Answer, (t) => t.task)
  answer?: Answer;

  @Field(() => [Submit], {
    description:
      "Contains submits the user has access to. For any user with the role student, this will be either an empty list, or a list with 1 item (containing the users own submit). For students, use the 'mySubmit' field instead",
  })
  @OneToMany(() => Submit, (d) => d.task, { cascade: true })
  submits: Submit[];

  @Field()
  @Column({ nullable: false, default: 10 })
  points: number;

  @Field(() => Submit, {
    nullable: true,
    description: "Value of the current submit value for this user. Will always be null, if the user is a teacher",
  })
  mySubmit?: Submit;
}
