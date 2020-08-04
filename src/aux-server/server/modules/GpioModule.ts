import { AuxModule2, Simulation } from '@casual-simulation/aux-vm';
import {
    DeviceInfo,
    remoteResult,
    remoteError,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import {
    SendWebhookAction,
    SetGpioPinAction,
    ConfigureGpioPinAction,
    GetGpioPinAction,
    asyncResult,
    asyncError,
    hasValue,
} from '@casual-simulation/aux-common';
import { sendWebhook } from '../../shared/WebhookUtils';
const Gpio = require('onoff').Gpio; //require onoff to control GPIO

let pinMap = new Map<number, typeof Gpio>();

// for (let i=0; i<26; i++){
//     pinMap.set(i, new Gpio(i, 'out'))
// }

/**
 * Defines an AuxModule that adds GPIO functionality to the module.
 */
export class GpioModule implements AuxModule2 {
    constructor() {}

    setChannelManager() {}

    async setup(simulation: Simulation): Promise<Subscription> {
        let sub = new Subscription();

        sub.add(
            simulation.localEvents
                .pipe(
                    flatMap(async event => {
                        if (event.type === 'configure_gpio_pin') {
                            await this._configureGpio(simulation, event);
                        }
                        if (event.type === 'set_gpio_pin') {
                            await this._setGpio(simulation, event);
                        }
                        if (event.type === 'get_gpio_pin') {
                            await this._getGpio(simulation, event);
                        }
                    })
                )
                .subscribe()
        );

        return sub;
    }

    _configureGpio(simulation: Simulation, event: ConfigureGpioPinAction) {
        try {
            let pin = pinMap.get(event.pin);
            if (pin) {
                pin.setDirection(event.mode);
            } else {
                pin = new Gpio(event.pin, event.mode);
                pinMap.set(event.pin, pin);
            }
            simulation.helper.transaction(
                hasValue(event.playerId)
                    ? remoteResult(
                          undefined,
                          { sessionId: event.playerId },
                          event.taskId
                      )
                    : asyncResult(event.taskId, undefined)
            );
        } catch (error) {
            simulation.helper.transaction(
                hasValue(event.playerId)
                    ? remoteError(
                          {
                              error: 'failure',
                              exception: error.toString(),
                          },
                          { sessionId: event.playerId },
                          event.taskId
                      )
                    : asyncError(event.taskId, error)
            );
        }
    }
    _setGpio(simulation: Simulation, event: SetGpioPinAction) {
        try {
            let pin = pinMap.get(event.pin);
            if (!pin) {
                pin = new Gpio(event.pin, 'out');
                pinMap.set(event.pin, pin);
            }
            pin.writeSync(event.value);
            simulation.helper.transaction(
                hasValue(event.playerId)
                    ? remoteResult(
                          undefined,
                          { sessionId: event.playerId },
                          event.taskId
                      )
                    : asyncResult(event.taskId, undefined)
            );
        } catch (error) {
            simulation.helper.transaction(
                hasValue(event.playerId)
                    ? remoteError(
                          {
                              error: 'failure',
                              exception: error.toString(),
                          },
                          { sessionId: event.playerId },
                          event.taskId
                      )
                    : asyncError(event.taskId, error)
            );
        }
    }
    _getGpio(simulation: Simulation, event: GetGpioPinAction) {
        try {
            let pin = pinMap.get(event.pin);
            if (!pin) {
                pin = new Gpio(event.pin, 'out');
                pinMap.set(event.pin, pin);
            }
            pin.readSync(event.pin);
            simulation.helper.transaction(
                hasValue(event.playerId)
                    ? remoteResult(
                          undefined,
                          { sessionId: event.playerId },
                          event.taskId
                      )
                    : asyncResult(event.taskId, undefined)
            );
        } catch (error) {
            simulation.helper.transaction(
                hasValue(event.playerId)
                    ? remoteError(
                          {
                              error: 'failure',
                              exception: error.toString(),
                          },
                          { sessionId: event.playerId },
                          event.taskId
                      )
                    : asyncError(event.taskId, error)
            );
        }
    }

    async deviceConnected(
        simulation: Simulation,
        device: DeviceInfo
    ): Promise<void> {}

    async deviceDisconnected(
        simulation: Simulation,
        device: DeviceInfo
    ): Promise<void> {}
}
