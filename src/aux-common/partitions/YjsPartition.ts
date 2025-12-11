/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    TagEditOp,
    TagEdit,
    GetInstStateFromUpdatesAction,
    CreateInitializationUpdateAction,
    InstUpdate,
    ApplyUpdatesToInstAction,
    GetCurrentInstUpdateAction,
    InstallAuxAction,
    CreateInitializationUpdateFromPreviousUpdatesAction,
} from '../bots';
import {
    isTagEdit,
    preserve,
    del,
    insert,
    edit,
    asyncResult,
    asyncError,
    getInstStateFromUpdates,
} from '../bots';
import type { Observable } from 'rxjs';
import type {
    AuxPartitionRealtimeStrategy,
    YjsPartition,
} from './AuxPartition';
import type {
    BotAction,
    Bot,
    UpdatedBot,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
    StateUpdatedEvent,
    BotsState,
    BotTags,
} from '../bots';
import {
    breakIntoIndividualEvents,
    botAdded,
    createBot,
    botRemoved,
    hasValue,
    botUpdated,
    convertToString,
} from '../bots';
import type {
    PartitionConfig,
    PartitionRemoteEvents,
    YjsPartitionConfig,
} from './AuxPartitionConfig';
import type { Doc, Transaction, AbstractType, YEvent } from 'yjs';
import {
    Text,
    Map,
    applyUpdate,
    YMapEvent,
    createAbsolutePositionFromRelativePosition,
    YTextEvent,
    encodeStateAsUpdate,
} from 'yjs';
import { MemoryPartitionImpl } from './MemoryPartition';
import {
    createRelativePositionFromStateVector,
    getClock,
    getStateVector,
} from '../yjs/YjsHelpers';
import {
    ensureTagIsSerializable,
    getStateFromUpdates,
    supportsRemoteEvent,
} from './PartitionUtils';
import type { RemoteActions, VersionVector } from '../common';
import { fromByteArray, toByteArray } from 'base64-js';
import { YjsSharedDocument } from '../documents/YjsSharedDocument';
import { v4 as uuid } from 'uuid';

const APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN = '__apply_updates_to_inst';

/**
 * Attempts to create a YjsPartition from the given config.
 * @param config The config.
 */
export function createYjsPartition(config: PartitionConfig): YjsPartition {
    if (config.type === 'yjs') {
        return new YjsPartitionImpl(config);
    }
    return undefined;
}

type MapValue = Text | object | number | boolean;
type TagsMap = Map<MapValue>;

export class YjsPartitionImpl
    extends YjsSharedDocument
    implements YjsPartition
{
    protected _hasRegisteredSubs = false;

    private _bots: Map<TagsMap>;
    private _masks: Map<MapValue>;
    private _internalPartition: MemoryPartitionImpl;

    private _remoteEvents: PartitionRemoteEvents | boolean;
    private _connectionId: string;

    get onBotsAdded(): Observable<Bot[]> {
        return this._internalPartition.onBotsAdded;
    }

    get onBotsRemoved(): Observable<string[]> {
        return this._internalPartition.onBotsRemoved;
    }

    get onBotsUpdated(): Observable<UpdatedBot[]> {
        return this._internalPartition.onBotsUpdated;
    }

    get onStateUpdated(): Observable<StateUpdatedEvent> {
        return this._internalPartition.onStateUpdated;
    }

    unsubscribe() {
        return this._sub.unsubscribe();
    }

    // get doc() {
    //     return this._doc;
    // }

    get state(): BotsState {
        return this._internalPartition.state;
    }

    type = 'yjs' as const;
    private: boolean;

    get space(): string {
        return this._internalPartition.space;
    }

    set space(value: string) {
        this._internalPartition.space = value;
    }

    get realtimeStrategy(): AuxPartitionRealtimeStrategy {
        return 'immediate';
    }

    constructor(config: YjsPartitionConfig) {
        super(config);
        this.private = config.private || false;
        this._remoteEvents = config.remoteEvents;
        this._connectionId = config.connectionId;
        this._bots = this._doc.getMap('bots');
        this._masks = this._doc.getMap('masks');
        this._doc.on('afterTransaction', (transaction: Transaction) => {
            this._processTransaction(transaction);
        });
        this._internalPartition = new MemoryPartitionImpl({
            type: 'memory',
            initialState: {},
            localSiteId: this._currentSite,
            remoteSiteId: this._remoteSite,
        });
        this._internalPartition.getCurrentVersion = () => {
            return this._currentVersion;
        };

        this._internalPartition.getNextVersion = (textEdit: TagEdit) => {
            const version = getStateVector(this._doc);

            if (this._isRemoteUpdate) {
                const {
                    [this._currentSite]: currentVersion,
                    ...otherVersions
                } = version;
                return {
                    currentSite: this._currentSite,
                    remoteSite: this._remoteSite,
                    vector: otherVersions,
                };
            } else {
                const site = textEdit.isRemote
                    ? this._remoteSite
                    : this._currentSite;
                return {
                    currentSite: this._currentSite,
                    remoteSite: this._remoteSite,
                    vector: {
                        [site]: version[this._doc.clientID] ?? 0,
                    },
                };
            }
        };
    }

    async sendRemoteEvents(events: RemoteActions[]): Promise<void> {
        if (!this._remoteEvents) {
            return;
        }

        for (let event of events) {
            if (!supportsRemoteEvent(this._remoteEvents, event)) {
                continue;
            }

            if (event.type === 'remote') {
                if (event.event.type === 'get_remote_count') {
                    this._onEvents.next([asyncResult(event.taskId, 1)]);
                } else if (event.event.type === 'get_remotes') {
                    if (this._connectionId) {
                        this._onEvents.next([
                            asyncResult(event.taskId, [this._connectionId]),
                        ]);
                    } else {
                        this._onEvents.next([asyncResult(event.taskId, [])]);
                    }
                } else if (event.event.type === 'list_inst_updates') {
                    try {
                        const updates: InstUpdate[] = [
                            {
                                id: 0,
                                timestamp: Date.now(),
                                update: fromByteArray(
                                    encodeStateAsUpdate(this._doc)
                                ),
                            },
                        ];
                        this._onEvents.next([
                            asyncResult(event.taskId, updates, false),
                        ]);
                    } catch (err) {
                        this._onEvents.next([asyncError(event.taskId, err)]);
                    }
                } else if (event.event.type === 'get_inst_state_from_updates') {
                    const action = <GetInstStateFromUpdatesAction>event.event;
                    try {
                        let partition = new YjsPartitionImpl({
                            type: 'yjs',
                        });

                        for (let { update } of action.updates) {
                            const updateBytes = toByteArray(update);
                            applyUpdate(partition.doc, updateBytes);
                        }

                        this._onEvents.next([
                            asyncResult(event.taskId, partition.state, false),
                        ]);
                    } catch (err) {
                        this._onEvents.next([asyncError(event.taskId, err)]);
                    }
                } else if (
                    event.event.type === 'create_initialization_update'
                ) {
                    const action = <CreateInitializationUpdateAction>(
                        event.event
                    );
                    try {
                        let partition = new YjsPartitionImpl({
                            type: 'yjs',
                        });

                        partition.doc.on('update', (update: Uint8Array) => {
                            let instUpdate: InstUpdate = {
                                id: 0,
                                timestamp: Date.now(),
                                update: fromByteArray(update),
                            };

                            this._onEvents.next([
                                asyncResult(event.taskId, instUpdate, false),
                            ]);
                        });

                        await partition.applyEvents(
                            action.bots.map((b) =>
                                botAdded(createBot(b.id, b.tags))
                            )
                        );
                    } catch (err) {
                        this._onEvents.next([asyncError(event.taskId, err)]);
                    }
                } else if (
                    event.event.type ===
                    'create_initialization_update_from_previous_updates'
                ) {
                    const action = <
                        CreateInitializationUpdateFromPreviousUpdatesAction
                    >event.event;
                    try {
                        let partition = new YjsPartitionImpl({
                            type: 'yjs',
                        });

                        for (let { update } of action.previousUpdates) {
                            const updateBytes = toByteArray(update);
                            applyUpdate(partition.doc, updateBytes);
                        }

                        const allBotIds = new Set<string>(
                            Object.keys(partition.state)
                        );
                        const actions: BotAction[] = [];
                        for (let b of action.bots) {
                            if (partition.state[b.id]) {
                                actions.push(
                                    botUpdated(b.id, {
                                        tags: b.tags,
                                    })
                                );
                                allBotIds.delete(b.id);
                            } else {
                                actions.push(botAdded(createBot(b.id, b.tags)));
                                allBotIds.delete(b.id);
                            }
                        }

                        for (let id of allBotIds) {
                            actions.push(botRemoved(id));
                        }

                        partition.doc.on('update', (update: Uint8Array) => {
                            let instUpdate: InstUpdate = {
                                id: 0,
                                timestamp: Date.now(),
                                update: fromByteArray(
                                    encodeStateAsUpdate(partition.doc)
                                ),
                            };

                            this._onEvents.next([
                                asyncResult(event.taskId, instUpdate, false),
                            ]);
                        });

                        await partition.applyEvents(actions);
                    } catch (err) {
                        this._onEvents.next([asyncError(event.taskId, err)]);
                    }
                } else if (event.event.type === 'apply_updates_to_inst') {
                    const action = <ApplyUpdatesToInstAction>event.event;
                    try {
                        this._applyUpdates(
                            action.updates.map((u) => u.update),
                            APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN
                        );
                        this._onEvents.next([
                            asyncResult(event.taskId, null, false),
                        ]);
                    } catch (err) {
                        this._onEvents.next([asyncError(event.taskId, err)]);
                    }
                } else if (event.event.type === 'get_current_inst_update') {
                    const action = <GetCurrentInstUpdateAction>event.event;
                    try {
                        const update: InstUpdate = {
                            id: 0,
                            timestamp: Date.now(),
                            update: fromByteArray(
                                encodeStateAsUpdate(this._doc)
                            ),
                        };
                        this._onEvents.next([
                            asyncResult(event.taskId, update, false),
                        ]);
                    } catch (err) {
                        this._onEvents.next([asyncError(event.taskId, err)]);
                    }
                } else if (event.event.type === 'install_aux_file') {
                    const action = <InstallAuxAction>event.event;
                    try {
                        if (action.mode === 'copy') {
                            let bots: Bot[];
                            if (action.aux.version === 2) {
                                const state = getStateFromUpdates(
                                    getInstStateFromUpdates(action.aux.updates)
                                );
                                bots = Object.values(state);
                            } else {
                                bots = Object.values(action.aux.state);
                            }

                            if (bots && bots.length > 0) {
                                this._applyEvents(
                                    bots.map(
                                        (b) =>
                                            botAdded(
                                                createBot(uuid(), b.tags)
                                            ) as AddBotAction
                                    )
                                );
                            }
                        } else {
                            if (action.aux.version === 2) {
                                this.applyStateUpdates(action.aux.updates);
                            } else if (action.aux.version === 1) {
                                this._applyEvents(
                                    Object.values(action.aux.state).map((b) =>
                                        botAdded(createBot(b.id, b.tags))
                                    )
                                );
                            }
                        }

                        this._onEvents.next([
                            asyncResult(event.taskId, null, false),
                        ]);
                    } catch (err) {
                        this._onEvents.next([asyncError(event.taskId, err)]);
                    }
                }
            }
        }
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        const finalEvents = events.flatMap((e) => {
            if (e.type === 'apply_state') {
                return breakIntoIndividualEvents(this.state, e);
            } else if (
                e.type === 'add_bot' ||
                e.type === 'remove_bot' ||
                e.type === 'update_bot'
            ) {
                return [e] as const;
            } else {
                return [];
            }
        });

        this._applyEvents(finalEvents);

        return [];
    }

    private _applyEvents(
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[]
    ) {
        this._isLocalTransaction = true;
        this._doc.transact((t) => {
            for (let event of events) {
                if (event.type === 'add_bot') {
                    const map: TagsMap = new Map();

                    for (let tag in event.bot.tags) {
                        const val = ensureTagIsSerializable(
                            event.bot.tags[tag]
                        );
                        if (hasValue(val)) {
                            const yVal =
                                typeof val === 'string' ? new Text(val) : val;
                            map.set(tag, yVal);
                        }
                    }

                    if (this.space && event.bot.masks) {
                        const tags = event.bot.masks[this.space];
                        if (tags) {
                            for (let tag of Object.keys(tags)) {
                                const maskId = tagMaskId(event.id, tag);
                                const val = ensureTagIsSerializable(tags[tag]);
                                if (hasValue(val)) {
                                    const yVal =
                                        typeof val === 'string'
                                            ? new Text(val)
                                            : val;

                                    this._masks.set(maskId, yVal);
                                }
                            }
                        }
                    }

                    this._bots.set(event.id, map);
                } else if (event.type === 'remove_bot') {
                    this._bots.delete(event.id);
                } else if (event.type === 'update_bot') {
                    const currentBot = this.state[event.id];
                    const currentMap = this._bots.get(event.id);
                    if (event.update.tags && currentBot && currentMap) {
                        for (let tag of Object.keys(event.update.tags)) {
                            let newVal = ensureTagIsSerializable(
                                event.update.tags[tag]
                            );
                            const oldVal = currentBot.tags[tag];

                            if (newVal === oldVal) {
                                if (Array.isArray(newVal)) {
                                    newVal = newVal.slice();
                                } else {
                                    continue;
                                }
                            }

                            this._updateValueInMap(
                                this._doc,
                                currentMap,
                                tag,
                                newVal
                            );
                        }
                    }

                    if (this.space && event.update.masks) {
                        const tags = event.update.masks[this.space];

                        if (tags) {
                            for (let tag of Object.keys(tags)) {
                                const maskId = tagMaskId(event.id, tag);
                                const value = ensureTagIsSerializable(
                                    tags[tag]
                                );

                                this._updateValueInMap(
                                    this._doc,
                                    this._masks,
                                    maskId,
                                    value
                                );
                            }
                        }
                    }
                }
            }
        });
    }

    private async _processTransaction(transaction: Transaction) {
        let memoryEvents: (AddBotAction | RemoveBotAction | UpdateBotAction)[] =
            [];

        const version = getStateVector(this._doc);

        for (let [type, events] of transaction.changedParentTypes) {
            if (type === this._bots) {
                for (let event of events) {
                    // Update the current target so that the event
                    // path is calculated from the bots map.
                    // see https://github.com/yjs/yjs/blob/5244755879daaa7b5a1ca64e6af617cdbb110462/src/utils/YEvent.js#L63
                    event.currentTarget = this._bots;
                    const target = event.target;
                    if (target === type) {
                        // Bot was added or removed
                        if (event instanceof YMapEvent) {
                            for (let [key, change] of event.changes.keys) {
                                if (change.action === 'add') {
                                    // bot added
                                    const value = this._bots.get(key);
                                    const bot = this._mapToBot(key, value);
                                    memoryEvents.push(botAdded(bot));
                                } else if (change.action === 'delete') {
                                    // bot deleted
                                    memoryEvents.push(botRemoved(key));
                                } else if (change.action === 'update') {
                                    // bot updated in a way that we can't track
                                    // in this scenario, we just remove the bot and re-add it
                                    memoryEvents.push(botRemoved(key));
                                    const value = this._bots.get(key);
                                    const bot = this._mapToBot(key, value);
                                    memoryEvents.push(botAdded(bot));
                                }
                            }
                        }
                    } else {
                        this._handleValueUpdates(
                            target,
                            event,
                            memoryEvents,
                            version,
                            (event) =>
                                event.path[event.path.length - 1] as string,
                            (event, key) => {
                                throw new Error('should not happen');
                            },
                            (event) => ({
                                id: event.path[event.path.length - 2] as string,
                                tag: event.path[
                                    event.path.length - 1
                                ] as string,
                            }),
                            (id, tags) =>
                                botUpdated(id, {
                                    tags,
                                }),
                            (id, tag, val) =>
                                botUpdated(id, {
                                    tags: {
                                        [tag]: val,
                                    },
                                })
                        );
                    }
                }
            } else if (type === this._masks) {
                for (let event of events) {
                    // Update the current target so that the event
                    // path is calculated from the bots map.
                    // see https://github.com/yjs/yjs/blob/5244755879daaa7b5a1ca64e6af617cdbb110462/src/utils/YEvent.js#L63
                    event.currentTarget = this._masks;
                    const target = event.target;

                    this._handleValueUpdates(
                        target,
                        event,
                        memoryEvents,
                        version,
                        (event) => event.path[event.path.length - 1] as string,
                        (event, key) => parseTagMaskId(key),
                        (event) =>
                            parseTagMaskId(
                                event.path[event.path.length - 1] as string
                            ),
                        (id, tags) =>
                            botUpdated(id, {
                                masks: {
                                    [this.space]: tags,
                                },
                            }),
                        (id, tag, val) =>
                            botUpdated(id, {
                                masks: {
                                    [this.space]: {
                                        [tag]: val,
                                    },
                                },
                            })
                    );
                }
            }
        }

        this._currentVersion = {
            currentSite: this._currentSite,
            remoteSite: this._remoteSite,
            vector: version,
        };
        await this._internalPartition.applyEvents(memoryEvents);
        this._onVersionUpdated.next(this._currentVersion);
    }

    private _mapToBot(
        id: string,
        map: Map<Text | object | number | boolean>
    ): Bot {
        let tags: BotTags = {};
        for (let [key, value] of map.entries()) {
            const val = map.get(key);
            let finalVal: string | number | boolean | object;
            if (hasValue(val)) {
                if (val instanceof Text) {
                    finalVal = val.toString();
                } else {
                    finalVal = val;
                }
                tags[key] = finalVal;
            }
        }

        return createBot(id, tags);
    }

    /**
     * Updates the given value in the given document and map.
     * This is a generalization of the update logic for tags and tag masks.
     * @param doc The document.
     * @param map The map that contains the values.
     * @param valueId The ID that the value should be looked up by. For tags, this is the tag name. For tag masks, this is the tag mask ID.
     * @param newVal The new value.
     */
    private _updateValueInMap(
        doc: Doc,
        map: Map<MapValue>,
        valueId: string,
        newVal: any
    ) {
        doc.clientID = this._localId;
        if (hasValue(newVal)) {
            if (isTagEdit(newVal)) {
                if (newVal.isRemote) {
                    doc.clientID = this._remoteId;
                    this._isLocalTransaction = false;
                }

                const val = map.get(valueId);
                let text: Text;
                if (val instanceof Text) {
                    text = val;
                } else {
                    text = new Text(convertToString(val));
                    map.set(valueId, text);
                }

                const version = {
                    ...newVal.version,
                    [this._currentSite]: getClock(doc, this._localId),
                };

                if (text instanceof Text) {
                    for (let ops of newVal.operations) {
                        let index = 0;
                        for (let op of ops) {
                            if (op.type === 'preserve') {
                                index += op.count;
                            } else if (op.type === 'insert') {
                                if (op.text.length <= 0) {
                                    continue;
                                }
                                const relativePos =
                                    createRelativePositionFromStateVector(
                                        text,
                                        version,
                                        index
                                    );
                                const finalPosition =
                                    createAbsolutePositionFromRelativePosition(
                                        relativePos,
                                        doc
                                    );

                                text.insert(finalPosition.index, op.text);
                                index += op.text.length;
                            } else if (op.type === 'delete') {
                                if (op.count <= 0) {
                                    continue;
                                }
                                const relativePos =
                                    createRelativePositionFromStateVector(
                                        text,
                                        version,
                                        index
                                    );
                                const finalPosition =
                                    createAbsolutePositionFromRelativePosition(
                                        relativePos,
                                        doc
                                    );

                                text.delete(finalPosition.index, op.count);
                            }
                        }

                        version[this._currentSite] = getClock(
                            doc,
                            this._localId
                        );
                    }
                }
            } else {
                const yVal =
                    typeof newVal === 'string' ? new Text(newVal) : newVal;
                map.set(valueId, yVal);
            }
        } else {
            map.delete(valueId);
        }
    }

    private _handleValueUpdates(
        target: AbstractType<any>,
        event: YEvent<AbstractType<any>>,
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[],
        version: VersionVector,
        getMapBotId: (event: YEvent<AbstractType<any>>) => string,
        getTagMaskBotValues: (
            event: YEvent<AbstractType<any>>,
            key: string
        ) => { id: string; tag: string },
        getTextBotValues: (event: YEvent<AbstractType<any>>) => {
            id: string;
            tag: string;
        },
        createBotUpdate: (id: string, tags: BotTags) => UpdateBotAction,
        createTextUpdate: (
            id: string,
            tag: string,
            value: any
        ) => UpdateBotAction
    ) {
        // child event - this could mean that a bot tag was updated
        if (target instanceof Map) {
            if (event instanceof YMapEvent) {
                if (target === this._masks) {
                    let botToMasks = new globalThis.Map<string, BotTags>();
                    for (let [key, change] of event.changes.keys) {
                        const { id, tag } = getTagMaskBotValues(event, key);

                        let tags = botToMasks.get(id);
                        if (!tags) {
                            tags = {};
                            botToMasks.set(id, tags);
                        }

                        if (
                            change.action === 'add' ||
                            change.action === 'update'
                        ) {
                            // tag added
                            const value = target.get(key);
                            const auxValue =
                                value instanceof Text
                                    ? value.toString()
                                    : value;
                            tags[tag] = auxValue;
                        } else if (change.action === 'delete') {
                            tags[tag] = null;
                        }
                    }

                    for (let [id, tags] of botToMasks) {
                        events.push(createBotUpdate(id, tags));
                    }
                } else {
                    // Update the current target so that the event
                    // path is calculated from the bots map.
                    // see https://github.com/yjs/yjs/blob/5244755879daaa7b5a1ca64e6af617cdbb110462/src/utils/YEvent.js#L63
                    event.currentTarget = this._bots;

                    // Maps are only used for bots and tags
                    // so a map that is not the bots map must be for a tag
                    const id = getMapBotId(event);
                    let tags = {} as BotTags;
                    for (let [key, change] of event.changes.keys) {
                        if (
                            change.action === 'add' ||
                            change.action === 'update'
                        ) {
                            // tag added
                            const value = target.get(key);
                            const auxValue =
                                value instanceof Text
                                    ? value.toString()
                                    : value;
                            tags[key] = auxValue;
                        } else if (change.action === 'delete') {
                            tags[key] = null;
                        }
                    }

                    events.push(createBotUpdate(id, tags));
                }
            }
        } else if (target instanceof Text) {
            // text is used for string tag values
            const { id, tag } = getTextBotValues(event);
            if (event instanceof YTextEvent) {
                let operations = [] as TagEditOp[];
                for (let delta of event.delta) {
                    if (hasValue(delta.retain)) {
                        operations.push(preserve(delta.retain));
                    } else if (hasValue(delta.insert)) {
                        if (typeof delta.insert === 'string') {
                            operations.push(insert(delta.insert));
                        } else if (Array.isArray(delta.insert)) {
                            for (let str of delta.insert) {
                                operations.push(insert(str));
                            }
                        }
                    } else if (hasValue(delta.delete)) {
                        operations.push(del(delta.delete));
                    }
                }

                const siteId = this._isLocalTransaction
                    ? this._currentSite
                    : this._remoteSite;
                const e = edit({ [siteId]: version[siteId] }, ...operations);
                e.isRemote = !this._isLocalTransaction;

                events.push(createTextUpdate(id, tag, e));
            }
        }
    }
}

/**
 * Creates the tag mask ID for the given bot ID and tag.
 * @param botId The ID of the bot.
 * @param tag the tag.
 */
function tagMaskId(botId: string, tag: string): string {
    return `${botId}:${tag}`;
}

/**
 * Creates the tag mask ID for the given bot ID and tag.
 * @param botId The ID of the bot.
 * @param tag the tag.
 */
function parseTagMaskId(val: string): { id: string; tag: string } {
    const index = val.indexOf(':');
    if (index < 0) {
        throw new Error('Invalid tag mask ID');
    }
    const id = val.substring(0, index);
    const tag = val.substring(index + 1);

    return { id, tag };
}
