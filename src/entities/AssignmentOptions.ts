import "reflect-metadata";

import { Authorized, Field, InputType, Int, ObjectType } from "type-graphql";
import { Course } from "./Course";
import { Task } from "./Task";
import { BaseWithOwner, dateTimeColumnType } from "./Base";
import { Column, Entity, ManyToOne, OneToMany } from "typeorm";
import { FileDetails } from "./FileDetails";

@ObjectType()
@InputType("AssignmentOptionsInput", { description: "Assignment options" })
export class AssignmentOptions {
  @Field({ nullable: false, description: "If this assignment should accept file uploads" })
  @Column({ nullable: false, default: false })
  allowUploads?: boolean;

  @Field({ nullable: false, description: "If this assignment should have peer assesment after the deadline" })
  @Column({ nullable: false, default: false })
  hasPeerAssesment?: boolean;

  @Field(() => Date)
  @Column({ nullable: false, type: dateTimeColumnType })
  reveal: Date;

  @Field(() => Date, { nullable: true })
  @Column({ nullable: true, type: dateTimeColumnType })
  deadline?: Date;
}
