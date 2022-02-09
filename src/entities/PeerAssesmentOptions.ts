import "reflect-metadata";

import { Field, InputType, Int, ObjectType } from "type-graphql";
import { dateTimeColumnType } from "./Base";
import { Column } from "typeorm";

@ObjectType()
@InputType("PeerAssesmentOptionsInput", { description: "PeerAssesment options" })
export class PeerAssesmentOptions {
  @Field(() => Int, {
    nullable: false,
    description: "How many peer assesments each participant should do (if possible)",
  })
  @Column({ nullable: false, default: 0 })
  peerAssesmentCount: number;

  @Field(() => Date, { nullable: false })
  @Column({ nullable: false, type: dateTimeColumnType })
  deadline: Date;

  @Column({
    nullable: false,
    default: false,
    comment: "If assessor / asessed pairs have been generated for this peer assesment",
  })
  @Field(() => Boolean, {
    nullable: true,
    description: "If assessor / asessed pairs have been generated for this peer assesment",
  })
  pairsHaveBeenGenerated?: boolean;
  @Column({
    nullable: false,
    default: false,
    comment: "If peer assesment results should be automatically revealed to the student",
  })
  @Field({ nullable: false })
  revealAutomatically?: boolean;
}
