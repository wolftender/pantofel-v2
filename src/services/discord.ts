/*
 * services/discord.ts
 * service that runs the discord bot account
 */

import { ActivityOptions, ActivityType, Client, ClientOptions, GatewayIntentBits } from "discord.js";
import { Logging, LogLevel } from "../logger";
import { Autowired, Service } from "../service";
import { DatabaseService } from "./database";

import config from '../config.json';

@Service ()
export class DiscordService extends Logging {
    @Autowired ()
    private m_databaseService! : DatabaseService;

    // discord client
    private m_client : Client;

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
        });

        this.m_client.login (process.env.DISCORD_TOKEN);
    }
}