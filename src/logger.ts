/*
 * Logger helper class
 * imported from eterbot
 */

import * as fs from 'fs';
import config from './config.json';

export enum LogLevel {
    INFO, WARN, ERROR
}

export class Logger {
    private static __logger? : Logger = undefined;

    public static get logger () : Logger {
        if (!Logger.__logger) {
            Logger.__logger = new Logger ();
        }

        return Logger.__logger;
    }

    private m_outputStream : fs.WriteStream;
    private m_logDirectory : string;
    private m_logLevel : number;

    private createLogDirectory () : void {
        if (!fs.existsSync (this.m_logDirectory)) {
            fs.mkdirSync (this.m_logDirectory, { recursive: true });
        }
    }

    private constructor () {
        this.m_logDirectory = config.logger.logDirectory;
        this.m_logLevel = config.logger.level;

        this.createLogDirectory ();
        
        const date : Date = new Date ();
        const baseName : string = `${date.getFullYear ()}_${date.getMonth ()}_${date.getDate ()}_${date.getHours ()}_${date.getMinutes ()}_r`;
        
        let iteration : number = 1, fileName : string;
        do {
            fileName = `${baseName}${iteration}`;
            iteration++;
        } while (fs.existsSync (fileName));

        this.m_outputStream = fs.createWriteStream (`${this.m_logDirectory}/${fileName}.log`);
    }

    private pad (number : number) {
        return (`0${number}`).slice (-2);
    }

    private createLogTimestamp () : string {
        const date : Date = new Date ();
        const timestamp : string = `${this.pad (date.getHours ())}:${this.pad (date.getMinutes ())}:${this.pad (date.getSeconds ())} ${this.pad (date.getDate ())}/${this.pad (date.getMonth () + 1)}`;

        return timestamp;
    }

    public log (level : LogLevel, message : string) : void {
        if (level < this.m_logLevel) return;
        
        const timestamp : string = this.createLogTimestamp ();
        const formattedMessage : string = `[${timestamp}][${LogLevel[level]}] ${message}`;

        switch (level) {
            case LogLevel.ERROR: console.error (formattedMessage); break;
            case LogLevel.WARN: console.warn (formattedMessage); break;
            default: console.log (formattedMessage); break;
        }

        this.m_outputStream.write (`${formattedMessage}\n`);
    }

    public error (message : string) : void {
        this.log (LogLevel.ERROR, message);
    }

    public warning (message : string) : void {
        this.log (LogLevel.WARN, message);
    }

    public info (message : string) : void {
        this.log (LogLevel.INFO, message);
    }
}

export class Logging {
    protected static log (level : LogLevel, message : string) : void {
        Logger.logger.log (level, message);
    }

    protected static error (message : string) : void {
        Logger.logger.error (message);
    }

    protected static warning (message : string) : void {
        Logger.logger.warning (message);
    }

    protected static info (message : string) : void {
        Logger.logger.info (message);
    }

    protected log (level : LogLevel, message : string) : void {
        Logger.logger.log (level, message);
    }

    protected error (message : string) : void {
        Logger.logger.error (message);
    }

    protected warning (message : string) : void {
        Logger.logger.warning (message);
    }

    protected info (message : string) : void {
        Logger.logger.info (message);
    }
}