/*
 * commands/songinfo.ts
 * get information about currently playing song
 */

import type { Client, CommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandHandler } from "../command";
import { CommandExecutor } from "../executor";

@CommandHandler ()
class SongInfoCommand extends CommandExecutor {
    public constructor () {
        super ('songinfo', 'get information about currently playing song');
    }

    public build () : SlashCommandBuilder {
        return (super.build ()
            .setDescription ('get information about currently playing song')
        ) as SlashCommandBuilder;
    }

    public async command (client : Client, interaction : CommandInteraction) : Promise<void> {
        await interaction.reply ('not implemented');
    }
}