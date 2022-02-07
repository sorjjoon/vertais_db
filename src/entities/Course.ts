import "reflect-metadata";

import { Field, ObjectType } from "type-graphql";
import { Assignment } from "./Assignment";
import { CourseSignUp } from "./CourseSignup";
import { Comment } from "./Comment";
import { BaseWithOwner } from "./Base";
import { Column, Entity, OneToMany } from "typeorm";

@ObjectType()
@Entity()
export class Course extends BaseWithOwner {
  @Field(() => String, { nullable: true, description: "Plain text content" })
  @Column({ nullable: true, type: "text", comment: "Plain text content" })
  description?: string;

  @Field(() => String)
  @Column()
  name!: string;

  @Field(() => String, { nullable: false })
  @Column({ nullable: false })
  icon: string;

  @Field(() => String, { nullable: false })
  @Column({ nullable: false, unique: true })
  code: string;

  @Field(() => String, { nullable: true })
  @Column({ length: 6, nullable: true })
  abbreviation?: string;

  @Field(() => [CourseSignUp])
  @OneToMany(() => CourseSignUp, (signup) => signup.course)
  studentSignups: CourseSignUp[];

  @Field(() => [Assignment])
  @OneToMany(() => Assignment, (assig) => assig.course)
  assignments: Assignment[];

  @Field(() => [Comment])
  @OneToMany(() => Comment, (comment) => comment.course)
  comments: Comment[];
}
