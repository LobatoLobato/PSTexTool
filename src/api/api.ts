import * as photoshop from "./photoshop";

const hostName = require("uxp")
  .host.name.toLowerCase()
  .replace(/\s/g, "") as string;

// prettier-ignore
let host = {} as
  & typeof photoshop
if (hostName.startsWith("photoshop")) host = photoshop;

export const api = host;
