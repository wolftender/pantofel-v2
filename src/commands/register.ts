/*
 * commands/register.ts
 * attach the bot to a voice channel
 */

import { ChannelType, ChatInputCommandInteraction, Client, Role, SlashCommandBuilder, VoiceChannel, PermissionFlagsBits } from 'discord.js';
import { CommandHandler } from '../command';
import { CommandExecutor } from '../executor';
import { Autowired } from '../service';
import { DatabaseService } from '../services/database';
import { PlaylistService } from '../services/playlist';

@CommandHandler ()
class RegisterCommand extends CommandExecutor {
    @Autowired ()
    private m_databaseService! : DatabaseService;

    @Autowired ()
    private m_playlistService! : PlaylistService;

    public constructor () {
        super ('register', 'attach the bot to a voice channel');
    }

    public build () : SlashCommandBuilder {
        return (super.build ()
            .addChannelOption (option => option
                .setName ('channel')
                .setDescription ('the channel to attach to')
                .setRequired (true)
                .addChannelTypes (ChannelType.GuildVoice))
            .addRoleOption (option => option
                .setName ('forceskip-role')
                .setDescription ('the role with the permission to force skip')
                .setRequired (false))
            .setDefaultMemberPermissions (PermissionFlagsBits.Administrator)
        ) as SlashCommandBuilder;
    }

    public async command (client : Client, interaction : ChatInputCommandInteraction) : Promise<void> {
        const channel = interaction.options.getChannel ('channel', true) as VoiceChannel;
        const guildId = interaction.guildId;
        
        if (guildId !== null) {
            await this.m_databaseService.client.guild.upsert ({
                where : {
                    guildId
                },
                update : {
                    channelId : channel.id,
                },
                create : {
                    guildId,
                    channelId : channel.id,
                }
            });
            await interaction.reply (`Attached to <#${channel.id}>`);
            this.m_playlistService.connect (channel);
        }
    }
}