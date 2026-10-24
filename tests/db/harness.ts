import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

export async function createTestDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(readFileSync(join(here, "supabase-shim.sql"), "utf8"));
  const migrationsDir = join(root, "supabase", "migrations");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return db;
}

type Role = { kind: "anon" } | { kind: "service" } | { kind: "user"; id: string };

/** Runs `fn` as the given Supabase role, inside a transaction that is rolled back unless `commit` is set. */
export async function as<T>(
  db: PGlite,
  role: Role,
  fn: (tx: Transaction) => Promise<T>,
  { commit = true }: { commit?: boolean } = {},
): Promise<T> {
  return db.transaction(async (tx) => {
    if (role.kind === "anon") {
      await tx.exec("set local role anon");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "anon" })]);
    } else if (role.kind === "service") {
      await tx.exec("set local role service_role");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]);
    } else {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: role.id, role: "authenticated" }),
      ]);
    }
    const result = await fn(tx);
    if (!commit) await tx.rollback();
    return result;
  });
}

export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export interface Fixture {
  userA: string;
  userB: string;
  orgA: string;
  orgB: string;
  devA: string;
  devB: string;
  propA2bhkInBudget: string;
  propA2bhkOverBudget: string;
  propA3bhk: string;
  propASold: string;
  propB: string;
  leadA: string;
  leadB: string;
}

/** Two organisations with one agent each, inserted as the database owner. */
export async function seedFixture(db: PGlite): Promise<Fixture> {
  const one = async (sql: string, params: unknown[] = []) =>
    ((await db.query<{ id: string }>(sql, params)).rows[0] as { id: string }).id;

  const userA = await one("insert into auth.users (email, raw_user_meta_data) values ('agent.a@example.test', '{\"full_name\":\"Priya Agent\"}') returning id");
  const userB = await one("insert into auth.users (email) values ('agent.b@example.test') returning id");
  const orgA = await one("insert into organisations (name, slug) values ('Org A', 'org-a') returning id");
  const orgB = await one("insert into organisations (name, slug) values ('Org B', 'org-b') returning id");
  await db.query("insert into organisation_memberships (organisation_id, user_id, role) values ($1, $2, 'owner'), ($3, $4, 'agent')", [orgA, userA, orgB, userB]);
  await db.query("update profiles set phone_e164 = '+919800000001' where id = $1", [userA]);

  const devA = await one(
    "insert into developments (organisation_id, name, payment_plan) values ($1, 'Example Residences', '[{\"label\":\"On booking\",\"value\":\"10%\"}]') returning id",
    [orgA],
  );
  const devB = await one("insert into developments (organisation_id, name) values ($1, 'Other Towers') returning id", [orgB]);

  const prop = (org: string, dev: string, ref: string, config: string, price: number, status = "available") =>
    one(
      "insert into properties (organisation_id, development_id, unit_reference, configuration, bedrooms, bathrooms, area, price, availability_status) values ($1, $2, $3, $4, 2, 2, 1100, $5, $6) returning id",
      [org, dev, ref, config, price, status],
    );
  const propA2bhkInBudget = await prop(orgA, devA, "A-1204", "2BHK", 9200000);
  const propA2bhkOverBudget = await prop(orgA, devA, "A-1801", "2BHK", 11500000);
  const propA3bhk = await prop(orgA, devA, "B-0902", "3BHK", 14000000);
  const propASold = await prop(orgA, devA, "A-0603", "2BHK", 8500000, "sold");
  const propB = await prop(orgB, devB, "X-101", "2BHK", 9000000);

  const leadA = await one(
    "insert into leads (organisation_id, development_id, buyer_name, phone_e164, configuration, budget_min, budget_max, notes, created_by) values ($1, $2, 'Ahmed Khan', '+919812345678', '2BHK', 8000000, 10000000, 'Private note: prefers east facing', $3) returning id",
    [orgA, devA, userA],
  );
  const leadB = await one(
    "insert into leads (organisation_id, development_id, buyer_name, phone_e164, configuration, created_by) values ($1, $2, 'Other Buyer', '+971501234567', '2BHK', $3) returning id",
    [orgB, devB, userB],
  );

  return { userA, userB, orgA, orgB, devA, devB, propA2bhkInBudget, propA2bhkOverBudget, propA3bhk, propASold, propB, leadA, leadB };
}
