import "reflect-metadata";
import { Arg, Authorized, Ctx, Int, Mutation, Query, Resolver, UseMiddleware } from "type-graphql";
import { FileDetails } from "../entities/FileDetails";
import { MyContext, UserError } from "../types";
import { hasAccessToResource, Resource } from "../server/auth";
import { GradeInfo, Info } from "./types";
import { getManager, In } from "typeorm";
import { UserRole } from "../entities/Account";
import { Task } from "../entities/Task";
import { Submit } from "../entities/Submit";
import { Grade } from "../entities/Grade";

@Resolver()
export class SubmitResolver {
  @Mutation(() => Task)
  @Authorized([UserRole.STUDENT])
  @UseMiddleware(hasAccessToResource(Resource.TASK, "data.id"))
  async updateSubmit(
    @Arg("data", () => Info, { nullable: false }) data: Info,
    @Ctx() { user }: MyContext
  ): Promise<Task> {
    const subId = await getManager().transaction(async (transEm) => {
      const qb = transEm.createQueryBuilder().insert();
      qb.into(Submit).values({ description: data.description, owner: user, task: { id: data.id } });
      qb.orUpdate(["description", "updatedAt"], "UQ_submit_task_id_owner");
      qb.returning("*");
      const res = await qb.execute();

      const id = res.raw[0].id;

      await Promise.all([
        transEm.update(FileDetails, { id: In(data.filesToLink), owner: user }, { submit: { id } }),
        transEm.delete(FileDetails, { id: In(data.filesToDelete ?? []), owner: user }),
      ]);
      return id;
    });
    const sub = await Submit.findOne({
      relations: ["files", "owner", "task", "task.owner", "files.owner"],
      where: { id: subId },
    });
    if (!sub) {
      throw new UserError("Tehtävää ei löytynyt, onko etsimäsi tehtävä poistettu?");
    }
    sub.task.mySubmit = sub;

    return sub.task;
  }

  @Mutation(() => Task)
  @Authorized([UserRole.STUDENT])
  async deleteSubmit(@Arg("id", () => Int, { nullable: false }) id: number, @Ctx() { user }: MyContext) {
    const qb = Submit.createQueryBuilder().delete();
    qb.where({ owner: user, id }).returning("*");
    const res = await qb.execute();

    return { id: res.raw[0].taskId, submits: [] };
  }

  @Mutation(() => Submit)
  @Authorized()
  @UseMiddleware(hasAccessToResource(Resource.SUBMIT, "submitId"))
  @UseMiddleware(hasAccessToResource(Resource.GRADE, "submitId"))
  async updateGrade(
    @Arg("data", () => GradeInfo, { nullable: false }) data: GradeInfo,
    @Arg("submitId", () => Int, { nullable: false }) submitId: number,
    @Ctx() ctx: MyContext
  ): Promise<Submit> {
    const grade = new Grade({ submitId, ...data, owner: ctx.user });
    return grade.save().then(async (g) => {
      await g.reload();
      g.submit.grade = g;
      return g.submit;
    });
  }

  @Query(() => Task, {
    description: "Provide either the submit id, or the owner of the submit and the task submit is targeting",
    nullable: true,
  })
  @Authorized()
  @UseMiddleware(hasAccessToResource(Resource.TASK, "taskId", false))
  @UseMiddleware(hasAccessToResource(Resource.SUBMIT, "id", false))
  async getSubmit(
    @Arg("id", () => Int, { nullable: true }) id: number,
    @Ctx() { user }: MyContext,
    @Arg("ownerId", () => Int, { nullable: true }) ownerId?: number,
    @Arg("taskId", () => Int, { nullable: true }) taskId?: number
  ): Promise<Task | undefined> {
    const sub = await Submit.findOne({
      where: [{ id: id }, { owner: { id: ownerId }, task: { id: taskId } }],
      relations: ["grade", "task", "files", "grade.feedbacks"],
    });
    if (!sub) {
      return undefined;
    }
    sub.task.mySubmit = sub;
    return sub.task;
  }

  @Query(() => [Submit], {
    description: "Provide either the submit id, or the owner of the submit and the task submit is targeting",
  })
  @Authorized([UserRole.TEACHER])
  async getSubmits(@Arg("taskId", () => Int, { nullable: true }) taskId: number, @Ctx() { user }: MyContext) {
    return Submit.find({
      where: [{ task: { id: taskId, owner: user } }],
      relations: ["grade", "task", "files", "grade.feedbacks"],
      order: { updatedAt: "ASC" },
    });
  }
}
