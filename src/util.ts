import { EmbedBuilder } from "@discordjs/builders";
import type { Song } from "@prisma/client";

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

    public static songEmbed (song : Song) : EmbedBuilder {
        const timestamp = Math.floor (song.added.getTime() / 1000.0);
        const embed = new EmbedBuilder ()
            .setTitle (song.title)
            .setAuthor ( { name: song.artist } )
            .setColor ([103, 72, 255])
            .setDescription (`Added by <@${song.userId}> <t:${timestamp}:R>`);
   
        if (song.artworkUrl) {
            embed.setThumbnail (song.artworkUrl);
        }

        return embed;
    }
}