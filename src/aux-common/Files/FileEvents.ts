import { PartialFile, FilesState, File } from './File';
import {
    Event,
    DeviceEvent,
    RemoteEvent,
} from '@casual-simulation/causal-trees';

/**
 * Defines a union type for all the possible events that can be emitted from a files channel.
 */
export type FileEvent =
    | FileAddedEvent
    | FileRemovedEvent
    | FileUpdatedEvent
    | FileTransactionEvent
    | ApplyStateEvent
    | Action
    | PasteStateEvent
    | LocalEvents
    | RemoteEvent
    | DeviceEvent;

/**
 * Defines a set of possible local event types.
 */
export type LocalEvents =
    | ShowToastEvent
    | TweenToEvent
    | OpenQRCodeScannerEvent
    | ShowQRCodeEvent
    | LoadSimulationEvent
    | UnloadSimulationEvent
    | SuperShoutEvent
    | GoToContextEvent
    | GoToURLEvent
    | OpenURLEvent
    | ImportAUXEvent
    | ShowInputForTagEvent
    | SetForcedOfflineEvent
    | SayHelloEvent
    | GrantRoleEvent
    | RevokeRoleEvent
    | ShellEvent
    | OpenConsoleEvent
    | EchoEvent
    | DownloadEvent
    | BackupToGithubEvent
    | BackupAsDownloadEvent;

/**
 * Defines a file event that indicates a file was added to the state.
 */
export interface FileAddedEvent extends Event {
    type: 'file_added';
    id: string;
    file: File;
}

/**
 * Defines a file event that indicates a file was removed from the state.
 */
export interface FileRemovedEvent extends Event {
    type: 'file_removed';
    id: string;
}

/**
 * Defines a file event that indicates a file was updated.
 */
export interface FileUpdatedEvent extends Event {
    type: 'file_updated';
    id: string;
    update: PartialFile;
}

/**
 * A set of file events in one.
 */
export interface FileTransactionEvent extends Event {
    type: 'transaction';
    events: FileEvent[];
}

/**
 * An event to apply some generic FilesState to the current state.
 * This is useful when you have some generic file state and want to just apply it to the
 * current state. An example of doing this is from the automatic merge system.
 */
export interface ApplyStateEvent extends Event {
    type: 'apply_state';
    state: FilesState;
}

/**
 * The options for pasting files state into a channel.
 */
export interface PasteStateOptions {
    /**
     * The context that the state should be pasted into.
     */
    context?: string;

    /**
     * The X position that the state should be pasted at.
     * If a context is provided then this is the X position inside the context.
     * If a context is not provided then this is the X position that the new context should be created at.
     */
    x: number;

    /**
     * The Y position that the state should be pasted at.
     * If a context is provided then this is the Y position inside the context.
     * If a context is not provided then this is the Y position that the new context should be created at.
     */
    y: number;

    /**
     * The Z position that the state should be pasted at.
     * If a context is provided then this is the Z position inside the context.
     * If a context is not provided then this is the Z position that the new context should be created at.
     */
    z: number;
}

/**
 * An event to paste the given files state as a new worksurface at a position.
 */
export interface PasteStateEvent extends Event {
    type: 'paste_state';
    state: FilesState;

    /**
     * The options for the event.
     */
    options: PasteStateOptions;
}

/**
 * An event that is used as a way to communicate local changes from script actions to the interface.
 * For example, showing a toast message is a local event.
 */
export interface LocalEvent extends Event {
    type: 'local';
}

/**
 * An event that is used to print a "hello" message.
 */
export interface SayHelloEvent extends LocalEvent {
    name: 'say_hello';
}

/**
 * An event that is used to request that a message is sent back to you.
 */
export interface EchoEvent extends LocalEvent {
    name: 'echo';

    /**
     * The message.
     */
    message: string;
}

/**
 * An event that is used to request that the server be backed up to github.
 */
export interface BackupToGithubEvent extends LocalEvent {
    name: 'backup_to_github';

    /**
     * The authentication key to use.
     */
    auth: string;

    /**
     * The options that should be used for backing up.
     */
    options?: BackupOptions;
}

/**
 * An event that is used to request that the server be backed up to a zip file and downloaded.
 */
export interface BackupAsDownloadEvent extends LocalEvent {
    name: 'backup_as_download';

    /**
     * The options that should be used for backing up.
     */
    options?: BackupOptions;
}

/**
 * Defines the list of possible options for backing up a server.
 */
export interface BackupOptions {
    /**
     * Whether to include archived atoms.
     */
    includeArchived?: boolean;
}

/**
 * An event that is used to grant a role to a user.
 */
export interface GrantRoleEvent extends LocalEvent {
    name: 'grant_role';

    /**
     * The role to grant.
     */
    role: string;

    /**
     * The username of the user that the role should be granted to.
     */
    username: string;

    /**
     * The token that should be used to authorize the operation.
     */
    grant?: string;
}

/**
 * An event that is used to remove a role from a user.
 */
export interface RevokeRoleEvent extends LocalEvent {
    name: 'revoke_role';

    /**
     * The role to revoke.
     */
    role: string;

    /**
     * The username of the user that the role should be removed from.
     */
    username: string;

    /**
     * The token that should be used to authorize the operation.
     */
    grant?: string;
}

/**
 * An event that is used to run a shell script.
 */
export interface ShellEvent extends LocalEvent {
    name: 'shell';

    /**
     * The script that should be run.
     */
    script: string;
}

/**
 * An event that is used to show a toast message to the user.
 */
export interface ShowToastEvent extends LocalEvent {
    name: 'show_toast';
    message: string;
}

/**
 * An event that is used to tween the camera to the given file's location.
 */
export interface TweenToEvent extends LocalEvent {
    name: 'tween_to';

    /**
     * The ID of the file to tween to.
     */
    fileId: string;

    /*
     * The zoom value to use.
     */
    zoomValue: number;

    /*
     * The rotation spherical value to use.
     */
    rotationValue: {
        x: number;
        y: number;
    };
}

/**
 * An event that is used to show or hide the QR Code Scanner.
 */
export interface OpenQRCodeScannerEvent extends LocalEvent {
    name: 'show_qr_code_scanner';

    /**
     * Whether the QR Code scanner should be visible.
     */
    open: boolean;
}

/**
 * An event that is used to toggle whether the console is open.
 */
export interface OpenConsoleEvent extends LocalEvent {
    name: 'open_console';

    /**
     * Whether the console should be open.
     */
    open: boolean;
}

/**
 * An event that is used to show or hide a QR Code on screen.
 */
export interface ShowQRCodeEvent extends LocalEvent {
    name: 'show_qr_code';

    /**
     * Whether the QR Code should be visible.
     */
    open: boolean;

    /**
     * The code to display.
     */
    code: string;
}

/**
 * An event that is used to load a simulation.
 */
export interface LoadSimulationEvent extends LocalEvent {
    name: 'load_simulation';

    /**
     * The ID of the simulation to load.
     */
    id: string;
}

/**
 * An event that is used to unload a simulation.
 */
export interface UnloadSimulationEvent extends LocalEvent {
    name: 'unload_simulation';

    /**
     * The ID of the simulation to unload.
     */
    id: string;
}

/**
 * An event that is used to load an AUX from a remote location.
 */
export interface ImportAUXEvent extends LocalEvent {
    name: 'import_aux';

    /**
     * The URL to load.
     */
    url: string;
}

/**
 * Defines an event for actions that are shouted to every current loaded simulation.
 */
export interface SuperShoutEvent extends LocalEvent {
    name: 'super_shout';

    /**
     * The name of the event.
     */
    eventName: string;

    /**
     * The argument to pass as the "that" variable to scripts.
     */
    argument?: any;
}

/**
 * Defines an event that is used to send the player to a context.
 */
export interface GoToContextEvent extends LocalEvent {
    name: 'go_to_context';

    /**
     * The context that should be loaded.
     */
    context: string;
}

/**
 * Defines an event that is used to show an input box to edit a tag on a file.
 */
export interface ShowInputForTagEvent extends LocalEvent {
    name: 'show_input_for_tag';

    /**
     * The ID of the file to edit.
     */
    fileId: string;

    /**
     * The tag that should be edited on the file.
     */
    tag: string;

    /**
     * The options for the input box.
     */
    options: Partial<ShowInputOptions>;
}

/**
 * Defines an event that is used to set whether the connection is forced to be offline.
 */
export interface SetForcedOfflineEvent extends LocalEvent {
    name: 'set_offline_state';

    /**
     * Whether the connection should be offline.
     */
    offline: boolean;
}

/**
 * Defines an event that is used to redirect the user to the given URL.
 * This should be equivalent to clicking a link with rel="noreferrer".
 */
export interface GoToURLEvent extends LocalEvent {
    name: 'go_to_url';

    /**
     * The URL to open.
     */
    url: string;
}

/**
 * Defines an event that is used to open the given URL.
 * This should be equivalent to clicking a link with rel="noreferrer" and target="_blank".
 */
export interface OpenURLEvent extends LocalEvent {
    name: 'open_url';

    /**
     * The URL to open.
     */
    url: string;
}

/**
 * Defines an event that is used to download a file onto the device.
 */
export interface DownloadEvent extends LocalEvent {
    name: 'download';

    /**
     * The data that should be included in the downloaded file.
     */
    data: any;

    /**
     * The name of the downloaded file. (includes the extension)
     */
    filename: string;

    /**
     * The MIME type of the downloaded file.
     */
    mimeType: string;
}

/**
 * Defines an interface for options that a show input event can use.
 */
export interface ShowInputOptions {
    /**
     * The type of input box to show.
     */
    type: ShowInputType;

    /**
     * The subtype of input box to show.
     */
    subtype: ShowInputSubtype;

    /**
     * The title that should be used for the input.
     */
    title: string;

    /**
     * The placeholder for the value.
     */
    placeholder: string;

    /**
     * The background color to use.
     */
    backgroundColor: string;

    /**
     * The foreground color to use.
     */
    foregroundColor: string;
}

/**
 * Defines the possible input types.
 */
export type ShowInputType = 'text' | 'color';

/**
 * Defines the possible input types.
 */
export type ShowInputSubtype = 'basic' | 'swatch' | 'advanced';

/**
 * Defines an event for actions.
 * Actions are basically user-defined events.
 */
export interface Action {
    type: 'action';

    /**
     * The IDs of the files that the event is being sent to.
     * If null, then the action is sent to every file.
     */
    fileIds: string[] | null;

    /**
     * The File ID of the user.
     */
    userId: string | null;

    /**
     * The name of the event.
     */
    eventName: string;

    /**
     * The argument to pass as the "that" variable to scripts.
     */
    argument?: any;

    /**
     * Whether the File IDs should be sorted before processing.
     */
    sortFileIds?: boolean;
}

/**
 * Creates a new FileAddedEvent.
 * @param file The file that was added.
 */
export function fileAdded(file: File): FileAddedEvent {
    return {
        type: 'file_added',
        id: file.id,
        file: file,
    };
}

/**
 * Creates a new FileRemovedEvent.
 * @param fileId The ID of the file that was removed.
 */
export function fileRemoved(fileId: string): FileRemovedEvent {
    return {
        type: 'file_removed',
        id: fileId,
    };
}

/**
 * Creates a new FileUpdatedEvent.
 * @param id The ID of the file that was updated.
 * @param update The update that was applied to the file.
 */
export function fileUpdated(id: string, update: PartialFile): FileUpdatedEvent {
    return {
        type: 'file_updated',
        id: id,
        update: update,
    };
}

/**
 * Creates a new FileTransactionEvent.
 * @param events The events to contain in the transaction.
 */
export function transaction(events: FileEvent[]): FileTransactionEvent {
    return {
        type: 'transaction',
        events: events,
    };
}

/**
 * Creates a new Action.
 * @param eventName The name of the event.
 * @param fileIds The IDs of the files that the event should be sent to. If null then the event is sent to every file.
 * @param userId The ID of the file for the current user.
 * @param arg The optional argument to provide.
 * @param sortIds Whether the files should be processed in order of their File IDs.
 */
export function action(
    eventName: string,
    fileIds: string[] = null,
    userId: string = null,
    arg?: any,
    sortIds: boolean = true
): Action {
    return {
        type: 'action',
        fileIds,
        eventName,
        userId,
        argument: arg,
        sortFileIds: sortIds,
    };
}

/**
 * Creates a new ApplyStateEvent.
 * @param state The state to apply.
 */
export function addState(state: FilesState): ApplyStateEvent {
    return {
        type: 'apply_state',
        state: state,
    };
}

/**
 * Creates a new PasteStateEvent.
 * @param state The state to paste.
 * @param options The options for the event.
 */
export function pasteState(
    state: FilesState,
    options: PasteStateOptions
): PasteStateEvent {
    return {
        type: 'paste_state',
        state,
        options,
    };
}

/**
 * Creates a new ShowToastEvent.
 * @param message The message to show with the event.
 */
export function toast(message: string): ShowToastEvent {
    return {
        type: 'local',
        name: 'show_toast',
        message: message,
    };
}

/**
 * Creates a new TweenToEvent.
 * @param fileId The ID of the file to tween to.
 * @param zoomValue The zoom value to use.
 */
export function tweenTo(
    fileId: string,
    zoomValue: number = -1,
    rotX: number = null,
    rotY: number = null
): TweenToEvent {
    if (rotY != null && rotX != null && rotY > 0 && rotX === 0) {
        rotX = 1;
    }

    if (rotX === null || rotY === null) {
        return {
            type: 'local',
            name: 'tween_to',
            fileId: fileId,
            zoomValue: zoomValue,
            rotationValue: null,
        };
    } else {
        return {
            type: 'local',
            name: 'tween_to',
            fileId: fileId,
            zoomValue: zoomValue,
            rotationValue: {
                x: rotX / 180,
                y: rotY / 180,
            },
        };
    }
}

/**
 * Creates a new OpenQRCodeScannerEvent.
 * @param open Whether the QR Code scanner should be open or closed.
 */
export function openQRCodeScanner(open: boolean): OpenQRCodeScannerEvent {
    return {
        type: 'local',
        name: 'show_qr_code_scanner',
        open: open,
    };
}

/**
 * Creates a new ShowQRCodeEvent.
 * @param open Whether the QR Code should be visible.
 * @param code The code that should be shown.
 */
export function showQRCode(open: boolean, code?: string): ShowQRCodeEvent {
    return {
        type: 'local',
        name: 'show_qr_code',
        open: open,
        code: code,
    };
}

/**
 * Creates a new LoadSimulationEvent.
 * @param id The ID of the simulation to load.
 */
export function loadSimulation(id: string): LoadSimulationEvent {
    return {
        type: 'local',
        name: 'load_simulation',
        id: id,
    };
}

/**
 * Creates a new UnloadSimulationEvent.
 * @param id The ID of the simulation to unload.
 */
export function unloadSimulation(id: string): UnloadSimulationEvent {
    return {
        type: 'local',
        name: 'unload_simulation',
        id: id,
    };
}

/**
 * Creates a new SuperShoutEvent.
 * @param eventName The name of the event.
 * @param arg The argument to send as the "that" variable to scripts.
 */
export function superShout(eventName: string, arg?: any): SuperShoutEvent {
    return {
        type: 'local',
        name: 'super_shout',
        eventName: eventName,
        argument: arg,
    };
}

/**
 * Creates a new GoToContextEvent.
 * @param simulationOrContext The simulation ID or context to go to. If a simulation ID is being provided, then the context parameter must also be provided.
 * @param context
 */
export function goToContext(context: string): GoToContextEvent {
    return {
        type: 'local',
        name: 'go_to_context',
        context: context,
    };
}

/**
 * Creates a new ImportAUXEvent.
 * @param url The URL that should be loaded.
 */
export function importAUX(url: string): ImportAUXEvent {
    return {
        type: 'local',
        name: 'import_aux',
        url: url,
    };
}

/**
 * Creates a new ShowInputForTagEvent.
 * @param fileId The ID of the file to edit.
 * @param tag The tag to edit.
 */
export function showInputForTag(
    fileId: string,
    tag: string,
    options?: Partial<ShowInputOptions>
): ShowInputForTagEvent {
    return {
        type: 'local',
        name: 'show_input_for_tag',
        fileId: fileId,
        tag: tag,
        options: options || {},
    };
}

/**
 * Creates a new SetForcedOfflineEvent event.
 * @param offline Whether the connection should be offline.
 */
export function setForcedOffline(offline: boolean): SetForcedOfflineEvent {
    return {
        type: 'local',
        name: 'set_offline_state',
        offline: offline,
    };
}

/**
 * Creates a new GoToURLEvent.
 * @param url The URL to go to.
 */
export function goToURL(url: string): GoToURLEvent {
    return {
        type: 'local',
        name: 'go_to_url',
        url: url,
    };
}

/**
 * Creates a new OpenURLEvent.
 * @param url The URL to go to.
 */
export function openURL(url: string): OpenURLEvent {
    return {
        type: 'local',
        name: 'open_url',
        url: url,
    };
}

/**
 * Creates a new SayHelloEvent.
 */
export function sayHello(): SayHelloEvent {
    return {
        type: 'local',
        name: 'say_hello',
    };
}

/**
 * Creates an new EchoEvent.
 */
export function echo(message: string): EchoEvent {
    return {
        type: 'local',
        name: 'echo',
        message,
    };
}

/**
 * Creates a new GrantRoleEvent.
 * @param username The username of the user that the role should be granted to.
 * @param role The role to grant.
 * @param grant The token that is used to authorize the operation.
 */
export function grantRole(
    username: string,
    role: string,
    grant?: string
): GrantRoleEvent {
    return {
        type: 'local',
        name: 'grant_role',
        role: role,
        username: username,
        grant: grant,
    };
}

/**
 * Creates a new RevokeRoleEvent.
 * @param username The username of the user that the role should be revoked from.
 * @param role The role to revoke.
 * @param grant The token that is used to authorize the operation.
 */
export function revokeRole(
    username: string,
    role: string,
    grant?: string
): RevokeRoleEvent {
    return {
        type: 'local',
        name: 'revoke_role',
        role: role,
        username: username,
        grant: grant,
    };
}

/**
 * Creates a new ShellEvent.
 * @param script The script that should be run.
 */
export function shell(script: string): ShellEvent {
    return {
        type: 'local',
        name: 'shell',
        script: script,
    };
}

/**
 * Creates a new ToggleConsoleEvent.
 */
export function openConsole(): OpenConsoleEvent {
    return {
        type: 'local',
        name: 'open_console',
        open: true,
    };
}

/**
 * Creates a new BackupToGithub event.
 * @param auth The authentication key that should be used.
 * @param options The options that should be used.
 */
export function backupToGithub(
    auth: string,
    options?: BackupOptions
): BackupToGithubEvent {
    return {
        type: 'local',
        name: 'backup_to_github',
        auth,
        options,
    };
}

/**
 * Creates a new BackupAsDownload event.
 */
export function backupAsDownload(
    options?: BackupOptions
): BackupAsDownloadEvent {
    return {
        type: 'local',
        name: 'backup_as_download',
        options,
    };
}

/**
 * Creates a new DownloadEvent.
 * @param data The data that should be downloaded.
 * @param filename The name of the file.
 * @param mimeType The MIME type of the data.
 */
export function download(
    data: any,
    filename: string,
    mimeType: string
): DownloadEvent {
    return {
        type: 'local',
        name: 'download',
        data,
        filename,
        mimeType,
    };
}
