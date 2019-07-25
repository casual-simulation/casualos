import { File, UserMode } from '@casual-simulation/aux-common';

import {
    AuxUser,
    AuxVM,
    BaseSimulation,
    LoginManager,
} from '@casual-simulation/aux-vm';
import SelectionManager from './SelectionManager';
import { RecentFilesManager } from './RecentFilesManager';
import { FilePanelManager } from './FilePanelManager';
import { BrowserSimulation } from './BrowserSimulation';
import { AuxVMImpl } from '../vm/AuxVMImpl';
import { ProgressManager } from '@casual-simulation/aux-vm/managers';

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit files.
 */
export class FileManager extends BaseSimulation implements BrowserSimulation {
    private _selection: SelectionManager;
    private _recent: RecentFilesManager;
    private _filePanel: FilePanelManager;
    private _login: LoginManager;
    private _progress: ProgressManager;

    /**
     * Gets all the selected files that represent an object.
     */
    get selectedObjects(): File[] {
        return this.selection.getSelectedFilesForUser(this.helper.userFile);
    }

    /**
     * Gets the selection manager.
     */
    get selection() {
        return this._selection;
    }

    /**
     * Gets the recent files manager.
     */
    get recent() {
        return this._recent;
    }

    /**
     * Gets the files panel manager.
     */
    get filePanel() {
        return this._filePanel;
    }

    get login() {
        return this._login;
    }

    get progress() {
        return this._progress;
    }

    constructor(
        user: AuxUser,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean }
    ) {
        super(id, config, config => new AuxVMImpl(user, config));
        this.helper.userId = user ? user.id : null;

        this._selection = new SelectionManager(this._helper);
        this._recent = new RecentFilesManager(this._helper);
        this._login = new LoginManager(this._vm);
        this._progress = new ProgressManager(this._vm);
    }

    /**
     * Sets the file mode that the user should be in.
     * @param mode The mode that the user should use.
     */
    setUserMode(mode: UserMode) {
        return this.helper.updateFile(this.helper.userFile, {
            tags: {
                'aux._mode': mode,
            },
        });
    }

    protected _initManagers() {
        super._initManagers();
        this._filePanel = new FilePanelManager(
            this._watcher,
            this._helper,
            this._selection,
            this._recent
        );
    }
}
