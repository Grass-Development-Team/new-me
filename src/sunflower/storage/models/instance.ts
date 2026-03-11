import * as p from "drizzle-orm/pg-core";
import { messages_table } from "./message";

export const instance_table = p.pgTable(
  "instances",
  {
    platform: p.text("platform").notNull(),
    platform_sid: p.text("platform_sid").notNull(),
    created_at: p
      .timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: p
      .timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    p.primaryKey({
      name: "instance_pk",
      columns: [table.platform, table.platform_sid],
    }),
    p.index("instance_updated_at_idx").on(table.updated_at),
  ],
);

/**
 * 归档场景历史：一条记录对应某个 scene 中的一条消息引用。
 * 按 id 升序即可得到 scene 对应的 message_id 列表顺序。
 */
export const instance_scene_history_table = p.pgTable(
  "instance_scene_history",
  {
    id: p.bigserial("id", { mode: "number" }).primaryKey(),
    platform: p.text("platform").notNull(),
    platform_sid: p.text("platform_sid").notNull(),
    scene: p.text("scene").notNull(),
    message_id: p.uuid("message_id").notNull(),
    created_at: p
      .timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    p.foreignKey({
      name: "instance_scene_history_instance_fk",
      columns: [table.platform, table.platform_sid],
      foreignColumns: [instance_table.platform, instance_table.platform_sid],
    }),
    p.foreignKey({
      name: "instance_scene_history_message_fk",
      columns: [table.message_id],
      foreignColumns: [messages_table.id],
    }),
    p
      .index("instance_scene_history_lookup_idx")
      .on(table.platform, table.platform_sid, table.scene, table.id),
    p.index("instance_scene_history_message_idx").on(table.message_id),
    p
      .uniqueIndex("instance_scene_history_unique_ref")
      .on(table.platform, table.platform_sid, table.scene, table.message_id),
  ],
);
