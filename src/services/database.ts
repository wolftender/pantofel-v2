import { PrismaClient, Song } from "@prisma/client";
import { Logging } from "../logger";
import { Service } from "../service";

@Service ()
export class DatabaseService extends Logging {
    private m_client : PrismaClient;

    constructor () {
        super ();

        this.info ("initializing database service");
        this.m_client = new PrismaClient ();
    }
}