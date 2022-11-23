/*
 * services/playlist.ts
 * playlist management service
 */

import { Logging } from '../logger';
import { Autowired, Service } from '../service';
import { DiscordService } from './discord';
import { DatabaseService } from './database';
import { joinVoiceChannel, VoiceConnectionStatus, createAudioPlayer, AudioPlayer, NoSubscriberBehavior, createAudioResource, AudioPlayerStatus, AudioResource, getVoiceConnection, VoiceConnection, PlayerSubscription, entersState } from '@discordjs/voice';
import { Message, ActivityOptions, ActivityType, Collection, VoiceChannel, VoiceState } from 'discord.js';

import config from '../config.json';
import { Util } from '../util';
import fs from 'fs';
import type { Song } from '@prisma/client';
import type { UserID } from '../types';

type VoteSkip = {
    message : Message | null,
    voted : boolean
}

@Service ()
export class PlaylistService extends Logging {
    @Autowired ()
    private m_databaseService! : DatabaseService;

    @Autowired ()
    private m_discordService! : DiscordService;

    private m_audioPlayer : AudioPlayer;

    private m_songCount : number;
    private m_playlist : number[];
    private m_skipVotes : Map<UserID, VoteSkip>;
    private m_nowPlaying : Song | null;

    private m_announcement : boolean;
    private m_announcers : string[];

    /* I don't know why subscriptions aren't stored inside connections */
    private m_subscriptions : Collection<string, PlayerSubscription>;

    public constructor () {
        super ();
        this.info ('initializing playlist manager service');
        this.m_audioPlayer = createAudioPlayer ({
            behaviors : {
                noSubscriber : NoSubscriberBehavior.Pause,
            },
        });

        this.m_audioPlayer.once (AudioPlayerStatus.Playing, () => {
            this.info ('the audio player has started playback');
        });

        this.m_audioPlayer.on (AudioPlayerStatus.Idle, () => {
            this.play ();
        });

        this.m_discordService.client.on ('voiceStateUpdate', this.channelEvent.bind (this));

        this.m_discordService.client.once ('ready', () => {
            this.connectAll ();
            this.play ();
        });

        this.m_songCount = 0;
        this.m_playlist = [];
        this.m_skipVotes = new Map ();
        this.m_nowPlaying = null;

        this.m_announcement = false;
        this.m_announcers = fs.readdirSync (`${config.storage.announcerDirectory}`);

        if (this.m_announcers.length === 0) {
            throw new Error ('Announcers missing');
        }

        this.m_subscriptions = new Collection ();

    }

    private async shuffle () : Promise<void> {
        this.m_playlist = (await this.m_databaseService.song.findMany ({
            select : {
                songId : true
            }
        })).map (song => song.songId);
        this.m_songCount = this.m_playlist.length;
        Util.shuffle (this.m_playlist);
        this.info (`playlist shuffled: ${this.m_playlist.length} songs`);
    }

    private getListenerCount (channel : VoiceChannel) : number {
        return channel.members.size - 1;
    }

    public async play () : Promise<void> {
        let resource : AudioResource;
        if (this.m_announcement) {
            if (this.m_playlist.length === 0) {
                await this.shuffle ();
            }
            const songId = this.m_playlist.shift ();
            if (songId === undefined) {
                this.error ('playlist is empty');
                return;
            }
            const song = await this.m_databaseService.song.findUnique ({
                where : {
                    songId
                }
            });
            this.m_skipVotes.clear ();
            this.m_nowPlaying = song;
            resource = createAudioResource (`${config.storage.announcerDirectory}/${Util.randomArrayElement (this.m_announcers)}`);

            this.info (`announcing ${this.m_nowPlaying?.songId}.opus`);

            this.m_discordService.client.user?.setActivity ({ type : ActivityType.Listening, name: `${song?.title} by ${song?.artist}`} as ActivityOptions);
        } else {
            resource = createAudioResource (`${config.storage.musicDirectory}/${this.m_nowPlaying?.songId}.opus`);
        }

        this.m_audioPlayer.play (resource);

        if (this.m_announcement) {
            if (this.m_nowPlaying !== null) {
                const { embed, files } = Util.songEmbed (this.m_nowPlaying);
                embed.setFooter ({ text : `${this.m_songCount - this.m_playlist.length}/${this.m_songCount}` });
                const channels = await this.fetchAllChannels ();
                for (const channel of channels) {
                    channel.send ({ embeds : [embed], files });
                }
            }
        }

        try {
            await entersState (this.m_audioPlayer, AudioPlayerStatus.Playing, 5_000);
            this.m_announcement = !this.m_announcement;
        } catch (error) {
            this.error (error as string);
            this.m_announcement = true;
            this.play ();
            return;
        }
    }

    public async channelEvent (oldState : VoiceState, currentState : VoiceState) {
        const channelId : string = (oldState.channelId ?? currentState.channelId) as string;
        const guildId : string = oldState.guild.id;
        const connection : VoiceConnection | undefined = getVoiceConnection (guildId);

        if (connection) {
            const channel = await this.m_discordService.client.channels.fetch (channelId);
            if (channel instanceof VoiceChannel) {
                if (this.getListenerCount (channel) === 0) {
                    const subscription = this.m_subscriptions.get (channelId);
                    if (subscription) {
                        subscription.unsubscribe ();
                        this.m_subscriptions.delete (channelId);
                    }
                } else {
                    if (!this.m_subscriptions.has (channelId)) {
                        const subscription = connection.subscribe (this.m_audioPlayer);
                        if (subscription) {
                            this.m_subscriptions.set (channelId, subscription);
                        }
                    }
                }
            }
        }
    }

    public connect (channel : VoiceChannel) : void {
        const connection = joinVoiceChannel ({
            channelId : channel.id,
            guildId : channel.guild.id,
            adapterCreator : channel.guild.voiceAdapterCreator
        })

        connection.on (VoiceConnectionStatus.Disconnected, () => {
            setTimeout (() => {
                this.connect (channel);
            }, config.player.rejoinDelay)
        });

        if (this.getListenerCount (channel) > 0) {
            connection.subscribe (this.m_audioPlayer);
        }
    }

    private async fetchAllChannels () : Promise<VoiceChannel[]> {
        const guilds = await this.m_databaseService.guild.findMany ();
        const res : VoiceChannel[] = [];
        for (const dbGuild of guilds) {
            try {
                const guild = await this.m_discordService.client.guilds.fetch (dbGuild.guildId);
                const channel = await guild.channels.fetch (dbGuild.channelId);
                if (channel instanceof VoiceChannel) {
                    res.push (channel);
                }
            } catch (error) {
                this.error (`Unable to fetch a guild channel: ${error}`);
            }
        }
        return res;
    }

    private async connectAll () : Promise<void> {
        const channels = await this.fetchAllChannels ();
        for (const channel of channels) {
            this.connect (channel);
        }
    }

    public getCurrentSong () : Song | null {
        return this.m_nowPlaying;
    }

    /**
     * @returns `true` if the song has been skipped successfully
     */
    public skipCurrentSong () : boolean {
        const song = this.getCurrentSong ();
        if (song === null) {
            return false;
        } else {
            this.m_announcement = true;
            this.m_skipVotes.clear ();
            return this.m_audioPlayer.stop ();
        }
    }

    public async voteSkip (userId : string, message: Message) : Promise<{ voteCount : number, userCount: number }> {
        const song = this.getCurrentSong ();

        if (song === null) {
            return { voteCount : 0, userCount: 0};
        }

        const channels = await this.fetchAllChannels ();

        let userCount = 0;
        for (const channel of channels) {
            userCount += channel.members.size;
        }
        userCount -= 1; // Exclude self

        if (this.m_skipVotes.has (userId)) {
            const previousVote = this.m_skipVotes.get (userId)!;
            if (previousVote.message !== null) {
                await previousVote.message.delete ();
            }
            this.m_skipVotes.set (userId, {
                message,
                voted : !previousVote.voted
            });
        } else {
            this.m_skipVotes.set (userId, {
                message,
                voted : true
            });
        }

        return { 
            voteCount : Array.from (this.m_skipVotes.values ()).filter (vote => vote.voted).length, 
            userCount 
        };
    }

    public addSong (songId : number) : void {
        this.m_playlist.unshift (songId);
        this.m_songCount++;

        if (this.m_songCount === 1) {
            this.play ();
        }
    }

    public getNextSongIDs (count : number) : number[] {
        return [this.m_nowPlaying?.songId ?? 0, ...this.m_playlist.slice (0, count)];
    }
}