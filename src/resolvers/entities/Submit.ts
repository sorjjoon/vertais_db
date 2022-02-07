import { Resolver, ResolverInterface, FieldResolver, Root, Ctx, Authorized } from "type-graphql";
import { Grade } from "../../entities/Grade";
import { Submit } from "../../entities/Submit";
import { MyContext } from "../../types";
import { sanitize } from "../../utils/sanitize";

@Resolver((of) => Submit)
export class SubmitResolver implements ResolverInterface<Submit> {
  @FieldResolver()
  description(@Root() root: Submit) {
    return root.description ? sanitize(root.description) : root.description;
  }

  @FieldResolver()
  @Authorized()
  grade(@Root() root: Submit, @Ctx() ctx: MyContext) {
    if (!root.grade) {
      return undefined;
    }
    const userId = ctx.user?.id;

    return root.grade.isRevealed || userId == root.grade.owner.id ? root.grade : undefined;
  }
}
