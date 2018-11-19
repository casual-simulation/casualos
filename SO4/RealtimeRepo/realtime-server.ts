import { Express } from 'express';
import * as SocketIO from 'socket.io';
import * as HttpProxy from 'http-proxy';
import Axios from 'axios';
import { asyncMiddleware } from '../utils';

/**
 * Defines a set of possible config properties for a realtime git server.
 */
export interface Config {
    proxy: HttpProxy.ServerOptions;
    gitlab_server: string;
    personal_access_token: string;
}

interface GitlabUser {
    id: number,
    username: string,
    name: string,
    state: string,
    avatar_url: string,
    web_url: string,
    created_at: string,
    bio: string | null,
    location: string | null,
    public_email: string,
    skype: string | null,
    linkedin: string | null,
    twitter: string | null,
    website_url: string | null,
    organization: string | null
}

/**
 * Defines a class which is able to configure and start a realtime git server.
 * The server proxies connections on /git to a Gitlab server that runs at http://localhost:4330/git
 * and provides some convenient socket.io messaging capabilities.
 */
export class RealtimeServer {

    private _proxy: HttpProxy;
    private _gitlab_server: string;
    private _personal_access_token: string;

    constructor(config: Config) {
        this._proxy = HttpProxy.createProxyServer(config.proxy);
        this._gitlab_server = config.gitlab_server;
        this._personal_access_token = config.personal_access_token;
    }

    private _url(api: string): string {
        return `${this._gitlab_server}/api/v4/${api}?private_token=${this._personal_access_token}`;
    }

    /**
     * Configures the given express app.
     */
    configure(app: Express, socket: SocketIO.Server) {
        app.use('/git', (req, res) => {
            this._proxy.web(req, res, {
                target: this._gitlab_server
            });
        });

        app.post('/api/users', asyncMiddleware(async (req, res) => {
            const json = req.body;
            const gitlabUsersResponse = await Axios.get(this._url('users'));

            const gitlabUsers: GitlabUser[] = gitlabUsersResponse.data;

            const usersWithMatchingName = gitlabUsers.filter(u => u.public_email === json.email);
            if (usersWithMatchingName.length <= 0) {
                // Create user

                const username = json.email.split('@')[0];

                const gitlabCreateUserResponse = await Axios.post(this._url('users'), {
                    email: json.email,
                    password: 'buggycar',
                    username: username,
                    name: username,
                    public_email: json.email,
                });
                const user: GitlabUser = gitlabCreateUserResponse.data;

                res.send({
                    id: user.id,
                    email: user.public_email,
                    username: user.username,
                    name: user.name
                });

            } else {
                // User already exists
                const user = usersWithMatchingName[0];
                res.send({
                    id: user.id,
                    email: user.public_email,
                    username: user.username,
                    name: user.name
                });
            }
        }));

        socket.on('connection', (socket) => {
            console.log("[RealtimeServer] User connected to socket.");

            socket.on('disconnect', (reason) => {
                console.log("[RealtimeServer] User disconnected from socket:", reason);
            });
        });
    }
}