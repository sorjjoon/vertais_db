import { Resolver, ResolverInterface, FieldResolver, Root, Ctx } from "type-graphql";
import { Submit } from "../../entities/Submit";
import { Task } from "../../entities/Task";
import { MyContext } from "../../types";
import { sanitize } from "../../utils/sanitize";

@Resolver((of) => Task)
export class TaskResolver implements ResolverInterface<Task> {
  @FieldResolver()
  description(@Root() root: Task) {
    return root.description ? sanitize(root.description) : root.description;
  }

  @FieldResolver()
  async mySubmit(@Root() root: Task, @Ctx() context: MyContext) {
    if (root.mySubmit) {
      return root.mySubmit;
    }
    if (root.submits !== undefined) {
      return root.submits.find((s) => (s.owner?.id ?? s.ownerId) == context.user?.id);
    } else {
      return Submit.findOne({
        where: { owner: context.user, task: root },
        relations: ["grade", "task", "files", "grade.feedbacks"],
      });
    }
  }

  //   @FieldResolver()
  //   async files(@Root() root: Task) {
  //     const assig =
  //       root.assignment ??
  //       (await Task.findOneOrFail(root.id, { relations: ["assignment", "assignment.files"] })).assignment;
  //     console.log(root);
  //     return assig.files.concat(root.files);
  //   }
}
