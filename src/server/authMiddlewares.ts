import "reflect-metadata";

import { AuthChecker, MiddlewareFn } from "type-graphql";
import { LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { Account, UserRole } from "../entities/Account";
import { Assignment } from "../entities/Assignment";
import { Course } from "../entities/Course";
import { Submit } from "../entities/Submit";
import { MyContext, UserError } from "../types";
import { getUserCoursesQuery, getUserQueriesSub } from "../utils/sql";
import { getNestedAttribute, multiMap } from "../utils/utils";
import { COOKIE_NAME, UNAUTHORIZED_ACCESS_ERROR_MESSAGE } from "./constant";

export const customAuthChecker: AuthChecker<MyContext> = ({ root, args, context, info }, roles) => {
  if (context.req.session.role == UserRole.ADMIN) {
    return true;
  }

  if (context.user?.role === UserRole.DUMMY) {
    console.log("DUMMY user was able to login!", context.user);
    logoutUser(context);
    throw new Error("Dummy user able to login!");
  }
  if (roles.length && !roles.includes(context.req.session.role!)) {
    console.log("Denying invalid role", context.req.session.role, "Expected: ", roles, "Access to: ", info.fieldName);
    return false;
  }

  switch (root?.constructor) {
    case Account:
      if (root?.id != context.req.session.userId && info.operation.name?.value !== "Register") {
        console.log("denying access! Requested sensitive account info");
        return false;
      }
      break;
    case Course:
      if (root?.owner?.id != context.req.session.userId) {
        console.log("denying access! Requested sensitive course info without being a teacher: ");
        return false;
      }
      break;
    default:
      if (!context.user) {
        console.log("Denying unauthenticated access to " + info.operation.name?.value);
        return false;
      }
      break;
  }
  return true;
};

export enum Resource {
  COURSE = "COURSE",
  TASK = "TASK",
  SUBMIT = "SUBMIT",
  GRADE = "GRADE",
}

export function hasAccessToResource(
  target: Resource,
  argsKey: string,
  errorIfInvalidArgKey = true
): MiddlewareFn<MyContext> {
  return async function checkAccess({ context, info, args }, next) {
    if (!context.user) {
      console.log("Denying access to " + info.operation.name?.value);
      throw new UserError(UNAUTHORIZED_ACCESS_ERROR_MESSAGE);
    }

    const id = getNestedAttribute(args, argsKey);
    if (!id) {
      if (errorIfInvalidArgKey) {
        throw new Error("argKey invalid");
      } else {
        return next();
      }
    }

    switch (target) {
      case Resource.COURSE:
        const courseQb = getUserCoursesQuery(context.user?.id, { joinComments: false });
        const course = await courseQb.andWhere("course.id = :id").setParameter("id", id).getOne();
        if (!course) {
          throw new UserError(UNAUTHORIZED_ACCESS_ERROR_MESSAGE);
        }
        context.course = course;
        break;
      case Resource.TASK:
        const assigQb = Assignment.createQueryBuilder("a").select();
        assigQb.leftJoinAndSelect("a.tasks", "t");

        const sql = getUserQueriesSub(assigQb, context.user.id, "courseId");
        assigQb.andWhere(sql).andWhere([{ owner: context.user }, { options: { reveal: LessThanOrEqual("now()") } }]);
        assigQb.andWhere([
          { owner: context.user },
          { options: { deadline: MoreThanOrEqual("now()") } },
          { options: { deadline: null } },
        ]);

        const assignments = await assigQb.getMany();

        const taskIds = multiMap(assignments, (a) => a.tasks.map((t) => t.id));

        if (!taskIds.includes(id)) {
          console.log("Denying access, because task id is not found in list", "found: ", taskIds, "expected ", id);
          throw new UserError(UNAUTHORIZED_ACCESS_ERROR_MESSAGE);
        }
        break;
      case Resource.GRADE:
      case Resource.SUBMIT:
        let sub = await Submit.findOne(id, { relations: ["task"] });
        if (sub && sub.owner.id != context.user.id && sub.task.owner.id != context.user.id) {
          throw new UserError(UNAUTHORIZED_ACCESS_ERROR_MESSAGE);
        }
        break;

      default:
        break;
    }

    return next();
  };
}

export async function logoutUser({ res, req }: MyContext) {
  res.clearCookie(COOKIE_NAME);

  return new Promise<boolean>((resolve, reject) => {
    try {
      req.session.destroy(() => {
        resolve(true);
      });
    } catch (err) {
      console.error("Error in deleting cookie from session storage", err);
      reject(err);
    }
  });
}
