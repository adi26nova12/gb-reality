import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, seedFixture, type Fixture } from "./harness";

let db: PGlite;
let f: Fixture;
let adminA: string;
let agentA: string;
let outsider: string;

beforeEach(async () => {
  db = await createTestDb();
  f = await seedFixture(db);
  const user = async (email: string) => (await db.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email])).rows[0].id;
  adminA = await user("admin.a@example.test");
  agentA = await user("agent2.a@example.test");
  outsider = await user("new.person@example.test");
  await db.query("insert into organisation_memberships (organisation_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'agent')", [f.orgA, adminA, agentA]);
}, 60_000);

const asUser = (id: string) => ({ kind: "user" as const, id });
const role = async (org: string, user: string) =>
  (await db.query<{ role: string }>("select role from organisation_memberships where organisation_id = $1 and user_id = $2", [org, user])).rows[0]?.role;

describe("adding members", () => {
  it("lets an admin add an existing account by email (case-insensitive)", async () => {
    await as(db, asUser(adminA), (tx) => tx.query("select public.add_organisation_member($1, $2, 'agent')", [f.orgA, "  New.Person@Example.test "]));
    expect(await role(f.orgA, outsider)).toBe("agent");
  });

  it("refuses agents, other organisations and unknown or duplicate accounts", async () => {
    await expect(as(db, asUser(agentA), (tx) => tx.query("select public.add_organisation_member($1, $2, 'agent')", [f.orgA, "new.person@example.test"]))).rejects.toThrow(/forbidden/);
    await expect(as(db, asUser(adminA), (tx) => tx.query("select public.add_organisation_member($1, $2, 'agent')", [f.orgB, "new.person@example.test"]))).rejects.toThrow(/forbidden/);
    await expect(as(db, asUser(adminA), (tx) => tx.query("select public.add_organisation_member($1, $2, 'agent')", [f.orgA, "nobody@example.test"]))).rejects.toThrow(/user_not_found/);
    await expect(as(db, asUser(adminA), (tx) => tx.query("select public.add_organisation_member($1, $2, 'agent')", [f.orgA, "agent2.a@example.test"]))).rejects.toThrow(/already_member/);
  });

  it("only lets owners add owners", async () => {
    await expect(as(db, asUser(adminA), (tx) => tx.query("select public.add_organisation_member($1, $2, 'owner')", [f.orgA, "new.person@example.test"]))).rejects.toThrow(/only_owners_manage_owners/);
    await as(db, asUser(f.userA), (tx) => tx.query("select public.add_organisation_member($1, $2, 'owner')", [f.orgA, "new.person@example.test"]));
    expect(await role(f.orgA, outsider)).toBe("owner");
  });

  it("no longer allows inserting memberships directly", async () => {
    await expect(
      as(db, asUser(f.userA), (tx) => tx.query("insert into organisation_memberships (organisation_id, user_id, role) values ($1, $2, 'agent')", [f.orgA, outsider])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("changing roles", () => {
  it("lets admins promote agents but not touch owners", async () => {
    await as(db, asUser(adminA), (tx) => tx.query("select public.set_organisation_member_role($1, $2, 'admin')", [f.orgA, agentA]));
    expect(await role(f.orgA, agentA)).toBe("admin");
    await expect(as(db, asUser(adminA), (tx) => tx.query("select public.set_organisation_member_role($1, $2, 'agent')", [f.orgA, f.userA]))).rejects.toThrow(/only_owners_manage_owners/);
    await expect(as(db, asUser(adminA), (tx) => tx.query("select public.set_organisation_member_role($1, $2, 'owner')", [f.orgA, agentA]))).rejects.toThrow(/only_owners_manage_owners/);
  });

  it("always keeps at least one owner", async () => {
    await expect(as(db, asUser(f.userA), (tx) => tx.query("select public.set_organisation_member_role($1, $2, 'agent')", [f.orgA, f.userA]))).rejects.toThrow(/last_owner/);
    await as(db, asUser(f.userA), (tx) => tx.query("select public.set_organisation_member_role($1, $2, 'owner')", [f.orgA, adminA]));
    await as(db, asUser(f.userA), (tx) => tx.query("select public.set_organisation_member_role($1, $2, 'agent')", [f.orgA, f.userA]));
    expect(await role(f.orgA, f.userA)).toBe("agent");
  });

  it("refuses unknown roles and members of other organisations", async () => {
    await expect(as(db, asUser(f.userA), (tx) => tx.query("select public.set_organisation_member_role($1, $2, 'superuser')", [f.orgA, agentA]))).rejects.toThrow(/invalid_role/);
    await expect(as(db, asUser(f.userA), (tx) => tx.query("select public.set_organisation_member_role($1, $2, 'agent')", [f.orgA, f.userB]))).rejects.toThrow(/member_not_found/);
  });
});

describe("removing members", () => {
  it("unassigns the member's enquiries in that organisation", async () => {
    await db.query("update leads set assigned_agent_id = $1 where id = $2", [agentA, f.leadA]);
    await as(db, asUser(adminA), (tx) => tx.query("select public.remove_organisation_member($1, $2)", [f.orgA, agentA]));
    expect(await role(f.orgA, agentA)).toBeUndefined();
    const lead = (await db.query<{ assigned_agent_id: string | null }>("select assigned_agent_id from leads where id = $1", [f.leadA])).rows[0];
    expect(lead.assigned_agent_id).toBeNull();
  });

  it("protects owners from admins and the last owner from removal", async () => {
    await expect(as(db, asUser(adminA), (tx) => tx.query("select public.remove_organisation_member($1, $2)", [f.orgA, f.userA]))).rejects.toThrow(/only_owners_manage_owners/);
    await expect(as(db, asUser(f.userA), (tx) => tx.query("select public.remove_organisation_member($1, $2)", [f.orgA, f.userA]))).rejects.toThrow(/last_owner/);
    await expect(as(db, asUser(agentA), (tx) => tx.query("select public.remove_organisation_member($1, $2)", [f.orgA, adminA]))).rejects.toThrow(/forbidden/);
  });
});

describe("notification emails", () => {
  async function notify() {
    return (
      await db.query<{ id: string }>(
        "insert into notifications (organisation_id, recipient_id, type, title, body, lead_id) values ($1, $2, 'viewing_request', 'New viewing request', 'Not yet confirmed.', $3) returning id",
        [f.orgA, f.userA, f.leadA],
      )
    ).rows[0].id;
  }
  const status = async (id: string) => (await db.query<{ email_status: string }>("select email_status from notifications where id = $1", [id])).rows[0].email_status;

  it("skips recipients who have not opted in", async () => {
    const id = await notify();
    const rows = await as(db, { kind: "service" }, async (tx) => (await tx.query("select * from public.claim_notification_email($1)", [id])).rows);
    expect(rows).toEqual([]);
    expect(await status(id)).toBe("skipped");
  });

  it("claims each notification once and records the provider's answer", async () => {
    await as(db, asUser(f.userA), (tx) => tx.query("update organisation_memberships set notify_email = true where organisation_id = $1 and user_id = $2", [f.orgA, f.userA]));
    const id = await notify();

    const first = await as(db, { kind: "service" }, async (tx) => (await tx.query<{ recipient_email: string; title: string }>("select * from public.claim_notification_email($1)", [id])).rows);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ recipient_email: "agent.a@example.test", title: "New viewing request" });
    expect(await status(id)).toBe("sending");

    const retry = await as(db, { kind: "service" }, async (tx) => (await tx.query("select * from public.claim_notification_email($1)", [id])).rows);
    expect(retry).toEqual([]);

    await as(db, { kind: "service" }, (tx) => tx.query("select public.complete_notification_email($1, 'accepted', 'msg_123')", [id]));
    expect(await status(id)).toBe("accepted");
  });

  it("cannot be claimed by signed-in users, and recipients cannot forge the status", async () => {
    const id = await notify();
    await expect(as(db, asUser(f.userA), (tx) => tx.query("select * from public.claim_notification_email($1)", [id]))).rejects.toThrow(/permission denied/);
    await expect(as(db, asUser(f.userA), (tx) => tx.query("update notifications set email_status = 'accepted' where id = $1", [id]))).rejects.toThrow(/permission denied/);
  });
});
