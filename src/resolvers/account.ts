import "reflect-metadata";

import { format } from "util";
import { Resolver, Query, Ctx, Arg, Mutation, InputType, Field, Authorized } from "type-graphql";
import { MyContext, Nullish, UserError } from "../types";
import bcrypt from "bcrypt";
import { Account, UserRole } from "../entities/Account";
import { AccountResponse, FieldError } from "./types";
import {
  DOMAIN_NAME,
  MAX_FIRSTNAME_OR_LASTNAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  PASSWORD_HASH_SALT_ROUNDS,
  PASSWORD_RESET_TOKEN_MAX_AGE_MS,
  PostgreSQLErrorCodes,
} from "../server/constant";
import { sendMail } from "../utils/sendMail";
import { randomBytes } from "crypto";
import { PasswordResetToken } from "../entities/PasswordResetToken";
import { getConnection, LessThan, MoreThan, MoreThanOrEqual } from "typeorm";
import { logoutUser } from "../server/authMiddlewares";

function hashPassword(plainText: string) {
  return new Promise<string>((resolve, reject) => {
    bcrypt.hash(plainText, PASSWORD_HASH_SALT_ROUNDS, (err, hash) => {
      if (err) {
        reject(err);
      } else {
        resolve(hash);
      }
    });
  });
}

function comparePassword(plainText: string, hashedPassword: string) {
  return new Promise<boolean>((resolve, reject) => {
    bcrypt.compare(plainText, hashedPassword, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

interface NonNullAccountFields {
  username?: boolean;
  password?: boolean;

  firstName?: boolean;
  lastName?: boolean;
}

function validateAccountInfo(
  { username, password, email, firstName, lastName }: Partial<Account>,
  allowNullForFields: NonNullAccountFields = {}
) {
  const errors: FieldError[] = [];

  // Username
  if (username == null && !allowNullForFields.username) {
    errors.push({ fieldName: "username", message: "Käyttäjänimi ei voi olla tyhjä" });
  }

  if (username != null && username.length < MIN_USERNAME_LENGTH) {
    errors.push({
      fieldName: "username",
      message: format("Käyttäjänimen täytyy olla vähintään %s merkkiä", MIN_USERNAME_LENGTH),
    });
  }

  if (username != null && username.length > MAX_USERNAME_LENGTH) {
    errors.push({
      fieldName: "username",
      message: format("Käyttäjänimi saa olla enintään %s merkkiä", MAX_USERNAME_LENGTH),
    });
  }

  // Password
  if (password == null && !allowNullForFields.password) {
    errors.push({ fieldName: "password", message: "Salasana ei voi olla tyhjä" });
  }

  if (password != null && password.length < MIN_PASSWORD_LENGTH) {
    errors.push({
      fieldName: "password",
      message: format("Salasanan täytyy olla vähintään %s merkkiä", MIN_PASSWORD_LENGTH),
    });
  }

  if (password != null && password.length > MAX_PASSWORD_LENGTH) {
    errors.push({
      fieldName: "password",
      message: format("Salasana saa olla enintään %s merkkiä", MAX_PASSWORD_LENGTH),
    });
  }

  // Email
  if (email && !email.includes("@")) {
    errors.push({ fieldName: "email", message: "Epäkelpo sähköposti" });
  }
  // firstName
  if (firstName == null && !allowNullForFields.firstName) {
    errors.push({ fieldName: "firstName", message: "Etunimi ei voi olla tyhjä" });
  }
  if (firstName != null && firstName.length > MAX_FIRSTNAME_OR_LASTNAME_LENGTH) {
    errors.push({ fieldName: "firstName", message: format("Etunimi saa olla enintään %s merkkiä") });
  }

  // lastName
  if (lastName == null && !allowNullForFields.lastName) {
    errors.push({ fieldName: "firstName", message: "Sukunimi ei voi olla tyhjä" });
  }
  if (lastName != null && lastName.length > MAX_FIRSTNAME_OR_LASTNAME_LENGTH) {
    errors.push({ fieldName: "firstName", message: format("Sukunimi saa olla enintään %s merkkiä") });
  }

  return errors;
}

function handleAccountUpdatePostgreSQLError(error: any) {
  if (error.code == PostgreSQLErrorCodes.UNIQUE_VIOLATION) {
    if (error.detail.includes("username")) {
      return { fieldName: "username", message: "Käyttäjänimi on varattu" };
    } else if (error.detail.includes("email")) {
      return { fieldName: "email", message: "Tällä sähköpostilla on jo tili" };
    }
  }
  // Unexpected error
  throw error;
}

@InputType({ description: "Username, email and password input" })
class UsernamePasswordInput {
  @Field({ nullable: true })
  username?: string;
  @Field({ nullable: true })
  password?: string;
  @Field({ nullable: true })
  email?: string;
}

@Resolver()
export class AccountResolver {
  @Mutation(() => AccountResponse, { nullable: true, description: "Create a new user." })
  async register(
    @Arg("credentials", { description: "UsernamePasswordInput for the new user" }) credentials: UsernamePasswordInput,
    @Arg("firstName") firstName: string,
    @Arg("lastName") lastName: string,
    @Arg("is_teacher", { description: "If the new user should be created as a student or a teacher." })
    is_teacher: boolean,
    @Ctx() ctx: MyContext
  ): Promise<AccountResponse> {
    var role = UserRole.STUDENT;
    if (is_teacher) {
      role = UserRole.TEACHER;
    }
    credentials.email = credentials.email || undefined;
    const response: AccountResponse = { errors: [] };

    response.errors?.push(...validateAccountInfo({ ...credentials, firstName, lastName }));

    if (response.errors?.length) {
      return response;
    }

    const hash = await hashPassword(credentials.password!);
    const user = Account.create({
      username: credentials.username,
      role,
      firstName,
      lastName,
      password: hash,
      email: credentials.email,
    });

    await user
      .save()
      .then((insertedUser) => {
        response.user = insertedUser;
      })
      .catch((err) => {
        response.errors?.push(handleAccountUpdatePostgreSQLError(err));
      });

    if (response.errors?.length === 0) {
      response.errors = undefined;
      ctx.user = response.user ?? undefined; // Temporarily authenticate this request with the currently created user.
    }
    return response;
  }

  @Query(() => Account, {
    nullable: true,
    description: `Return the currently authenticated user. 
    Do not attempt to load any non lazy relations.`,
  })
  async currentUser(@Ctx() { req }: MyContext): Promise<Account | Nullish> {
    return Account.findOne({ id: req.session.userId });
  }

  @Mutation(() => Boolean, {
    description: `Request a password reset token for user attached to this email.
  Will raise an error, if you attempt to request token for an email not related to any account.
  Returns a boolean flag, indicating if sending the email was a success.
  `,
  })
  async requestPasswordResetToken(@Arg("email", { description: "Email attached to " }) email: string) {
    let val = true;
    const user = await Account.findOne({ email });
    if (!user || !user.email) {
      throw new UserError("Antamasi sähköposti ei ole liitetty yhteenkään tiliin");
    }

    const expire = new Date(new Date().getTime() + PASSWORD_RESET_TOKEN_MAX_AGE_MS);

    console.log("Creating a password reset token for user: ", user.id);

    const token = PasswordResetToken.create({
      token: randomBytes(128).toString("hex"),
      owner: user,
      expires: expire,
    });

    // FIXME: Delete previously generated tokens?
    await token.save();

    const url = `${DOMAIN_NAME}/password-reset/${token.token}`;
    const text = `<p>Hei ${user.username}!</p> 
    <p>Voit nollata salasanasi klikkaamalla <a href="${url}">tästä</a></p> 
    <p>Jos lähetit tämän viestin vahingossa, voit jättää sen huomiotta.</p> 
    
    <p> Linkki vanhenee yhden päivän kuluttua lähettämisestä </p> 
    <br>
    <hr style="margin:4px">
    <p>Tämä on automaattisesti lähetetty viesti, älä vastaa tähän viestiin.</p>
    <br>

    Jos linkki ei toimi, kopioi tämä osoite selaimeesi: 
    
    ${url}
    `;

    await sendMail(user.email, text, "Vertais.fi salasanan nollaus").catch((err) => {
      console.error("Error sending email to  ", user.email);
      console.error(err);
      val = false;
    });

    return val;
  }

  @Mutation(() => Boolean, {
    description: `Logout the currently authenticated user. 
    Returns a boolean flag, indicating if there was an error attempting to log out the user.`,
  })
  async logout(@Ctx() ctx: MyContext): Promise<boolean> {
    return logoutUser(ctx);
  }

  @Mutation(() => AccountResponse, { nullable: true })
  async login(
    @Arg("credentials") credentials: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<AccountResponse> {
    const user = await Account.findOne({ username: credentials.username });
    const response: AccountResponse = { errors: [] };

    if (!user) {
      response.errors?.push({ fieldName: "username", message: "Käyttäjänimeä ei löydy" });
    }

    if (response.errors?.length) {
      return response;
    }
    const passwordIsValid = await comparePassword(credentials.password ?? "", user!.password);

    if (!passwordIsValid) {
      response.errors?.push({ fieldName: "password", message: "Väärä salasana" });
    } else {
      response.user = user;
      // Login the user
      req.session.userId = user!.id;
      req.session.role = user!.role;
    }

    if (!response.errors?.length) {
      response.errors = undefined;
    }
    return response;
  }

  @Authorized()
  @Mutation(() => AccountResponse, {
    nullable: true,
    description: `Update user details (including password) for the currently authenticated user.
  You must be authenticated to use this mutation, use changePasswordWithResetToken instead to update an unauthenticated user's password.
  `,
  })
  async updateAuthenticatedUserDetails(
    @Ctx() { req }: MyContext,
    @Arg("newCredentials", { nullable: true }) credentials?: UsernamePasswordInput,
    @Arg("firstName", { nullable: true }) firstName?: string,
    @Arg("lastName", { nullable: true }) lastName?: string
  ): Promise<AccountResponse> {
    const response: AccountResponse = { errors: [], user: null };
    credentials = credentials || {};

    credentials.email = credentials?.email || undefined;
    credentials.password = credentials?.password || undefined;
    credentials.username = credentials?.username || undefined;

    firstName = firstName || undefined;
    lastName = lastName || undefined;

    response.errors?.push(
      ...validateAccountInfo(
        { ...credentials, firstName, lastName },
        { firstName: true, lastName: true, username: true, password: true }
      )
    );

    if (response.errors?.length) {
      return response;
    }

    response.user = await Account.findOne({ id: req.session.userId });
    if (!response.user) {
      response.errors?.push({
        fieldName: "password",
        message: "Jokin meni pieleen, pahoittelumme. Yritä kirjautua ulos",
      });
      return response;
    }

    const originalUser = Object.assign({}, response.user);

    if (credentials.password) {
      response.user.password = await hashPassword(credentials.password);
    }
    if (credentials.username) {
      response.user.username = credentials.username;
    }
    if (credentials.email) {
      response.user.email = credentials.email;
    }
    if (firstName) {
      response.user.firstName = firstName;
    }
    if (lastName) {
      response.user.lastName = lastName;
    }

    await response.user
      .save()
      .then(() => {
        response.errors = undefined;
      })
      .catch(async (err) => {
        response.user = originalUser;
        response.errors?.push(handleAccountUpdatePostgreSQLError(err));
      });

    return response;
  }

  @Mutation(() => Boolean, {
    nullable: true,
    description: `Update an account password using a secure reset token.
    
  Return true if the update is successfull, throws an error, if the provided reset token was invalid or expired, or the provided password was not valid.
  `,
  })
  async updatePasswordUsingResetToken(
    @Ctx() { req }: MyContext,
    @Arg("resetToken", { nullable: false }) resetToken: string,
    @Arg("newPassword", { nullable: false }) newPassword: string
  ) {
    const error = validateAccountInfo(
      { password: newPassword },
      { username: true, firstName: true, lastName: true }
    )[0];

    if (error) {
      throw new UserError(error.message);
    }

    await getConnection().transaction(async (transEm) => {
      const token = await transEm.findOne(PasswordResetToken, {
        where: { token: resetToken, expires: MoreThan(new Date()) },
      });

      if (!token) {
        throw new UserError(
          "Käyttämäsi linkki on vanhentunut tai virheellinen. Jos kirjoitit linkin itse, tarkista oikeinkirjoitus"
        );
      }

      const user = token.owner;
      user.password = await hashPassword(newPassword);

      await transEm.save(user);
      await transEm.delete(PasswordResetToken, { id: token.id });
    });

    return true;
  }
}
