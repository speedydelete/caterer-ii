
import {BotError, Message, Response} from './util.js';
import {COMMANDS} from './index.js';


interface Help {
    desc: string;
    args: {
        name: string;
        optional?: boolean;
        newline?: boolean;
        desc: string;
    }[];
    extra?: string;
    aliases?: string[];
}

const HELP: {[key: string]: Help} = {

    help: {
        desc: 'Display a help message',
        args: [
            {
                name: 'command',
                optional: true,
                desc: 'Command to display infomation for. If omitted or invalid, displays generic help/info message.'
            },
        ],
        extra: 'If an argument looks like <arg>, it is required. If it looks like [arg], it is optional.',
        aliases: ['about', 'info'],
    },

    eval: {
        desc: 'Evaluates code (admins only)',
        args: [
            {
                name: 'code',
                desc: 'The code to run',
            },
        ],
    },

    ping: {
        desc: 'Gets the latency',
        args: [],
    },

    sim: {
        desc: 'Simulate a RLE and output a gif',
        args: [
            {
                name: '\'time\'',
                optional: true,
                desc: 'Shows how much time it took',
            },
            {
                name: 'parts',
                desc: 'Specifies how to simulate',
            },
        ],
        extra: `See https://discord.com/channels/357922255553953794/404518331605975040/1489678824932380774 for more details.`
    },

    'sim rand': {
        desc: 'Simulate a random pattern',
        args: [
            {
                name: 'size',
                optional: true,
                desc: 'The size of the pattern, such as 20x20 or 8x32 (default 16x16).',
            },
            {
                name: 'percent',
                optional: true,
                desc: 'The percentage to fill the pattern. Must start with a percent (such as 50%), can optionally be followed by  a comma then state weights, such as "50%,1-2=1,3=3" (sets states 1 and 2 to weight 1 but state 3 to weight 3). Ranges are inclusive, all states by default have weight 0.',
            },
            {
                name: 'rule',
                desc: 'The rule to simulate it in.'
            },
            {
                name: '\'time\'',
                optional: true,
                desc: 'Also show how much time it takes',
            },
            {
                name: 'parts',
                desc: 'How to run it. See !help sim.',
            },
        ],
    },

    identify: {
        desc: 'Identify a pattern',
        args: [
            {
                name: 'generations',
                optional: true,
                desc: 'Number of generations to run the identifier for (default 1024).'
            },
        ],
    },

    basicidentify: {
        desc: 'Identify a pattern, but provide less information',
        args: [
            {
                name: 'generations',
                optional: true,
                desc: 'Number of generations to run the identifier for (default 1024).'
            },
        ],
    },

    minmax: {
        desc: 'Find the minimum and maximum rule of a pattern',
        args: [
            {
                name: 'generations',
                desc: 'Number of generations to run the pattern for.',
            },
        ],
    },

    identifyconduit: {
        desc: 'Identify a conduit (only works for B3/S23)',
        args: [
            {
                name: 'min_time',
                desc: 'Minimum number of generations before it can take it as a conduit',
            },
            {
                name: 'sep_gens',
                desc: 'Number of generations to run object separation for (default 0).',
            },
            {
                name: 'max_time',
                desc: 'Maximum time the conduit can take to work (default 512), also the maximum repeat time.',
            },
            {
                name: 'identify_gens',
                desc: 'Number of generations to identify for (default 256).',
            },
        ],
    },

    hashsoup: {
        desc: 'Get a Catagolue hashsoup',
        args: [
            {
                name: 'symmetry',
                desc: 'The symmetry to use.',
            },
            {
                name: 'seed',
                desc: 'The seed for the soup (k_whatever).',
            },
            {
                name: 'rule',
                desc: 'The rule to use.',
            },
        ],
    },

    apgencode: {
        desc: 'Get an unprefixed apgcode for any pattern. For prefixed apgcodes, use `!identify`.',
        args: [
            {
                name: '\'canonical\'',
                optional: true,
                desc: 'Whether to canonicalize the apgcode (by rotation/reflection). Can also be `canon` or `c`.',
            },
            {
                name: 'gens',
                optional: true,
                desc: 'Only valid with the canonical option. How many generations to run to find the canonicalized apgcode.',
            },
        ],
    },

    apgdecode: {
        desc: 'Decode an apgcode.',
        args: [
            {
                name: 'apgcode',
                desc: 'The apgcode to decode.',
            },
            {
                name: 'rule',
                optional: true,
                desc: 'The rule to use (default B3/S23).',
            },
        ],
    },

    population: {
        desc: 'Get the population of a pattern.',
        args: [],
        aliases: ['pop'],
    },

    inttomap: {
        desc: 'Converts an INT rule to a MAP rule.',
        args: [
            {
                name: 'rule',
                desc: 'The INT rule to convert.',
            },
        ],
    },

    ruleinfo: {
        desc: 'Gets information about a rule.',
        args: [
            {
                name: 'rule',
                desc: 'The rule to use.',
            },
        ],
    },

    normalizerule: {
        desc: 'Normalize a rulestring.',
        args: [],
    },

    blackwhitereverse: {
        desc: 'Gets the black/white reversal of a rule.',
        args: [
            {
                name: 'rule',
                desc: 'The rule to use.',
            },
        ],
        aliases: ['blackwhitereversal', 'bwreverse', 'bwreversal'],
    },

    checkerboarddual: {
        desc: 'Gets the checkerboard dual of a rule.',
        args: [
            {
                name: 'rule',
                desc: 'The rule to use.',
            },
        ],
        aliases: ['cbdual'],
    },

    sssss: {
        desc: 'Query the 5S database',
        args: [
            {
                name: 'type',
                optional: true,
                desc: 'The rulespace to use: int/intb0/ot/otb0/intgen/otgen, default int.',
            },
            {
                name: 'speed',
                desc: 'A speed, such as c/2, c/2o, c/2d, (2, 1)c/5, etc.',
            },
            {
                name: 'adjustables',
                optional: true,
                desc: `Whether to search for adjustable spaceships, can be 'yes', 'no', or 'only'.`,
            },
        ],
        aliases: ['5s'],
    },

    sssssinfo: {
        desc: 'Query the status of a specific rulespace in 5S',
        args: [
            {
                name: 'type',
                optional: true,
                desc: 'The rulespace to use: int/intb0/ot/otb0/intgen/otgen, default int.',
            },
        ],
        aliases: ['5sinfo'],
    },

    name: {
        desc: 'Find or set the name of a pattern',
        args: [
            {
                name: 'new_name',
                optional: true,
                desc: 'The new name. If provided, it will set the name. If omitted, it will just show the current name.'
            },
        ],
    },

    rename: {
        desc: 'Change the name of a pattern',
        args: [
            {
                name: 'new_name',
                desc: 'The new name.',
            },
        ],
        aliases: ['rename'],
    },

    deletename: {
        desc: 'Delete the name of a pattern',
        args: [],
    },

    simstats: {
        desc: 'Get statistics on the most popular rules used by !sim',
        args: [
            {
                name: 'page',
                optional: true,
                desc: 'The page to get data for, defaults to 0.'
            },
        ],
    },

    savesimstats: {
        desc: 'Save the !sim stats',
        args: [],
    },

    alias: {
        desc: 'Alias a rule',
        args: [
            {
                name: 'alias',
                desc: 'The new alias for the rule.',
            },
            {
                name: 'rule',
                newline: true,
                desc: 'The rule being aliased to. Must be on a new line. Can be a file.',
            },
        ],
        aliases: ['upload'],
    },

    realias: {
        desc: 'Change an alias',
        args: [
            {
                name: 'alias',
                desc: 'The new alias for the rule.',
            },
            {
                name: 'rule',
                newline: true,
                desc: 'The rule being aliased to. Must be on a new line. Can be a file.',
            },
        ],
        aliases: ['upload'],
    },

    unalias: {
        desc: 'Remove an alias for a rule',
        args: [
            {
                name: 'alias',
                desc: 'The alias to remove.',
            },
        ],
        aliases: ['deletealias'],
    },

    lookupalias: {
        desc: 'Looks up an alias for a rule',
        args: [
            {
                name: 'alias',
                desc: 'The alias to look up.',
            },
        ],
    },

    listaliases: {
        desc: 'Lists all the aliases',
        args: [],
        aliases: ['aliases'],
    },

    wiki: {
        desc: 'Look up something on the ConwayLife.com wiki',
        args: [
            {
                name: 'page',
                desc: 'The page to look up',
            },
        ],
    },

    noreplypings: {
        desc: 'Disables reply pings when using commands',
        args: [],
    },

    yesreplypings: {
        desc: 'Enables reply pings when using commands (This command removes you from the list of no-reply-ping users, and therefore deletes your data)',
        args: [],
    },

};


const HELP_MSG = `A cellular automata bot for the ConwayLife Lounge Discord server.

Commands:
* Simulation: \`!sim\`, \`!sim rand\`
* Identification: \`!identify\`, \`!basic_identify\`, \`!minmax\`, \`!identify_conduit\`
* Pattern manipulation: \`!hashsoup\`, \`!apgencode\`, \`!apgdecode\`, \`!population\`
* Rules: \`!map_to_int\`, \`!map_to_hex_int\`, \`!int_to_map\`, \`!rule_info\`, \`!black_white_reverse\`, \`!checkerboard_dual\`
* 5S: \`!sssss\`, \`!sssss_info\`
* Pattern naming: \`!name\`, \`!rename\`, \`!delete_name\`
* Statistics: \`!sim_stats\`, \`!save_sim_stats\`
* Rule aliases: \`!alias\`, \`!unalias\`, \`!lookup_alias\`, \`!list_aliases\`
* Configuration: \`!noreplypings\`, \`!yesreplypings\`
* Other: \`!wiki\`, \`!help\`, \`!eval\`, \`!ping\`

This bot pernamently stores your user ID when you use \`!noreplypings\`, and deletes it when you use \`!yesreplypings\`. So, to delete all your personal information that is stored by the bot, use \`!yesreplypings\`.

You can use Bash-style quoting and escaping in commands.

Type \`!help <command>\` for help for a specific command!`;


let helpMsgs: {[key: string]: string} = {};

for (let cmd in HELP) {
    let data = HELP[cmd];
    let msg = '`!' + cmd;
    for (let arg of data.args) {
        msg += arg.newline ? '\n' : ' ';
        if (arg.optional) {
            msg += '[' + arg.name + ']';
        } else {
            msg += '<' + arg.name + '>';
        }
    }
    msg += '`\n\n' + data.desc + '\n\nArguments:';
    for (let arg of data.args) {
        msg += '\n* ';
        if (arg.optional) {
            msg += '`[' + arg.name + ']`';
        } else {
            msg += '`<' + arg.name + '>`';
        }
        msg += ' - ' + arg.desc;
    }
    if (data.extra) {
        msg += '\n\n' + data.extra;
    }
    if (data.aliases) {
        msg += '\n\nAliases: ' + data.aliases.map(x => '`!' + x + '`').join(', ');
    }
    helpMsgs[cmd] = msg;
    if (data.aliases) {
        for (let alias of data.aliases) {
            helpMsgs[alias] = msg;
        }
    }
}

export async function cmdHelp(msg: Message, argv: string[]): Promise<Response> {
    if (argv.length > 1) {
        let cmd = argv.slice(1).join(' ').toLowerCase();
        if (cmd.startsWith('!')) {
            cmd = cmd.slice(1);
        }
        if (cmd in helpMsgs) {
            return helpMsgs[cmd];
        } else if (cmd in COMMANDS) {
            throw new BotError(`Command !${cmd} present, but has no help entry`);
        } else {
            throw new BotError(`No command called !${cmd}`);
        }
    } else {
        return HELP_MSG;
    }
}
