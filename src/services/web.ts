/*
 * services/web.ts
 * service that runs the web server
 */

import { Logging } from "../logger";
import { Service } from "../service";

@Service ()
export class WebService extends Logging {
    public constructor () {
        super ();
        this.info ("initializing web service");
    }
}