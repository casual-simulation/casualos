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
    RpioReadpadAction,
    RpioWritepadAction,
    RpioPudAction,
    RpioPollAction,
    RpioCloseAction,
    RpioI2CBeginAction,
    RpioI2CSetSlaveAddressAction,
    RpioI2CSetBaudRateAction,
    RpioI2CSetClockDividerAction,
    RpioI2CReadAction,
    RpioI2CWriteAction,
    // RpioI2CReadRegisterRestartAction,
    // RpioI2CWriteReadRestartAction,
    RpioI2CEndAction,
    RpioPWMSetClockDividerAction,
    RpioPWMSetRangeAction,
    RpioPWMSetDataAction,
    RpioSPIBeginAction,
    RpioSPIChipSelectAction,
    RpioSPISetCSPolarityAction,
    RpioSPISetClockDividerAction,
    RpioSPISetDataModeAction,
    RpioSPITransferAction,
    RpioSPIWriteAction,
    RpioSPIEndAction,
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
                        if (event.type === 'rpio_read_sequence') {
                            // Read Buffer
                            await this._rpioReadSequence(simulation, event);
                        }
                        if (event.type === 'rpio_write') {
                            await this._rpioWrite(simulation, event);
                        }
                        if (event.type === 'rpio_write_sequence') {
                            // Write Buffer
                            await this._rpioWriteSequence(simulation, event);
                        }
                        if (event.type === 'rpio_readpad') {
                            await this._rpioReadpad(simulation, event);
                        }
                        if (event.type === 'rpio_writepad') {
                            await this._rpioWritepad(simulation, event);
                        }
                        if (event.type === 'rpio_pud') {
                            await this._rpioPud(simulation, event);
                        }
                        if (event.type === 'rpio_poll') {
                            await this._rpioPoll(simulation, event);
                        }
                        if (event.type === 'rpio_close') {
                            await this._rpioClose(simulation, event);
                        }
                        // i2c
                        if (event.type === 'rpio_i2c_begin') {
                            await this._rpioI2CBegin(simulation, event);
                        }
                        if (event.type === 'rpio_i2c_setslaveaddress') {
                            await this._rpioI2CSetSlaveAddress(
                                simulation,
                                event
                            );
                        }
                        if (event.type === 'rpio_i2c_setbaudrate') {
                            await this._rpioI2CSetBaudRate(simulation, event);
                        }
                        if (event.type === 'rpio_i2c_setclockdivider') {
                            await this._rpioI2CSetClockDivider(
                                simulation,
                                event
                            );
                        }
                        if (event.type === 'rpio_i2c_read') {
                            await this._rpioI2CRead(simulation, event);
                        }
                        if (event.type === 'rpio_i2c_write') {
                            await this._rpioI2CWrite(simulation, event);
                        }
                        // if (event.type === 'rpio_i2c_readregisterrestart') {
                        //     await this._rpioI2CReadRegisterRestart(simulation, event);
                        // }
                        // if (event.type === 'rpio_i2c_writereadrestart') {
                        //     await this._rpioI2CWriteReadRestart(simulation, event);
                        // }
                        if (event.type === 'rpio_i2c_end') {
                            await this._rpioI2CEnd(simulation, event);
                        }
                        // PWM
                        if (event.type === 'rpio_pwm_setclockdivider') {
                            await this._rpioPWMSetClockDivider(
                                simulation,
                                event
                            );
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
                            await this._rpioSPISetClockDivider(
                                simulation,
                                event
                            );
                        }
                        if (event.type === 'rpio_spi_setdatamode') {
                            await this._rpioSPISetDataMode(simulation, event);
                        }
                        if (event.type === 'rpio_spi_transfer') {
                            await this._rpioSPITransfer(simulation, event);
                        }
                        if (event.type === 'rpio_spi_write') {
                            await this._rpioSPIWrite(simulation, event);
                        }
                        if (event.type === 'rpio_spi_end') {
                            await this._rpioSPIEnd(simulation, event);
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
    _rpioReadpad(simulation: Simulation, event: RpioReadpadAction) {
        try {
            var group;
            var control;
            var result;
            if (event.group == 'PAD_GROUP_0_27') {
                group = rpio.PAD_GROUP_0_27;
                control = rpio.readpad(group);
            } else if (event.group == 'PAD_GROUP_28_45') {
                group = rpio.PAD_GROUP_28_45;
                control = rpio.readpad(group);
            } else if (event.group == 'PAD_GROUP_46_53') {
                group = rpio.PAD_GROUP_46_53;
                control = rpio.readpad(group);
            }

            var slew =
                (control & rpio.PAD_SLEW_UNLIMITED) == rpio.PAD_SLEW_UNLIMITED;
            var hysteresis =
                (control & rpio.PAD_HYSTERESIS) == rpio.PAD_HYSTERESIS;
            var current = control & 0x7;

            if (event.bitmask == 'slew') {
                if (slew) {
                    result = true;
                } else {
                    result = false;
                }
            }
            if (event.bitmask == 'hysteresis') {
                if (hysteresis) {
                    result = true;
                } else {
                    result = false;
                }
            }
            if (event.bitmask == 'current') {
                result = current * 2 + 2;
            }
            simulation.helper.transaction(
                hasValue(event.playerId)
                    ? remoteResult(
                          result,
                          { sessionId: event.playerId },
                          event.taskId
                      )
                    : asyncResult(event.taskId, result)
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
    _rpioWritepad(simulation: Simulation, event: RpioWritepadAction) {
        try {
            var group;
            var control;
            if (event.group == 'PAD_GROUP_0_27') {
                group = rpio.PAD_GROUP_0_27;
                control = rpio.readpad(group);
            } else if (event.group == 'PAD_GROUP_28_45') {
                group = rpio.PAD_GROUP_28_45;
                control = rpio.readpad(group);
            } else if (event.group == 'PAD_GROUP_46_53') {
                group = rpio.PAD_GROUP_46_53;
                control = rpio.readpad(group);
            }

            if (event.slew == true) {
                control &= rpio.PAD_SLEW_UNLIMITED;
            } else {
                control &= ~rpio.PAD_SLEW_UNLIMITED;
            }

            if (event.hysteresis == true) {
                control &= rpio.PAD_HYSTERESIS;
            } else {
                control &= ~rpio.PAD_HYSTERESIS;
            }

            if (event.current == 2) {
                control &= rpio.PAD_DRIVE_2mA;
            } else if (event.current == 4) {
                control &= rpio.PAD_DRIVE_4mA;
            } else if (event.current == 6) {
                control &= rpio.PAD_DRIVE_6mA;
            } else if (event.current == 8) {
                control &= rpio.PAD_DRIVE_8mA;
            } else if (event.current == 10) {
                control &= rpio.PAD_DRIVE_10mA;
            } else if (event.current == 12) {
                control &= rpio.PAD_DRIVE_12mA;
            } else if (event.current == 14) {
                control &= rpio.PAD_DRIVE_14mA;
            } else if (event.current == 16) {
                control &= rpio.PAD_DRIVE_16mA;
            }

            rpio.writepad(group, control);
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
    _rpioPud(simulation: Simulation, event: RpioPudAction) {
        try {
            var state;
            if (event.state == 'PULL_OFF') {
                state = rpio.PULL_OFF;
            } else if (event.state == 'PULL_DOWN') {
                state = rpio.PULL_DOWN;
            } else if (event.state == 'PULL_UP') {
                state = rpio.PULL_UP;
            }
            rpio.pud(event.pin, state);
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
    _rpioPoll(simulation: Simulation, event: RpioPollAction) {
        try {
            var options;
            if (event.options == 'POLL_LOW') {
                options = rpio.POLL_LOW;
            } else if (event.options == 'POLL_HIGH') {
                options = rpio.POLL_HIGH;
            } else if (event.options == 'POLL_BOTH') {
                options = rpio.POLL_BOTH;
            }
            rpio.poll(event.pin, event.cb, options);
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
    // i2c
    _rpioI2CBegin(simulation: Simulation, event: RpioI2CBeginAction) {
        try {
            rpio.i2cBegin();
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
    _rpioI2CSetSlaveAddress(
        simulation: Simulation,
        event: RpioI2CSetSlaveAddressAction
    ) {
        try {
            rpio.i2cSetSlaveAddress(event.address);
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
    _rpioI2CSetBaudRate(
        simulation: Simulation,
        event: RpioI2CSetBaudRateAction
    ) {
        try {
            rpio.i2cSetBaudRate(event.rate);
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
    _rpioI2CSetClockDivider(
        simulation: Simulation,
        event: RpioI2CSetClockDividerAction
    ) {
        try {
            rpio.i2cSetClockDivider(event.rate);
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
    _rpioI2CRead(simulation: Simulation, event: RpioI2CReadAction) {
        try {
            let rx = new Buffer(event.rx);
            rpio.i2cRead(rx, event.length);
            let array = [...rx.values()];
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
    _rpioI2CWrite(simulation: Simulation, event: RpioI2CWriteAction) {
        try {
            let tx = Buffer.from(event.tx);
            rpio.i2cWrite(tx, event.length);
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
    // _rpioI2CReadRegisterRestart(simulation: Simulation, event: RpioI2CReadRegisterRestartAction) {
    //     try {
    //         rpio.i2cReadRegisterRestart();
    //         simulation.helper.transaction(
    //             hasValue(event.playerId)
    //                 ? remoteResult(
    //                       undefined,
    //                       { sessionId: event.playerId },
    //                       event.taskId
    //                   )
    //                 : asyncResult(event.taskId, undefined)
    //         );
    //     } catch (error) {
    //         simulation.helper.transaction(
    //             hasValue(event.playerId)
    //                 ? remoteError(
    //                       {
    //                           error: 'failure',
    //                           exception: error.toString(),
    //                       },
    //                       { sessionId: event.playerId },
    //                       event.taskId
    //                   )
    //                 : asyncError(event.taskId, error)
    //         );
    //     }
    // }
    // _rpioI2CWriteReadRestart(simulation: Simulation, event: RpioI2CWriteReadRestartAction) {
    //     try {
    //         rpio.i2cWriteReadRestart();
    //         simulation.helper.transaction(
    //             hasValue(event.playerId)
    //                 ? remoteResult(
    //                       undefined,
    //                       { sessionId: event.playerId },
    //                       event.taskId
    //                   )
    //                 : asyncResult(event.taskId, undefined)
    //         );
    //     } catch (error) {
    //         simulation.helper.transaction(
    //             hasValue(event.playerId)
    //                 ? remoteError(
    //                       {
    //                           error: 'failure',
    //                           exception: error.toString(),
    //                       },
    //                       { sessionId: event.playerId },
    //                       event.taskId
    //                   )
    //                 : asyncError(event.taskId, error)
    //         );
    //     }
    // }
    _rpioI2CEnd(simulation: Simulation, event: RpioI2CEndAction) {
        try {
            rpio.i2cEnd();
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
    _rpioPWMSetClockDivider(
        simulation: Simulation,
        event: RpioPWMSetClockDividerAction
    ) {
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
    _rpioSPISetCSPolarity(
        simulation: Simulation,
        event: RpioSPISetCSPolarityAction
    ) {
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
    _rpioSPISetClockDivider(
        simulation: Simulation,
        event: RpioSPISetClockDividerAction
    ) {
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
    _rpioSPISetDataMode(
        simulation: Simulation,
        event: RpioSPISetDataModeAction
    ) {
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
    _rpioSPITransfer(simulation: Simulation, event: RpioSPITransferAction) {
        try {
            let tx = Buffer.from(event.tx);
            let rx = new Buffer(tx.length);
            rpio.spiTransfer(tx, rx, tx.length);
            let array = [...rx.values()];
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
    _rpioSPIWrite(simulation: Simulation, event: RpioSPIWriteAction) {
        try {
            let tx = Buffer.from(event.tx);
            rpio.spiWrite(tx, tx.length);
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
    _rpioSPIEnd(simulation: Simulation, event: RpioSPIEndAction) {
        try {
            rpio.spiEnd();
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
