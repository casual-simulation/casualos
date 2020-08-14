import { AuxModule2, Simulation } from '@casual-simulation/aux-vm';
import {
    DeviceInfo,
    remoteResult,
    remoteError,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import {
    ExportGpioPinAction,
    UnexportGpioPinAction,
    SetGpioPinAction,
    GetGpioPinAction,
    asyncResult,
    asyncError,
    hasValue,
} from '@casual-simulation/aux-common';
const Gpio = require('onoff').Gpio;

let pinMap = new Map<number, typeof Gpio>();

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
                        if (event.type === 'export_gpio_pin') {
                            await this._exportGpio(simulation, event);
                        }
                        if (event.type === 'unexport_gpio_pin') {
                            await this._unexportGpio(simulation, event);
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

    _exportGpio(simulation: Simulation, event: ExportGpioPinAction) {
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
    _unexportGpio(simulation: Simulation, event: UnexportGpioPinAction) {
        try {
            let pin = pinMap.get(event.pin);
            if (pin) {
                pin.unexport();
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
            // Get the pin number from the pinmap
            let pin = pinMap.get(event.pin);
            // If there isn't an existing entry with the provided pin number
            if (!pin) {
                // Export a new GPIO pin
                pin = new Gpio(event.pin, 'out');
                // And add it to the pinmap
                pinMap.set(event.pin, pin);
            }
            // Read the state of the gpio type of the provided pin
            let state = pin.readSync(event.pin);
            simulation.helper.transaction(
                hasValue(event.playerId)
                    ? remoteResult(
                          state, // return the state
                          { sessionId: event.playerId },
                          event.taskId
                      )
                    : asyncResult(event.taskId, state) // return the state
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
