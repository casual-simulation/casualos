import { Express } from 'express';
import * as SocketIO from 'socket.io';
import * as HttpProxy from 'http-proxy';
import Axios, { AxiosError } from 'axios';
import { asyncMiddleware } from '../utils';
import { config } from 'bluebird';

/**
 * Defines a set of possible config properties for a realtime git server.
 */
export interface Config {
    proxy: HttpProxy.ServerOptions;
    gitlab_server: string;
    personal_access_token: string;
    default_project: ConfigProject;
    user: ConfigUser
    admin_username: string;
}

export interface ConfigProject {
    namespace: string;
    name: string;
}

export interface ConfigUser {
    email: string,
    name: string
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

export enum GitlabAccessLevels {
    Guest = 10,
    Reporter = 20,
    Developer = 30,
    Maintainer = 40,
    Owner = 50
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
    private _default_project: ConfigProject;
    private _git_user : ConfigUser;
    private _admin_username: string;

    constructor(config: Config) {
        this._proxy = HttpProxy.createProxyServer(config.proxy);
        this._gitlab_server = config.gitlab_server;
        this._personal_access_token = config.personal_access_token;
        this._default_project = config.default_project;
        this._git_user = config.user;
        this._admin_username = config.admin_username;
    }

    private _url(...api: string[]): string {
        return `${this._gitlab_server}/api/v4/${api.map(x => encodeURIComponent(x)).join('/')}?private_token=${this._personal_access_token}`;
    }

    private get defaultProject(): string {
        return `${this._default_project.namespace}/${this._default_project.name}`
    }

    private async _createDefaultProject(rootUser: GitlabUser) : Promise<any> {
        console.log('[RealtimeServer] Checking for default project', this._default_project, '...');
        try {
            const gitlabGetProjectResponse = await Axios.get(this._url('projects', this.defaultProject));
            
            console.log('[RealtimeServer] Default project exists');
            
        } catch(er) {
            const err: AxiosError = er;
            if(err.response && err.response.status === 404) {
                console.log('[RealtimeServer] Default project doesn\'t exist. Creating it...');

                const gitlabCreateProjectResponse = await Axios.post(this._url('projects', 'user', rootUser.id.toString()), {
                    name: this._default_project.name,
                    visibility: 'public'
                });

                console.log('RealtimeServer] Project created. Adding first commit...');

                const gitlabAddFileResponse = await Axios.post(this._url('projects', this.defaultProject, 'repository', 'files', '.gitkeep'), {
                    branch: 'master',
                    author_email: this._git_user.email,
                    author_name: this._git_user.name,
                    content: '',
                    commit_message: 'Initial Commit'
                });

                console.log('[RealtimeServer] Added initial commit.')

            } else {
                throw er;
            }
        }
    }

    private async _addUserToProject(user: GitlabUser): Promise<any> {
        console.log(`[RealtimeServer] Adding user ${user.public_email} to default project...`);

        const gitlabAddUserToProjectResponse = await Axios.post(this._url('projects', this.defaultProject, 'members'), {
            user_id: user.id,
            access_level: GitlabAccessLevels.Maintainer
        });

        console.log('[RealtimeServer] User added to project.');
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

            console.log('[RealtimeServer] Getting user', json.email);
            const gitlabUsersResponse = await Axios.get(this._url('users'));
            const gitlabUsers: GitlabUser[] = gitlabUsersResponse.data;
            const rootUser = gitlabUsers.filter(u => u.username === this._admin_username)[0];
            if(!rootUser) {
                throw new Error('Root user could not be found.');
            }

            const usersWithMatchingName = gitlabUsers.filter(u => u.public_email === json.email);
            if (usersWithMatchingName.length <= 0) {
                // Create user

                const username = json.email.split('@')[0];

                console.log('[RealtimeServer] User does not exist. Creating', username, '...');

                const gitlabCreateUserResponse = await Axios.post(this._url('users'), {
                    email: json.email,
                    password: 'buggycar',
                    username: username,
                    name: username,
                    public_email: json.email,
                });

                await this._createDefaultProject(rootUser);

                const user: GitlabUser = gitlabCreateUserResponse.data;

                await this._addUserToProject(user);

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

        // socket.on('connection', (user) => {
        //     console.log("[RealtimeServer] User connected to socket.");

        //     user.on('event', (event) => {
        //         user.broadcast.emit('event', event);
        //     });

        //     user.on('disconnect', (reason) => {
        //         console.log("[RealtimeServer] User disconnected from socket:", reason);
        //     });
        // });
    }
}