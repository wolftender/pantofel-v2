/*
 * services/discord.ts
 * service that runs the discord bot account
 */

import { ActivityOptions, ActivityType, AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction, Client, ClientOptions, CommandInteraction, GatewayIntentBits, Interaction, VoiceChannel, VoiceState } from "discord.js";
import { Logging } from "../logger";
import { Service } from "../service";

import config from '../config.json';
import { CommandManager } from "../command";

@Service ()
export class DiscordService extends Logging {
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
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates
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

            for (const guild of await this.m_client.guilds.fetch()) {
               
            }

            const channel = await this.m_client.channels.fetch ('964890696391745616');
            if (channel !== null && channel instanceof VoiceChannel) {
                // this.m_playlistService.connect (channel);
            }
        });

        this.m_client.on ("interactionCreate", async (interaction : Interaction) => {
            if (interaction.isChatInputCommand ()) {
                this.info (`received command ${interaction.commandName} from ${interaction.user.id}`);
                this.m_commandManager.handleCommand (this.m_client, interaction as ChatInputCommandInteraction);
            } else if (interaction.isButton ()) {
                this.info (`received button ${interaction.customId} from ${interaction.user.id}`);
                this.m_commandManager.handleButton (this.m_client, interaction as ButtonInteraction);
            } else if (interaction.isAutocomplete ()) {
                this.m_commandManager.handleAutocomplete (this.m_client, interaction as AutocompleteInteraction);
            }
        });

        this.m_client.login (process.env.DISCORD_TOKEN);
    }

    public get client () {
        return this.m_client;
    }
}