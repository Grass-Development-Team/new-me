import * as p from "drizzle-orm/pg-core";

import type { Message } from "@/sunflower/adapter/message";
import { user_table } from "./user";
import { instance_table } from "./instance";

export const messages_table = p.pgTable(
  "messages",
  {
    id: p.uuid("id").primaryKey(),
    platform: p.text("platform").notNull(),
    platform_sid: p.text("platform_sid").notNull(),
    scene: p.text("scene").notNull(),
    sender_id: p.text("sender_id").references(() => user_table.id),
  },
  (table) => [
    p.index("instance_idx").on(table.platform, table.platform_sid),
    p.foreignKey({
      name: "message_instance_fk",
      columns: [table.platform, table.platform_sid],
      foreignColumns: [instance_table.platform, instance_table.platform_sid],
    }),
  ],
);

export const message_vector_table = p.pgTable("message_vectors", {
  message_id: p
    .uuid("message_id")
    .primaryKey()
    .references(() => messages_table.id),
  vector: p
    .vector("vector", {
      dimensions: 1536,
    })
    .notNull(),
  // TODO
});
