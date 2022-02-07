import "reflect-metadata";
import { ObjectType, Field } from "type-graphql";
import { Entity, ManyToOne } from "typeorm";
import { Account } from "./Account";
import { Base } from "./Base";
import { Course } from "./Course";

@ObjectType()
@Entity()
export class CourseSignUp extends Base {
  @Field(() => Course)
  @ManyToOne(() => Course, { primary: true, nullable: false, cascade: true, onDelete: "CASCADE", eager: true })
  course: Course;

  @Field(() => Account)
  @ManyToOne(() => Account, { primary: true, nullable: false, cascade: true, onDelete: "CASCADE", eager: true })
  student: Account;
}
