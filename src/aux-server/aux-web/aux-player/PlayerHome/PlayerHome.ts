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
import { Watch, Prop } from 'vue-property-decorator';
import type {
    BotTags,
    PrecalculatedBot,
    BotAction,
    BiosOption,
} from '@casual-simulation/aux-common';
import {
    calculateBotValue,
    hasValue,
    QUERY_PORTALS,
    KNOWN_PORTALS,
    ON_PLAYER_PORTAL_CHANGED_ACTION_NAME,
    calculateStringTagValue,
    calculateStringListTagValue,
    ON_PORTAL_CHANGED_ACTION_NAME,
    QUERY_FULL_HISTORY_TAGS,
    QUERY_PARTIAL_HISTORY_TAGS,
    getBotTheme,
} from '@casual-simulation/aux-common';
import PlayerGameView from '../PlayerGameView/PlayerGameView';
import {
    PLAYER_OWNER,
    PUBLIC_OWNER,
    appManager,
} from '../../shared/AppManager';
import { first } from 'rxjs/operators';
import type { Dictionary } from 'vue-router/types/router';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import {
    getUserBotAsync,
    userBotTagsChanged,
} from '@casual-simulation/aux-vm-browser';
import type { UpdatedBotInfo } from '@casual-simulation/aux-vm';
import { intersection, isEqual } from 'lodash';
import type { Subscription } from 'rxjs';
import type { Config } from 'unique-names-generator';
import { uniqueNamesGenerator } from 'unique-names-generator';
import adjectives from '../../shared/dictionaries/adjectives';
import colors from '../../shared/dictionaries/colors';
import animals from '../../shared/dictionaries/animals';
import { setTheme } from '../../shared/StyleHelpers';
import { getInstParameters, getPermalink } from '../UrlUtils';
import type { FormError } from '@casual-simulation/aux-common';
import FieldErrors from '../../shared/vue-components/FieldErrors/FieldErrors';
import { MdField } from 'vue-material/dist/components';
import { sortInsts } from '../PlayerUtils';
import { getSimulationId } from '../../../shared/SimulationHelpers';

Vue.use(MdField);

const namesConfig: Config = {
    dictionaries: [adjectives, colors, animals],
    separator: '-',
};

function isPrivateInst(
    biosOption: BiosOption
): biosOption is 'private inst' | 'studio inst' | 'studio' {
    return (
        biosOption === 'private inst' ||
        biosOption === 'studio inst' ||
        biosOption === 'studio'
    );
}

function isPublicInst(
    biosOption: BiosOption
): biosOption is 'public inst' | 'free inst' | 'free' {
    return (
        biosOption === 'public inst' ||
        biosOption === 'free inst' ||
        biosOption === 'free'
    );
}

function isStaticInst(
    biosOption: BiosOption
): biosOption is 'static inst' | 'local inst' | 'local' {
    return (
        biosOption === 'static inst' ||
        biosOption === 'local inst' ||
        biosOption === 'local'
    );
}

function isJoinCode(
    biosOption: BiosOption
): biosOption is 'enter join code' | 'join inst' {
    return biosOption === 'enter join code' || biosOption === 'join inst';
}

const MdOption = Vue.component('MdOption');
const BiosOptionComponent = MdOption.extend({
    methods: {
        getTextContent() {
            const el = this.$el as HTMLElement;
            if (el) {
                const queryResult = el.querySelector(
                    '.md-list-item-text > span'
                );
                if (queryResult) {
                    return queryResult.textContent.trim();
                }
                return el.textContent.trim();
            }
            const slot = this.$slots.default;
            const slotText = slot ? slot[0]?.text?.trim() : '';
            return slotText ?? '';
        },
    },
});

const MdSelect = Vue.component('MdSelect');
const BiosSelectComponent = MdSelect.extend({
    methods: {
        setFieldContent() {
            // Overrides the default MdSelect#setFieldContent method
            // to ensure that it actually works for the BIOS selection dialog.
            // For some reason, the default version doesn't work because of the multiple-line item description issue.
            this.MdSelect.label = this.localValue;
        },
    },
});

@Component({
    components: {
        'game-view': PlayerGameView,
        'field-errors': FieldErrors,
        'bios-option': BiosOptionComponent,
        'bios-select': BiosSelectComponent,
    },
})
export default class PlayerHome extends Vue {
    @Prop() query: Dictionary<string[] | string>;
    @Prop() url: string;

    debug: boolean = false;
    isLoading: boolean = false;
    showBios: boolean = false;
    showLoggingIn: boolean = false;
    biosOptions: BiosOption[] = [];
    biosSelection: BiosOption = null;

    recordsOptions: string[] = [];
    instOptions: string[] = [];

    recordSelection: string = null;
    instSelection: string = null;
    joinCode: string = null;
    instName: string = null;
    privacyPolicyUrl: string = null;
    termsOfServiceUrl: string = null;
    codeOfConductUrl: string = null;
    supportUrl: string = null;
    logoUrl: string = null;
    logoTitle: string = null;
    generatedName: string = null;

    errors: FormError[] = [];

    private _loadedStaticInst: boolean = false;

    private _simulations: Map<BrowserSimulation, Subscription>;

    get isPrivoCertified() {
        return appManager.config?.requirePrivoLogin;
    }

    get joinCodeClass() {
        const hasJoinCodeError = this.errors.some((e) => e.for === 'joinCode');
        return hasJoinCodeError ? 'md-invalid' : '';
    }

    get showInstNameInput() {
        return (
            isStaticInst(this.biosSelection) &&
            this.instSelection === 'new-inst'
        );
    }

    get botManager() {
        return appManager.simulationManager.primary;
    }

    get canLoad() {
        if (this.biosSelection) {
            if (isJoinCode(this.biosSelection)) {
                return !!this.joinCode;
            } else {
                return true;
            }
        } else {
            return false;
        }
    }

    get startButtonLabel() {
        if (
            isPublicInst(this.biosSelection) ||
            isPrivateInst(this.biosSelection) ||
            isStaticInst(this.biosSelection) ||
            isJoinCode(this.biosSelection)
        ) {
            return 'Load';
        } else if (
            this.biosSelection === 'sign in' ||
            this.biosSelection === 'sign up' ||
            this.biosSelection === 'sign out'
        ) {
            return 'Continue';
        } else {
            return 'Load';
        }
    }

    get biosSelectionOptions() {
        if (!this.biosOptions) {
            return [];
        }
        return this.biosOptions.filter(
            (option) =>
                option !== 'sign in' &&
                option !== 'sign up' &&
                option !== 'sign out'
        );
    }

    hasOptionDescription(option: BiosOption): boolean {
        if (
            isPrivateInst(option) ||
            isPublicInst(option) ||
            isStaticInst(option) ||
            isJoinCode(option)
        ) {
            return true;
        }

        return false;
    }

    getOptionDescription(option: BiosOption): string {
        if (isStaticInst(option)) {
            return 'bots are stored in your browser on your device';
        } else if (isPrivateInst(option)) {
            return 'bots are stored in the cloud and shared with studio members';
        } else if (isPublicInst(option)) {
            return 'bots are stored in the cloud and shared publicly, expires in 24h';
        } else if (isJoinCode(option)) {
            return 'enter a join code to load an existing inst';
        }
        return '';
    }

    canSignOut(): boolean {
        return this.biosOptions.some((option) => option === 'sign out');
    }

    canSignIn(): boolean {
        return this.biosOptions.some((option) => option === 'sign in');
    }

    canSignUp(): boolean {
        return this.biosOptions.some((option) => option === 'sign up');
    }

    isStaticInst(option: BiosOption): boolean {
        return isStaticInst(option);
    }

    @Watch('query')
    async onQueryChanged(newValue: any, oldQuery: any) {
        const staticInst = this.query['staticInst'] as string | string[];
        const inst = this.query['inst'] as string | string[];
        let recordName =
            this.query['owner'] ??
            this.query['record'] ??
            this.query['player'] ??
            null;
        if (hasValue(staticInst)) {
            await this._setServer(recordName, staticInst, true);
        } else if (hasValue(inst)) {
            await this._setServer(recordName, inst, false);
        }
        for (let [sim, sub] of this._simulations) {
            getUserBotAsync(sim).subscribe({
                next: (bot) => {
                    this._updatePlayerTags(sim, bot, Object.keys(oldQuery));
                },
                error: (err) => console.error(err),
            });
        }
    }

    @Watch('url')
    async onUrlChanged() {
        for (let [sim, sub] of this._simulations) {
            getUserBotAsync(sim).subscribe({
                next: (bot) => {
                    this._updateUrlTag(sim, bot);
                },
                error: (err) => console.error(err),
            });
        }
    }

    @Watch('biosSelection')
    async onBiosSelectionChanged() {
        if (isStaticInst(this.biosSelection)) {
            this.instOptions = await appManager.listStaticInsts();
            if (!this.instOptions.includes(this.instSelection)) {
                this.instSelection = 'new-inst';
            }
        } else {
            this.instOptions = [];
            this.instSelection = null;
        }
    }

    constructor() {
        super();
    }

    async created() {
        this.isLoading = true;
        this.showBios = false;
        this.biosSelection = null;
        this.recordSelection = null;
        this.instSelection = 'new-inst';
        this.instName = '';
        this.biosOptions = [];
        this.errors = [];
        this._simulations = new Map();
        this.logoUrl = appManager.comIdConfig?.logoUrl;
        this.generatedName = uniqueNamesGenerator(namesConfig);
        this.logoTitle =
            appManager.comIdConfig?.displayName ??
            appManager.comIdConfig?.comId ??
            '';

        appManager.simulationManager.simulationAdded.subscribe((sim) => {
            const sub = this._setupSimulation(sim);
            this._simulations.set(sim, sub);
        });

        appManager.simulationManager.simulationRemoved.subscribe((sim) => {
            let sub = this._simulations.get(sim);
            if (sub) {
                sub.unsubscribe();
            }
        });

        await this._executeOrShowBios();

        appManager.auth.primary.getPolicyUrls().then((urls) => {
            this.privacyPolicyUrl = urls.privacyPolicyUrl;
            this.termsOfServiceUrl = urls.termsOfServiceUrl;
            this.codeOfConductUrl = urls.codeOfConductUrl;
            this.supportUrl = urls.supportUrl;
        });
    }

    private async _executeOrShowBios() {
        if (import.meta.env.MODE === 'static') {
            this.executeBiosOption('local inst', null, null, null);
        } else if (this.query) {
            const params = getInstParameters(this.query);

            if (params) {
                this._setServer(
                    params.recordName,
                    params.inst,
                    params.isStatic
                );

                if ('bios' in this.query) {
                    this._updateQuery({
                        bios: null,
                    });
                }
            } else {
                const joinCode = this.query['joinCode'];
                if (joinCode) {
                    const code = Array.isArray(joinCode)
                        ? joinCode[0]
                        : joinCode;
                    this._loadJoinCode(code);
                } else {
                    const biosOption =
                        this.query['bios'] ??
                        appManager.config.automaticBiosOption;

                    let hasValidBiosOption = false;
                    if (biosOption) {
                        const bios = getFirst(biosOption) as BiosOption;
                        const options = await this._getBiosOptions();

                        if (
                            options.some(
                                (o) =>
                                    o === bios ||
                                    (isStaticInst(o) && isStaticInst(bios)) ||
                                    (isPrivateInst(o) && isPrivateInst(bios)) ||
                                    (isPublicInst(o) && isPublicInst(bios))
                            )
                        ) {
                            this.biosSelection = bios;
                            if (
                                !isJoinCode(bios) &&
                                bios !== 'sign up' &&
                                bios !== 'sign in' &&
                                bios !== 'sign out'
                            ) {
                                hasValidBiosOption = true;
                                this.executeBiosOption(bios, null, null, null);
                            }
                        }
                    }

                    if (!hasValidBiosOption) {
                        if (!this.biosSelection) {
                            this.biosSelection =
                                appManager.config.defaultBiosOption;
                        }
                        this._showBiosOptions();
                    }
                }
            }
        }
    }

    private async _showBiosOptions() {
        this.showBios = true;
        const options = await this._getBiosOptions();
        this.biosOptions = options;

        // If we show the BIOS options, then
        // we should have time to initialize the service worker
        appManager.initOffline();
    }

    async signIn() {
        await this.executeBiosOption('sign in', null, null, null);
    }

    async signOut() {
        await this.executeBiosOption('sign out', null, null, null);
    }

    async signUp() {
        await this.executeBiosOption('sign up', null, null, null);
    }

    isJoinCode(option: BiosOption) {
        return isJoinCode(option);
    }

    private async _deleteInst(inst: string) {
        if (window.confirm(`Are you sure you want to delete ${inst}?`)) {
            await appManager.deleteStaticInst(inst);
            this.instSelection = 'new-inst';
            this.instOptions = await appManager.listStaticInsts();
        }
        this.showBios = true;
    }

    async executeBiosOption(
        option: BiosOption,
        recordName: string,
        inst: string,
        joinCode: string
    ) {
        this.showBios = false;
        console.log('selection', option, recordName, inst);
        if (option === 'sign in' || option === 'sign up') {
            try {
                if (option === 'sign in') {
                    this.showLoggingIn = true;
                }
                await appManager.auth.primary.authenticate(option);
            } finally {
                this.showLoggingIn = false;
                this.biosSelection = null;
                await this._executeOrShowBios();
            }
        } else if (option === 'sign out') {
            await appManager.auth.primary.logout();
            this.biosSelection = null;
            this._showBiosOptions();
        } else if (isStaticInst(option)) {
            this._loadStaticInst(inst);
        } else if (isPrivateInst(option)) {
            this._loadPrivateInst();
        } else if (isPublicInst(option)) {
            this._loadPublicInst();
        } else if (isJoinCode(option)) {
            this._loadJoinCode(joinCode);
        } else if (option === 'delete inst') {
            this._deleteInst(inst);
        } else {
            this.showBios = true;
        }
    }

    async cancelLogin() {
        this.showLoggingIn = false;
        await appManager.auth.primary.cancelLogin();
    }

    async showAccountInfo() {
        await appManager.authCoordinator.showAccountInfo(null);
    }

    private _loadStaticInst(instSelection: string) {
        const update: Dictionary<string | string[]> = {};
        const inst =
            !instSelection || instSelection === 'new-inst'
                ? this.instName && this.instName.trim() !== ''
                    ? this.instName.trim()
                    : this.generatedName
                : instSelection;

        update.staticInst = inst;
        update.bios = null;

        if (!hasValue(this.query['gridPortal'])) {
            update.gridPortal = 'home';
        }

        if (Object.keys(update).length > 0) {
            this._updateQuery(update);
        }

        this._setServer(null, inst, true);
    }

    private async _loadJoinCode(joinCode: string) {
        if (!joinCode) {
            this.errors = [
                ...this.errors.filter((e) => e.for !== 'joinCode'),
                {
                    for: 'joinCode',
                    errorCode: 'invalid_join_code',
                    errorMessage: 'A join code must be provided.',
                },
            ];
            this.showBios = true;
            return;
        }
        const update: Dictionary<string | string[]> = {};
        const inst = uniqueNamesGenerator(namesConfig);

        update.staticInst = inst;
        update.joinCode = joinCode;
        update.bios = null;

        if (!hasValue(this.query['gridPortal'])) {
            update.gridPortal = 'home';
        }

        if (Object.keys(update).length > 0) {
            this._updateQuery(update);
        }

        this._setServer(null, inst, true);
    }

    private _loadPrivateInst() {
        const userId =
            appManager.auth.primary.currentLoginStatus.authData?.userId;

        if (userId) {
            const update: Dictionary<string | string[]> = {};
            const inst = uniqueNamesGenerator(namesConfig);

            update.owner = userId;
            update.inst = inst;
            update.bios = null;

            if (!hasValue(this.query['gridPortal'])) {
                update.gridPortal = 'home';
            }

            if (Object.keys(update).length > 0) {
                this._updateQuery(update);
            }

            this._setServer(userId, inst, false);
        }
    }

    private _loadPublicInst() {
        const update: Dictionary<string | string[]> = {};
        const inst = uniqueNamesGenerator(namesConfig);

        update.owner = PUBLIC_OWNER;
        update.inst = inst;
        update.bios = null;

        if (!hasValue(this.query['gridPortal'])) {
            update.gridPortal = 'home';
        }

        if (Object.keys(update).length > 0) {
            this._updateQuery(update);
        }

        this._setServer(PUBLIC_OWNER, inst, false);
    }

    private async _getBiosOptions(): Promise<BiosOption[]> {
        const privacyFeatures =
            appManager.auth.primary.currentLoginStatus?.authData
                ?.privacyFeatures ?? appManager.defaultPrivacyFeatures;
        const authenticated = await appManager.auth.primary.isAuthenticated();
        return (
            appManager.config.allowedBiosOptions ?? [
                'enter join code',
                'local',
                'studio',
                'free',
                'sign in',
                'sign up',
                'sign out',
            ]
        ).filter((option) => {
            if (
                isPrivateInst(option) &&
                privacyFeatures.publishData &&
                authenticated
            ) {
                return true;
            } else if (
                isPublicInst(option) &&
                privacyFeatures.allowPublicInsts
            ) {
                return true;
            } else if (isStaticInst(option)) {
                return true;
            } else if (
                (option === 'sign in' || option === 'sign up') &&
                !authenticated
            ) {
                if (
                    option === 'sign up' &&
                    !appManager.config?.requirePrivoLogin
                ) {
                    return false;
                } else {
                    return true;
                }
            } else if (option === 'sign out' && authenticated) {
                return true;
            } else if (isJoinCode(option) && privacyFeatures.allowPublicInsts) {
                return true;
            } else {
                return false;
            }
        });
    }

    private _setupSimulation(sim: BrowserSimulation): Subscription {
        let setInitialValues = false;
        return userBotTagsChanged(sim).subscribe({
            next: (update) => {
                if (!setInitialValues) {
                    setInitialValues = true;
                    this._updatePlayerTags(sim, update.bot);
                } else {
                    if (sim.id === appManager.simulationManager.primary.id) {
                        this._handleQueryUpdates(sim, update);
                        if (update.tags.has('inst')) {
                            // inst changed - update it
                            const calc = sim.helper.createContext();
                            const inst = calculateStringListTagValue(
                                calc,
                                update.bot,
                                'inst',
                                null
                            );
                            const recordName =
                                calculateStringTagValue(
                                    calc,
                                    update.bot,
                                    'record',
                                    null
                                ) ??
                                calculateStringTagValue(
                                    calc,
                                    update.bot,
                                    'player',
                                    null
                                );
                            if (hasValue(inst)) {
                                // Handle changing inst tag
                                const wasStatic = !!this._loadedStaticInst;
                                const final = {
                                    ...this.$route,
                                    query: {
                                        ...this.query,
                                    },
                                };

                                let hasChange = false;
                                if (wasStatic) {
                                    if (
                                        !areEqualInstLists(
                                            final.query.staticInst,
                                            inst
                                        )
                                    ) {
                                        final.query.staticInst = inst;
                                        hasChange = true;
                                    }
                                } else {
                                    if (
                                        !areEqualInstLists(
                                            final.query.inst,
                                            inst
                                        )
                                    ) {
                                        final.query.inst = inst;
                                        hasChange = true;
                                    }
                                }

                                if (hasChange) {
                                    window.history.pushState(
                                        {},
                                        window.document.title
                                    );
                                    this.$router.replace(final);
                                    this._setServer(
                                        recordName,
                                        inst,
                                        wasStatic
                                    );
                                }
                            }
                        }

                        if (update.tags.has('pageTitle')) {
                            // Title changed - update it
                            const title = calculateStringTagValue(
                                null,
                                update.bot,
                                'pageTitle',
                                'CasualOS'
                            );
                            document.title = title;
                        }

                        if (update.tags.has('theme')) {
                            const theme = getBotTheme(null, update.bot);
                            setTheme(theme);
                        }
                    }
                }

                this._sendPortalChangedEvents(sim, update);
            },
            error: (err) => console.log(err),
        });
    }

    private async _sendPortalChangedEvents(
        sim: BrowserSimulation,
        update: UpdatedBotInfo
    ) {
        const actions: BotAction[] = [];
        const calc = sim.helper.createContext();
        for (let portal of KNOWN_PORTALS) {
            if (update.tags.has(portal)) {
                const value = calculateBotValue(calc, update.bot, portal);
                actions.push(
                    ...sim.helper.actions([
                        {
                            bots: null,
                            eventName: ON_PORTAL_CHANGED_ACTION_NAME,
                            arg: {
                                portal: portal,
                                dimension: value,
                            },
                        },
                        {
                            bots: null,
                            eventName: ON_PLAYER_PORTAL_CHANGED_ACTION_NAME,
                            arg: {
                                portal: portal,
                                dimension: value,
                            },
                        },
                    ])
                );
            }
        }

        if (actions.length > 0) {
            await sim.helper.transaction(...actions);
        }
    }

    private async _setServer(
        recordName: string | string[],
        newServer: string | string[],
        isStatic: boolean
    ) {
        this._loadedStaticInst = isStatic;
        const owner = getFirst(recordName);
        let recordInfo = appManager.getRecordName(owner);

        while (recordInfo.owner === PLAYER_OWNER && !recordInfo.recordName) {
            await appManager.auth.primary.authenticate();
            recordInfo = appManager.getRecordName(owner);
        }

        const record = recordInfo.recordName;
        if (typeof newServer === 'string') {
            await this._loadPrimarySimulation(record, newServer, isStatic);

            if (appManager.simulationManager.simulations.size >= 2) {
                const simId = getSimulationId(record, newServer, isStatic);
                await appManager.simulationManager.removeNonMatchingSimulations(
                    simId
                );
            }
        } else if (newServer.length === 1) {
            const server = newServer[0];
            await this._loadPrimarySimulation(record, server, isStatic);

            if (appManager.simulationManager.simulations.size >= 2) {
                const simId = getSimulationId(record, server, isStatic);
                await appManager.simulationManager.removeNonMatchingSimulations(
                    simId
                );
            }
        } else {
            if (!appManager.simulationManager.primary) {
                await this._loadPrimarySimulation(
                    record,
                    newServer[0],
                    isStatic
                );
            }
            await appManager.simulationManager.updateSimulations(
                newServer.map((s) => ({
                    id: getSimulationId(record, s, isStatic),
                    options: {
                        recordName: record,
                        inst: s,
                        isStatic: isStatic,
                    },
                }))
            );
        }
    }

    private async _loadPrimarySimulation(
        recordName: string,
        newServer: string,
        isStatic: boolean
    ) {
        const sim = await appManager.setPrimarySimulation(
            recordName,
            newServer,
            isStatic
        );
        sim.connection.syncStateChanged
            .pipe(first((synced) => synced))
            .subscribe(() => {
                this.isLoading = false;
            });
    }

    private async _updatePlayerTags(
        botManager: BrowserSimulation,
        bot: PrecalculatedBot,
        oldTags?: string[]
    ) {
        const calc = botManager.helper.createContext();
        const tags = Object.keys(this.query);
        let changes: BotTags = {};
        let hasChange = false;
        for (let tag of tags) {
            if (tag === 'sessionKey' || tag === 'connectionKey') {
                continue;
            }
            const oldValue = calculateBotValue(calc, bot, tag);
            const newValue = this.query[tag];
            if (newValue !== oldValue) {
                changes[tag] = newValue;
                hasChange = true;
            }
        }
        if (oldTags) {
            for (let tag of oldTags) {
                if (!tags.includes(tag)) {
                    changes[tag] = null;
                }
            }
        }
        if (bot.tags.url !== location.href) {
            changes.url = location.href;
            hasChange = true;
        }
        const permalink = getPermalink(
            location.href,
            botManager.origin.recordName
        );
        if (bot.tags.permalink !== permalink) {
            changes.permalink = permalink;
            hasChange = true;
        }
        const recordName = botManager.origin.recordName;
        if (bot.tags.record !== recordName) {
            changes.record = recordName;
            hasChange = true;
        }
        if (
            hasChange &&
            botManager.origin.isStatic &&
            changes.staticInst !== bot.tags.inst
        ) {
            changes.inst = changes.staticInst;
        }
        if (hasChange && hasValue(changes.inst)) {
            changes.inst = sortInsts(changes.inst, botManager.inst);
        }
        if (hasChange) {
            await botManager.helper.updateBot(bot, {
                tags: changes,
            });
        }
    }

    private async _updateUrlTag(
        botManager: BrowserSimulation,
        bot: PrecalculatedBot
    ) {
        let changes: BotTags = {};
        let hasChange = false;
        if (bot.tags.url !== location.href) {
            changes.url = location.href;
            hasChange = true;
        }
        if (hasChange) {
            await botManager.helper.updateBot(bot, {
                tags: changes,
            });
        }
    }

    private _handleQueryUpdates(
        botManager: BrowserSimulation,
        update: UpdatedBotInfo
    ) {
        const calc = botManager.helper.createContext();
        const tags = intersection(
            [...update.tags],

            // Include the known portals so that they always update the URL
            [...Object.keys(this.query), ...QUERY_PORTALS]
        );
        let changes: Dictionary<any> = {};
        for (let tag of tags) {
            const oldValue = this.query[tag];
            const newValue = calculateBotValue(calc, update.bot, tag);
            if (!isEqual(newValue, oldValue)) {
                // The inst and staticInst tags are handled by the userBotTagsChanged handler
                if (tag === 'inst' || tag === 'staticInst') {
                    continue;
                }
                changes[tag] = newValue;
            }
        }

        this._updateQuery(changes);
    }

    private _updateQuery(changes: Dictionary<any>) {
        if (Object.keys(changes).length > 0) {
            const final = {
                ...this.$route,
                query: {
                    ...this.query,
                    ...changes,
                },
            };

            let pushState = false;
            for (let tag in changes) {
                if (QUERY_FULL_HISTORY_TAGS.has(tag)) {
                    pushState = true;
                    break;
                } else if (QUERY_PARTIAL_HISTORY_TAGS.has(tag)) {
                    const value = changes[tag];
                    const url = new URL(location.href);
                    const hasSearch = url.searchParams.has(tag);
                    pushState =
                        (!hasValue(value) && hasSearch) ||
                        (hasValue(value) && !hasSearch);
                    if (pushState) {
                        break;
                    }
                }
            }

            for (let param in final.query) {
                if (!hasValue(final.query[param])) {
                    delete final.query[param];
                }
            }

            if (pushState) {
                window.history.pushState({}, window.document.title);
            }
            this.$router.replace(final).then(undefined, (err: Error) => {
                // Ignore navigation duplicated errors
                if (err.name !== 'NavigationDuplicated') {
                    // Throw all other error types
                    throw err;
                }
            });
        }
    }
}

function getFirst(list: string | string[]): string {
    if (Array.isArray(list)) {
        return list[0];
    } else {
        return list;
    }
}

function areEqualInstLists(
    a: string | string[],
    b: string | string[]
): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && isEqual(a, b);
    } else if (Array.isArray(a)) {
        return a.length === 1 && a[0] === b;
    } else if (Array.isArray(b)) {
        return b.length === 1 && b[0] === a;
    } else {
        return a === b;
    }
}
