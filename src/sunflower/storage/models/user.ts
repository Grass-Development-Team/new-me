import { defineRelations } from "drizzle-orm";
import p, { foreignKey, pgTable, primaryKey } from "drizzle-orm/pg-core";

export const user_table = pgTable("users", {
  id: p.uuid("id").primaryKey(),
  score: p.integer("score").notNull().default(10),
  last_interaction: p.timestamp("last_interaction"),
  summary: p.text("summary"),
});

export const platform_user_table = pgTable(
  "platform_users",
  {
    platform: p.text("platform").notNull(),
    platform_uid: p.text("user_id").notNull(),
  },
  (table) => [
    primaryKey({
      name: "platform_user_id",
      columns: [table.platform, table.platform_uid],
    }),
  ],
);

export const user_platform_relation_table = pgTable(
  "user_platform_relations",
  {
    user_id: p.uuid("user_id").notNull(),
    platform: p.text("platform").notNull(),
    platform_uid: p.text("platform_uid").notNull(),
  },
  (table) => [
    foreignKey({
      name: "user_platform_relation_user_id_fk",
      columns: [table.user_id],
      foreignColumns: [user_table.id],
    }),
    foreignKey({
      name: "user_platform_relation_platform_user_fk",
      columns: [table.platform, table.platform_uid],
      foreignColumns: [
        platform_user_table.platform,
        platform_user_table.platform_uid,
      ],
    }),
  ],
);

export const relations = defineRelations(
  {
    user_table,
    platform_user_table,
    user_platform_relation_table,
  },
  (r) => ({
    user_platform_relation_table: {
      user: r.one.user_table({
        from: r.user_platform_relation_table.user_id,
        to: r.user_table.id,
      }),
      platform_user: r.one.platform_user_table({
        from: [
          r.user_platform_relation_table.platform,
          r.user_platform_relation_table.platform_uid,
        ],
        to: [
          r.platform_user_table.platform,
          r.platform_user_table.platform_uid,
        ],
      }),
    },
    user_table: {
      platform_users: r.many.platform_user_table({
        from: r.user_table.id.through(r.user_platform_relation_table.user_id),
        to: [
          r.platform_user_table.platform.through(
            r.user_platform_relation_table.platform,
          ),
          r.platform_user_table.platform_uid.through(
            r.user_platform_relation_table.platform_uid,
          ),
        ],
      }),
      platform_relations: r.many.user_platform_relation_table({
        from: r.user_table.id,
        to: r.user_platform_relation_table.user_id,
      }),
    },
    platform_user_table: {
      user: r.one.user_table({
        from: [
          r.platform_user_table.platform.through(
            r.user_platform_relation_table.platform,
          ),
          r.platform_user_table.platform_uid.through(
            r.user_platform_relation_table.platform_uid,
          ),
        ],
        to: r.user_table.id.through(r.user_platform_relation_table.user_id),
      }),
      user_relations: r.many.user_platform_relation_table({
        from: [
          r.platform_user_table.platform,
          r.platform_user_table.platform_uid,
        ],
        to: [
          r.user_platform_relation_table.platform,
          r.user_platform_relation_table.platform_uid,
        ],
      }),
    },
  }),
);
