import { Express } from 'express';
import * as SocketIO from 'socket.io';
import * as HttpProxy from 'http-proxy';

/**
 * Defines a set of possible config properties for a realtime git server.
 */
export interface Config {
    proxy: HttpProxy.ServerOptions;
}

/**
 * Defines a class which is able to configure and start a realtime git server.
 * The server proxies connections on /git to a Gitlab server that runs at http://localhost:4330/git
 * and provides some convenient socket.io messaging capabilities.
 */
export class RealtimeServer {

    private _proxy: HttpProxy;

    constructor(config: Config) {
        this._proxy = HttpProxy.createProxyServer(config.proxy);
    }

    /**
     * Configures the given express app.
     */
    configure(app: Express, socket: SocketIO.Server) {
        app.use('/git', (req, res) => {
            this._proxy.web(req, res, {
                target: 'http://localhost:4330/git'
            });
        });

        socket.on('connection', (socket) => {
            console.log("[RealtimeServer] User connected to socket.");
            
            socket.on('disconnect', (reason) => {
                console.log("[RealtimeServer] User disconnected from socket:", reason);
            });
        });
    }
}