import { AuxModule, AuxChannel } from '@casual-simulation/aux-vm';
import { USERNAME_CLAIM } from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap, tap } from 'rxjs/operators';

/**
 * Defines an AuxModule that adds Admin-related functionality to the module.
 */
export class AdminModule implements AuxModule {
    async setup(channel: AuxChannel): Promise<Subscription> {
        let sub = new Subscription();

        sub.add(
            channel.onDeviceEvents
                .pipe(
                    flatMap(events => events),
                    tap(event => {
                        if (event.event && event.event.type === 'local') {
                            let local = event.event;
                            if (local.name === 'say_hello') {
                                sayHelloTo(event.device.claims[USERNAME_CLAIM]);
                            }
                        }
                    })
                )
                .subscribe()
        );

        return sub;
    }
}

function sayHelloTo(username: string) {
    console.log(`User ${username} says "Hello!"`);
}
