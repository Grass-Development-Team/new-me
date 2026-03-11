import * as p from "drizzle-orm/pg-core";
import { createHash } from "node:crypto";

import type { Message } from "@/sunflower/adapter/message";
import { user_table } from "./user";

const dynamic_vector = p.customType<{
  data: number[];
  driverData: string;
}>({
  dataType() {
    return "vector";
  },
  toDriver(value) {
    return JSON.stringify(value);
  },
  fromDriver(value) {
    if (!value || value.length < 2) {
      return [];
    }

    return value
      .slice(1, -1)
      .split(",")
      .filter((item) => item.length > 0)
      .map((item) => Number.parseFloat(item));
  },
});

export const messages_table = p.pgTable(
  "messages",
  {
    id: p.uuid("id").primaryKey().defaultRandom(),
    role: p.text("role").$type<Message["role"]>().notNull(),
    parts: p.jsonb("parts").$type<Message["parts"]>().notNull(),
    text_content: p.text("text_content"),
    sender_id: p.uuid("sender_id").references(() => user_table.id),
    created_at: p
      .timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    p.index("messages_sender_idx").on(table.sender_id),
    p.index("messages_created_at_idx").on(table.created_at),
    p.index("messages_role_idx").on(table.role),
  ],
);

export const message_vector_table = p.pgTable(
  "message_vectors",
  {
    id: p.uuid("id").primaryKey().defaultRandom(),
    message_id: p
      .uuid("message_id")
      .notNull()
      .references(() => messages_table.id, {
        onDelete: "cascade",
      }),
    embedding_driver: p.text("embedding_driver").notNull(),
    embedding_model: p.text("embedding_model").notNull(),
    embedding_dimensions: p.integer("embedding_dimensions").notNull(),
    chunk_index: p.integer("chunk_index").notNull(),
    chunk_text: p.text("chunk_text").notNull(),
    chunk_token_count: p.integer("chunk_token_count"),
    vector: dynamic_vector("vector").notNull(),
    created_at: p
      .timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    p
      .uniqueIndex("message_vectors_chunk_unique")
      .on(
        table.message_id,
        table.embedding_driver,
        table.embedding_model,
        table.chunk_index,
      ),
    p.index("message_vectors_message_idx").on(table.message_id),
    p
      .index("message_vectors_model_idx")
      .on(
        table.embedding_driver,
        table.embedding_model,
        table.embedding_dimensions,
      ),
  ],
);

type VectorDistance = "cosine" | "l2" | "ip";
type VectorIndexMethod = "hnsw" | "ivfflat";

const DISTANCE_OPS: Record<VectorDistance, string> = {
  cosine: "vector_cosine_ops",
  l2: "vector_l2_ops",
  ip: "vector_ip_ops",
};

export interface MessageVectorRuntimeIndexConfig {
  embedding_driver: string;
  embedding_model: string;
  embedding_dimensions: number;
  distance?: VectorDistance;
  method?: VectorIndexMethod;
}

const quote_identifier = (value: string) => `"${value.replace(/"/g, '""')}"`;

const quote_literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

export const build_enable_vector_extension_sql = () =>
  "CREATE EXTENSION IF NOT EXISTS vector;";

/**
 * 运行时创建按模型分区的 partial index。
 * 这样即使切换 embedding 维度，也无需改 migration 或删除旧数据。
 */
export const build_message_vector_runtime_index_sql = (
  config: MessageVectorRuntimeIndexConfig,
) => {
  if (
    !Number.isInteger(config.embedding_dimensions) ||
    config.embedding_dimensions <= 0
  ) {
    throw new Error("embedding_dimensions must be a positive integer");
  }

  const distance = config.distance ?? "cosine";
  const method = config.method ?? "hnsw";
  const opclass = DISTANCE_OPS[distance];

  const signature = `${config.embedding_driver}:${config.embedding_model}:${config.embedding_dimensions}:${distance}:${method}`;
  const suffix = createHash("sha1")
    .update(signature)
    .digest("hex")
    .slice(0, 16);
  const index_name = `message_vectors_runtime_${suffix}`;

  const where_clause = [
    `embedding_driver = ${quote_literal(config.embedding_driver)}`,
    `embedding_model = ${quote_literal(config.embedding_model)}`,
    `embedding_dimensions = ${config.embedding_dimensions}`,
  ].join(" AND ");

  return `CREATE INDEX IF NOT EXISTS ${quote_identifier(index_name)} ON ${quote_identifier("message_vectors")} USING ${method} ((vector::vector(${config.embedding_dimensions})) ${opclass}) WHERE ${where_clause};`;
};
