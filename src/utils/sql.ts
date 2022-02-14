import "reflect-metadata";
import { Course } from "../entities/Course";
import { CourseSignUp } from "../entities/CourseSignup";
import { filterKeys } from "./utils";
import { Connection, EntityManager, EntityTarget, getConnection, In, SelectQueryBuilder } from "typeorm";
import { Base, BaseWithOwner } from "../entities/Base";
import { FileDetails } from "../entities/FileDetails";
import { Answer } from "../entities/Answer";
import { Nullish } from "../types";
import { FileTarget } from "../resolvers/types";

interface SubQueryOptions {
  alias?: string;
  commentAlias?: string;
  joinComments?: boolean;
}

const defaults = { alias: "course", commentAlias: "comment", joinComments: true };
export function getUserCoursesQuery(userId?: number, options?: SubQueryOptions) {
  options = { ...defaults, ...options };
  const qb = Course.createQueryBuilder(options.alias).select();

  qb.leftJoinAndSelect(`${qb.alias}.owner`, "account");
  if (options.joinComments) {
    joinComments(qb, options.commentAlias)
      .leftJoinAndSelect("comment.owner", "account2")
      .leftJoinAndSelect("comment.files", "files");
  }
  const sql = getUserQueriesSub(qb, userId);
  qb.setParameters({ userId: userId });
  return qb.andWhere(sql).addOrderBy(`${qb.alias}.createdAt`, "DESC");
}

export function getUserQueriesSub<T>(qb: SelectQueryBuilder<T>, userId: number | Nullish, courseIdColumn = "id") {
  const sub1 = qb
    .subQuery()
    .select("teacher_sub.id")
    .from(Course, "teacher_sub")
    .where("teacher_sub.ownerId = :SubQuserId");
  const sub2 = qb
    .subQuery()
    .select("student_sub.courseId")
    .from(CourseSignUp, "student_sub")
    .where("student_sub.studentId = :SubQuserId");
  qb.setParameter("SubQuserId", userId);
  return ` (${qb.alias}.${courseIdColumn} IN ${sub1.getQuery()} OR ${
    qb.alias
  }.${courseIdColumn} IN ${sub2.getQuery()})`;
}

export function joinComments<T>(qb: SelectQueryBuilder<T>, alias = "comment"): SelectQueryBuilder<T> {
  qb.leftJoinAndSelect(
    `${qb.alias}.comments`,
    alias,
    `${alias}.ownerId = :userId OR ${alias}.reveal <= now() OR ${alias}.reveal IS NULL`
  ).addOrderBy(`GREATEST(${alias}.reveal, ${alias}.createdAt)`, "DESC");
  return qb;
}

export function getFileDetails(ids: number[], owner: { id: number }) {
  return FileDetails.find({ where: { id: In(ids), owner: owner } });
}

export async function deleteEntity(
  entity: EntityTarget<BaseWithOwner>,
  id: number | Nullish,
  owner: { id: number } | Nullish
) {
  const conn = getConnection();
  const qb = conn.createQueryBuilder(entity, "del").delete();
  qb.where({ id, owner }).returning("*");
  return qb.execute();
}

export function updateEntity<T extends EntityTarget<BaseWithOwner>>(
  entity: T,
  conn: Connection,
  where: any,
  data: any
) {
  filterKeys(data);
  const qb = conn.createQueryBuilder().update(entity);
  qb.set(data as any)
    .where(where)
    .returning("*");

  return qb.execute();
}

export function insertEntity<T extends EntityTarget<BaseWithOwner>>(entity: T, conn: Connection, data: any) {
  filterKeys(data);
  const qb = conn.createQueryBuilder().insert();
  qb.into(entity);
  qb.values(data).returning("*");
  return qb.execute();
}

export function foreignKeysToDummyEntities<T>(raw: T, depth = 1) {
  if (depth <= 0) {
    return raw;
  }
  if (Array.isArray(raw)) {
    raw.forEach((v) => foreignKeysToDummyEntities(v, depth));
  } else {
    for (let key in raw) {
      let newKey = key.slice(0, key.length - 2);
      let val = raw[key];
      if (key.endsWith("Id") && typeof val === "number" && (raw as any)[newKey] == undefined) {
        (raw as any)[newKey === "gradeSubmit" ? "grade" : newKey] = { id: val };
      } else if (val instanceof Base) {
        foreignKeysToDummyEntities(val, depth - 1);
      } else if (Array.isArray(val)) {
        val.forEach((v) => foreignKeysToDummyEntities(v, depth - 1));
      }
    }
  }
  return raw;
}

export function updateAnswer(em: EntityManager, taskId: number, description?: string): Promise<number> {
  const qb = em.createQueryBuilder(Answer, "a").insert();
  qb.values({ description, task: taskId as any })
    .orUpdate(["description", "updatedAt", "taskId"], "UQ_answer_task_id")
    .returning("*");

  return qb.execute().then((res) => {
    return res.raw[0].id;
  });
}

export function linkFiles(em: EntityManager, filesToLink: number[], target: FileTarget) {
  return em.update(FileDetails, { id: In(filesToLink) }, { ...target }).catch((err) => {
    console.log("Linking files failed", err, target, filesToLink);
    throw err;
  });
}
