import type { Message } from "@/sunflower/adapter/message";
import * as p from "drizzle-orm/pg-core";

export const instance_table = p.pgTable(
  "instances",
  {
    platform: p.text("platform").notNull(),
    platform_sid: p.text("platform_sid").notNull(),
    history: p.jsonb("history").$type<{ [key: string]: string[] }>().notNull(),
  },
  (table) => [
    p.primaryKey({
      name: "instance_pk",
      columns: [table.platform, table.platform_sid],
    }),
  ],
);
