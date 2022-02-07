import "reflect-metadata";
import { Arg, Args, Authorized, Ctx, Int, Mutation, Query, Resolver, UseMiddleware } from "type-graphql";
import { Between, getManager, In, LessThanOrEqual, MoreThanOrEqual, Not } from "typeorm";
import { UserRole } from "../entities/Account";
import { Answer } from "../entities/Answer";
import { Assignment } from "../entities/Assignment";
import { AssignmentOptions } from "../entities/AssignmentOptions";
import { Course } from "../entities/Course";
import { FileDetails } from "../entities/FileDetails";
import { PeerAssesmentAssignment } from "../entities/PeerAssesmentAssignment";
import { PeerAssesmentOptions } from "../entities/PeerAssesmentOptions";
import { Task } from "../entities/Task";
import { hasAccessToResource, Resource } from "../server/auth";
import { MyContext, Nullish, UserError } from "../types";
import {
  deleteEntity,
  foreignKeysToDummyEntities,
  getUserCoursesQuery,
  getUserQueriesSub,
  updateAnswer,
} from "../utils/sql";
import { multiMap } from "../utils/utils";
import { InfoArgs, TaskInfo, UpcomingAssignmentsReturnType } from "./types";

export function getCourseAssignmentsQueryBuilder(user: { id: number; role: string }, courseId?: number) {
  const qb = Course.createQueryBuilder("c").select();
  qb.leftJoinAndSelect("c.comments", "comments");
  qb.leftJoinAndSelect("comments.owner", "comm_owner");
  qb.leftJoinAndSelect("comments.grade", "comm_grade");
  qb.leftJoinAndSelect("c.owner", "c_ow");
  qb.leftJoinAndSelect("c.assignments", "a", "(a.reveal <= now() OR a.reveal IS NULL OR a.ownerId = :userId)", {
    userId: user.id,
  });
  if (courseId != null) {
    qb.andWhere({ id: courseId });
  }

  const sql = getUserQueriesSub(qb, user.id, "id");
  qb.andWhere(sql);
  qb.leftJoinAndSelect("a.files", "file_d");
  qb.leftJoinAndSelect("file_d.owner", "file_o");
  qb.leftJoinAndSelect("a.tasks", "t");
  qb.leftJoinAndSelect("t.files", "t_files");
  if (user?.role === UserRole.STUDENT) {
    qb.leftJoinAndSelect("t.submits", "t_subs", "t_subs.ownerId = :userId", { userId: user.id });
    qb.leftJoinAndSelect("t.answer", "t_answer", " a.deadline < now()");
  } else {
    qb.leftJoinAndSelect("t.submits", "t_subs");
    qb.leftJoinAndSelect("t.answer", "t_answer");
  }
  qb.leftJoinAndSelect("t_subs.owner", "t_sub_owner");
  qb.leftJoinAndSelect("t_subs.files", "t_sub_files");
  qb.leftJoinAndSelect("t_answer.files", "t_answer_files");

  qb.leftJoin("t_subs.task", "t_sub_task");
  qb.addSelect("t_sub_task.id");

  qb.leftJoinAndSelect("t_files.owner", "t_files_o");

  qb.leftJoinAndSelect("a.peerAssesment", "a_peer");
  qb.leftJoinAndSelect("a_peer.pairs", "a_peer_pairs");
  qb.leftJoinAndSelect("a_peer_pairs.assessor", "a_peer_asessor");
  qb.leftJoinAndSelect("a_peer_pairs.assessed", "a_peer_asessed");
  qb.addOrderBy("a.deadline", "ASC", "NULLS LAST");
  qb.addOrderBy("a_peer.deadline", "ASC", "NULLS LAST");
  qb.addOrderBy("a.reveal", "DESC");
  qb.addOrderBy("a.createdAt", "DESC");
  qb.addOrderBy("t.number", "ASC");
  qb.addOrderBy("a_peer_pairs.id", "ASC");

  return qb;
}

@Resolver()
export class AssignmentResolver {
  @Query(() => UpcomingAssignmentsReturnType, { nullable: false })
  @Authorized()
  async getUpcomingAssignments(@Ctx() context: MyContext): Promise<UpcomingAssignmentsReturnType> {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 1000 * 60 * 60 * 24 * 7);

    const myCourses = await getUserCoursesQuery(context?.user?.id).getMany();
    const courseIds = myCourses.map((c) => c.id);
    const assignments = await Assignment.find({
      where: {
        course: In(courseIds),
        options: { deadline: Between(today, nextWeek), reveal: MoreThanOrEqual(today) },
      },
    });

    const peerAssesments = await PeerAssesmentAssignment.find({
      where: {
        assignment: { options: { deadline: LessThanOrEqual(today) }, course: In(courseIds) },
        options: { deadline: Between(today, nextWeek) },
      },
      relations: ["assignment", "assignment.course"],
    });

    return {
      peerAssesments,
      assignments,
    };
  }

  @Mutation(() => Course, { nullable: true })
  @Authorized([UserRole.TEACHER])
  async updateAssignment(
    @Arg("name", { nullable: false }) name: string,
    @Args(() => InfoArgs) info: InfoArgs,
    @Arg("options", () => AssignmentOptions, { nullable: false }) opts: AssignmentOptions,
    @Arg("peerAssesmentOptions", () => PeerAssesmentOptions, { nullable: false })
    peerAssesmentOptions: PeerAssesmentOptions,

    @Arg("tasks", () => [TaskInfo], { nullable: false }) tasks: TaskInfo[],
    @Ctx() context: MyContext
  ): Promise<Course | Nullish> {
    if (tasks.length === 0) {
      throw new UserError("Palautuksessa täytyy olla ainakin yksi tehtävä");
    }
    const newAssignment = await getManager().transaction(async (transEm) => {
      try {
        const assignment = await transEm.findOneOrFail(
          Assignment,
          { id: info.id, owner: context.user },
          { relations: ["peerAssesment", "course"] }
        );
        if (assignment?.peerAssesment?.options?.pairsHaveBeenGenerated) {
          throw new UserError("Et voi muokata palautusta, kun sen vertaisarviointi on käynnissä");
        }

        assignment.options = { ...opts };

        assignment.name = name;
        assignment.description = info.description;
        await transEm.save(assignment).catch((er) => {
          console.log("saving assignment failed");
          throw er;
        });
        if (!opts.hasPeerAssesment) {
          var prom = transEm.delete(PeerAssesmentAssignment, { assignment, owner: context.user });
        } else {
          const newPeer = {
            options: { ...peerAssesmentOptions },
            assignment,
            owner: context.user,
          };
          if (assignment.peerAssesment?.id) {
            prom = transEm.update(
              PeerAssesmentAssignment,
              { id: assignment.peerAssesment.id, owner: context.user, assignment },
              newPeer
            );
          } else {
            prom = transEm.insert(PeerAssesmentAssignment, newPeer);
          }
        }
        prom.catch((err) => {
          console.log("Updating peer failed");
          throw err;
        });
        await prom;
        const oldTaskIds = tasks.filter((t) => !!t.id).map((t) => t.id);
        await transEm.delete(Task, { assignment, id: Not(In(oldTaskIds)), owner: context.user }).catch((er) => {
          console.log("deleting task failed");
          throw er;
        });

        const allFilesToDelete = info.filesToDelete ?? [];
        const taskWork = tasks.map(async ({ filesToDelete, filesToLink, id: oldTaskId, answer, ...t }, i) => {
          const newTask = new Task({ ...t, owner: context.user, number: i + 1 });
          allFilesToDelete.push(...(filesToDelete ?? []), ...(answer?.filesToDelete ?? []));
          let taskPromise: Promise<number>;

          if (oldTaskId) {
            taskPromise = transEm
              .update(Task, { id: oldTaskId, owner: context.user, assignment }, newTask)
              .then(() => oldTaskId)
              .catch((er) => {
                console.log("updating old task failed");
                throw er;
              });
          } else {
            taskPromise = transEm
              .insert(Task, { ...newTask, assignment, owner: context.user })
              .then((res) => res.identifiers[0] as any)
              .catch((er) => {
                console.log("inserting new task failed");
                throw er;
              });
          }
          const taskId = await taskPromise;
          if (!answer) {
            transEm.delete(Answer, { task: taskId });
          } else {
            updateAnswer(transEm, taskId, answer.description)
              .then((answerId) => {
                transEm.update(
                  FileDetails,
                  { id: In(answer.filesToLink), owner: context.user },
                  { answer: { id: answerId } }
                );
              })
              .catch((err) => {
                console.log("Updating answer failed");
                throw err;
              });
          }
        });
        await Promise.all(taskWork);
        await transEm.delete(FileDetails, { id: In(allFilesToDelete), owner: context.user }).catch((er) => {
          console.log("deleting unused files failed");
          throw er;
        });

        return assignment;
      } catch (err) {
        console.log(err);
        throw err;
      }
    });

    return this.getAssignments(newAssignment.course.id, context);
  }

  @Query(() => Course, { nullable: true })
  @Authorized()
  async getAssignments(
    @Arg("courseId", () => Int, { nullable: false }) courseId: number,
    @Ctx() { user }: MyContext
  ): Promise<Course> {
    const qb = getCourseAssignmentsQueryBuilder(user!, courseId);
    const res = await qb.getOneOrFail();
    res?.assignments.forEach((a) => {
      a.tasks.forEach((t) => {
        if (t.answer) {
          t.answer.task = t;
        }
      });
      a.course = res;
    });
    return res;
  }

  @Mutation(() => Assignment, { nullable: false })
  @Authorized([UserRole.TEACHER])
  async deleteAssignment(
    @Arg("id", () => Int) id: number,
    @Ctx() { req, user }: MyContext
  ): Promise<Assignment | Nullish> {
    return foreignKeysToDummyEntities((await deleteEntity(Assignment, id, user)).raw[0]);
  }

  @Mutation(() => Course, { nullable: false })
  @Authorized([UserRole.TEACHER])
  @UseMiddleware(hasAccessToResource(Resource.COURSE, "courseId"))
  async insertAssignment(
    @Arg("name", { nullable: false }) name: string,
    @Args(() => InfoArgs) info: InfoArgs,
    @Arg("options", () => AssignmentOptions, { nullable: false }) opts: AssignmentOptions,
    @Arg("peerAssesmentOptions", () => PeerAssesmentOptions, { nullable: false })
    peerAssesmentOptions: PeerAssesmentOptions,

    @Arg("courseId", () => Int, { nullable: false }) _: number,
    @Arg("tasks", () => [TaskInfo], { nullable: false }) tasks: TaskInfo[],
    @Ctx() context: MyContext
  ) {
    if (tasks.length === 0) {
      throw new UserError("Palautuksessa täytyy olla ainakin yksi tehtävä");
    }
    const newAssignment = await getManager().transaction(async (transEm) => {
      const assignment = new Assignment({
        name,
        description: info.description,
        owner: context.user,
        course: context.course,
        options: opts,
      });

      await transEm.save(assignment);
      if (opts.hasPeerAssesment) {
        const peer = new PeerAssesmentAssignment({ owner: context.user });
        peer.options = peerAssesmentOptions;
        peer.assignment = assignment;
        await transEm.save(peer);
      }
      const savedTasks = await transEm.save(
        tasks.map((t, i) => new Task({ owner: context.user, description: t.description, number: i + 1, assignment }))
      );
      const fileWork = [
        transEm.update(FileDetails, { id: In(info.filesToLink), owner: context.user }, { assignment: assignment }),
      ].concat(
        tasks.map((t, i) =>
          transEm.update(FileDetails, { id: In(t.filesToLink), owner: context.user }, { task: savedTasks[i] })
        )
      );
      //Saving answer
      await Promise.all(
        tasks.map((t, i) => {
          if (!t.answer) {
            return null;
          }
          let a = new Answer();
          a.description = t.answer.description;
          a.task = savedTasks[i];

          return transEm
            .save(a)
            .then((savedAnswer) =>
              transEm.update(
                FileDetails,
                { id: In(t.answer?.filesToLink ?? []), owner: context.user },
                { answer: savedAnswer }
              )
            );
        })
      );

      await Promise.all(fileWork);
      return assignment;
    });
    return this.getAssignments(newAssignment.course.id, context);
  }
}
