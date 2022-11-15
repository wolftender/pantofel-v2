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
import { Util } from '../util';
import sharp from 'sharp';
import { Logging } from "../logger";

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
            .addSubcommand (option => option
                .setName ('local')
                .setDescription ('upload a local music file')
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
                    .setRequired (false)))
            .addSubcommand (option => option
                .setName('youtube')
                .setDescription ('upload a song from YouTube Music')
                .addStringOption (option => option
                    .setName ('url')
                    .setDescription ('the link to the song')
                    .setRequired (true)))
        ) as SlashCommandBuilder;
    }

    public async command (client : Client, interaction : ChatInputCommandInteraction) {
        switch (interaction.options.getSubcommand (true)) {
        case 'local' :
            await this.commandLocal (client, interaction);
            break;
        case 'youtube' :
            await this.commandYoutube (client, interaction);
            break;
        default:
            await interaction.reply ('Invalid subcommand');
            break;
        }
    }

    public async commandLocal (client : Client, interaction : ChatInputCommandInteraction) : Promise<void> {
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

    public async commandYoutube (client : Client, interaction : ChatInputCommandInteraction) : Promise<void> {
        const url = this.verifyURL(interaction.options.getString ('url', true));
        const musicDir = config.storage.musicDirectory;
        const jacketDir = config.storage.jacketDirectory;
        const userId = interaction.user.id;

        if (url == null) {
            await interaction.reply ({
                content: 'Invalid URL',
                ephemeral: true
            });
            return;
        }

        const description = await Util.exec(`yt-dlp --get-title --get-description "${url}"`);
        const artist = this.parseArtist(description);
        const title = this.parseTitle(description);

        if (!description.trimEnd().endsWith ('Auto-generated by YouTube.')) {
            await interaction.reply ({
                content: 'Only Youtube Music uploads are supported',
                ephemeral: true
            });
            return;
        }

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
            }
        });
        const songId = songEntry.songId;

        try { 
            await Util.exec (`yt-dlp -o "${musicDir}/${songId}.%(ext)s" ` +
                                        '--write-thumbnail ' + 
                                        '--convert-thumbnails webp ' +
                                        '--audio-quality 128k ' +
                                        '--audio-format opus ' +
                                        `-x "${url}"`);

            await this.m_databaseService.client.song.update ({
                where: {
                    songId
                },
                data: {
                    artworkUrl: `res://${songId}.webp`
                }
            });

            await sharp (`${musicDir}/${songId}.webp`)
                .resize ({width:720, height:730, fit:"cover"})
                .toFile (`${jacketDir}/${songId}.webp`)

            await Util.exec(`rm ${musicDir}/${songId}.webp`);

            this.m_playlistService.addSong (songEntry.songId);
            await interaction.editReply ('Upload successful');
        } catch (error) {
            await this.m_databaseService.client.song.delete ({
                where: {
                    songId
                }
            });
            Logging.error (`${error}`);
            await interaction.editReply ('Upload failed');
        }
    }

    private verifyURL (url: string) : string | null {
        const regex = /(https:\/\/)?(www\.|music\.)?youtu(be\.com\/watch\?v=|\.be\/)[a-zA-Z0-9_-]{8,12}\b/
        if(regex.test(url)) {
            if(url.startsWith('https://')) {
                return url;
            } else {
                return `https://${url}`;
            }
        } else {
            return null;
        }
    }

    /*
     * The songDescription parsed by yt-dlp follows this format:
     * 
     * <song title>
     * Provided to YouTube by <big label>
     * 
     * <song title> · <artist 1> · <artist 2> · <artist 3> 
     * 
     * ...
    */
    private parseTitle (songDescription : string) : string {
        return songDescription.slice(0, songDescription.indexOf('\n'));
    }

    private parseArtist (songDescription : string) : string {

        const bullet = songDescription.indexOf ('·');
        if (bullet < 0) {
            return 'Unknown';
        } else {
            const artists = songDescription.slice (bullet + 2, songDescription.indexOf('\n', bullet + 1));
            return artists.replaceAll (' · ', ' + ')
        }
    }
}