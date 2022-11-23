import { Logging, LogLevel } from './logger';

// envitonment variable setup
import dotenv from 'dotenv'
dotenv.config ();

// config
import config from './config.json';

// services
import './services/database.ts';
import './services/discord.ts';
import './services/playlist.ts';
import './services/web.ts';

import './commands/songinfo';
import './commands/register';
import './commands/skip';
import './commands/upload';
import './commands/playlist'

export class Pantofel extends Logging {
    public static async run () : Promise<void> {
        this.log (LogLevel.INFO, 'starting the bot...');
    }
}

Pantofel.run ();