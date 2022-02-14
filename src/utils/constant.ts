export const minUsernameLength = 3;
export const maxUsernameLength = 100;

export const minPasswordLength = 5;
export const maxPasswordLength = 100;

export const commentCheckConstraintName = "at_least_one_foreign_key";

export const courseCodeLength = 4;

export enum SqlErrorCodes {
  UNIQUE_VIOLATION = "23505",
  CHECK_VIOLATION = "23514",
  SERILALIZATION_FAILURE = "40001",
}
