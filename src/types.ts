import "reflect-metadata";

import { Request, Response } from "express";
import { Session } from "express-session";
import { Account } from "./entities/Account";
import { Course } from "./entities/Course";
import { PeerAssesmentAssignment } from "./entities/PeerAssesmentAssignment";
export enum SqlErrorCodes {
  UNIQUE_VIOLATION = "23505",
  CHECK_VIOLATION = "23514",
  SERILALIZATION_FAILURE = "40001",
}

export type MyContext = {
  req: Request & { session: Session };
  res: Response;
  user: (Partial<Account> & { id: number; role: string }) | undefined;
  course?: Course;
  peerAssesmentAssignment?: PeerAssesmentAssignment;
};

declare module "express-session" {
  interface Session {
    userId?: number;
    role?: string;
  }
}
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnownError";
  }
}

export type Nullish = undefined | null;
