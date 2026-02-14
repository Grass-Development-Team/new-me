import type AdapterConfig from "./config";
import type { GenerateOptions, Message, MessagePart } from "./message";
import type Tools from "./tools";

export default abstract class Adapter {
  /**
   * The unique identifier for the adapter. This should be a string that uniquely identifies the adapter, such as "openai-gpt-3" or "azure-openai".
   */
  abstract id: string;
  /**
   * The configuration for the adapter. This should include all necessary information for connecting to the API, such as API keys, base URLs, model names, and system prompts.
   */
  abstract config: AdapterConfig;
  /**
   * The tools that the adapter supports. This should be an array of Tool objects that represent the different tools or capabilities that the adapter can use when generating responses. Each tool should have a name, description, and a function that defines how to use the tool.
   */
  abstract tools: Tools[];

  /**
   * Generates a response based on the given message. This method should take a Message object as input and return a Response object. The implementation of this method will depend on the specific API being used, but it should handle the logic for sending the message to the API and processing the response.
   * @param message The message to generate a response for.
   * @returns A promise that resolves to a Response object.
   */
  abstract generate(
    message: Message,
    options?: GenerateOptions,
  ): Promise<Message>;

  /**
   * Generates a response based on the given message, but instead of returning a single Response object, it returns an async generator that yields MessagePart objects as the response is generated. This allows for streaming responses, where parts of the response can be processed and displayed as they are received, rather than waiting for the entire response to be generated before processing.
   * @param message the message to generate a response for.
   * @returns an async generator that yields MessagePart objects as the response is generated. This allows for streaming responses, where parts of the response can be processed and displayed as they are received, rather than waiting for the entire response to be generated before processing.
   */
  abstract generate_stream(
    message: Message,
    options: GenerateOptions,
  ): AsyncGenerator<MessagePart>;
}
