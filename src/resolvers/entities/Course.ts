import { Resolver, ResolverInterface, FieldResolver, Root } from "type-graphql";
import { Comment } from "../../entities/Comment";
import { Course } from "../../entities/Course";
import { sanitize } from "../../utils/sanitize";

@Resolver((of) => Course)
export class CourseResolver implements ResolverInterface<Course> {
  @FieldResolver()
  description(@Root() root: Course) {
    return root.description ? sanitize(root.description) : root.description;
  }

  @FieldResolver()
  comments(@Root() root: Course) {
    if (root.comments) return root.comments;

    return Comment.find({ where: { course: root }, relations: ["grade"] });
  }
}
