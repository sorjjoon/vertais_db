import { Resolver, ResolverInterface, FieldResolver, Root } from "type-graphql";
import { Answer } from "../../entities/Answer";

import { sanitize } from "../../utils/sanitize";

@Resolver((of) => Answer)
export class AnswerResolver implements ResolverInterface<Answer> {
  @FieldResolver()
  description(@Root() root: Answer) {
    return root.description ? sanitize(root.description) : root.description;
  }
}
