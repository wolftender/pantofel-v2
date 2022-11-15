import { AttachmentBuilder } from "discord.js";
import { EmbedBuilder } from "@discordjs/builders";
import type { Song } from "@prisma/client";
import { exec } from 'child_process'
import util from 'util';
import config from './config.json';

export class Util {
    public static randomArrayElement<T> (array : T[]) : T {
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Shuffle an array in-place
     * @see https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
     */
    public static shuffle<T> (array : T[]): T[] {
        for (let i = array.length - 1; i > 0; --i) {
            const j = Math.floor (Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    public static wait (miliseconds : number) : Promise <void> {
        return new Promise <void> ((resolve) => setTimeout (resolve, miliseconds));
    }

    public static songEmbed (song : Song) : { embed : EmbedBuilder, files: AttachmentBuilder[] } {
        const timestamp = Math.floor (song.added.getTime() / 1000.0);
        const embed = new EmbedBuilder ()
            .setTitle (song.title)
            .setAuthor ( { name: song.artist } )
            .setColor ([103, 72, 255])
            .setDescription (`Added by <@${song.userId}> <t:${timestamp}:R>`);
        const files: AttachmentBuilder[] = []
   
        if (song.artworkUrl) {
            if (song.artworkUrl.startsWith ('https://')) {
                embed.setThumbnail (song.artworkUrl);
            } else if(song.artworkUrl.startsWith ('res://')) {
                const url = song.artworkUrl.replace ('res://', `${config.storage.jacketDirectory}/`);
                const builder = new AttachmentBuilder (url).setName ('cover.webp');
                files.push (builder);
                embed.setThumbnail (`attachment://cover.webp`);
            }
        }

        return { embed, files };
    }

    public static async exec (cmd : string) : Promise<string> {
        return (await util.promisify(exec)(cmd)).stdout;
    }
}