import Devzat from "devzat";

import fetch from "node-fetch";
import chalk from "chalk";
import "ts-replace-all";
import { nanoid } from "nanoid";

if(!process.env.DEVZAT_TOKEN) throw new Error("DEVZAT_TOKEN environment variable is not defined");
if(!process.env.DEVZAT_ADDRESS) throw new Error("DEVZAT_ADDRESS environment variable is not defined");

const name = chalk.green("Duckpoll");

const plugin = new Devzat({
    address: process.env.DEVZAT_ADDRESS,
    token: process.env.DEVZAT_TOKEN,
    name
});

type Poll = {
	token: string,
	title: string,
	options: string[],
	multiple: boolean,
	votes: [string, number[]][],
	author: string
};

const polls: Poll[] = [];

const pollResults = (poll: Poll, index: number) => {
	// get a list of the options with vote counts and voters
	const options: string[][] = poll.options.map((option, index) =>
		poll.votes.filter(([, votes]) => votes.includes(index))
			.map(([voter]) => voter)
	);
	const totalVotes = options.reduce((total, option) => total + option.length, 0);

	return `:clipboard: @${poll.author}: ${chalk.bold.greenBright(poll.title)}${poll.multiple ? chalk.dim(" (you may vote for multiple options)") : ""}

${poll.options.map((option, index) => {
	let percent = Math.round(options[index].length / totalVotes * 100);
	if(isNaN(percent)) percent = 0;
	// const bar = `${'█'.repeat(percent)}${'░'.repeat(100 - percent)}`;
	// make the bar have a set width of 40 characters
	const bar = `${'█'.repeat(Math.round(percent / 100 * 40))}${'░'.repeat(40 - Math.round(percent / 100 * 40))}`;
	const voters = options[index].map(voter => "@" + voter).join(", ");
	
	return `${chalk.bold(`${index}. ${option}`)} (${options[index].length} votes, ${chalk.bold(`${percent}%`)})

${voters}

\`${bar}\``;
}).join("\n\n")}

Run \`vote ${index} <option number>\` to vote, or \`poll ${index}\` to see the current results!`;
}

plugin.command({
    name: "create-poll",
    info: `Create a poll with ${name}`,
    argsInfo: ""
}, event => {
    console.log(event);
    const r = (msg: string) => plugin.sendMessage({ ephemeralTo: event.from, room: event.room, msg });

    const prompts = [
    	"",
    	"",
    	""
    ];
    let i = 0;
	const poll: Poll = {
		token: nanoid(),
		title: "",
		options: [],
		multiple: false,
		votes: [],
		author: event.from
	};
	let hasFinished = false;

	r("Enter poll title (send q to cancel)");
    
	const done = plugin.onMessageSend({ middleware: true },  async mw => {
		if(event.from !== mw.from && event.room !== mw.room) return;

		// noinspection ES6MissingAwait
		void async function() {
			const finished = () => {
				hasFinished = true;
				done();
			};

			if(mw.msg === "q") {
				await r("Poll creation cancelled");
				finished();
				return;
			}

			switch(i) {
				case 0: {
					poll.title = mw.msg;
					await r(`> Poll title: ${chalk.bold.blue(poll.title)}`);
					await r("Should the poll allow multiple options? (y=yes, n=no, q=cancel)")
					i++;
					break;
				}
				case 1: {
					if(mw.msg !== "y" && mw.msg !== "n") {
						await r("Invalid input, enter y or n");
						break;
					}
					poll.multiple = mw.msg === "y";
					await r(`> Poll will ${chalk.bold.blue(poll.multiple ? "allow" : "not allow")} multiple options`);
					await r("Enter options (s=save, q=cancel)");
					i++;
					break;
				}
				case 2: {
					if(mw.msg === "s") {
						// Save poll
						const i = polls.push(poll) - 1;
						await r(`Created poll! To delete, run \`close-poll ${poll.token}\``);
						await plugin.sendMessage({ room: event.room, msg: pollResults(poll, i) });
						finished();
						break;
					}
					poll.options.push(mw.msg);
					await r(`> Option ${chalk.bold.blue(poll.options.length)}: ${chalk.bold.blue(poll.options[poll.options.length - 1])}`);
					break;
				}
			}
		}();

		return "";
	});

	setTimeout(async () => {
		if(hasFinished) return;
	    await r("Poll creation timed out");
		done();
	}, 60_000);
});

plugin.command({
    name: "close-poll",
    info: `Close a ${name} poll`,
    argsInfo: "<poll-secret>"
}, event => {
	const poll = polls.find(poll => poll.token === event.args);
	if(!poll) return "No poll found with that secret";

	polls.splice(polls.indexOf(poll), 1);
	return "Poll closed!";
});

plugin.command({
	name: "lspolls",
	info: `List all active ${name} polls`,
	argsInfo: ""
}, () => {
	let pollsStr = polls.map((poll, index) => `${index}. @${poll.author}: ${chalk.bold.greenBright(`${poll.title}`)}`).join("\n");
	if(pollsStr === "") pollsStr = chalk.italic.dim("[there are no polls yet]");

	return `Active polls:

${pollsStr}

Run \`poll <poll-id>\` to view a poll!`;
});

plugin.command({
	name: "poll",
	info: `View a ${name} poll`,
	argsInfo: "<poll-id>"
}, event => {
	const n = Number(event.args);
	if(isNaN(n) || !polls[n]) return "Invalid poll ID";
	return pollResults(polls[n], n);
});

plugin.command({
	name: "vote",
	info: `Vote on a ${name} poll`,
	argsInfo: "<poll-id> <option-id>"
}, event => {
	const [n, o] = event.args.split(" ").map(Number);
	if(isNaN(n) || isNaN(o) || !polls[n]) return "Invalid poll ID";
	const poll = polls[n];
	if(!poll.options[o]) return "Invalid option ID";

	const existingVote = poll.votes.find(([user]) => user === event.from);
	if(existingVote) {
		if(existingVote[1].includes(o)) {
			// Remove the vote
			if(existingVote[1].length === 1) {
				poll.votes.splice(poll.votes.indexOf(existingVote), 1);
			} else {
				existingVote[1].splice(existingVote[1].indexOf(o), 1);
			}

			return `Removed vote for option ${chalk.bold.blue(o)}`!;
		}
		if(!poll.multiple) {
			existingVote[1][0] = o;
			return `Moved vote to option ${chalk.bold.blue(o)}`!;
		}
		existingVote[1].push(o);
	} else {
		poll.votes.push([event.from, [o]]);
	}
	return `Voted for option ${chalk.bold.blue(o)}`!;
});
