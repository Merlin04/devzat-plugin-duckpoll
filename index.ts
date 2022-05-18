import Devzat from "devzat";

// Some utilities that may be helpful (feel free to remove them)
import fetch from "node-fetch";
import chalk from "chalk";
import "ts-replace-all";

if(!process.env.DEVZAT_TOKEN) throw new Error("DEVZAT_TOKEN environment variable is not defined");
if(!process.env.DEVZAT_ADDRESS) throw new Error("DEVZAT_ADDRESS environment variable is not defined");

const plugin = new Devzat({
    address: process.env.DEVZAT_ADDRESS,
    token: process.env.DEVZAT_TOKEN,
    name: chalk.red("Devzat Node Starter")
});

// Now, you can use the plugin instance

plugin.command({
    name: "example",
    info: "An example command",
    argsInfo: ""
}, event => "Hello, world!");
