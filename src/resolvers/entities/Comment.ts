import { Resolver, ResolverInterface, FieldResolver, Root } from "type-graphql";
import { Comment } from "../../entities/Comment";
import { sanitize } from "../../utils/sanitize";

@Resolver((of) => Comment)
export class CommentResolver implements ResolverInterface<Comment> {
  @FieldResolver()
  content(@Root() root: Comment) {
    return root.content ? sanitize(root.content) : root.content;
  }
}
