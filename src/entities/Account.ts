import "reflect-metadata";

import { Authorized, Field, ObjectType, registerEnumType } from "type-graphql";
import { PasswordResetToken } from "./PasswordResetToken";
import { Course } from "./Course";
import { CourseSignUp } from "./CourseSignup";
import { Comment } from "./Comment";
import { BaseWithPrimary } from "./Base";
import { FileDetails } from "./FileDetails";
import { Column, Entity, OneToMany, OneToOne } from "typeorm";
import { Submit } from "./Submit";
export enum UserRole {
  ADMIN = "ADMIN",
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
  DUMMY = "DUMMY",
}

registerEnumType(UserRole, {
  name: "UserRole",
  description: "User roles",
});

@ObjectType()
@Entity()
export class Account extends BaseWithPrimary {
  @Authorized()
  @Field(() => String, {
    nullable: false,
    description: `Username used for logging in.  
      Attempting to request this field for any other user, except the currently authenticated one will end the request in an authorization error.`,
  })
  @Column({ nullable: false, unique: true })
  username!: string;

  @Column({ nullable: false })
  password!: string;

  @Field(() => String, { nullable: false })
  @Column({ nullable: false })
  firstName!: string;

  @Field(() => String, { nullable: false })
  @Column({ nullable: false })
  lastName!: string;

  @Column({ type: "enum", nullable: false, enum: UserRole })
  @Field(() => UserRole, { nullable: false, description: "User role, teacher or student for normal users" })
  role!: UserRole;

  @Authorized()
  @Field(() => String, { nullable: true })
  @Column({ nullable: true, unique: true })
  email?: string;

  @Authorized()
  @Field(() => [Course], {
    description: `Courses taught by the user.  
  Attempting to request this field for any other user, except the currently authenticated one will end the request in an authorization error.`,
  })
  @OneToMany(() => Course, (course) => course.owner)
  teachedCourses: Course[];

  @Authorized()
  @Field(() => [CourseSignUp], {
    description: `Courses user has signed up as a student.  
  Attempting to request this field for any other user, except the currently authenticated one will end the request in an authorization error.`,
  })
  @OneToMany(() => CourseSignUp, (c) => c.student)
  signedUpCourses: CourseSignUp[];

  @OneToMany(() => Comment, (c) => c.owner)
  comments: Comment[];

  @OneToMany(() => FileDetails, (c) => c.owner)
  files: FileDetails[];

  @OneToOne(() => PasswordResetToken)
  passwordResetToken?: PasswordResetToken;

  @OneToMany(() => Submit, (c) => c.owner)
  @Field(() => [Submit], { nullable: false })
  submits: Submit[];
}
