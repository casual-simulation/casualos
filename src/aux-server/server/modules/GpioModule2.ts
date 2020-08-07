import { AuxModule2, Simulation } from '@casual-simulation/aux-vm';
import {
    DeviceInfo,
    remoteResult,
    remoteError,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import {
    RpioOpenAction,
    RpioReadAction,
    RpioWriteAction,
    asyncResult,
    asyncError,
    hasValue,
} from '@casual-simulation/aux-common';
const rpio = require('rpio').rpio;

/**
 * https://www.npmjs.com/package/rpio
 *
 * TODO - rpio.exit()
 * WIP - rpio.open(pin, mode[, option])
 * WIP - rpio.mode(pin, mode[, option])       //changes the mode input|output
 * WIP - rpio.read(pin)
 * TODO - rpio.readbuf(pin, buffer[, length])
 * WIP - rpio.write(pin, value)               //changes the state high|low
 * TODO - rpio.writebuf(pin, buffer[, length])
 * TODO - rpio.readpad(group)
 * TODO - rpio.writepad(group, control)
 * TODO - rpio.pud(pin, state)
 * TODO - rpio.poll(pin, cb[, direction])
 * WIP - rpio.close(pin[, reset])
 *
 * TODO - rpio.i2cBegin()
 * TODO - rpio.i2cSetSlaveAddress()
 * TODO - rpio.i2cSetBaudRate()
 * TODO - rpio.i2cSetClockDivider()
 * TODO - rpio.i2cWrite()
 * TODO - rpio.i2cRead()
 * TODO - rpio.i2cReadRegisterRestart()
 * TODO - rpio.i2cWriteReadRestart()
 * TODO - rpio.i2cEnd()
 *
 * TODO - rpio.pwmSetClockDivider()
 * TODO - rpio.pwmSetRange()
 * TODO - rpio.pwmSetData()
 *
 * TODO - rpio.spiBegin()
 * TODO - rpio.spiChipSelect()
 * TODO - rpio.spiSetCSPolarity()
 * TODO - rpio.spiSetClockDivider()
 * TODO - rpio.spiSetDataMode()
 * TODO - rpio.spiTransfer()
 * TODO - rpio.spiWrite()
 * TODO - rpio.spiEnd()
 *
 */

/**
 * Defines an AuxModule that adds GPIO functionality to the module.
 */
export class GpioModule2 implements AuxModule2 {
    constructor() {}

    setChannelManager() {}

    async setup(simulation: Simulation): Promise<Subscription> {
        let sub = new Subscription();

        sub.add(
            simulation.localEvents
                .pipe(
                    flatMap(async event => {
                        if (event.type === 'rpio_open') {
                            await this._rpioOpen(simulation, event);
                        }
                        if (event.type === 'rpio_read') {
                            await this._rpioRead(simulation, event);
                        }
                        if (event.type === 'rpio_write') {
                            await this._rpioWrite(simulation, event);
                        }
                    })
                )
                .subscribe()
        );

        return sub;
    }

    _rpioOpen(simulation: Simulation, event: RpioOpenAction) {
        try {
            if (event.pin) {
                let pin = event.pin;
                var mode;
                var options;
                if (event.mode == 'INPUT') {
                    mode = rpio.INPUT;
                } else if (event.mode == 'OUTPUT') {
                    mode = rpio.OUTPUT;
                } else if (event.mode == 'PWM') {
                    mode = rpio.PWM;
                } else {
                    mode = rpio.OUTPUT;
                }

                if (event.options == 'HIGH') {
                    options = rpio.HIGH;
                } else if (event.options == 'LOW') {
                    options = rpio.LOW;
                } else if (event.options == 'PULL_OFF') {
                    options = rpio.PULL_OFF;
                } else if (event.options == 'PULL_DOWN') {
                    options = rpio.PULL_DOWN;
                } else if (event.options == 'PULL_UP') {
                    options = rpio.PULL_UP;
                }

                rpio.open(pin, mode, options);
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
    _rpioRead(simulation: Simulation, event: RpioReadAction) {
        try {
            let state;
            if (event.pin) {
                state = rpio.read(event.pin);
            } else {
                state = rpio.LOW;
            }
            simulation.helper.transaction(
                hasValue(event.playerId)
                    ? remoteResult(
                          state,
                          { sessionId: event.playerId },
                          event.taskId
                      )
                    : asyncResult(event.taskId, state)
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
    _rpioWrite(simulation: Simulation, event: RpioWriteAction) {
        try {
            if (event.pin) {
                let pin = event.pin;
                let value;
                if (event.value == 'HIGH') {
                    value = rpio.HIGH;
                } else if (event.value == 'LOW') {
                    value = rpio.LOW;
                }

                rpio.write(pin, value);
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

    async deviceConnected(
        simulation: Simulation,
        device: DeviceInfo
    ): Promise<void> {}

    async deviceDisconnected(
        simulation: Simulation,
        device: DeviceInfo
    ): Promise<void> {}
}
