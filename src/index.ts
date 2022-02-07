import "reflect-metadata";
require("source-map-support").install();
import express from "express";
import { ApolloServer, AuthenticationError } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { format } from "util";

import session from "express-session";
import { MyContext, SqlErrorCodes } from "./types";
import cors from "cors";
import { COOKIE_NAME, __prod__ } from "./server/constant";

import { customAuthChecker } from "./server/auth";
import { Account, UserRole } from "./entities/Account";
import { graphqlUploadExpress } from "graphql-upload";
import { FileBlob } from "./entities/FileBlob";
import { FileDetails } from "./entities/FileDetails";

import { createConnection, getConnectionOptions, LessThan } from "typeorm";
import typeOrmConfig from "./type-orm.config";
import { TypeormStore } from "connect-typeorm/out";
import { Session } from "./entities/Session";
import { ErrorInterceptor } from "./server/middlewares";
import { createApollo } from "./apollo.config";

function httpAndHttpsUrls(domain: string) {
  return ["http://" + domain, "https://" + domain];
}

const main = async () => {
  console.log("starting up");

  const app = express();
  const port = parseInt(process.env.PORT!) || 5000;

  //Logging

  app.use(
    cors({
      origin: [...httpAndHttpsUrls("vertais.fi"), ...httpAndHttpsUrls("www.vertais.fi"), "http://localhost:3000"],
      credentials: true,
    })
  );

  app.use(express.json({ limit: __prod__ ? "20mb" : "7mb" }));
  app.use(express.urlencoded({ limit: __prod__ ? "20mb" : "7mb", extended: true }));

  console.log("Typeorm init");
  const defaultConfig = await getConnectionOptions();
  const conn = await createConnection({ ...defaultConfig, ...typeOrmConfig }).catch((err) => {
    console.error(err);
    throw err;
  });

  console.log("Configuring session");
  const repo = conn.getRepository(Session);
  repo.delete({ expiredAt: LessThan(new Date().getTime()) }).then((r) => {
    console.log("Session clenup ok, deleted " + r.affected);
  });

  const store = new TypeormStore({ cleanupLimit: 10 }).connect(repo);
  app.use(
    session({
      rolling: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, //
        httpOnly: true,
        secure: true,
        sameSite: "none",
      },
      resave: false,
      saveUninitialized: false,
      name: COOKIE_NAME,
      secret: process.env.SECRET_KEY!,
      store,
    })
  );
  // );
  console.log("Session config success");
  console.log("Configuring file upload");
  app.use(graphqlUploadExpress({ maxFileSize: 100 * 1024 * 1024, maxFiles: 10 }));
  console.log("Upload config success!");

  const apolloSever = await createApollo();

  apolloSever.applyMiddleware({ app, cors: { origin: "http://localhost:3000", credentials: true } });

  console.log("Cleaning session");

  app.get("/file/:id/:name", async (req, res) => {
    const qb = FileDetails.createQueryBuilder("de").select();
    qb.leftJoinAndSelect(FileBlob, "blob", "de.id = blob.detailsId")
      .where("de.id = :fileId")
      .setParameter("fileId", parseInt(req.params.id));
    const file: any = (await qb.execute())[0];

    if (!file) {
      res.sendStatus(404);
    } else {
      res.writeHead(200, [
        ["Content-Type", file.de_mimetype],
        [
          "Content-Disposition",
          `${safeMimetype(file.de_mimetype) ? "inline" : "attachment"}; filename="${file.de_filename}"`,
        ],
      ]);
      res.end(file.blob_data);
    }
  });
  app.listen(port, () => {
    console.log("server started on " + port);
  });
};

main().catch((err) => {
  console.error(err);
});

function safeMimetype(mime: string) {
  const secureMimetypes = ["pdf", "png", "jpg"];
  for (let x of secureMimetypes) {
    if (mime.includes(x)) {
      return true;
    }
  }
  return false;
}
