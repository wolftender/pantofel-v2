/*
 * commands/upload.ts
 * upload a song
 */

import type { ChatInputCommandInteraction, Client, SlashCommandBuilder } from "discord.js";
import { CommandHandler } from "../command";
import { CommandExecutor } from "../executor";
import { Autowired } from "../service";
import { DatabaseService } from "../services/database";
import { PlaylistService } from "../services/playlist";
import config from '../config.json';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

@CommandHandler ()
class UploadCommand extends CommandExecutor {
    @Autowired ()
    private m_databaseService! : DatabaseService;

    @Autowired ()
    private m_playlistService! : PlaylistService;


    public constructor () {
        super ('upload', 'upload a song');
    }

    public build () : SlashCommandBuilder {
        return (super.build ()
            .addAttachmentOption (option => option
                .setName ('file')
                .setDescription ('the song file (opus')
                .setRequired (true))
            .addStringOption (option => option
                .setName ('artist')
                .setDescription ('the author of the song')
                .setRequired (true))
            .addStringOption (option => option
                .setName ('title')
                .setDescription ('the title of the song')
                .setRequired (true))
            .addAttachmentOption (option => option
                .setName ('cover-art')
                .setDescription ('the cover art')
                .setRequired (false))
        ) as SlashCommandBuilder;
    }

    public async command (client : Client, interaction : ChatInputCommandInteraction) : Promise<void> {
        const file = interaction.options.getAttachment ('file', true);
        const artist = interaction.options.getString ('artist', true);
        const title = interaction.options.getString ('title', true);
        const coverArt = interaction.options.getAttachment ('cover-art');
        const userId = interaction.user.id;

        await interaction.deferReply ({
            ephemeral: true
        });

        const userEntry = await this.m_databaseService.client.user.findUnique({
            where: {
                userId
            }
        });

        if (userEntry === null) {
            await this.m_databaseService.client.user.create({
                data: {
                    userId
                }
            })
        } else if (userEntry.bannedUntil && userEntry.bannedUntil > new Date()) {
            await interaction.editReply (`You are banned until <t:${Math.floor(userEntry.bannedUntil.getTime() / 1000.0)}>`);
            return;
        }

        const songEntry = await this.m_databaseService.client.song.create({
            data: {
                artist,
                title,
                userId,
                artworkUrl: coverArt?.url
            }
        });

        const writeStream = fs.createWriteStream (`${config.storage.musicDirectory}/${songEntry.songId}.opus`);
        
        ffmpeg ()
            .on('error', async () => {
                await this.m_databaseService.client.song.delete({
                    where: {
                        songId: songEntry.songId
                    }
                })
                await interaction.editReply ('Upload failed');
            })
            .on('end', async () => {
                this.m_playlistService.addSong (songEntry.songId);
                await interaction.editReply ('Upload successful');
            })
            .input (file.url)
            .audioBitrate ('128k')
            .format ('opus')
            .pipe (writeStream);
    }
}