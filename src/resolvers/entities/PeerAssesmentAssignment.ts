import { Resolver, ResolverInterface, FieldResolver, Root, Ctx, Authorized } from "type-graphql";
import { In } from "typeorm";
import { UserRole } from "../../entities/Account";
import { Course } from "../../entities/Course";
import { Grade } from "../../entities/Grade";
import { PeerAssesmentAssignment } from "../../entities/PeerAssesmentAssignment";
import { Submit } from "../../entities/Submit";
import { MyContext } from "../../types";
import { sanitize } from "../../utils/sanitize";

@Resolver((of) => PeerAssesmentAssignment)
export class PeerAssesmentAssignmentResolver implements ResolverInterface<PeerAssesmentAssignment> {
  @FieldResolver()
  @Authorized()
  async pairs(@Root() root: PeerAssesmentAssignment, @Ctx() ctx: MyContext) {
    if (!root.pairs) {
      return undefined;
    }
    const myPairs = root.pairs.filter((p) => p.assessor.id === ctx.user?.id);
    const allSubmits = await Submit.find({
      relations: ["task"],
      where: {
        owner: In(myPairs.map((p) => p.assessed.id)),
        task: { assignment: root.assignment.id },
      },
    });
    root.pairs.forEach((p) => {
      p.assessedSubmits = allSubmits.filter((s) => s.owner.id == p.assessed.id);
    });

    if (ctx.user?.role === UserRole.TEACHER) {
      return root.pairs;
    }

    return root.pairs.filter((p) => p.assessor.id === ctx.user?.id).sort((a, b) => a.id - b.id);
  }
}
