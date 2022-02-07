import "reflect-metadata";

import { Authorized, Field, ObjectType, UseMiddleware } from "type-graphql";
import { Course } from "./Course";
import { Task } from "./Task";
import { BaseWithOwner, dateTimeColumnType } from "./Base";
import { Column, Entity, ManyToOne, OneToMany, OneToOne } from "typeorm";
import { FileDetails } from "./FileDetails";
import { AssignmentOptions } from "./AssignmentOptions";
import { PeerAssesmentAssignment } from "./PeerAssesmentAssignment";

@ObjectType()
@Entity()
export class Assignment extends BaseWithOwner {
  @Field(() => String, { nullable: true, description: "Sanitized html content" })
  @Column({ nullable: true, type: "text", comment: "Unsanitzed html" })
  description?: string;

  @Field(() => String)
  @Column()
  name!: string;

  @Field(() => Course)
  @ManyToOne(() => Course, { nullable: false, cascade: false, onDelete: "CASCADE" })
  course: Course;

  @Authorized()
  @Field(() => [Task])
  @OneToMany(() => Task, (task) => task.assignment, { cascade: false, eager: true })
  tasks: Task[];

  @Field(() => AssignmentOptions)
  @Column(() => AssignmentOptions)
  options: AssignmentOptions;

  @Field(() => [FileDetails])
  @OneToMany(() => FileDetails, (d) => d.assignment, { cascade: false, eager: true })
  files: FileDetails[];

  @Field(() => Date, { deprecationReason: "Use options object instead" })
  reveal?: Date;

  @Field(() => Date, { nullable: true, deprecationReason: "Use options object instead" })
  deadline?: Date;

  @Field(() => PeerAssesmentAssignment, { nullable: true })
  @OneToOne(() => PeerAssesmentAssignment, (a) => a.assignment, { cascade: false })
  peerAssesment?: PeerAssesmentAssignment;
}
