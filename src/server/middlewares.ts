import { AuthenticationError } from "apollo-server-express";
import { MiddlewareFn } from "type-graphql";
import { getConnection } from "typeorm";
import { PeerAssesmentAssignment } from "../entities/PeerAssesmentAssignment";
import { MyContext, UserError } from "../types";
import { multiMap, sleep } from "../utils/utils";
import { UNAUTHORIZED_ACCESS_ERROR_MESSAGE, __prod__ } from "./constant";
import * as _ from "lodash";
import { PeerAssesmentPair } from "../entities/PeerAssesmentPair";
import console from "console";
export const LoggerInterCeptor: MiddlewareFn<any> = async ({ context, info }, next) => {
  // console.log("variables: ", info.variableValues);
  return next();
};

export const ErrorInterceptor: MiddlewareFn<MyContext> = async ({ args, context, info, root }, next) => {
  try {
    return await next();
  } catch (err) {
    if (!(err instanceof UserError) && !(err instanceof AuthenticationError)) {
      console.log("Unknown error!");
      console.error(err);
      console.log("root", root);
      console.log("args", args);
      console.log("user", context.user);
      console.log("fieldName", info.fieldName);
      console.log("op", info.operation);
      if (__prod__) {
        throw new Error("Jokin meni pieleen, pahoittelumme");
      }
    } else if (!__prod__) {
      console.error(err);
    }

    // rethrow the error
    throw err;
  }
};

export function ensurePeerAssesmentPairsAreGenerated(
  argsKey: string,
  errorIfInvalidArgKey = true
): MiddlewareFn<MyContext> {
  return async function generatePairs({ context, info, args }, next) {
    if (!context.user) {
      console.log("Denying access to " + info.operation.name?.value);
      throw new UserError(UNAUTHORIZED_ACCESS_ERROR_MESSAGE);
    }
    var id = _.get(args, argsKey);
    if (!id && errorIfInvalidArgKey) {
      throw new Error(`argKey '${argsKey}' invalid`);
    }
    const peerAssesmentAssignment = await PeerAssesmentAssignment.findOne({
      relations: ["assignment", "assignment.tasks"],
      where: [{ id }],
    });
    if (
      !peerAssesmentAssignment ||
      peerAssesmentAssignment.options.pairsHaveBeenGenerated ||
      (peerAssesmentAssignment.assignment.deadline && peerAssesmentAssignment.assignment.deadline > new Date())
    ) {
      context.peerAssesmentAssignment = peerAssesmentAssignment;
      return next();
    }
    const conn = getConnection();
    try {
      await conn.transaction("SERIALIZABLE", async (transEm) => {
        const peerAssement = await transEm.findOneOrFail(PeerAssesmentAssignment, {
          where: { id: peerAssesmentAssignment.id },
          relations: ["assignment", "assignment.tasks", "assignment.tasks.submits"],
        });
        if (peerAssement.options.pairsHaveBeenGenerated) {
          console.log("Peer assesment generated before transaction?");
          return;
        }
        const allSubmits = multiMap(peerAssement.assignment.tasks, (t) => t.submits);
        const allSubmitOwners = allSubmits.map((s) => s.owner);
        const studentsWithSubmits = _.shuffle(_.uniqBy(allSubmitOwners, "id"));
        const newPairs: PeerAssesmentPair[] = [];
        for (let i = 0; i < Math.min(peerAssement.options.peerAssesmentCount, studentsWithSubmits.length - 1); i++) {
          let newPairing = [...studentsWithSubmits];
          for (let j = 0; j <= i; j++) {
            let a = newPairing.shift()!;
            newPairing.push(a);
          }
          newPairing.forEach((student1, k) => {
            const student2 = studentsWithSubmits[k];
            const pair = new PeerAssesmentPair();
            pair.assessed = student1;
            pair.assessor = student2;
            pair.peerAssesmentAssignment = peerAssement;
            newPairs.push(pair);
          });
        }
        await transEm.save(newPairs);

        await transEm.update(
          PeerAssesmentAssignment,
          { id: peerAssement.id },
          { options: { pairsHaveBeenGenerated: true } }
        );
      });
    } catch (err) {
      console.log("Serialization error, peer assesment data should be commited by another transaction?");
      console.error(err);
    }
    context.peerAssesmentAssignment = await PeerAssesmentAssignment.findOneOrFail({
      relations: ["assignment"],
      where: [{ id }],
    });
    return next();
  };
}
