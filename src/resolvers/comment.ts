import { FileUpload, GraphQLUpload } from "graphql-upload";
import "reflect-metadata";
import { Arg, Ctx, Mutation, Resolver, Int, Query, Authorized } from "type-graphql";
import { In, LessThan } from "typeorm";
import { Account } from "../entities/Account";

import { Comment } from "../entities/Comment";
import { Course } from "../entities/Course";
import { FileDetails } from "../entities/FileDetails";
import { Grade } from "../entities/Grade";
import { PeerAssesmentPair } from "../entities/PeerAssesmentPair";
import { MyContext } from "../types";
import { foreignKeysToDummyEntities } from "../utils/sql";
import { uploadFilesToFileDetails } from "../utils/utils";
import { CommentTarget } from "./types";

@Resolver()
export class CommentResolver {
  @Mutation(() => Comment, { nullable: false })
  @Authorized()
  async insertComment(
    @Arg("target", { nullable: false }) target: CommentTarget,
    @Arg("content", { nullable: false }) content: string,
    @Arg("reveal", {
      nullable: true,
      defaultValue: null,
    })
    reveal: Date,
    @Arg("files", () => [GraphQLUpload], { nullable: true, defaultValue: [] })
    files: [Promise<FileUpload>],
    @Arg("filesToLink", () => [Int], { nullable: true, defaultValue: [] })
    filesToLink: number[],
    @Ctx() { user }: MyContext
  ) {
    const c = new Comment();

    c.content = content;
    c.files = [];
    c.reveal = reveal ? new Date(reveal) : new Date();
    const [fullUser, details, fullDetails] = await Promise.all([
      Account.findOneOrFail(user?.id),
      uploadFilesToFileDetails(files, user!),
      FileDetails.find({ where: { id: In(filesToLink), owner: user } }),
    ]);
    c.owner = fullUser;
    details.forEach((d) => (d.comment = c));
    if (target.course) {
      c.course = await Course.findOneOrFail({ where: { id: target.course, owner: user } });
    }
    if (target.grade) {
      c.grade = await Grade.findOneOrFail({ where: { submit: { id: target.grade }, owner: user } }).catch((err) =>
        new Grade({ submit: { id: target.grade }, comments: [] }).save()
      );
      c.grade.comments.push(c);
    }
    if (target.peerAssesmentPair) {
      c.peerAssesmentPair = await PeerAssesmentPair.findOneOrFail({ where: { id: target.peerAssesmentPair } });
    }
    c.files = details.concat(fullDetails);
    return c.save();
  }
  @Mutation(() => Comment, { nullable: false })
  @Authorized()
  async deleteComment(@Arg("id", () => Int, { nullable: false }) id: number, @Ctx() { user }: MyContext) {
    const qb = Comment.createQueryBuilder("c").delete();

    qb.where({ id, owner: user! }).returning("*");
    const res = await qb.execute();
    res.raw[0].gradeId = res.raw[0].gradeSubmitId;
    return foreignKeysToDummyEntities(res.raw[0]);
  }

  @Query(() => [Comment], { nullable: false })
  @Authorized()
  async getComments(
    @Arg("target", () => CommentTarget, { nullable: false }) target: CommentTarget,
    @Ctx() { user: owner }: MyContext
  ): Promise<Comment[]> {
    //TODO auth

    const res = await Comment.find({
      where: [
        { owner, ...target },
        { reveal: LessThan("now()"), ...target },
      ],

      relations: ["grade", "course"],
      order: { createdAt: "DESC" },
    });

    return foreignKeysToDummyEntities(res, 2);
  }

  @Mutation(() => Comment, { nullable: false })
  @Authorized()
  async updateComment(
    @Arg("id", () => Int, { nullable: false }) id: number,
    @Arg("content", { nullable: true }) content: string,
    @Arg("reveal", {
      nullable: true,
      defaultValue: null,
    })
    reveal: Date,
    @Arg("newFiles", () => [GraphQLUpload], { nullable: true, defaultValue: [] })
    newFiles: [Promise<FileUpload>],

    @Arg("filesToDelete", () => [Int], { nullable: true, defaultValue: [] })
    filesToDelete: number[],
    @Ctx() { user }: MyContext
  ): Promise<Comment> {
    const [comment, filesToInsert] = await Promise.all([
      Comment.findOneOrFail({ relations: ["files", "owner"], where: { id, owner: user } }),
      uploadFilesToFileDetails(newFiles, user!),
    ]);
    filesToInsert.forEach((f) => (f.comment = comment));

    if (content) {
      comment.content = content;
    }
    if (reveal) {
      comment.reveal = new Date(reveal);
    }
    comment.files = comment.files.filter((f) => !filesToDelete.includes(f.id)).concat(filesToInsert);

    await comment.save();
    return foreignKeysToDummyEntities(comment);
  }
}
