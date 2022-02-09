import "reflect-metadata";

import { ObjectType, Field } from "type-graphql";
import { Entity, Column, OneToMany, PrimaryColumn, OneToOne, JoinColumn } from "typeorm";
import { BaseWithOwnerNoPrimary } from "./Base";
import { Submit } from "./Submit";
import { Comment } from "./Comment";
import { Feedback } from "./Feedback";

@ObjectType()
@Entity()
export class Grade extends BaseWithOwnerNoPrimary {
  @Field()
  id: number;

  @Field({ nullable: true })
  @Column({ nullable: true, type: "float" })
  points: number;

  @Field(() => Submit)
  @OneToOne(() => Submit, (t) => t.grade, {
    nullable: false,
    eager: true,
    cascade: false,
    onDelete: "CASCADE",
  })
  @JoinColumn()
  submit: Submit;

  @PrimaryColumn()
  @Field({ nullable: false })
  submitId: number;

  @Field({ nullable: false })
  @Column({ nullable: false, default: false })
  isRevealed: boolean;

  @Field(() => [Comment])
  @OneToMany(() => Comment, (comment) => comment.grade, { eager: true })
  comments: Comment[];

  @Field(() => [Feedback])
  @OneToMany(() => Feedback, (f) => f.grade, { eager: true })
  feedbacks: Feedback[];
}
