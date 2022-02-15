import "reflect-metadata";

require("source-map-support").install();

import express from "express";
import session from "express-session";
import cors from "cors";
import { COOKIE_NAME, FILE_UPLOAD_MAX_SIZE, SESSION_COOKIE_MAX_AGE_MS, __PROD__ } from "./server/constant";

import { graphqlUploadExpress } from "graphql-upload";
import { FileBlob } from "./entities/FileBlob";
import { FileDetails } from "./entities/FileDetails";

import { createConnection, getConnectionOptions, LessThan } from "typeorm";
import typeOrmConfig from "./type-orm.config";
import { TypeormStore } from "connect-typeorm/out";
import { Session } from "./entities/Session";
import { createApollo } from "./apollo.config";
import compression from "compression";
import { multiMap } from "./utils/utils";

function getHttpAndHttpsUrlsForDomain(domain: string) {
  return ["http://" + domain, "https://" + domain];
}

const main = async () => {
  console.log("starting up");

  const app = express();
  const port = parseInt(process.env.PORT || "5000");

  console.log("Compression config");
  app.use(compression());
  console.log("Compression ok");

  const corsDomains = multiMap(["vertais.fi", "www.vertais.fi", "localhost:3000"], getHttpAndHttpsUrlsForDomain);

  console.log("CORS config");
  app.use(
    cors({
      origin: corsDomains,
      credentials: true,
    })
  );
  console.log("CORS ok");

  app.use(express.json({ limit: __PROD__ ? "20mb" : "7mb" }));
  app.use(express.urlencoded({ limit: __PROD__ ? "20mb" : "7mb", extended: true }));

  console.log("Typeorm init");
  const defaultConfig = await getConnectionOptions();
  const conn = await createConnection({ ...defaultConfig, ...typeOrmConfig }).catch((err) => {
    console.error(err);
    throw err;
  });
  console.log("Typeorm init ok");

  console.log("Configuring session");
  const repo = conn.getRepository(Session);
  repo.delete({ expiredAt: LessThan(new Date().getTime()) }).then((r) => {
    console.log("Session clenup ok, deleted " + r.affected);
  });

  const store = new TypeormStore({ cleanupLimit: 10 }).connect(repo);
  app.set("trust proxy", true);
  app.use(
    session({
      rolling: false,
      cookie: {
        maxAge: SESSION_COOKIE_MAX_AGE_MS, //
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
  console.log("Session ok");
  console.log("Configuring file upload");
  app.use(graphqlUploadExpress({ maxFileSize: FILE_UPLOAD_MAX_SIZE, maxFiles: 10 }));
  console.log("Upload ok");

  console.log("Creating apollo");
  const apolloSever = await createApollo();
  console.log("Apollo creation ok");
  apolloSever.applyMiddleware({ app, cors: false });

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
