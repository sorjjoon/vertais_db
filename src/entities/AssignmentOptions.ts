import "reflect-metadata";

import { Field, InputType, ObjectType } from "type-graphql";
import { dateTimeColumnType } from "./Base";
import { Column } from "typeorm";

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
