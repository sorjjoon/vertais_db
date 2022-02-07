import "reflect-metadata";
import { Course } from "../entities/Course";
import { Resolver, Query, Ctx, Arg, Int, Mutation, Authorized, UseMiddleware } from "type-graphql";
import { MyContext, Nullish, SqlErrorCodes, UserError } from "../types";
import { filterKeys, generateRandomRichText, nextYear, randomString, yesterday } from "../utils/utils";
import { Account, UserRole } from "../entities/Account";
import { CourseSignUp } from "../entities/CourseSignup";
import { foreignKeysToDummyEntities, getUserCoursesQuery } from "../utils/sql";
import { courseCodeLength } from "../utils/constant";
import { getManager, In, Not } from "typeorm";
import { sampleSize } from "lodash";
import { Assignment } from "../entities/Assignment";
import { Task } from "../entities/Task";
import { Submit } from "../entities/Submit";
import { PeerAssesmentAssignment } from "../entities/PeerAssesmentAssignment";
import { __prod__ } from "../server/constant";
import { getCourseAssignmentsQueryBuilder } from "./assignment";

@Resolver()
export class CourseResolver {
  @Authorized()
  @Query(() => Course, { nullable: true })
  async getCourse(@Arg("id", () => Int) id: number, @Ctx() { user }: MyContext): Promise<Course | Nullish> {
    const course = await Course.findOne(id, {
      relations: ["comments", "comments.grade", "studentSignups", "assignments", "assignments.peerAssesment"],
    });
    if (!course) return null;
    if (course.owner.id !== user?.id && !course.studentSignups.map((s) => s.student.id).includes(user!.id)) {
      console.log("Unauhtorized access to course", course, "by", user);
      return null;
    }
    return course;
  }

  @Authorized([UserRole.TEACHER])
  @Query(() => [Account], { nullable: false })
  async getStudents(
    @Arg("courseId", () => Int) courseId: number,
    @Ctx() { user }: MyContext
  ): Promise<Account[] | Nullish> {
    const c = await CourseSignUp.find({
      where: { course: { id: courseId } },
      relations: ["student", "student.submits", "student.submits.files", "student.submits.grade"],
    });
    c.sort((a, b) => {
      return (a.student.firstName + ", " + a.student.lastName).localeCompare(
        b.student.firstName + ", " + b.student.lastName,
        "fi"
      );
    });
    return c.map((a) => foreignKeysToDummyEntities(a.student, 3));
  }

  @Authorized()
  @Query(() => [Course], { nullable: true })
  async getMyCourses(
    @Arg("offset", () => Int, { nullable: true, defaultValue: 0 }) offset: number | Nullish,
    @Arg("limit", () => Int, { nullable: true }) limit: number | Nullish,
    @Ctx() { user }: MyContext
  ): Promise<Course[]> {
    // limit = Math.min(50, limit ?? 50);
    // offset = offset ?? 0; .skip(offset).take(limit)
    const qb = getUserCoursesQuery(user?.id);
    qb.leftJoinAndSelect("course.assignments", "a");
    qb.leftJoinAndSelect("a.peerAssesment", "p");
    return qb.getMany();
  }

  @Authorized()
  @Mutation(() => Course, { nullable: true })
  async generateDummyCourse(@Ctx() ctx: MyContext): Promise<Course | Nullish> {
    if (ctx.user?.role === UserRole.STUDENT && __prod__) {
      return undefined;
    }

    const newCourse = new Course();
    newCourse.abbreviation = "ESIM";
    newCourse.code = randomString(courseCodeLength);
    newCourse.description =
      "Tämä on esimerkki kurssi, jossa voit katsella erilaisia tapoja luoda tehtäviä sivustolla.\nÄlä jaa tämän kurssin koodia opiskelijoille, vaan luo uusi kurssi oikeasta yläkulmasta";
    newCourse.name = "Esimerkki kurssi";
    newCourse.icon = "course-icons/1.jpg";
    const courseId = await getManager().transaction(async (transEm) => {
      const randomDummyStudents = sampleSize(await transEm.find(Account, { where: { role: UserRole.DUMMY } }), 15);

      //If in dev, push the currently logged in student to the dummy course.
      //Disabled in prob, because we do not want to allow a student to be the owner of a course
      if (ctx.user?.role === UserRole.STUDENT) {
        const student = await transEm.findOneOrFail(Account, ctx.user.id);
        randomDummyStudents.push(student);
        const dummyTeacher = await transEm.findOneOrFail(Account, {
          where: { id: Not(In(randomDummyStudents.map((s) => s.id))), role: UserRole.DUMMY },
        });
        newCourse.owner = dummyTeacher;
      } else {
        newCourse.owner = ctx.user as Account;
      }
      const course = await transEm.save(newCourse);

      const signUps = randomDummyStudents.map((s) => {
        const signUp = new CourseSignUp();
        signUp.course = course;
        signUp.student = s;
        return signUp;
      });
      await transEm.save(signUps);

      const assignment = new Assignment({ course, owner: ctx.user });
      assignment.description = generateRandomRichText();
      assignment.options = { reveal: yesterday(), hasPeerAssesment: true, deadline: yesterday() };
      assignment.name = "Esimerkki tehtävä, vertaisarvioinilla";

      await transEm.save(assignment);

      const peer = new PeerAssesmentAssignment({ owner: ctx.user });
      peer.assignment = assignment;
      peer.options = { deadline: nextYear(), peerAssesmentCount: 3, revealAutomatically: true };
      await transEm.save(peer);

      const task = new Task({ owner: ctx.user });
      task.assignment = assignment;
      task.description = generateRandomRichText();
      task.number = 1;
      task.points = 10;

      await transEm.save(task);

      await transEm.save(
        randomDummyStudents
          .filter((s, i) => i % 3 || s.role === UserRole.STUDENT) // Make sure some of the dummy students haven't made a submit
          .map((s) => {
            const submit = new Submit();
            submit.owner = s;
            submit.description = generateRandomRichText();
            submit.task = task;
            return submit;
          })
      );

      return course.id;
    });

    return this.getCourse(courseId, ctx);
  }

  @Authorized(UserRole.TEACHER)
  @Mutation(() => Course, { nullable: true })
  @Authorized()
  async insertCourse(
    @Arg("name", () => String) name: string,
    @Arg("icon", () => String) icon: string,
    @Arg("abbreviation", () => String, { nullable: true }) abbreviation: string,
    @Arg("description", () => String, { nullable: true }) description: string,
    @Ctx()
    { req, res, user }: MyContext
  ): Promise<Course> {
    var c: Course = Course.create({
      name,
      description,
      abbreviation: abbreviation || undefined,
      owner: user,
      icon,
      code: randomString(courseCodeLength),
      comments: [],
      assignments: [],
    });

    if (c.name.length < 1) {
      throw new UserError("Kurssin nimi ei voi olla tyhjä!");
    }
    await Promise.all([
      c.save().catch(async (err) => {
        switch (err.code) {
          case "23505":
            if (err.detail.includes("code")) {
              console.log("Duplicate code!");
              c = await this.insertCourse(name, icon, abbreviation, description, { req, res, user });
            }
            break;
          case "22001":
            if (err.message.includes("value too long for type character varying(6)")) {
              throw new UserError("Lyhenteen pituus saa olla enintään 6 merkkiä");
            } else if (err.message.includes(" value too long for type character varying(255)")) {
              throw new UserError("Kurssin nimen pituus saa olla enintään 255 merkkiä");
            }
            break;
        }

        throw err;
      }),
      Account.findOne(user?.id).then((acc) => (c.owner = acc!)),
    ]);

    return c;
  }

  @Authorized(UserRole.STUDENT)
  @Mutation(() => [Course], { nullable: true })
  async signUpCourse(
    @Arg("code", () => String) code: string,

    @Ctx() ctx: MyContext
  ) {
    const course = await Course.findOne({
      where: { code: code.toUpperCase() },
      relations: ["studentSignups"],
    });

    if (!course) {
      throw new UserError("Antamallasi koodilla ei löytynyt kurssia");
    }

    const c = new CourseSignUp({ student: ctx.user, course });

    try {
      await c.save();
    } catch (err) {
      if (err.code === SqlErrorCodes.UNIQUE_VIOLATION && err.constraint.includes("pkey")) {
        throw new UserError("Olet jo ilmoittautunut tälle kurssille");
      } else {
        throw err;
      }
    }

    return this.getMyCourses(undefined, undefined, ctx);
  }

  @Authorized(UserRole.TEACHER)
  @Mutation(() => Course, { nullable: true })
  async updateCourse(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext,
    @Arg("name", () => String, { nullable: true }) name?: string,
    @Arg("abbreviation", () => String, { nullable: true }) abbreviation?: string,
    @Arg("description", () => String, { nullable: true }) description?: string,
    @Arg("icon", () => String, { nullable: true }) icon?: string
  ): Promise<Course | Nullish> {
    const course = await Course.findOneOrFail({ where: { owner: req.session.userId, id } });

    const data = filterKeys({ id, name, abbreviation, description, icon });
    if (data.name != null && data.name.length < 1) {
      throw new UserError("Kurssin nimi ei voi olla tyhjä!");
    }
    if (data.abbreviation != null && data.abbreviation.length > 6) {
      throw new UserError("Kurssin lyhenne ei saa olla pidempi kuin 6 merkkiä");
    }
    Object.assign(course, data);
    return course.save();
  }
}
