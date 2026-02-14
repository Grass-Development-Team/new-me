import { expect, test } from "bun:test";
import Gemini from "./gemini";

test("Gemini Adapter Message To Content", () => {
  const message_to_content = Gemini.prototype.message_to_content;
  expect(
    message_to_content([
      {
        role: "user",
        parts: [
          {
            type: "text",
            content: "Hello, how are you? This is an image: ",
          },
          {
            type: "image",
            content: {
              mime: "image/png",
              url: "iVBORw0KGgoAAAANSUhEUgAAAAUA",
            },
          },
          {
            type: "audio",
            content: "Audio",
          },
          {
            type: "text",
            content: "Oh wait, this is another image",
          },
          {
            type: "image",
            content: "This ia an image described in text",
            cached: true,
          },
        ],
      },
    ]),
  ).toEqual([
    {
      role: "user",
      parts: [
        { text: "Hello, how are you? This is an image: " },
        {
          inlineData: {
            mimeType: "image/png",
            data: "iVBORw0KGgoAAAANSUhEUgAAAAUA",
          },
        },
        { text: "Oh wait, this is another image" },
        { text: "[Cached Image] This ia an image described in text" },
      ],
    },
  ]);
});

test("Gemini Adapter Content To Message", () => {
  const content_to_message = Gemini.prototype.content_to_message;
  expect(
    content_to_message({
      role: "user",
      parts: [
        { text: "Thinking", thought: true },
        { text: "Hello, how are you? This is an image: " },
        {
          inlineData: {
            mimeType: "image/png",
            data: "iVBORw0KGgoAAAANSUhEUgAAAAUA",
          },
        },
        {
          text: "Oh wait, this is another image\n[Cached Image] This ia an image described in text",
        },
      ],
    }),
  ).toEqual({
    role: "user",
    parts: [
      {
        type: "text",
        content: "Hello, how are you? This is an image: ",
      },
      {
        type: "image",
        content: {
          mime: "image/png",
          url: "iVBORw0KGgoAAAANSUhEUgAAAAUA",
        },
      },
      {
        type: "text",
        content:
          "Oh wait, this is another image\n[Cached Image] This ia an image described in text",
      },
    ],
  });
});
