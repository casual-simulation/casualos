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
import Vue from 'vue';
import Component from 'vue-class-component';
import type {
    Bot,
    BotTags,
    PrecalculatedBot,
} from '@casual-simulation/aux-common';
import {
    hasValue,
    calculateStringTagValue,
    TAG_PORTAL,
    calculateMeetPortalAnchorPointOffset,
    DEFAULT_TAG_PORTAL_ANCHOR_POINT,
    trimTag,
    TAG_PORTAL_SPACE,
    registerBuiltinPortal,
    getPortalTag,
    formatValue,
    getTagValueForSpace,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import type { Simulation } from '@casual-simulation/aux-vm';
import { tap } from 'rxjs/operators';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { userBotChanged } from '@casual-simulation/aux-vm-browser';
import { TagPortalConfig } from './TagPortalConfig';
import { EventBus } from '@casual-simulation/aux-components';
import TagValueEditor from '../TagValueEditor/TagValueEditor';
import TagValueEditorWrapper from '../TagValueEditorWrapper/TagValueEditorWrapper';
import type monaco from '@casual-simulation/monaco-editor';
import { getModelUriFromId } from '../../MonacoUtils';
import { calculateIndexFromLocation } from '@casual-simulation/aux-runtime/runtime/TranspilerUtils';

@Component({
    components: {
        'tag-value-editor-wrapper': TagValueEditorWrapper,
        'tag-value-editor': TagValueEditor,
    },
})
export default class TagPortal extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _portals: Map<
        BrowserSimulation,
        { portal: string; space: string }
    > = new Map();
    private _currentConfig: TagPortalConfig;
    private _currentSim: BrowserSimulation;
    private _currentSub: Subscription;
    private _currentPortal: { portal: string; space: string };

    showButton: boolean = false;
    buttonIcon: string = null;
    buttonHint: string = null;
    currentSimId: string = null;
    currentBot: Bot = null;
    currentSpace: string = null;
    currentTag: string = null;
    extraStyle: object = {};

    private _tagSelectionEvents: Map<
        string,
        {
            selectionStart: number;
            selectionEnd: number;
        }
    > = new Map();

    get hasPortal(): boolean {
        return hasValue(this.currentBot) && hasValue(this.currentTag);
    }

    /**
     * The HTML element that contains the tag editor.
     */
    get portalElement(): HTMLElement {
        return <HTMLElement>this.$refs.portalContainer;
    }

    /**
     * The HTML element that contains the other elements that should be repositioned when
     * the meet portal is open.
     */
    get othersElement(): HTMLElement {
        return <HTMLElement>this.$refs.otherContainer;
    }

    constructor() {
        super();
    }

    created() {
        this._sub = new Subscription();
        this._simulations = new Map();
        this._portals = new Map();
        this._tagSelectionEvents = new Map();
        this.extraStyle = calculateMeetPortalAnchorPointOffset(
            DEFAULT_TAG_PORTAL_ANCHOR_POINT
        );

        window.addEventListener('resize', (e) => this._resize());

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap((sim) => this._onSimulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap((sim) => this._onSimulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
        if (this._currentSub) {
            this._currentSub.unsubscribe();
            this._currentSub = null;
        }
    }

    buttonClick() {
        if (this._currentConfig) {
            this._currentConfig.buttonClick();
        }
    }

    exitSheet() {
        if (this._currentSim) {
            this._currentSim.helper.updateBot(this._currentSim.helper.userBot, {
                tags: {
                    [TAG_PORTAL]: null,
                },
            });
        }
    }

    private _resize(): any {
        if (!this.portalElement || !this.othersElement) {
            return;
        }
        setTimeout(() => {
            const portalRect = this.portalElement.getBoundingClientRect();

            // Calculate whether to fill space not taken or whether to fill behind
            if (
                portalRect.top !== 0 &&
                portalRect.bottom !== window.innerHeight &&
                portalRect.left !== 0 &&
                portalRect.right !== window.innerWidth
            ) {
                // If the portal is not attached to a side of the screen then fill behind
                this.othersElement.style.height = null;
                this.othersElement.style.width = null;
                this.othersElement.style.top = null;
                this.othersElement.style.bottom = null;
                this.othersElement.style.left = null;
                this.othersElement.style.right = null;
                return;
            }

            const portalSize = this._calculateSize(this.portalElement);
            const heightRatio = portalSize.height / window.innerHeight;
            const widthRatio = portalSize.width / window.innerWidth;

            // Calculate whether to fill the rest of the height or width
            if (widthRatio === 0 && heightRatio === 0) {
                this.othersElement.style.height = null;
                this.othersElement.style.width = null;
                this.othersElement.style.left = null;
                this.othersElement.style.right = null;
                this.othersElement.style.top = null;
                this.othersElement.style.bottom = null;
            } else if (widthRatio > heightRatio) {
                this.othersElement.style.height =
                    window.innerHeight - portalSize.height + 'px';
                this.othersElement.style.width = null;

                // Calculate whether to fill above or below
                if (portalRect.top < window.innerHeight - portalRect.bottom) {
                    // The meet portal is on the top so place the others on the bottom
                    this.othersElement.style.top = null;
                    this.othersElement.style.bottom = '0px';
                } else {
                    // the meet portal is on the bottom so place the others on the top
                    this.othersElement.style.top = '0px';
                    this.othersElement.style.bottom = null;
                }
            } else {
                this.othersElement.style.height = null;
                this.othersElement.style.width =
                    window.innerWidth - portalSize.width + 'px';

                // Calculate whether to fill left or right
                if (portalRect.left < window.innerWidth - portalRect.right) {
                    // The meet portal is on the left so place the others on the right
                    this.othersElement.style.left = null;
                    this.othersElement.style.right = '0px';
                } else {
                    // the meet portal is on the right so place the others on the left
                    this.othersElement.style.left = '0px';
                    this.othersElement.style.right = null;
                }
            }

            EventBus.$emit('resize');
        }, 100);
    }

    private _calculateSize(element: HTMLElement) {
        const width = element.offsetWidth;
        const height = element.offsetHeight;

        return { width, height };
    }

    private _onSimulationAdded(sim: BrowserSimulation) {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        sub.add(
            userBotChanged(sim)
                .pipe(tap((user) => this._onUserBotUpdated(sim, user)))
                .subscribe()
        );
        sub.add(
            sim.localEvents.subscribe((e) => {
                if (e.type === 'focus_on') {
                    if (
                        hasValue(e.tag) &&
                        hasValue(e.portal) &&
                        getPortalTag(e.portal) === TAG_PORTAL
                    ) {
                        if (hasValue(e.startIndex)) {
                            this.selectBotAndTag(
                                sim,
                                e.botId,
                                e.tag,
                                e.space,
                                e.startIndex ?? 0,
                                e.endIndex ?? e.startIndex ?? 0
                            );
                        } else if (hasValue(e.lineNumber)) {
                            this.selectBotAndTagByLineNumber(
                                sim,
                                e.botId,
                                e.tag,
                                e.space,
                                e.lineNumber ?? 1,
                                e.columnNumber ?? 1
                            );
                        } else {
                            this.selectBotAndTag(sim, e.botId, e.tag, e.space);
                        }
                    }
                }
            })
        );

        sim.helper.transaction(registerBuiltinPortal(TAG_PORTAL));
    }

    private _onSimulationRemoved(sim: BrowserSimulation) {
        const sub = this._simulations.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulations.delete(sim);
        this._portals.delete(sim);
        this._updateCurrentPortal();
    }

    private _onUserBotUpdated(sim: BrowserSimulation, user: PrecalculatedBot) {
        const portal = calculateStringTagValue(null, user, TAG_PORTAL, null);
        const space = calculateStringTagValue(
            null,
            user,
            TAG_PORTAL_SPACE,
            null
        );
        if (hasValue(portal)) {
            this._portals.set(sim, { portal, space });
        } else {
            this._portals.delete(sim);
        }
        this._updateCurrentPortal();
    }

    /**
     * Updates the current simulation and portal.
     */
    private _updateCurrentPortal() {
        // If the current sim still exists, then keep it.
        if (this._currentSim && this._portals.has(this._currentSim)) {
            const targetPortal = this._portals.get(this._currentSim);
            if (targetPortal === this._currentPortal) {
                return;
            }
        }

        if (this._currentSim === null && this._portals.size <= 0) {
            return;
        }

        // Use the first botAndTag
        this._setCurrentSim(null, null);
        for (let [sim, botAndTag] of this._portals) {
            if (this._setCurrentSim(sim, botAndTag)) {
                break;
            }
        }
    }

    private _setCurrentSim(
        sim: BrowserSimulation,
        data: { portal: string; space: string }
    ): boolean {
        if (this._currentConfig) {
            this._currentConfig.unsubscribe();
            this._currentConfig = null;
        }
        if (this._currentSub) {
            this._currentSub.unsubscribe();
            this._currentSub = null;
        }

        if (sim) {
            this._currentConfig = new TagPortalConfig(TAG_PORTAL, sim);
            this._currentConfig.onUpdated
                .pipe(
                    tap(() => {
                        this._updateConfig();
                    })
                )
                .subscribe();
        }
        this._currentSim = sim;
        this._currentPortal = data;
        this.currentSimId = sim ? sim.id : null;
        if (sim) {
            if (!hasValue(data)) {
                return false;
            }
            const botAndTag = data.portal;
            const space = data.space;
            const dotIndex = botAndTag.indexOf('.');
            if (dotIndex < 0) {
                return false;
            }
            const botId = botAndTag.slice(0, dotIndex);
            const tag = botAndTag.slice(dotIndex + 1);
            if (!hasValue(botId) || !hasValue(tag)) {
                return false;
            }
            this.currentBot = sim.helper.botsState[botId];
            this.currentTag = trimTag(tag);
            this.currentSpace = space;
            this._currentSub = sim.watcher
                .botChanged(botId)
                .subscribe((bot) => {
                    this.currentBot = bot;
                });
        } else {
            this.currentBot = null;
            this.currentTag = null;
            this.currentSpace = null;
        }
        this._updateConfig();
        return true;
    }

    private _updateConfig() {
        if (!this.currentBot || !this.currentTag) {
            this.extraStyle = calculateMeetPortalAnchorPointOffset(
                DEFAULT_TAG_PORTAL_ANCHOR_POINT
            );
            this.showButton = false;
            this.buttonIcon = null;
            this.buttonHint = null;
            this._resize();
            return;
        }
        if (this._currentConfig) {
            this.extraStyle = this._currentConfig.style;
            this.showButton = this._currentConfig.showButton;
            this.buttonIcon = this._currentConfig.buttonIcon;
            this.buttonHint = this._currentConfig.buttonHint;
            this._resize();
        } else {
            this.extraStyle = calculateMeetPortalAnchorPointOffset(
                DEFAULT_TAG_PORTAL_ANCHOR_POINT
            );
            this.showButton = false;
            this.buttonIcon = null;
            this.buttonHint = null;
        }
    }

    /**
     * Selects the given bot, tag, and space in the editor.
     * The selection will be set to the given line and column numbers.
     * @param botId The Id of the bot.
     * @param tag The tag that should be selected.
     * @param space The space of the tag.
     * @param lineNumber The line number. Should be one-based.
     * @param columnNumber The column number. Should be one-based.
     */
    selectBotAndTagByLineNumber(
        sim: BrowserSimulation,
        botId: string,
        tag: string,
        space: string,
        lineNumber: number,
        columnNumber: number
    ) {
        const bot = sim.helper.botsState[botId];
        let tagValue = formatValue(getTagValueForSpace(bot, tag, space) ?? '');
        const prefix = sim.portals.getScriptPrefix(tagValue);
        if (prefix) {
            tagValue = tagValue.slice(prefix.length);
        }

        const index = calculateIndexFromLocation(tagValue, {
            lineNumber: lineNumber - 1,
            column: columnNumber - 1,
        });

        return this.selectBotAndTag(sim, botId, tag, space, index, index);
    }

    selectBotAndTag(
        sim: Simulation,
        botId: string,
        tag: string,
        space: string,
        startIndex?: number,
        endIndex?: number
    ) {
        let tags: BotTags = {
            [TAG_PORTAL]: `${botId}.${tag}`,
        };
        if (hasValue(space)) {
            tags[TAG_PORTAL_SPACE] = space;
        }
        this._setTagSelection(botId, tag, space, startIndex, endIndex);

        if (tags[TAG_PORTAL] != sim.helper.userBot.tags[TAG_PORTAL]) {
            sim.helper.updateBot(sim.helper.userBot, {
                tags: tags,
            });
        } else {
            this._focusEditor();
        }
    }

    private _setTagSelection(
        botId: string,
        tag: string,
        space: string,
        start: number,
        end: number
    ) {
        const uri = getModelUriFromId(botId, tag, space).toString();
        if (!this._changeEditorSelection(uri, start, end)) {
            this._tagSelectionEvents.set(uri, {
                selectionStart: start,
                selectionEnd: end,
            });
        }
    }

    getMultilineEditor() {
        return <TagValueEditor>this.$refs.multilineEditor;
    }

    private _changeEditorSelection(
        modelUri: string,
        selectionStart: number,
        selectionEnd: number
    ): boolean {
        let editor = this.getMultilineEditor();
        const monacoEditor = editor?.monacoEditor()?.editor;
        if (monacoEditor) {
            const model = monacoEditor.getModel();
            if (model && model.uri.toString() === modelUri) {
                setTimeout(() => {
                    if (
                        typeof selectionStart === 'number' &&
                        typeof selectionEnd === 'number'
                    ) {
                        const position = model.getPositionAt(selectionStart);
                        const endPosition = model.getPositionAt(selectionEnd);
                        monacoEditor.setSelection({
                            startLineNumber: position.lineNumber,
                            startColumn: position.column,
                            endLineNumber: endPosition.lineNumber,
                            endColumn: endPosition.column,
                        });
                        monacoEditor.revealLinesInCenter(
                            position.lineNumber,
                            endPosition.lineNumber,
                            1 /* Immediate scrolling */
                        );
                    }
                    monacoEditor.focus();
                }, 100);
                return true;
            }
        }

        return false;
    }

    private _focusEditor() {
        this.$nextTick(() => {
            let editor = this.getMultilineEditor();
            editor?.focusEditor();
        });
    }

    onEditorModelChanged(event: monaco.editor.IModelChangedEvent) {
        if (event.newModelUrl) {
            const action = this._tagSelectionEvents.get(
                event.newModelUrl.toString()
            );
            if (action) {
                this._tagSelectionEvents.delete(event.newModelUrl.toString());
                this._changeEditorSelection(
                    event.newModelUrl.toString(),
                    action.selectionStart,
                    action.selectionEnd
                );
            }
        }
    }
}
