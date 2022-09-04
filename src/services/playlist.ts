/*
 * services/playlist.ts
 * playlist management service
 */

import { Logging } from "../logger";
import { Autowired } from "../service";
import { DatabaseService } from "./database";

export class PlaylistService extends Logging {
    @Autowired ()
    private m_databaseService! : DatabaseService;

    public constructor () {
        super ();
        this.info ('initializing playlist manager service');
    }
}