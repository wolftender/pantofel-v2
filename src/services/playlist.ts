/*
 * services/playlist.ts
 * playlist management service
 */

import { Logging } from "../logger";
import { Autowired, Service } from "../service";
import { DiscordService } from "./discord";
import { DatabaseService } from "./database";
import { joinVoiceChannel, VoiceConnectionStatus, createAudioPlayer, AudioPlayer, NoSubscriberBehavior, createAudioResource, AudioPlayerStatus, AudioResource, getVoiceConnection, VoiceConnection, PlayerSubscription, getVoiceConnections, entersState, AudioPlayerState, AudioPlayerIdleState } from '@discordjs/voice';
import { Collection, VoiceChannel, VoiceState } from "discord.js";

import config from '../config.json';
import { Util } from "../util";
import fs from 'fs';

@Service ()
export class PlaylistService extends Logging {
    @Autowired ()
    private m_databaseService! : DatabaseService;

    @Autowired ()
    private m_discordService! : DiscordService;

    private m_audioPlayer : AudioPlayer;

    private m_songCount : number;
    private m_playlist : number[];
    private m_nowPlaying : number | null;

    private m_announcement : boolean;
    private m_announcers : string[];

    /* I don't know why subscriptions aren't stored inside connections */
    private m_subscriptions : Collection<string, PlayerSubscription>;

    public constructor () {
        super ();
        this.info ('initializing playlist manager service');
        this.m_audioPlayer = createAudioPlayer ({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause,
            },
        });

        this.m_audioPlayer.once (AudioPlayerStatus.Playing, () => {
            this.info ('the audio player has started playback');
        });

        this.m_audioPlayer.on (AudioPlayerStatus.Idle, () => {
            this.play ();
        });

        this.m_discordService.client.on ("voiceStateUpdate", this.channelEvent.bind(this));

        this.m_discordService.client.once ("ready", () => {
            this.connectAll ();
            this.play ();
        });

        this.m_songCount = 0;
        this.m_playlist = [];
        this.m_nowPlaying = null;

        this.m_announcement = false;
        this.m_announcers = fs.readdirSync (`${config.storage.announcerDirectory}`);

        this.m_subscriptions = new Collection ();

    }

    private async shuffle (): Promise<void> {
        this.m_playlist = (await this.m_databaseService.client.song.findMany ({
            select: {
                songId: true
            }
        })).map (song => song.songId);
        this.m_songCount = this.m_playlist.length;
        Util.shuffle(this.m_playlist);
        this.info (`playlist shuffled: ${this.m_playlist.length} songs`);
    }

    private getListenerCount (channel : VoiceChannel): number {
        return channel.members.size - 1;
    }

    public async play (): Promise<void> {
        let resource : AudioResource;
        if (this.m_announcement) {
            if (this.m_playlist.length === 0) {
                await this.shuffle ();
            }
            const songId = this.m_playlist.shift();
            if (songId === undefined) {
                this.error ('playlist is empty');
                return;
            }
            this.m_nowPlaying = songId;
            resource = createAudioResource (`${config.storage.announcerDirectory}/${Util.randomArrayElement (this.m_announcers)}`);

            this.info (`announcing ${this.m_nowPlaying}.opus`);
        } else {
            resource = createAudioResource (`${config.storage.musicDirectory}/${this.m_nowPlaying}.opus`);
        }

        this.m_audioPlayer.play(resource);

        if (this.m_announcement) {
            const song = await this.m_databaseService.client.song.findUnique({
                where: {
                    songId: this.m_nowPlaying!
                }
            });
            if (song !== null) {
                const embed = Util.songEmbed (song);
                embed.setFooter({ text: `${this.m_songCount - this.m_playlist.length}/${this.m_songCount}` });
                const channels = await this.fetchAllChannels ();
                for (const channel of channels) {
                    channel.send ({ embeds: [embed] });
                }
            }
        }

        try {
            await entersState(this.m_audioPlayer, AudioPlayerStatus.Playing, 5_000);
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
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator
        })

        connection.on (VoiceConnectionStatus.Disconnected, () => {
            setTimeout(() => {
                this.connect(channel);
            }, config.player.rejoinDelay)
        });

        connection.on ('stateChange', (previousState, currentState) => {
            // this.info (`connection to ${channel.name} (${channel.guild.name}) `
            // + `changed from ${previousState.status} to ${currentState.status}`);
        });

        if (this.getListenerCount (channel) > 0) {
            connection.subscribe (this.m_audioPlayer);
        }
    }

    private async fetchAllChannels () : Promise<VoiceChannel[]> {
        const guilds = await this.m_databaseService.client.guild.findMany();
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
        const channels = await this.fetchAllChannels();
        for (const channel of channels) {
            this.connect (channel);
        }
    }

    public getCurrentSongId () : number | null {
        return this.m_nowPlaying;
    }

    public skip () : void {
        this.m_announcement = true;
        this.m_audioPlayer.stop ();
    }

    public addSong (songId: number) : void {
        this.m_playlist.unshift (songId);
        this.m_songCount++;

        if (this.m_songCount === 1) {
            this.play ();
        }
    }
}