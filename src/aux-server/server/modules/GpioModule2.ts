import { AuxModule2, Simulation } from '@casual-simulation/aux-vm';
import {
    DeviceInfo,
    remoteResult,
    remoteError,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import {
    RpioInitAction,
    RpioExitAction,
    RpioOpenAction,
    RpioModeAction,
    RpioReadAction,
    RpioReadSequenceAction,
    RpioWriteAction,
    RpioWriteSequenceAction,
    RpioCloseAction,
    asyncResult,
    asyncError,
    hasValue,
} from '@casual-simulation/aux-common';
const rpio = require('rpio');

/**
 * https://www.npmjs.com/package/rpio
 *
 *  DONE - rpio.init([options])
 *  DONE - rpio.exit()
 *  DONE - rpio.open(pin, mode[, option])
 *  DONE - rpio.mode(pin, mode[, option])
 *  DONE - rpio.read(pin)
 *  DONE - rpio.readbuf(pin, buffer[, length])
 *  DONE - rpio.write(pin, value)
 *  DONE - rpio.writebuf(pin, buffer[, length])
 * TODO - rpio.readpad(group)
 * TODO - rpio.writepad(group, control)
 * TODO - rpio.pud(pin, state)
 * TODO - rpio.poll(pin, cb[, direction])
 *  DONE - rpio.close(pin[, reset])
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
                        if (event.type === 'rpio_init') {
                            await this._rpioInit(simulation, event);
                        }
                        if (event.type === 'rpio_exit') {
                            await this._rpioExit(simulation, event);
                        }
                        if (event.type === 'rpio_open') {
                            await this._rpioOpen(simulation, event);
                        }
                        if (event.type === 'rpio_mode') {
                            await this._rpioMode(simulation, event);
                        }
                        if (event.type === 'rpio_read') {
                            await this._rpioRead(simulation, event);
                        }
                        if (event.type === 'rpio_read_sequence') {
                            await this._rpioReadSequence(simulation, event);
                        }
                        if (event.type === 'rpio_write') {
                            await this._rpioWrite(simulation, event);
                        }
                        if (event.type === 'rpio_write_sequence') {
                            await this._rpioWriteSequence(simulation, event);
                        }
                        if (event.type === 'rpio_close') {
                            await this._rpioClose(simulation, event);
                        }
                    })
                )
                .subscribe()
        );
        return sub;
    }

    _rpioInit(simulation: Simulation, event: RpioInitAction) {
        try {
            rpio.init(event.options);
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
    _rpioExit(simulation: Simulation, event: RpioExitAction) {
        try {
            rpio.exit();
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
    _rpioMode(simulation: Simulation, event: RpioModeAction) {
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

                rpio.mode(pin, mode, options);
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
    _rpioReadSequence(simulation: Simulation, event: RpioReadSequenceAction) {
        try {
            let pin = event.pin;
            let length = event.length;
            let buffer = new Buffer(length);

            rpio.readbuf(pin, buffer, length);
            let array = [...buffer.values()];

            simulation.helper.transaction(
                hasValue(event.playerId)
                    ? remoteResult(
                          array,
                          { sessionId: event.playerId },
                          event.taskId
                      )
                    : asyncResult(event.taskId, array)
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
                } else {
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

    _rpioWriteSequence(simulation: Simulation, event: RpioWriteSequenceAction) {
        try {
            let pin = event.pin;
            let buffer = Buffer.from(event.buffer);
            rpio.writebuf(pin, buffer);

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

    _rpioClose(simulation: Simulation, event: RpioCloseAction) {
        try {
            if (event.pin) {
                let pin = event.pin;
                let options;
                if (event.options == 'PIN_PRESERVE') {
                    options = rpio.PIN_PRESERVE;
                } else {
                    options = rpio.PIN_RESET;
                }
                rpio.close(pin, options);
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
