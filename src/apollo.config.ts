import { AuthenticationError } from "apollo-server-errors";
import { ApolloServer, ApolloServerExpressConfig } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { Account } from "./entities/Account";
import { customAuthChecker } from "./server/authMiddlewares";
import { __PROD__ } from "./server/constant";
import { ErrorInterceptor } from "./server/middlewares";
import { MyContext } from "./types";

export async function createApollo(opts: ApolloServerExpressConfig = {}) {
  console.log("Configuring apollo");
  const a = new ApolloServer({
    formatError: (err) => {
      if (err.originalError instanceof AuthenticationError) {
        err.message = "Sinulla ei ole oikeuksia nähdä tätä sivua. Oletko kirjautunut sisään?";
      }
      return err;
    },
    introspection: true,
    playground: {
      title: (__PROD__ ? "prod" : "dev") + " - vertais.fi playground",
      settings: { "request.credentials": "include" },
    },
    schema: await buildSchema({
      resolvers: [__dirname + "/resolvers/**/*.{ts,js}"],
      validate: false,
      dateScalarMode: "isoDate",
      authChecker: customAuthChecker,
      globalMiddlewares: [ErrorInterceptor],
    }),
    uploads: false,
    context: ({ req, res }): MyContext => ({
      req,
      res,
      user: req.session.userId ? new Account({ id: req.session.userId, role: req.session.role }) : undefined,
    }),
    tracing: true,
    ...opts,
  });
  console.log("Apollo config Success!");
  return a;
}
