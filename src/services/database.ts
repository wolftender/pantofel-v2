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

    public get client () {
        return this.m_client;
    }
}