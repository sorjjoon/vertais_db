import "reflect-metadata";

import { Field, ObjectType } from "type-graphql";
import { BaseWithOwner } from "./Base";
import { Column, Entity, JoinColumn, OneToMany, OneToOne } from "typeorm";
import { Assignment } from "./Assignment";
import { PeerAssesmentOptions } from "./PeerAssesmentOptions";
import { PeerAssesmentPair } from "./PeerAssesmentPair";

@ObjectType()
@Entity()
export class PeerAssesmentAssignment extends BaseWithOwner {
  @Field(() => Assignment)
  @OneToOne(() => Assignment, (a) => a.peerAssesment, { nullable: false, cascade: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "assignmentId" })
  assignment: Assignment;

  @Field(() => PeerAssesmentOptions)
  @Column(() => PeerAssesmentOptions)
  options: PeerAssesmentOptions;

  @Field(() => [PeerAssesmentPair], { nullable: true })
  @OneToMany(() => PeerAssesmentPair, (pair) => pair.peerAssesmentAssignment, { eager: true })
  pairs?: PeerAssesmentPair[];
}
