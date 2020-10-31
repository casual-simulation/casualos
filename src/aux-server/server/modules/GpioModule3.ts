import { AuxModule2, Simulation } from '@casual-simulation/aux-vm';
import {
    DeviceInfo,
    remoteResult,
    remoteError,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import {
    SerialConnectAction,
    SerialOpenAction,
    SerialUpdateAction,
    SerialWriteAction,
    SerialReadAction,
    SerialCloseAction,
    // SerialSetAction,
    // SerialGetAction,
    // SerialFlushAction,
    // SerialDrainAction,
    SerialPauseAction,
    SerialResumeAction,
    asyncResult,
    asyncError,
    hasValue,
} from '@casual-simulation/aux-common';
import { Callback } from 'redis';
const execSync = require('child_process').execSync;
const SerialPort = require('serialport');
const parsers = SerialPort.parsers;

let btSerial = new Map<string, typeof SerialPort>();

/**
 * Defines an AuxModule that adds Serial functionality to the module.
 */
export class GpioModule3 implements AuxModule2 {
    constructor() {}

    setChannelManager() {}

    async setup(simulation: Simulation): Promise<Subscription> {
        let sub = new Subscription();

        sub.add(
            simulation.localEvents
                .pipe(
                    flatMap(async event => {
                        if (event.type === 'serial_connect') {
                            await this._serialConnect(simulation, event);
                        }
                        if (event.type === 'serial_open') {
                            await this._serialOpen(simulation, event);
                        }
                        if (event.type === 'serial_update') {
                            await this._serialUpdate(simulation, event);
                        }
                        if (event.type === 'serial_write') {
                            await this._serialWrite(simulation, event);
                        }
                        if (event.type === 'serial_read') {
                            await this._serialRead(simulation, event);
                        }
                        if (event.type === 'serial_close') {
                            await this._serialClose(simulation, event);
                        }
                        // if (event.type === 'serial_set') {
                        //     await this._serialSet(simulation, event);
                        // }
                        // if (event.type === 'serial_get') {
                        //     await this._serialGet(simulation, event);
                        // }
                        // if (event.type === 'serial_flush') {
                        //     await this._serialFlush(simulation, event);
                        // }
                        // if (event.type === 'serial_drain') {
                        //     await this._serialDrain(simulation, event);
                        // }
                        if (event.type === 'serial_pause') {
                            await this._serialPause(simulation, event);
                        }
                        if (event.type === 'serial_resume') {
                            await this._serialResume(simulation, event);
                        }
                    })
                )
                .subscribe()
        );
        return sub;
    }

    /**
     * everything needs a port passed to it after it's created
     *
     * create - port: any, path: string, options?: string[], cb?: any
     * open - port: any
     * update - port: any, options: string[], cb?: any
     * write - port: any, data: string|number[], encoding?: string, cb?: any
     * read - port: any, size?: number
     * close - port: any, cb?: any
     * set - port: any, options: setOptions(https://serialport.io/docs/api-stream#serialport-set)
     * get - port: any, ???
     * flush - port: any, cb?: any
     * drain - port: any, cb?: any
     * pause - port: any,
     * resume - port: any,
     * execSync - command: string, options?: object
     *
     */

    _serialConnect(simulation: Simulation, event: SerialConnectAction) {
        try {
            // Complete the bluetooth connection before opening it up
            execSync(
                'curl -X POST -H "Content-Type: text/plain" --data "connect" $(ip route show | awk \'/default/ {print $3}\'):8090/post'
            );

            // Use a `\r\n` as a line terminator
            const parser = new parsers.Readline({
                delimiter: '\r\n',
            });

            const port = new SerialPort(event.path, event.options, event.cb);
            btSerial.set('Connection01', port);

            port.pipe(parser);
            parser.on('data', console.log);

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
    _serialOpen(simulation: Simulation, event: SerialOpenAction) {
        try {
            const port = btSerial.get('Connection01');
            port.open();
            port.on('open', () => {
                simulation.helper.transaction(
                    hasValue(event.playerId)
                        ? remoteResult(
                              undefined,
                              { sessionId: event.playerId },
                              event.taskId
                          )
                        : asyncResult(event.taskId, undefined)
                );
            });
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
    _serialUpdate(simulation: Simulation, event: SerialUpdateAction) {
        try {
            const port = btSerial.get('Connection01');
            port.update(event.options, event.cb);

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
    _serialWrite(simulation: Simulation, event: SerialWriteAction) {
        try {
            const port = btSerial.get('Connection01');
            port.write(event.data, event.encoding, event.cb);

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
    _serialRead(simulation: Simulation, event: SerialReadAction) {
        try {
            const port = btSerial.get('Connection01');
            let data = port.read(event.size);

            simulation.helper.transaction(
                hasValue(event.playerId)
                    ? remoteResult(
                          data,
                          { sessionId: event.playerId },
                          event.taskId
                      )
                    : asyncResult(event.taskId, data)
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
    _serialClose(simulation: Simulation, event: SerialCloseAction) {
        try {
            const port = btSerial.get('Connection01');
            port.close(event.cb);

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
    // _serialSet(simulation: Simulation, event: SerialSetAction) {
    //     try {

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
    // _serialGet(simulation: Simulation, event: SerialGetAction) {
    //     try {

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
    // _serialFlush(simulation: Simulation, event: SerialFlushAction) {
    //     try {

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
    // _serialDrain(simulation: Simulation, event: SerialDrainAction) {
    //     try {

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
    _serialPause(simulation: Simulation, event: SerialPauseAction) {
        try {
            const port = btSerial.get('Connection01');
            port.pause();

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
    _serialResume(simulation: Simulation, event: SerialResumeAction) {
        try {
            const port = btSerial.get('Connection01');
            port.resume();

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
