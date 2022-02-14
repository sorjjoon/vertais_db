const path = require("path");
const connectionUrlParser = require("pg-connection-string");
const config = connectionUrlParser.parse(process.env.DATABASE_URL);

module.exports = [
  {
    name: "default",
    type: "postgres",
    host: config.host,
    port: config.port,
    username: config.user,
    password: config.password,
    database: config.database,

    applicationName: "vertais, typeorm",

    dropSchema: false,
    synchronize: process.env.NODE_ENV !== "production",

    entities: [path.join(__dirname, "dist", "entities", "*.js")],
    migrationsTableName: "migrations",
    migrations: [path.join(__dirname, "dist", "migrations", "*.js")],

    cli: {
      migrationsTableName: "migrations",
      migrationsDir: [path.join(__dirname, "dist", "migrations", "*.js")],
    },

    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false, ssl: true } : false,
  },
];
