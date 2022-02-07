import "reflect-metadata";
import { ArgsType, Field, InputType, Int, ObjectType } from "type-graphql";
import { Account } from "../entities/Account";
import { Assignment } from "../entities/Assignment";
import { PeerAssesmentAssignment } from "../entities/PeerAssesmentAssignment";

@ObjectType()
export class FieldError {
  @Field()
  message: string;

  @Field()
  fieldName: string;
}

@ObjectType()
export class AccountResponse {
  @Field(() => [FieldError], {
    nullable: true,
    description:
      "What errors the user input contained (such as username taken, or password too short) and which field was invalid",
  })
  errors?: FieldError[];

  @Field(() => Account, {
    nullable: true,
    description: "If given input was valid, and saving the user was successfull. Otherwise null",
  })
  user?: Account | null;
}

@InputType()
export class CommentTarget {
  @Field(() => Int, { nullable: true })
  course?: number;

  @Field(() => Int, { nullable: true })
  grade?: number;

  @Field(() => Int, { nullable: true })
  peerAssesmentPair?: number;
}

@InputType()
export class GradeInfo {
  @Field({ nullable: true, defaultValue: null })
  points: number;

  @Field({ nullable: true, defaultValue: null })
  isRevealed: boolean;
}

@InputType()
export class EntityId {
  @Field({ nullable: false })
  id: number;
}

@InputType()
export class FileTarget {
  [key: string]: EntityId | undefined;

  @Field(() => EntityId, { nullable: true })
  course?: EntityId;

  @Field(() => EntityId, { nullable: true })
  comment?: EntityId;

  @Field(() => EntityId, { nullable: true })
  assignment?: EntityId;

  @Field(() => EntityId, { nullable: true })
  task?: EntityId;

  @Field(() => EntityId, { nullable: true })
  answer?: EntityId;

  @Field(() => EntityId, { nullable: true })
  submit?: EntityId;
}
@InputType({
  description: "Common info describing a resource. Id field must omitted, if intending to create a new resource",
})
export class Info {
  @Field(() => Int, {
    nullable: true,
    description: "Id of the resource you are attempting to update. Must be omitted to create a new resource",
  })
  id?: number;

  @Field({ nullable: false, description: "(unsanitzed) html description of this resource" })
  description: string;

  @Field(() => [Int], {
    nullable: false,
    description:
      "files to be linked to this resource. Files must first have been uploaded. Can not be omitted, use an empty list, if there are no files to be linked",
  })
  filesToLink: number[];

  @Field(() => [Int], {
    nullable: true,
    defaultValue: [],
    description: "files that used to be linked to this resouce, that must be deleted. Can be omitted",
  })
  filesToDelete?: number[];
}
@ArgsType()
export class InfoArgs {
  @Field(() => Int, {
    nullable: true,
    description: "Id of the resource you are attempting to update. Must be omitted to create a new resource",
  })
  id?: number;

  @Field({ nullable: false, description: "(unsanitzed) html description of this resource" })
  description: string;

  @Field(() => [Int], {
    nullable: false,
    description:
      "files to be linked to this resource. Files must first have been uploaded. Can not be omitted, use an empty list, if there are no files to be linked",
  })
  filesToLink: number[];

  @Field(() => [Int], {
    nullable: true,
    defaultValue: [],
    description: "files that used to be linked to this resouce, that must be deleted. Can be omitted",
  })
  filesToDelete?: number[];
}

@InputType()
export class TaskInfo extends Info {
  @Field(() => Info, { nullable: true })
  answer?: Info;

  @Field(() => Int, { nullable: true })
  points?: number;
}

@ObjectType()
export class UpcomingAssignmentsReturnType {
  @Field(() => [Assignment], { nullable: false })
  assignments: Assignment[];

  @Field(() => [PeerAssesmentAssignment], { nullable: false })
  peerAssesments: PeerAssesmentAssignment[];
}
