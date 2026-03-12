<stack>
  Bun runtime, Hono web framework, Zod validation.
  DO NOT install new packages unless necessary. If you need database or authentication, use the database-auth skill.
</stack>

<structure>
  src/index.ts     — App entry, middleware, route mounting
  src/routes/      — Route modules (create as needed)
</structure>

<routes>
  Create routes in src/routes/ and mount them in src/index.ts.

  Example route file (src/routes/todos.ts):
  ```typescript
  import { Hono } from "hono";
  import { zValidator } from "@hono/zod-validator";
  import { z } from "zod";

  const todosRouter = new Hono();

  todosRouter.get("/", (c) => {
    return c.json({ todos: [] });
  });

  todosRouter.post(
    "/",
    zValidator("json", z.object({ title: z.string() })),
    (c) => {
      const { title } = c.req.valid("json");
      return c.json({ todo: { id: "1", title } });
    }
  );

  export { todosRouter };
  ```

  Mount in src/index.ts:
  ```typescript
  import { todosRouter } from "./routes/todos";
  app.route("/api/todos", todosRouter);
  ```
</routes>

<database>
  No database is configured by default.
  If the user needs to persist data or have user accounts, use the database-auth skill.
</database>

<environment>
  System manages git and the dev server (port 3000). DO NOT manage these.
  Access environment variables via process.env.
</environment>

<forbidden_files>
  None currently.
</forbidden_files>
