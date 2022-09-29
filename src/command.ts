/*
 * command.ts
 * command execution framework based on metaprogramming
 */

import { REST } from '@discordjs/rest';

import { Logging } from './logger';
import type { CommandExecutor } from "./executor";

import * as config from './config.json';
import { RESTPostAPIApplicationCommandsJSONBody, Routes } from 'discord-api-types/v10';
import type { AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction, Client, GuildManager } from 'discord.js';
import { Util } from './util';

const commandHandlers : Array <new(...args: {}[]) => CommandExecutor> = [];

export function CommandHandler () {
    return function <T extends new(...args: {}[]) => CommandExecutor> (target : T) {
        commandHandlers.push (target);
    }
}

export class CommandManager extends Logging {
    private m_commands : Map <string, CommandExecutor>;

    public constructor () {
        super ();

        this.m_commands = new Map <string, CommandExecutor> ();
        this.autoRegisterCommands ();

        const registered : string [] = [];
        for (const key of this.m_commands.keys ()) {
            registered.push (key);
        }

        this.info (`registered commands: ${registered.join (', ')}`);
    }

    private registerCommand (command : CommandExecutor) : void {
        if (this.m_commands.get (command.getName ())) {
            throw new Error (`command ${command.getName ()} is already registered`);
        }

        this.m_commands.set (command.getName (), command);
    }

    private autoRegisterCommands () : void {
        for (const commandHandlerType of commandHandlers) {
            this.info (`registering command handler: ${commandHandlerType.name}`);

            try {
                this.registerCommand ((new (commandHandlerType) ()) as CommandExecutor);
            } catch (err : any) {
                this.error (`command handler registration failed`);
                this.error (err as string);

                if (config.commands.displayErrorStack) {
                    this.error (err.stack);
                }
            }
        }
    }

    public async handleCommand (client : Client, interaction : ChatInputCommandInteraction) {
        const commandName : string = interaction.commandName;
        const handler : CommandExecutor | undefined = this.m_commands.get (commandName);

        if (handler) {
            try {
                await handler.command (client, interaction);
            } catch (err : any) {
                this.error (`failed to execute command ${commandName}`);
                this.error (err as string);

                if (config.commands.displayErrorStack) {
                    this.error (err.stack);
                }

                await interaction.reply ({ ephemeral: true, content: 'an error has occured while processing your query' });
            }
        } else {
            this.error (`received command ${commandName} but a handler was not found`);
            await interaction.reply ({ ephemeral: true, content: 'https://cdn.discordapp.com/attachments/895285228531245106/921914115348381726/aler_copium.gif' });
        }
    }

    public async handleButton (client : Client, interaction : ButtonInteraction) {
        const buttonId = interaction.customId;
        const [ commandId, route ] = buttonId.split (':');

        const command : CommandExecutor | undefined = this.m_commands.get (commandId);

        if (command) {
            try {
                await command.button (route, client, interaction);
            } catch (err : any) {
                this.error (`failed to execute interaction ${buttonId}`);
                this.error (err as string);

                if (config.commands.displayErrorStack) {
                    this.error (err.stack);
                }

                await interaction.reply ({ ephemeral: true, content: 'an error has occured while processing your query' });
            }
        } else {
            this.error (`received interaction ${buttonId} but a handler was not found`);
            await interaction.reply ({ ephemeral: true, content: 'https://cdn.discordapp.com/attachments/895285228531245106/921914115348381726/aler_copium.gif' });
        }
    }

    public async handleAutocomplete (client : Client, interaction : AutocompleteInteraction) {
        const commandName : string = interaction.commandName;
        const handler : CommandExecutor | undefined = this.m_commands.get (commandName);

        if (handler) {
            try {
                await handler.autocomplete (client, interaction);
            } catch (err : any) {
                this.error (`failed to execute command ${commandName}`);
                this.error (err as string);

                if (config.commands.displayErrorStack) {
                    this.error (err.stack);
                }

                await interaction.respond([]);
            }
        } else {
            this.error (`received command ${commandName} but a handler was not found`);
            await interaction.respond([]);
        }
    }

    public async buildCommands (clientId : string, guildManager: GuildManager) : Promise <void> {
        const token : string = process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN : '';
        const rest : REST = new REST ({ version: '10' }).setToken (token);

        try {
            this.info ('refreshing application commands...');

            const commands : RESTPostAPIApplicationCommandsJSONBody [] = [];
            for (const command of this.m_commands.values ()) {
                commands.push (command.build ().toJSON ());
            }

            if (config.commands.globalCommands) {
                this.warning ('command registration is set to GLOBAL');
                this.warning ('the registration process will commence in 5 seconds, terminate the program to stop');

                await Util.wait (5000);
                await rest.put (Routes.applicationCommands (clientId), { body: commands })
            } else {
                const guilds = await guildManager.fetch ();
                for (const [guildId] of guilds) {
                    this.info (`registering commands for guild ${guildId}`);
                    await rest.put (Routes.applicationGuildCommands (clientId, guildId), { body: commands });
                }
            }

            this.info ('commands refreshed successfully');
        } catch (err) {
            this.error ('failed to refresh commands');
            this.error (err as string);
        }
    }
}