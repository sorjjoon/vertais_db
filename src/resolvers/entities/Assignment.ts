import { Resolver, ResolverInterface, FieldResolver, Root } from "type-graphql";
import { Assignment } from "../../entities/Assignment";
import { PeerAssesmentAssignment } from "../../entities/PeerAssesmentAssignment";

import { sanitize } from "../../utils/sanitize";

@Resolver((of) => Assignment)
export class AssignmentResolver implements ResolverInterface<Assignment> {
  @FieldResolver()
  description(@Root() root: Assignment) {
    return root.description ? sanitize(root.description) : root.description;
  }

  @FieldResolver({ deprecationReason: "Use options object instead" })
  deadline(@Root() root: Assignment) {
    return root.options.deadline ?? root.deadline;
  }

  @FieldResolver({ deprecationReason: "Use options object instead" })
  reveal(@Root() root: Assignment) {
    return root.options.reveal ?? root.reveal;
  }

  @FieldResolver()
  peerAssesment(@Root() root: Assignment) {
    if (root.peerAssesment && !root.peerAssesment.assignment) {
      root.peerAssesment.assignment = root;
    }
    return root.options.hasPeerAssesment ? root.peerAssesment : undefined;
  }

  @FieldResolver()
  tasks(@Root() root: Assignment) {
    return root.tasks.sort((a, b) => a.number - b.number);
  }
}
