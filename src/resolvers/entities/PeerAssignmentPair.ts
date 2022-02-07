import { Resolver, ResolverInterface, FieldResolver, Root } from "type-graphql";
import { Assignment } from "../../entities/Assignment";
import { PeerAssesmentPair } from "../../entities/PeerAssesmentPair";
import { sanitize } from "../../utils/sanitize";

@Resolver((of) => PeerAssesmentPair)
export class PeerAssesmentPairResolver implements ResolverInterface<PeerAssesmentPair> {
  @FieldResolver()
  description(@Root() root: PeerAssesmentPair) {
    return root.description ? sanitize(root.description) : root.description;
  }
}
