/*
 * executor.ts
 * base classes for command executors
 */

import { SlashCommandBuilder } from "@discordjs/builders";
import type { AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction, Client } from "discord.js";

import { Logging } from "./logger";

export abstract class CommandExecutor extends Logging {
    private m_name : string;
    private m_description : string;

    public getName () : string {
        return this.m_name;
    }

    public getDescription () : string {
        return this.m_description;
    }

    public constructor (name : string, description : string) {
        super ();

        this.m_name = name;
        this.m_description = description;
    }

    public build () : SlashCommandBuilder {
        const builder : SlashCommandBuilder = new SlashCommandBuilder ()
            .setName (this.getName ())
            .setDescription (this.getDescription ());

        return builder;
    }

    public async command (client : Client, interaction : ChatInputCommandInteraction) : Promise<void> {
        throw new Error ("this command is not implemented");
    }

    public async button (id : string, client : Client, interaction : ButtonInteraction) : Promise<void> {
        throw new Error ("this button is not implemented");
    }

    public async autocomplete (client : Client, interaction : AutocompleteInteraction) : Promise<void> {
        throw new Error ("this autocomplete is not implemented");
    }
}

export abstract class RoutingCommandExecutor extends CommandExecutor {
    private m_routeHandlers : Map<string, (client : Client, interaction : ButtonInteraction, variables : string[]) => Promise <void>>;

    public constructor (name : string, description : string) {
        super (name, description);
        this.m_routeHandlers = new Map<string, (client : Client, interaction : ButtonInteraction, variables : string[]) => Promise <void>> ();
    }

    private validateFragment (str : string) {
        return !str.match (/[^a-zA-Z0-9]/) && str.length > 0;
    }

    public linkInteraction (action : string, args? : string []) : string {
        if (!this.validateFragment (action)) {
            throw new Error (`${action} is not a valid action name`);
        }

        const encodedArguments = args ? `/${args.join ('/')}` : '';
        return `${this.getName ()}:${action}${encodedArguments}`;
    }

    protected route (name : string, handler : (client : Client, interaction : ButtonInteraction, variables : string[]) => Promise <void>) : void {
        if (!this.validateFragment (name)) {
            throw new Error (`${name} is not a valid interaction name`);
        }

        if (this.m_routeHandlers.get (name)) {
            throw new Error (`interaction ${name} is already registered`);
        }

        this.m_routeHandlers.set (name, handler);
    }

    public async button (id : string, client : Client, interaction : ButtonInteraction) : Promise<void> {
        const pathElements : string [] = id.split (/\/+/);
        const name : string | undefined = pathElements.shift ();

        if (name && name.length !== 0) {
            const handler = this.m_routeHandlers.get (name);
            if (handler) {
                await handler (client, interaction, pathElements);
            } else {
                throw new Error (`invalid interaction handler id ${name}`);
            }
        } else {
            throw new Error ('no interaction handler id was provided');
        }
    }
}