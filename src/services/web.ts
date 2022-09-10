/*
 * services/web.ts
 * service that runs the web server
 */

import { Logging } from "../logger";
import { Service } from "../service";
import config from '../config.json';

import path from 'path';
import express, { Express } from 'express';

@Service ()
export class WebService extends Logging {
    private m_server : Express;

    public constructor () {
        super ();
        this.info ("initializing web service");

        // initialize the web server
        this.m_server = express ();

        // read config variables
        const port = config.web.port;
        const staticPath = path.resolve (config.web.static);

        // serve static files
        this.m_server.use (express.static (staticPath));

        this.m_server.listen (port, () => {
            this.info (`server listening on port ${port}`);
            this.info (`server will use static directory: ${staticPath}`);
        });
    }
}