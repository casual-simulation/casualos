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
    RpioPWMSetClockDividerAction,
    RpioPWMSetRangeAction,
    RpioPWMSetDataAction,
    RpioSPIBeginAction,
    RpioSPIChipSelectAction,
    RpioSPISetCSPolarityAction,
    RpioSPISetClockDividerAction,
    RpioSPISetDataModeAction,
    asyncResult,
    asyncError,
    hasValue,
} from '@casual-simulation/aux-common';
const rpio = require('rpio');

/**
 * https://www.npmjs.com/package/rpio
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
                        // GPIO
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
                        if (event.type === 'rpio_read_sequence') { // Read Buffer
                            await this._rpioReadSequence(simulation, event);
                        }
                        if (event.type === 'rpio_write') {
                            await this._rpioWrite(simulation, event);
                        }
                        if (event.type === 'rpio_write_sequence') { // Write Buffer
                            await this._rpioWriteSequence(simulation, event);
                        }
                        if (event.type === 'rpio_close') {
                            await this._rpioClose(simulation, event);
                        }
                        // PWM
                        if (event.type === 'rpio_pwm_setclockdivider') {
                            await this._rpioPWMSetClockDivider(simulation, event);
                        }
                        if (event.type === 'rpio_pwm_setrange') {
                            await this._rpioPWMSetRange(simulation, event);
                        }
                        if (event.type === 'rpio_pwm_setdata') {
                            await this._rpioPWMSetData(simulation, event);
                        }
                        // SPI
                        if (event.type === 'rpio_spi_begin') {
                            await this._rpioSPIBegin(simulation, event);
                        }
                        if (event.type === 'rpio_spi_chipselect') {
                            await this._rpioSPIChipSelect(simulation, event);
                        }
                        if (event.type === 'rpio_spi_setcspolarity') {
                            await this._rpioSPISetCSPolarity(simulation, event);
                        }
                        if (event.type === 'rpio_spi_setclockdivider') {
                            await this._rpioSPISetClockDivider(simulation, event);
                        }
                        if (event.type === 'rpio_spi_setdatamode') {
                            await this._rpioSPISetDataMode(simulation, event);
                        }
                    })
                )
                .subscribe()
        );
        return sub;
    }

    // GPIO
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
            let pin = event.pin;
            let value;
            if (event.value == 'HIGH') {
                value = rpio.HIGH;
            } else {
                value = rpio.LOW;
            }

            rpio.write(pin, value);

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
            let pin = event.pin;
            let options;
            if (event.options == 'PIN_PRESERVE') {
                options = rpio.PIN_PRESERVE;
            } else {
                options = rpio.PIN_RESET;
            }
            rpio.close(pin, options);

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
    // PWM
    _rpioPWMSetClockDivider(simulation: Simulation, event: RpioPWMSetClockDividerAction) {
        try {
            rpio.pwmSetClockDivider(event.rate);
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
    _rpioPWMSetRange(simulation: Simulation, event: RpioPWMSetRangeAction) {
        try {
            rpio.pwmSetRange(event.pin, event.range);
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
    _rpioPWMSetData(simulation: Simulation, event: RpioPWMSetDataAction) {
        try {
            rpio.pwmSetData(event.pin, event.width);
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
    // SPI
    _rpioSPIBegin(simulation: Simulation, event: RpioSPIBeginAction) {
        try {
            rpio.spiBegin();
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
    _rpioSPIChipSelect(simulation: Simulation, event: RpioSPIChipSelectAction) {
        try {
            rpio.spiChipSelect(event.value);
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
    _rpioSPISetCSPolarity(simulation: Simulation, event: RpioSPISetCSPolarityAction) {
        try {
            var polarity;
            if (event.polarity == 'HIGH') {
                polarity = rpio.HIGH;
            } else if (event.polarity == 'LOW') {
                polarity = rpio.LOW;
            }
            rpio.spiSetCSPolarity(event.value, polarity);
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
    _rpioSPISetClockDivider(simulation: Simulation, event: RpioSPISetClockDividerAction) {
        try {
            rpio.spiSetClockDivider(event.rate);
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
    _rpioSPISetDataMode(simulation: Simulation, event: RpioSPISetDataModeAction) {
        try {
            rpio.spiSetDataMode(event.mode);
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
