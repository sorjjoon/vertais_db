import "reflect-metadata";

import { Authorized, Field, Int, ObjectType } from "type-graphql";
import { Course } from "./Course";
import { Task } from "./Task";
import { BaseWithOwner, BaseWithPrimary, dateTimeColumnType } from "./Base";
import { Check, Column, Entity, ManyToOne, OneToMany, Unique } from "typeorm";
import { FileDetails } from "./FileDetails";
import { AssignmentOptions } from "./AssignmentOptions";
import { Account } from "./Account";
import { PeerAssesmentAssignment } from "./PeerAssesmentAssignment";
import { Submit } from "./Submit";
import { Feedback } from "./Feedback";
import { Comment } from "./Comment";
@ObjectType()
@Entity()
@Unique("UQ_peer_assement_pair_assignment", ["peerAssesmentAssignment", "assessor", "assessed"])
@Check("CHK_assessor_not_equal_to_assessed", '"assessorId" != "assessedId"')
export class PeerAssesmentPair extends BaseWithPrimary {
  @Field(() => Account, { description: "The student assessing another student's work" })
  @ManyToOne(() => Account, { nullable: false, cascade: false, onDelete: "CASCADE", eager: true })
  assessor: Account;

  @ManyToOne(() => Account, { nullable: false, cascade: false, eager: true })
  assessed: Account;

  @Field(() => PeerAssesmentAssignment, { nullable: false })
  @ManyToOne(() => PeerAssesmentAssignment, { nullable: false, cascade: false, onDelete: "CASCADE" })
  peerAssesmentAssignment: PeerAssesmentAssignment;

  @Field({ nullable: true })
  @Column({ nullable: true, type: "float" })
  points: number;

  @Field(() => [Comment])
  @OneToMany(() => Comment, (comment) => comment.peerAssesmentPair, { eager: true })
  comments: Comment[];

  @Field(() => [Feedback])
  @OneToMany(() => Feedback, (f) => f.peerAssesment, { eager: true })
  feedbacks: Feedback[];

  @Field(() => [Submit], {
    nullable: false,
    description: "All the submits this student is supposed to give feedback for",
  })
  assessedSubmits: Submit[];

  @Field(() => String, { nullable: true, description: "Sanitized html" })
  @Column({ nullable: true, type: "text", comment: "Unsanitzed html" })
  description: string | null;
}
