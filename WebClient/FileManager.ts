
import {SubscriptionLike} from 'rxjs';

import {AppManager, appManager} from './AppManager';
import {CreateFileEvent, fileCreated} from './Core/Event';
import {GitManager, gitManager} from './GitManager';

/**
 * Defines a class that interfaces with the AppManager and GitManager
 * to reactively edit files.
 */
export class FileManager {
  private _gitManager: GitManager;
  private _appManager: AppManager;

  // TODO: Dispose of the subscription
  private _sub: SubscriptionLike;

  constructor(app: AppManager, git: GitManager) {
    this._appManager = app;
    this._gitManager = git;
  }

  init() {
    this._sub = this._appManager.events.subscribe(event => {
      if (event.type === 'create_file') {
        this.createFile(event);
      }
    });
  }

  async createFile(event: CreateFileEvent) {
    console.log('[FileManager] Create File');

    const file = this._gitManager.createNewFile();
    await this._gitManager.saveFile(file);

    this._appManager.events.next(fileCreated(file));
  }
}

export const fileManager = new FileManager(appManager, gitManager);