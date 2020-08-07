import { AuxModule2, Simulation } from '@casual-simulation/aux-vm';
import {
    DeviceInfo,
    remoteResult,
    remoteError,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import {
    ConfigureRpioPinAction,
    SetRpioPinAction,
    GetRpioPinAction,
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
            if (event.options) {
                rpio.open(event.pin, rpio.event.mode, event.options);
            } else {
                rpio.open(event.pin, rpio.event.mode);
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
            let state = rpio.read(event.pin);
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
            rpio.write(event.pin, rpio.event.value);
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
