require("tsx/cjs");

const mod = require("./eleventy.config.ts");
module.exports = mod.default ?? mod;
