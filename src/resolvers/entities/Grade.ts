import { Resolver, ResolverInterface, FieldResolver, Root } from "type-graphql";
import { Course } from "../../entities/Course";
import { Grade } from "../../entities/Grade";
import { sanitize } from "../../utils/sanitize";

@Resolver((of) => Grade)
export class GradeResolver implements ResolverInterface<Grade> {
  @FieldResolver()
  id(@Root() root: Grade) {
    return root.submitId ?? root.submit?.id ?? root.id;
  }

  @FieldResolver()
  submitId(@Root() root: Grade) {
    return root.submitId ?? root.submit?.id ?? root.id;
  }

  @FieldResolver()
  feedbacks(@Root() root: Grade) {
    return root.feedbacks.sort((a,b)=>a.childIndex-b.childIndex)
  }
}
