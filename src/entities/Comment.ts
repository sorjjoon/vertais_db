import "reflect-metadata";

import { Field, ObjectType } from "type-graphql";
import { Course } from "./Course";
import { BaseWithOwner, dateTimeColumnType } from "./Base";
import { Check, Column, Entity, ManyToOne, OneToMany } from "typeorm";
import { FileDetails } from "./FileDetails";
import { Grade } from "./Grade";
import { PeerAssesmentPair } from "./PeerAssesmentPair";

@ObjectType()
@Entity()
@Check('COALESCE("courseId", "gradeSubmitId","peerAssesmentPairId" , -1) >= 1')
export class Comment extends BaseWithOwner {
  @Field(() => String, { nullable: false, description: "Sanitized html content" })
  @Column({ nullable: false, type: "text", comment: "Unsanitzed html" })
  content: string;

  @Field(() => Course, { nullable: true })
  @ManyToOne(() => Course, { nullable: true, cascade: false, onDelete: "CASCADE" })
  course?: Course;

  @Field(() => Grade, { nullable: true })
  @ManyToOne(() => Grade, { nullable: true, cascade: false, onDelete: "CASCADE" })
  grade?: Grade;

  @Field(() => PeerAssesmentPair, { nullable: true })
  @ManyToOne(() => PeerAssesmentPair, { nullable: true, cascade: false, onDelete: "CASCADE" })
  peerAssesmentPair?: PeerAssesmentPair;

  @Field(() => Date)
  @Column({ nullable: false, type: dateTimeColumnType })
  reveal: Date;

  @Field(() => [FileDetails])
  @OneToMany(() => FileDetails, (d) => d.comment, { cascade: true, eager: true })
  files: FileDetails[];
}
