import Sunflower from "@/sunflower";

import serve from "@/server";

import config from "#/conf";

const sunflower = new Sunflower(config);

await sunflower.init();

await serve("0.0.0.0", 9000, sunflower);
