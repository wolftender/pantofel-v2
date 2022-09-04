import { Logging, LogLevel } from "./logger";

// envitonment variable setup
import dotenv from 'dotenv'
dotenv.config ();

// config
import config from './config.json';

// services
import './services/discord.ts';
import './services/web.ts';

export class Pantofel extends Logging {
    public static async run () : Promise<void> {
        this.log (LogLevel.INFO, "starting the bot...");
    }
}

Pantofel.run ();