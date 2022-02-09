import "reflect-metadata";

import { MAX_LOG_MESSAGE_LENGTH, __prod__ } from "./server/constant";
import { AdvancedConsoleLogger, QueryRunner } from "typeorm";

import { SqlErrorCodes } from "./types";
class CustomLogger extends AdvancedConsoleLogger {
  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!query.includes('"session"')) {
      super.logQuery(removeVerboseSelects(query), mapParamsSafe(parameters), queryRunner);
    }
  }

  logQueryError(error: any, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (error.code !== SqlErrorCodes.UNIQUE_VIOLATION) {
      super.logQueryError(error, query, mapParamsSafe(parameters), queryRunner);
    } else {
      console.log("\x1b[31m", error.message);
    }
  }
}

function removeVerboseSelects(query: string) {
  return query.replaceAll(/(SELECT)(.+?)(?= FROM)/g, "SELECT * ");
}

function mapParamsSafe(parameters?: any[]) {
  return parameters?.map((msg) => {
    if (typeof msg == "string") {
      if (msg.length < MAX_LOG_MESSAGE_LENGTH) {
        return msg;
      } else {
        return (
          msg.slice(0, MAX_LOG_MESSAGE_LENGTH / 3) +
          ` ... ${Math.floor(msg.length - MAX_LOG_MESSAGE_LENGTH / 3)} more characters `
        );
      }
    }
    if (Buffer.isBuffer(msg)) {
      return `<binary data ${msg.byteLength} bytes>`;
    }
    return msg;
  });
}

export default {
  logger: new CustomLogger(["query", "schema", "error", "warn", "info", "log", "migration"]),
};
