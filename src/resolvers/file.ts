import "reflect-metadata";

import { FileUpload, GraphQLUpload } from "graphql-upload";
import { Arg, Authorized, Ctx, Int, Mutation, Resolver } from "type-graphql";
import { FileDetails } from "../entities/FileDetails";
import { MyContext } from "../types";
import { FileTarget } from "./types";
import { getManager, In } from "typeorm";
import { uploadFilesToFileDetails } from "../utils/utils";

@Resolver()
export class FileResolver {
  @Mutation(() => [FileDetails])
  @Authorized()
  async uploadFiles(
    //1
    @Arg("files", () => [GraphQLUpload], {})
    files: [Promise<FileUpload>],
    @Arg("target", () => FileTarget, { nullable: true }) target: FileTarget | undefined,
    @Ctx() { user }: MyContext
  ) {
    const data = await uploadFilesToFileDetails(files, user!, target);

    return getManager().save(data);
  }

  @Mutation(() => [FileDetails])
  @Authorized()
  async deleteFiles(
    //1
    @Arg("files", () => [Int], {})
    files: [number],
    @Ctx() { user }: MyContext
  ) {
    const qb = FileDetails.createQueryBuilder().delete();
    qb.where({ owner: user, id: In(files) }).returning("*");
    const res = await qb.execute();

    return res.raw;
  }
}
