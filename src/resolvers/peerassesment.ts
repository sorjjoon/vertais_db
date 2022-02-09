import "reflect-metadata";

import { Arg, Ctx, Resolver, Int, UseMiddleware, Query, Authorized, Mutation } from "type-graphql";
import { UserRole } from "../entities/Account";
import { PeerAssesmentAssignment } from "../entities/PeerAssesmentAssignment";
import { PeerAssesmentPair } from "../entities/PeerAssesmentPair";
import { ensurePeerAssesmentPairsAreGenerated } from "../server/middlewares";
import { MyContext } from "../types";

@Resolver()
export class PeerAssessmentResolver {
  @Query(() => PeerAssesmentAssignment, { nullable: true })
  @Authorized()
  @UseMiddleware(ensurePeerAssesmentPairsAreGenerated("id"))
  async getMyPeerAssesment(
    @Arg("id", () => Int, { nullable: false }) __: number,
    @Ctx() { peerAssesmentAssignment, user }: MyContext
  ) {
    return peerAssesmentAssignment;
  }

  @Mutation(() => PeerAssesmentPair)
  @Authorized([UserRole.STUDENT])
  async updatePeerAssesment(
    @Arg("pairId", () => Int, { nullable: false }) pairId: number,
    @Arg("points", () => Int, { nullable: true, defaultValue: null }) points: number,
    @Arg("description", { nullable: true, defaultValue: null }) description: string,
    @Ctx() ctx: MyContext
  ): Promise<PeerAssesmentPair> {
    const pair = await PeerAssesmentPair.findOneOrFail({ where: { id: pairId, assessor: ctx.user } });

    pair.points = points;
    pair.description = description;
    await pair.save();

    return pair;
  }
}
