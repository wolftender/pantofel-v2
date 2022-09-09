/*
 * services/discord.ts
 * service that runs the discord bot account
 */

import { ActivityOptions, ActivityType, ButtonInteraction, Client, ClientOptions, CommandInteraction, GatewayIntentBits, Interaction } from "discord.js";
import { Logging, LogLevel } from "../logger";
import { Autowired, Service } from "../service";
import { DatabaseService } from "./database";

import config from '../config.json';
import { CommandManager } from "../command";

import '../commands/songinfo';

@Service ()
export class DiscordService extends Logging {
    @Autowired ()
    private m_databaseService! : DatabaseService;

    // discord client
    private m_client : Client;
    private m_commandManager! : CommandManager;

    public constructor () {
        super ();
        this.info ("initializing discord service");

        // initialize the client
        this.m_client = new Client ({
            intents: [
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.Guilds
            ]
        } as ClientOptions);

        this.m_client.on ('error', (error) => {
            this.error (`${error.name}: ${error.message}`);
        });

        this.m_client.on ('warn', this.warning);
        this.m_client.on ('info', this.info);

        this.m_client.once ('ready', async () => {
            this.info (`client logged in as ${this.m_client.user?.username}#${this.m_client.user?.discriminator} (${this.m_client.user?.id})`);
            this.m_client.user?.setActivity ({ type: ActivityType.Streaming, name: config.discord.status } as ActivityOptions);

            // initialize command manager and build commands (if asked to by the config)
            this.m_commandManager = new CommandManager ();
            if (config.commands.register && this.m_client.user) {
                await this.m_commandManager.buildCommands (this.m_client.user.id, this.m_client.guilds);
            }
        });

        this.m_client.on ("interactionCreate", async (interaction : Interaction) => {
            if (interaction.isCommand ()) {
                this.info (`received command ${interaction.commandName} from ${interaction.user.id}`);
                this.m_commandManager.handleCommand (this.m_client, interaction as CommandInteraction);
            } else if (interaction.isButton ()) {
                this.info (`received button ${interaction.customId} from ${interaction.user.id}`);
                this.m_commandManager.handleButton (this.m_client, interaction as ButtonInteraction);
            }
        });

        this.m_client.login (process.env.DISCORD_TOKEN);
    }
}