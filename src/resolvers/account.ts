import "reflect-metadata";
import { Resolver, Query, Ctx, Arg, Mutation, InputType, Field } from "type-graphql";
import { MyContext, Nullish, SqlErrorCodes, UserError } from "../types";
import argon2 from "argon2";
import { Account, UserRole } from "../entities/Account";
import { AccountResponse } from "./types";
import { validUsername } from "../utils/utils";
import { DOMAIN_NAME, PASSWORD_RESET_TOKEN_MAX_AGE } from "../server/constant";
import { sendMail } from "../utils/sendMail";
import { randomBytes } from "crypto";
import { PasswordResetToken } from "../entities/PasswordResetToken";
import { MoreThanOrEqual } from "typeorm";
import { logoutUser } from "../server/auth";

@InputType()
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
  @Mutation(() => AccountResponse, { nullable: true })
  async register(
    @Arg("credentials") credentials: UsernamePasswordInput,
    @Arg("firstName") firstName: string,
    @Arg("lastName") lastName: string,
    @Arg("is_teacher") is_teacher: boolean,
    @Ctx() ctx: MyContext
  ): Promise<AccountResponse> {
    var role = UserRole.STUDENT;
    if (is_teacher) {
      role = UserRole.TEACHER;
    }
    credentials.email = credentials.email || undefined;
    const response: AccountResponse = {};
    response.errors = validUsername(credentials.username, credentials.password);
    if (credentials?.email?.length && !credentials.email.includes("@")) {
      response.errors?.push({ fieldName: "email", message: "Epäkelpo sähköposti" });
    }
    if (!credentials.password) {
      response.errors?.push({ fieldName: "password", message: "Salasana ei voi olla tyhjä" });
    } else if (!response.errors.length) {
      const hash = await argon2.hash(credentials.password);
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
          if (err.code == SqlErrorCodes.UNIQUE_VIOLATION) {
            if (err.detail.includes("username")) {
              response.errors?.push({ fieldName: "username", message: "Käyttäjänimi on varattu" });
            } else if (err.detail.includes("email")) {
              response.errors?.push({ fieldName: "email", message: "Tällä sähköpostilla on jo tili" });
            } else {
              console.error(err);
              response.errors?.push({ fieldName: "password", message: "Jokin meni pieleen, pahoittelumme" });
            }
          } else {
            console.log(err);
            response.errors?.push({ fieldName: "password", message: "Jokin meni pieleen, pahoittelumme" });
          }
        });
    }
    if (!response.errors.length) {
      response.errors = undefined;
      ctx.user = response.user ?? undefined;
    }
    return response;
  }

  @Query(() => Account, { nullable: true })
  async currentUser(@Ctx() { req }: MyContext): Promise<Account | Nullish> {
    return Account.findOne({ id: req.session.userId });
  }
  @Mutation(() => Boolean)
  async resetPassword(@Arg("email") email: string, @Ctx() { req }: MyContext) {
    let val = true;
    const user = await Account.findOne({ email });
    if (!user || !user.email) {
      throw new UserError("Antamasi sähköposti ei ole liitetty yhteenkään tiliin");
    }
    const expire = new Date(new Date().getTime() + PASSWORD_RESET_TOKEN_MAX_AGE);

    const token = PasswordResetToken.create({
      token: randomBytes(128).toString("hex"),
      owner: user,
      expires: expire,
    });

    await token.save().catch((err) => {
      console.error(err);
      val = false;
    });

    const url = `${DOMAIN_NAME}/password-reset/${token.token}`;
    const text = `<p>Hei ${user.username}!</p> 
    <p>Voit nollata salasanasi <a href="${url}">klikkaamalla tästä</a></p> 
    <p>Jos lähetit tämän viestin vahingossa, voit jättää sen huomiotta.</p> 
    
    <p> Linkki vanhenee yhden päivän kuluttua lähettämisestä </p> 
    <br>
    <hr style="margin:4px">
    <p>Tämä on automaattisesti lähetetty viesti, älä vastaa tähän viestiin.</p>
    <br>
    Jos linkki ei toimi, kopioi tämä osoite selaimeesi: 
    \n
    
    ${url}
    `;

    await sendMail(user.email, text, "Vertais.fi salasanan nollaus").catch((err) => {
      console.error(err);
      val = false;
    });

    return val;
  }
  @Mutation(() => Boolean)
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
    } else if (!credentials.password) {
      response.errors?.push({ fieldName: "password", message: "Väärä salasana" });
    } else {
      const validPwd = await argon2.verify(user.password, credentials.password);
      if (!validPwd) {
        response.errors?.push({ fieldName: "password", message: "Väärä salasana" });
      } else {
        response.user = user;
        req.session.userId = user.id;
        req.session.role = user.role;
      }
    }
    if (!response.errors?.length) {
      response.errors = undefined;
    }
    return response;
  }

  @Mutation(() => AccountResponse, { nullable: true })
  async updateUser(
    @Ctx() { req }: MyContext,
    @Arg("credentials", { nullable: true }) credentials?: UsernamePasswordInput,
    @Arg("firstName", { nullable: true }) firstName?: string,
    @Arg("lastName", { nullable: true }) lastName?: string,
    @Arg("resetToken", { nullable: true }) resetToken?: string
  ): Promise<AccountResponse> {
    const response: AccountResponse = { errors: [], user: null };
    credentials = credentials || {};

    credentials.email = credentials?.email || undefined;
    credentials.password = credentials?.password || undefined;
    credentials.username = credentials?.username || undefined;

    firstName = firstName || undefined;
    lastName = lastName || undefined;

    if (credentials.password != null) {
      response.errors?.push(...validUsername(undefined, credentials.password));
    }
    if (credentials.username != null) {
      response.errors?.push(...validUsername(credentials.username));
    }
    if (credentials?.email?.length && !credentials.email.includes("@")) {
      response.errors?.push({ fieldName: "email", message: "Epäkelpo sähköposti" });
    }
    if (firstName != null && firstName.length < 1) {
      response.errors?.push({ fieldName: "firstName", message: "Etunimi ei voi olla tyhjä" });
    }
    if (lastName != null && lastName.length < 1) {
      response.errors?.push({ fieldName: "lastName", message: "Sukunimi ei voi olla tyhjä" });
    }
    if (response.errors?.length) {
      return response;
    }
    if (!resetToken) {
      response.user = await Account.findOne({ id: req.session.userId });
      if (!response.user) {
        response.errors?.push({
          fieldName: "password",
          message: "Jokin meni pieleen, pahoittelumme. Yritä kirjautua ulos",
        });
      }
    } else {
      const token = await PasswordResetToken.findOne({
        relations: ["user"],
        where: [{ token: resetToken }, { expires: MoreThanOrEqual(new Date()) }],
      });
      response.user = token?.owner;
      if (!token?.owner) {
        response.errors?.push({
          fieldName: "password",
          message: "Käyttämäsi linkki on vanhentunut tai virheellinen.",
        });
      } else {
        await token.remove();
      }
    }

    if (!response.user) {
      return response;
    }

    const originalUser = Object.assign({}, response.user);

    if (!response.errors?.length) {
      if (credentials.password) {
        response.user.password = await argon2.hash(credentials.password);
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
          console.log(originalUser);
          if (err.code == SqlErrorCodes.UNIQUE_VIOLATION) {
            if (err.detail.includes("username")) {
              response.errors?.push({ fieldName: "username", message: "Käyttäjänimi on varattu" });
            } else if (err.detail.includes("email")) {
              response.errors?.push({ fieldName: "email", message: "Tällä sähköpostilla on jo tili" });
            } else {
              console.error(err);
              response.errors?.push({ fieldName: "password", message: "Jokin meni pieleen, pahoittelumme" });
            }
          } else {
            console.log(err);
            response.errors?.push({ fieldName: "password", message: "Jokin meni pieleen, pahoittelumme" });
          }
        });
    }
    return response;
  }
}
