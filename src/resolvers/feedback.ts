import "reflect-metadata";
import { Arg, Ctx, Mutation, Resolver, Int, UseMiddleware, Authorized } from "type-graphql";
import { getManager } from "typeorm";
import { UserRole } from "../entities/Account";

import { Feedback } from "../entities/Feedback";
import { Grade } from "../entities/Grade";
import { PeerAssesmentPair } from "../entities/PeerAssesmentPair";
import { hasAccessToResource, Resource } from "../server/auth";
import { MyContext } from "../types";
import { deleteEntity, foreignKeysToDummyEntities } from "../utils/sql";

import { assignWith } from "lodash";

@Resolver()
export class FeedbackResolver {
  @Mutation(() => Feedback, {
    nullable: false,
    description:
      "Adds a new feedback to the specfic grade. If the grade does not exsists, inserts a new grade first. If an empty string is used as the descpription, will instead delete any exsisting feedback",
  })
  @Authorized()
  @UseMiddleware(hasAccessToResource(Resource.SUBMIT, "targetId", false))
  async updateFeedback(
    @Arg("childIndex", () => Int, { nullable: false }) childIndex: number,
    @Arg("targetId", () => Int, {
      nullable: false,
      description:
        "Target for this feedback. If the current user is a student, it is asumed to be a grade primary key, for students a peer assesment id",
    })
    targetId: number,
    @Arg("description", { nullable: false }) description: string,

    @Ctx() { user }: MyContext
  ): Promise<Feedback> {
    const res = await getManager().transaction(async (transEm) => {
      const feedback = new Feedback({ owner: user, description, childIndex });

      if (user?.role === UserRole.TEACHER) {
        var grade = await transEm.findOne(Grade, {
          where: { submitId: targetId, owner: user },
          relations: ["feedbacks"],
        });
        if (!grade) {
          grade = await transEm.save(new Grade({ owner: user, submitId: targetId, feedbacks: [] }));
        }
        feedback.grade = grade;
        feedback.id = grade.feedbacks.find((f) => f.childIndex == childIndex)?.id!;
      } else {
        const peerPair = await transEm.findOneOrFail(PeerAssesmentPair, { where: { id: targetId, assessor: user } });
        feedback.peerAssesment = peerPair;
        feedback.id = peerPair.feedbacks.find((f) => f.childIndex == childIndex)?.id!;
      }
      //Peer assesment pairs should always exsists
      feedback.childIndex = childIndex;
      feedback.description = description;
      return transEm.save(feedback);
    });
    await res.reload();
    return res;
  }

  @Mutation(() => Feedback, { nullable: true })
  @Authorized()
  async deleteFeedback(
    @Arg("id", () => Int, { nullable: false }) id: number,
    @Ctx() { user }: MyContext
  ): Promise<Feedback | undefined> {
    const res = await deleteEntity(Feedback, id, user);
    console.log(res);
    return foreignKeysToDummyEntities(res.raw[0]);
  }
}
