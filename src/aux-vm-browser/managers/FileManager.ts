import {
    File,
    FileEvent,
    FilesState,
    Object,
    PartialFile,
    Workspace,
    action,
    fileChangeObservables,
    calculateActionEvents,
    addState,
    DEFAULT_USER_MODE,
    FileCalculationContext,
    AuxCausalTree,
    AuxFile,
    AuxObject,
    fileRemoved,
    UserMode,
    lerp,
    auxCausalTreeFactory,
    SimulationIdParseResult,
    parseSimulationId,
    SimulationIdParseSuccess,
    whitelistAllowsAccess,
    blacklistAllowsAccess,
    whitelistOrBlacklistAllowsAccess,
    isInUsernameList,
    getFileDesignerList,
    GLOBALS_FILE_ID,
    AuxOp,
} from '@casual-simulation/aux-common';
import { keys, union, values } from 'lodash';
import {
    BehaviorSubject,
    from,
    merge as mergeObservables,
    Observable,
    ReplaySubject,
    Subject,
    SubscriptionLike,
} from 'rxjs';
import {
    filter,
    map,
    startWith,
    first as rxFirst,
    flatMap,
    tap,
} from 'rxjs/operators';

import {
    User,
    FileHelper,
    FileWatcher,
    AuxVM,
    ConnectionManager,
    BaseSimulation,
} from '@casual-simulation/aux-vm';
import { SocketManager } from './SocketManager';
import { CausalTreeManager } from '@casual-simulation/causal-tree-client-socketio';
import {
    RealtimeCausalTree,
    StoredCausalTree,
} from '@casual-simulation/causal-trees';
import { LoadingProgress } from '@casual-simulation/aux-common/LoadingProgress';
import { LoadingProgressCallback } from '@casual-simulation/causal-trees';
import SelectionManager from './SelectionManager';
import { RecentFilesManager } from './RecentFilesManager';
import { ProgressStatus } from '@casual-simulation/causal-trees';
import { FilePanelManager } from './FilePanelManager';
import { BrowserSimulation } from './BrowserSimulation';
import { AuxVMImpl } from '../vm';

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit files.
 */
export class FileManager extends BaseSimulation implements BrowserSimulation {
    private _selection: SelectionManager;
    private _recent: RecentFilesManager;
    private _filePanel: FilePanelManager;

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

    constructor(
        user: User,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean }
    ) {
        super(user, id, config, config => new AuxVMImpl(config));

        this._selection = new SelectionManager(this._helper);
        this._recent = new RecentFilesManager(this._helper);
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
