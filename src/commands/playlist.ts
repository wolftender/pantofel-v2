/*
 * commands/playlist.ts
 * show the current playlist
 */

import { ChatInputCommandInteraction, Client, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { CommandHandler } from '../command';
import { CommandExecutor } from '../executor';
import { Autowired } from '../service';
import { DatabaseService } from '../services/database';
import { PlaylistService } from '../services/playlist';

@CommandHandler ()
class PlaylistCommand extends CommandExecutor {
    @Autowired ()
    private m_databaseService! : DatabaseService;

    @Autowired ()
    private m_playlistService! : PlaylistService;


    public constructor () {
        super ('playlist', 'show the current playlist')
    }

    public build () : SlashCommandBuilder {
        return (super.build ()) as SlashCommandBuilder;
    }

    public async command (client : Client, interaction : ChatInputCommandInteraction) : Promise<void> {
        const songIds = this.m_playlistService.getNextSongIDs (5);
        const embed = new EmbedBuilder ();
        for (const songId of songIds) {
            const song = await this.m_databaseService.song.findUnique ({
                where : {
                    songId
                }
            });
            if (song !== null) {
                let name = song.title;
                let value = song.artist;
                if (embed.data.fields === undefined || embed.data.fields.length === 0) {
                    name += ' (now playing)';
                }
                embed.addFields ({ name, value})
            }
        }
        
        embed.setTitle ('Playlist')
             .setColor ('#ef8586');

        await interaction.reply ({
            embeds : [embed]
        })
    }
}