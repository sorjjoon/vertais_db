## vertais_db

Backend for the [https://vertais.fi](https://vertais.fi) site.

Local setup:

```
npm run build
npm run start
```

Open [http://localhost:3000/graphql](http://localhost:3000/graphql) to run queries against the GraphQL schema.

The following environment variables need to be set before startup (or set in a .env file)<br>

```
DATABASE_URL, pointing to a postgresql instance. (Tested on pg 12+)
SECRET_KEY,  used for signing session cookies. Recommended length 64 bytes.
EMAIL_USERNAME, EMAIL_PASSWORD, EMAIL_HOST and EMAIL_PORT. Not needed for startup, but required for password reset emails to be sent.
```
