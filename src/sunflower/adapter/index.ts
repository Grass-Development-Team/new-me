import logger from "@/logger";

import type AdapterConfig from "./config";
import type { Message, MessagePartUnion } from "./message";

import type { ToolContext, ToolResponse } from "@/sunflower/tools";
import type Tools from "@/sunflower/tools";

export interface GenerateOptions {
  system_prompt?: string;
  model?: string;
  signal?: AbortSignal;
  tools?: Tools[];
  tool_context?: ToolContext;
  retry_times?: number;
  timeout_ms?: number;
}

interface ExecuteContext {
  signal: AbortSignal;
  attempt: number;
  mark_side_effect: () => void;
  has_side_effect: () => boolean;
}

const DEFAULT_RETRY_TIMES = 3;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const RETRY_STEP_DELAY_MS = 5000;
const RETRY_MAX_DELAY_MS = 20000;

export default abstract class Adapter<T = undefined> {
  /**
   * The unique identifier for the adapter. This should be a string that uniquely identifies the adapter, such as "openai-gpt-3" or "azure-openai".
   */
  abstract id: string;
  /**
   * The configuration for the adapter. This should include all necessary information for connecting to the API, such as API keys, base URLs, model names, and system prompts.
   */
  abstract config: AdapterConfig<T>;

  /**
   * Generates a response based on the given message. This method should take a Message object as input and return a Response object. The implementation of this method will depend on the specific API being used, but it should handle the logic for sending the message to the API and processing the response.
   * @param message The message to generate a response for.
   * @returns A promise that resolves to a Response object.
   */
  abstract generate(
    message: Message[],
    options?: GenerateOptions,
  ): Promise<Message>;

  /**
   * Generates a response based on the given message, but instead of returning a single Response object, it returns an async generator that yields MessagePart objects as the response is generated. This allows for streaming responses, where parts of the response can be processed and displayed as they are received, rather than waiting for the entire response to be generated before processing.
   * @param message the message to generate a response for.
   * @returns an async generator that yields MessagePart objects as the response is generated. This allows for streaming responses, where parts of the response can be processed and displayed as they are received, rather than waiting for the entire response to be generated before processing.
   */
  abstract generate_stream(
    message: Message[],
    options?: GenerateOptions,
  ): AsyncGenerator<MessagePartUnion>;

  protected async execute_with_retry<T>(
    runner: (ctx: ExecuteContext) => Promise<T>,
    options?: GenerateOptions,
  ): Promise<T> {
    const total_timeout_ms = this.resolve_timeout_ms(options);
    const retry_times = this.resolve_retry_times(options);
    const deadline = Date.now() + total_timeout_ms;

    for (let attempt = 1; attempt <= retry_times; attempt++) {
      const remaining_ms = deadline - Date.now();

      if (remaining_ms <= 0) {
        throw this.timeout_error(total_timeout_ms);
      }

      const attempt_signal = this.create_attempt_signal(
        options?.signal,
        remaining_ms,
      );
      let has_side_effect = false;

      try {
        return await runner({
          signal: attempt_signal.signal,
          attempt,
          mark_side_effect: () => {
            has_side_effect = true;
          },
          has_side_effect: () => has_side_effect,
        });
      } catch (error) {
        if (attempt_signal.aborted_by_external()) {
          throw error;
        }

        if (attempt_signal.aborted_by_timeout() || Date.now() >= deadline) {
          throw this.timeout_error(total_timeout_ms, error);
        }

        if (has_side_effect) {
          throw error;
        }

        if (attempt >= retry_times || !this.is_retryable_error(error)) {
          throw error;
        }

        const delay_ms = this.retry_delay_ms(attempt);
        const next_remaining = deadline - Date.now();

        if (next_remaining <= delay_ms) {
          throw this.timeout_error(total_timeout_ms, error);
        }

        logger.warn({
          adapter: this.id,
          attempt,
          retry_times,
          delay_ms,
          error: error instanceof Error ? error.message : String(error),
          data: "Adapter request failed, retrying",
        });

        await this.sleep(delay_ms, options?.signal);
      } finally {
        attempt_signal.cleanup();
      }
    }

    throw new Error("Adapter request failed after retries");
  }

  protected async *execute_stream_with_retry<T>(
    runner: (ctx: ExecuteContext) => AsyncGenerator<T>,
    options?: GenerateOptions,
  ): AsyncGenerator<T> {
    const total_timeout_ms = this.resolve_timeout_ms(options);
    const retry_times = this.resolve_retry_times(options);
    const deadline = Date.now() + total_timeout_ms;

    for (let attempt = 1; attempt <= retry_times; attempt++) {
      const remaining_ms = deadline - Date.now();

      if (remaining_ms <= 0) {
        throw this.timeout_error(total_timeout_ms);
      }

      const attempt_signal = this.create_attempt_signal(
        options?.signal,
        remaining_ms,
      );
      let has_side_effect = false;

      let yielded = false;

      try {
        const stream = runner({
          signal: attempt_signal.signal,
          attempt,
          mark_side_effect: () => {
            has_side_effect = true;
          },
          has_side_effect: () => has_side_effect,
        });

        for await (const part of stream) {
          yielded = true;
          yield part;
        }

        return;
      } catch (error) {
        if (attempt_signal.aborted_by_external()) {
          throw error;
        }

        if (attempt_signal.aborted_by_timeout() || Date.now() >= deadline) {
          throw this.timeout_error(total_timeout_ms, error);
        }

        if (has_side_effect) {
          throw error;
        }

        if (yielded) {
          throw error;
        }

        if (attempt >= retry_times || !this.is_retryable_error(error)) {
          throw error;
        }

        const delay_ms = this.retry_delay_ms(attempt);
        const next_remaining = deadline - Date.now();

        if (next_remaining <= delay_ms) {
          throw this.timeout_error(total_timeout_ms, error);
        }

        logger.warn({
          adapter: this.id,
          attempt,
          retry_times,
          delay_ms,
          error: error instanceof Error ? error.message : String(error),
          data: "Adapter stream request failed before first token, retrying",
        });

        await this.sleep(delay_ms, options?.signal);
      } finally {
        attempt_signal.cleanup();
      }
    }

    throw new Error("Adapter stream request failed after retries");
  }

  protected async call_tool(
    tool: Tools,
    args: Record<string, unknown>,
    tool_context: ToolContext | undefined,
    signal: AbortSignal,
  ): Promise<ToolResponse> {
    if (signal.aborted) {
      throw signal.reason ?? new Error("Aborted");
    }

    const context = tool_context
      ? {
          ...tool_context,
          signal,
        }
      : undefined;

    return this.with_abort_signal(() => tool.call(args, context), signal);
  }

  protected is_retryable_error(error: unknown): boolean {
    const status = this.error_status(error);

    if (status !== undefined) {
      if (
        status === 408 ||
        status === 409 ||
        status === 425 ||
        status === 429
      ) {
        return true;
      }

      if (status >= 500) {
        return true;
      }

      return false;
    }

    const message = (error instanceof Error ? error.message : String(error))
      .toLowerCase()
      .trim();

    if (message.includes("timeout") || message.includes("timed out")) {
      return true;
    }

    if (
      message.includes("rate limit") ||
      message.includes("too many requests")
    ) {
      return true;
    }

    if (message.includes("network") || message.includes("fetch")) {
      return true;
    }

    if (
      message.includes("connection") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("socket hang up")
    ) {
      return true;
    }

    return false;
  }

  private resolve_retry_times(options?: GenerateOptions): number {
    const value = options?.retry_times;

    if (typeof value !== "number" || !Number.isFinite(value)) {
      return DEFAULT_RETRY_TIMES;
    }

    return Math.max(1, Math.floor(value));
  }

  private resolve_timeout_ms(options?: GenerateOptions): number {
    const value = options?.timeout_ms;

    if (typeof value !== "number" || !Number.isFinite(value)) {
      return DEFAULT_TIMEOUT_MS;
    }

    return Math.max(1000, Math.floor(value));
  }

  private retry_delay_ms(attempt: number): number {
    return Math.min(RETRY_STEP_DELAY_MS * attempt, RETRY_MAX_DELAY_MS);
  }

  private timeout_error(timeout_ms: number, cause?: unknown): Error {
    const error = new Error(`Adapter request timed out after ${timeout_ms}ms`);

    if (cause !== undefined) {
      (error as Error & { cause?: unknown }).cause = cause;
    }

    return error;
  }

  private error_status(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null) {
      return undefined;
    }

    const status = (error as { status?: unknown }).status;

    if (typeof status === "number") {
      return status;
    }

    const code = (error as { code?: unknown }).code;

    if (typeof code === "number") {
      return code;
    }

    return undefined;
  }

  private create_attempt_signal(
    external_signal: AbortSignal | undefined,
    timeout_ms: number,
  ) {
    const controller = new AbortController();
    let by_external = false;
    let by_timeout = false;

    const on_external_abort = () => {
      by_external = true;
      controller.abort(external_signal?.reason);
    };

    if (external_signal) {
      if (external_signal.aborted) {
        on_external_abort();
      } else {
        external_signal.addEventListener("abort", on_external_abort, {
          once: true,
        });
      }
    }

    const timeout = setTimeout(() => {
      by_timeout = true;
      controller.abort(
        new Error(`Adapter request timed out after ${timeout_ms}ms`),
      );
    }, timeout_ms);

    return {
      signal: controller.signal,
      aborted_by_external: () => by_external,
      aborted_by_timeout: () => by_timeout,
      cleanup: () => {
        clearTimeout(timeout);

        if (external_signal) {
          external_signal.removeEventListener("abort", on_external_abort);
        }
      },
    };
  }

  private with_abort_signal<T>(
    runner: () => Promise<T>,
    signal: AbortSignal,
  ): Promise<T> {
    if (signal.aborted) {
      return Promise.reject(signal.reason ?? new Error("Aborted"));
    }

    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        signal.removeEventListener("abort", on_abort);
      };

      const resolve_once = (value: T) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(value);
      };

      const reject_once = (error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(error);
      };

      const on_abort = () => {
        reject_once(signal.reason ?? new Error("Aborted"));
      };

      signal.addEventListener("abort", on_abort, { once: true });

      runner().then(resolve_once).catch(reject_once);
    });
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);

      const on_abort = () => {
        cleanup();
        reject(signal?.reason ?? new Error("Aborted"));
      };

      const cleanup = () => {
        clearTimeout(timer);

        if (signal) {
          signal.removeEventListener("abort", on_abort);
        }
      };

      if (signal) {
        if (signal.aborted) {
          cleanup();
          reject(signal.reason ?? new Error("Aborted"));
          return;
        }

        signal.addEventListener("abort", on_abort, { once: true });
      }
    });
  }
}
