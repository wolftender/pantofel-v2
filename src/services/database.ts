import { PrismaClient } from '@prisma/client';
import { Logging } from '../logger';
import { Service } from '../service';

@Service ()
export class DatabaseService extends Logging {
    private m_client : PrismaClient;

    public constructor () {
        super ();

        this.info ('initializing database service');
        this.m_client = new PrismaClient ();
    }

    private get client () {
        return this.m_client;
    }

    public get guild () {
        return this.client.guild;
    }

    public get user () {
        return this.client.user;
    }

    public get song () {
        return this.client.song;
    }

    public get songRating () {
        return this.client.songRating;
    }
}