/*
 * commands/songinfo.ts
 * get information about a song
 */

import type { ChatInputCommandInteraction, Client, SlashCommandBuilder } from "discord.js";
import { CommandHandler } from "../command";
import { CommandExecutor } from "../executor";
import { Autowired } from "../service";
import { DatabaseService } from "../services/database";
import { PlaylistService } from "../services/playlist";

@CommandHandler ()
class SkipCommand extends CommandExecutor {
    @Autowired ()
    private m_databaseService! : DatabaseService;

    @Autowired ()
    private m_playlistService! : PlaylistService;


    public constructor () {
        super ('skip', 'force skip the current song');
    }

    public build () : SlashCommandBuilder {
        return (super.build ()) as SlashCommandBuilder;
    }

    public async command (client : Client, interaction : ChatInputCommandInteraction) : Promise<void> {     
        const songId = this.m_playlistService.getCurrentSongId (); 
        if (songId !== null) {
            this.m_playlistService.skip ();
            const song = await this.m_databaseService.client.song.findUnique ({
                where: {
                    songId
                }
            });
            if (song !== null) {
                await interaction.reply (`${song.artist} - ${song.title} skipped`)
            } else {
                await interaction.reply ('Song skipped');
            }
        } else {
            await interaction.reply ('Nothing is being played');
        }
    }
}