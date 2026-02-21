import { test } from "bun:test";
import { calc_typing_delay } from "./typing";

test("Test typing time", () => {
  console.log(calc_typing_delay("你好啊，我喜欢你，我要和你结婚，My Love"));
  console.log(calc_typing_delay("Star_Rainoud issued server command"));
});
