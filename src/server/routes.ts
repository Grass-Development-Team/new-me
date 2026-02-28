import {
  Code,
  ConnectError,
  type ConnectRouter,
  type HandlerContext,
} from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";

import {
  AbortResponseSchema,
  ClearChatResponseSchema,
  GenerateResponseSchema,
  SunflowerService,
  UpdateUserResponseSchema,
  type GenerateRequest,
  type GenerateRequestContext,
  type GenerateResponse as GenerateResponseType,
  type UpdateUserRequest,
  type UpdateUserResponse,
} from "./gen/sunflower/v1/service_pb";
import { MessageRole, UserSex } from "./gen/sunflower/v1/models_pb";

import type Sunflower from "@/sunflower";
import type { InstanceMeta } from "@/sunflower/instance";
import type { Message } from "@/sunflower/adapter/message";
import type { ListValue, Value } from "@bufbuild/protobuf/wkt";

export default class Route {
  private sunflower: Sunflower;

  constructor(sunflower: Sunflower) {
    this.sunflower = sunflower;
  }

  register(router: ConnectRouter) {
    router.service(SunflowerService, {
      generate: async function* (
        this: Route,
        reqs: AsyncIterable<GenerateRequest>,
        ctx: HandlerContext,
      ): AsyncGenerator<GenerateResponseType> {
        const it = reqs[Symbol.asyncIterator]();
        const first = await it.next();

        if (first.done) return;
        if (first.value.payload.case !== "context") return;

        let msg_id: string | undefined;

        const context = first.value.payload.value;

        const kill = () => {
          if (msg_id) {
            this.sunflower.abort(context.platform, context.platformSid, msg_id);
          }
        };

        (async () => {
          ctx.signal.addEventListener("abort", async () => {
            kill();
          });

          while (true) {
            const msg = await it.next();

            if (msg.done) break;
            if (msg.value.payload.case === "cancel") {
              kill();
              break;
            }
          }
        })();

        const { platform, platform_sid, meta, message, scene, args } =
          Route.convert(context);
        const stream = this.sunflower.generate(
          platform,
          platform_sid,
          meta,
          message,
          scene,
          args,
        );

        for await (const part of stream) {
          if (part.status === "queue") {
            msg_id = part.data;
          }

          if (part.status === "part") {
            const valid_types = ["text", "image", "video", "audio"] as const;
            const type = (valid_types as readonly string[]).includes(
              part.data.type,
            )
              ? (part.data.type as (typeof valid_types)[number])
              : "other";

            const content =
              type === "image"
                ? {
                    payload: {
                      case: part.data.cached ? "cache" : "raw",
                      value: part.data.content,
                    },
                  }
                : part.data.content;

            yield create(GenerateResponseSchema, {
              status: {
                case: part.status,
                value: {
                  type: {
                    case: type,
                    value: content,
                  },
                },
              },
            });
          } else {
            yield create(GenerateResponseSchema, {
              status: {
                case: part.status,
                value: part.data,
              },
            });
          }
        }
      }.bind(this),
      abort: async (req) => {
        if (req.msgId) {
          await this.sunflower.abort(req.platform, req.platformSid, req.msgId);
        } else {
          await this.sunflower.abort_all(req.platform, req.platformSid);
        }

        return create(AbortResponseSchema);
      },
      updateUser: async (req) => {
        const storage = this.sunflower.get_storage();
        const user = await storage.get_user(req.platform, req.id);

        if (req.score) {
          await storage.set_user(req.platform, {
            ...user,
            score: req.score,
          });

          user.score = req.score;
        }

        return create(UpdateUserResponseSchema, {
          platform: req.platform,
          id: req.id,
          score: user.score,
        });
      },
      clearChat: async (req) => {
        const storage = this.sunflower.get_storage();
        const instance_id = `${req.platform}::${req.platformSid}`;
        const history = await storage.get_instance(instance_id);
        const instance = this.sunflower.get_instance(instance_id);

        if (instance) {
          instance.clear(req.scene);

          if (req.scene) {
            delete history.history[req.scene];
          } else {
            history.history = {};
          }
        }

        await storage.set_instance(
          `${req.platform}::${req.platformSid}`,
          history,
        );

        return create(ClearChatResponseSchema);
      },
    });
  }

  static convert(context: GenerateRequestContext): {
    platform: string;
    platform_sid: string;
    meta: InstanceMeta;
    message: Message;
    scene: string;
    args: any;
  } {
    // Meta
    const raw_meta = this.ensure(context.meta, "meta");
    let meta: InstanceMeta;

    if (raw_meta.payload.case === "proactive") {
      meta = {
        type: "proactive",
      };
    } else {
      const sex =
        raw_meta.payload.value?.user?.sex === UserSex.FEMALE
          ? "female"
          : "male";

      meta = {
        type: "reactive",
        user_meta: {
          id: this.ensure(raw_meta.payload.value?.user?.id, "meta.user.id"),
          username: this.ensure(
            raw_meta.payload.value?.user?.username,
            "meta.user.username",
          ),
          nickname: this.ensure(
            raw_meta.payload.value?.user?.nickname,
            "meta.user.nickname",
          ),
          sex: sex,
          time: this.ensure(
            raw_meta.payload.value?.user?.time,
            "meta.user.time",
          ),
        },
      };
    }

    // Message
    const raw_message = this.ensure(context.message, "message");
    let role: "user" | "assistant" | "system";

    switch (raw_message.role) {
      case MessageRole.USER:
        role = "user";
        break;
      case MessageRole.ASSISTANT:
        role = "assistant";
        break;
      case MessageRole.SYSTEM:
        role = "system";
        break;
      default:
        throw new ConnectError("Invalid message role", Code.InvalidArgument);
    }

    const message: Message = {
      role,
      parts: raw_message.parts.map((part) => {
        const content =
          part.type.case === "image"
            ? this.ensure(
                part.type.value.payload.value,
                "message.parts[].type.value.payload.value",
              )
            : this.ensure(part.type.value, "message.parts[].type.value");

        return {
          type: this.ensure(part.type.case, "message.parts[].type"),
          content: content,
          cached:
            part.type.case === "image"
              ? part.type.value.payload.case === "cache"
              : undefined,
        };
      }),
    };

    // Args
    const args = context.args ? this.parse_struct(context.args) : {};

    return {
      platform: this.ensure(context.platform, "platform"),
      platform_sid: this.ensure(context.platformSid, "platformSid"),
      meta,
      message,
      scene: this.ensure(context.scene, "scene"),
      args,
    };
  }

  static parse_list(value: ListValue): any[] {
    return value.values.map((v) => {
      if (v.kind.case === "structValue") {
        return this.parse_struct(v.kind.value.fields);
      } else if (v.kind.case === "listValue") {
        return this.parse_list(v.kind.value);
      } else if (v.kind.case === "nullValue") {
        return null;
      } else {
        return v.kind.value;
      }
    });
  }

  static parse_struct(value: { [key: string]: Value }): {
    [key: string]: any;
  } {
    return Object.fromEntries(
      Object.entries(value).map((i) => {
        if (i[1].kind.case === "structValue") {
          return [i[0], this.parse_struct(i[1].kind.value.fields)];
        } else if (i[1].kind.case === "listValue") {
          return [i[0], this.parse_list(i[1].kind.value)];
        } else if (i[1].kind.case === "nullValue") {
          return [i[0], null];
        }

        return [i[0], i[1].kind.value];
      }),
    );
  }

  static ensure<T>(value: T | undefined, field_name: string): T {
    if (value === undefined || value === null) {
      throw new ConnectError(
        `Missing ${field_name} field`,
        Code.InvalidArgument,
      );
    }
    return value;
  }
}
