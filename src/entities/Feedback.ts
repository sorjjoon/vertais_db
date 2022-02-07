import "reflect-metadata";
import { Field, Int, ObjectType } from "type-graphql";
import { Column, Entity, ManyToOne, PrimaryColumn, Unique } from "typeorm";
import { BaseWithOwner, BaseWithOwnerNoPrimary } from "./Base";
import { Grade } from "./Grade";
import { PeerAssesmentPair } from "./PeerAssesmentPair";
import { Submit } from "./Submit";

@ObjectType()
@Entity()
export class Feedback extends BaseWithOwner {
  @Field({ nullable: false, description: "plain text content" })
  @Column({ nullable: false, type: "text", comment: "plain text content" })
  description: string;

  @Field(() => Grade, { nullable: true })
  @ManyToOne(() => Grade)
  grade: Grade;

  @Field(() => PeerAssesmentPair, { nullable: true })
  @ManyToOne(() => PeerAssesmentPair)
  peerAssesment: PeerAssesmentPair;

  @Field(() => Int, {
    nullable: false,
    description: "Which child index of the submit description this feedback is for",
  })
  @Column({ nullable: false, type: "int2" })
  childIndex: number;
}
