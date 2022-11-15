/*
 * service.ts
 * metadata and annotations based dependency injection framework used across the code
 */

import 'reflect-metadata';
import { Logger } from './logger';

const services : Array <any> = [];

export function Service () {
    return function <T extends new (...args : {}[]) => any> (target : T) {
        Logger.logger.info (`registering service ${target.name}`);

        const newService : T = new target ();
        for (const service of services) {
            if (newService instanceof service.constructor) {
                Logger.logger.warning (`service ambiguity ${target.name} extends ${service.constructor.name}`);
            }
        }

        services.push (newService);
    }
}

export interface AutowiredParameters {
    class? : Function;
    name? : string;
}

export function Autowired (parameters? : AutowiredParameters) {
    return function (target : any, memberName : string) {
        const propertyType = Reflect.getMetadata ('design:type', target, memberName);
        const tryAutowire = ((filter : (s : any) => boolean) => {
            for (const service of services) {
                if (filter (service)) {
                    Logger.logger.info (`autowired service ${service.constructor.name} to property ${memberName}`);
                    target [memberName] = service;

                    return true;
                }
            }

            return false;
        });

        if (parameters) {
            if (parameters.name) {
                const nameHint : string = parameters.name;
    
                if (tryAutowire (s => ((s.constructor.name as string).toLocaleLowerCase ().indexOf (nameHint) !== -1))) {
                    return;
                }
                
                Logger.logger.warning (`no services matching name = '${nameHint}' were found`);
            }
    
            if (parameters.class) {
                const hintClass : Function = parameters.class;

                if (tryAutowire (s => (s instanceof hintClass))) {
                    return;
                }

                Logger.logger.warning (`no services matching class = '${hintClass.name}' were found`);
            }
        }

        if (tryAutowire (s => (s instanceof propertyType))) {
            return;
        }

        throw new Error (`service ${propertyType.name} cannot be initialized correctly, make sure to import service before using it`);
    }
}