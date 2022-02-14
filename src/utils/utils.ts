import { FileUpload } from "graphql-upload";
import "reflect-metadata";
import { FileBlob } from "../entities/FileBlob";
import { FileDetails } from "../entities/FileDetails";
import { FieldError, FileTarget } from "../resolvers/types";
import { Nullish } from "../types";
import { random } from "lodash";
import { loremIpsum } from "lorem-ipsum";
// PAST = REVEAL < NOW()

/**
 * Returns the first object, which has a 'key' attribute equaling value
 *
 * Returns undefined in case not found
 * @param  {T[]} source
 * @param  {string} key
 * @param  {K} value
 * @returns T
 */
export function lookUpBasedOnKey<T, K>(source: readonly T[], key: string, value: K): T | Nullish {
  for (let x of source) {
    if ((x as any)[key] === value) return x;
  }
  return undefined;
}

export function sleep(timeMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeMs));
}

export function randomString(length: number, upper: boolean = true): string {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  if (!upper) {
    result = result.toLowerCase();
  }
  return result;
}

export function filterKeys<T>(
  obj: T,
  key: (obj: any, key: string) => boolean = (ob, attr) => ob[attr] === undefined,
  setUpdatedAt = true
) {
  Object.keys(obj as any).forEach((k) => key(obj, k) && delete (obj as any)[k]);
  if (setUpdatedAt) {
    (obj as any).updatedAt = new Date();
  }
  return obj;
}

export function loginUser(req: any, user: any) {
  req.session.userId = user.id;
  req.session.role = user.role;
}

export function getNestedAttribute(obj: any, key: string) {
  const parts = key.split(".");

  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]];
  }
  return obj[parts[parts.length - 1]];
}

export function objectIsEmpty(object: any) {
  for (let _ in object) {
    return false;
  }
  return true;
}

export function multiMap<T, K>(arr: T[], func: (e: T) => K | K[]) {
  const res: K[] = [];
  arr.forEach((x) => {
    let newArr = func(x);
    if (Array.isArray(newArr)) {
      res.push(...newArr);
    } else {
      res.push(newArr);
    }
  });
  return res;
}

export async function uploadFilesToFileDetails(
  files: [Promise<FileUpload>],
  user: { id: number },
  target: FileTarget = {}
) {
  const rawFiles = await Promise.all(files);

  return Promise.all(
    rawFiles.map((f) => {
      const temp: Buffer[] = [];

      return new Promise<FileDetails>((resolve, reject) => {
        f.createReadStream()
          .on("error", (err) => {
            reject(err);
          })
          .on("data", (c) => temp.push(c as Buffer))
          .on("end", () => {
            const file = new FileBlob();
            file.data = Buffer.concat(temp);

            const details = new FileDetails({ owner: user, ...target });
            details.filename = f.filename;
            details.mimetype = f.mimetype;
            file.details = details;
            details.file = file;
            resolve(details);
          });
      });
    })
  );
}

export function generateRandomRichText() {
  const count = random(3, 9, false);
  const res = [];
  for (let i = 0; i < count; i++) {
    res.push(loremIpsum());
  }
  return res.join("<br>");
}

export function yesterday() {
  const todayMs = new Date().getTime();

  return new Date(todayMs - 24 * 60 * 60 * 1000);
}

export function nextYear() {
  const todayMs = new Date().getTime();

  return new Date(todayMs + 365 * 24 * 60 * 60 * 1000);
}
