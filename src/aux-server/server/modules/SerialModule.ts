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
    SerialStreamAction,
    SerialOpenAction,
    SerialUpdateAction,
    SerialWriteAction,
    SerialReadAction,
    SerialCloseAction,
    SerialFlushAction,
    SerialDrainAction,
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

// Make multiple btSerial devices?
let btSerial = new Map<string, typeof SerialPort>();

/**
 * Defines an AuxModule that adds Serial functionality to the module.
 */
export class SerialModule implements AuxModule2 {
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
                        if (event.type === 'serial_stream') {
                            await this._serialStream(simulation, event);
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
                        if (event.type === 'serial_flush') {
                            await this._serialFlush(simulation, event);
                        }
                        if (event.type === 'serial_drain') {
                            await this._serialDrain(simulation, event);
                        }
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

    _serialConnect(simulation: Simulation, event: SerialConnectAction) {
        try {
            // Complete the bluetooth connection before opening it up
            let jsond = '{"command":"connect","device":"' + event.device + '", "mac":"' + event.mac + '", "channel":"' + event.channel + '"}';
            let ip = execSync('ip route show | awk \'/default/ {print $3}\'').toString().trim();
            let curl_command = 'curl -H "Content-Type: application/json" -X POST -d \'' + jsond + '\' ' + ip + ':8090/post';

            execSync(curl_command);

            const port = new SerialPort(event.device, event.options);
            btSerial.set(event.name, port);

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
    _serialStream(simulation: Simulation, event: SerialStreamAction) {
        try {
            const port = btSerial.get(event.name);

            // Use a `\r\n` as a line terminator
            const parser = new parsers.Readline({
                delimiter: '\r\n',
            });

            port.pipe(parser);
            parser.on('data', (data: string) => {
                simulation.helper.shout('onSerialData', null, data);
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
    _serialOpen(simulation: Simulation, event: SerialOpenAction) {
        try {
            const port = btSerial.get(event.name);
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
            const port = btSerial.get(event.name);
            port.update(event.options, event.cb);

            btSerial.set(event.name, port);

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
            const port = btSerial.get(event.name);
            port.write(event.data, event.encoding, () => {
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
    _serialRead(simulation: Simulation, event: SerialReadAction) {
        try {
            const port = btSerial.get(event.name);
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
            // Send a command to kill the rfcomm process
            let jsond = '{"command":"disconnect","device":"' + event.device + '"}';
            let ip = execSync('ip route show | awk \'/default/ {print $3}\'').toString().trim();
            let curl_command = 'curl -H "Content-Type: application/json" -X POST -d \'' + jsond + '\' ' + ip + ':8090/post';

            execSync(curl_command);

            const port = btSerial.get(event.name);
            port.close(event.cb);
            port.on('close', () => {
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
    _serialFlush(simulation: Simulation, event: SerialFlushAction) {
        try {
            const port = btSerial.get(event.name);
            port.flush();

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
    _serialDrain(simulation: Simulation, event: SerialDrainAction) {
        try {
            const port = btSerial.get(event.name);
            port.drain();

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
    _serialPause(simulation: Simulation, event: SerialPauseAction) {
        try {
            const port = btSerial.get(event.name);
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
            const port = btSerial.get(event.name);
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
