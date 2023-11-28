import Vue from 'vue';
import Component from 'vue-class-component';
import { Watch, Prop } from 'vue-property-decorator';
import {
    goToDimension,
    calculateBotValue,
    BotTags,
    PrecalculatedBot,
    hasValue,
    BotCalculationContext,
    QUERY_PORTALS,
    KNOWN_PORTALS,
    BotAction,
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
    getSimulationId,
} from '../../shared/AppManager';
import { first } from 'rxjs/operators';
import { Dictionary } from 'vue-router/types/router';
import {
    BrowserSimulation,
    userBotChanged,
    getUserBotAsync,
    userBotTagsChanged,
} from '@casual-simulation/aux-vm-browser';
import { UpdatedBotInfo } from '@casual-simulation/aux-vm';
import { intersection, isEqual } from 'lodash';
import { Subscription } from 'rxjs';
import { uniqueNamesGenerator, Config } from 'unique-names-generator';
import adjectives from '../../shared/dictionaries/adjectives';
import colors from '../../shared/dictionaries/colors';
import animals from '../../shared/dictionaries/animals';
import { setTheme } from '../../shared/StyleHelpers';
import { getInstParameters, getPermalink } from '../UrlUtils';
import { BiosOption } from 'shared/WebConfig';
import { FormError } from '@casual-simulation/aux-records';
import FieldErrors from '../../shared/vue-components/FieldErrors/FieldErrors';

const namesConfig: Config = {
    dictionaries: [adjectives, colors, animals],
    separator: '-',
};

@Component({
    components: {
        'game-view': PlayerGameView,
        'field-errors': FieldErrors,
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

    errors: FormError[] = [];

    private _loadedStaticInst: boolean = false;

    private _simulations: Map<BrowserSimulation, Subscription>;

    get joinCodeClass() {
        const hasJoinCodeError = this.errors.some((e) => e.for === 'joinCode');
        return hasJoinCodeError ? 'md-invalid' : '';
    }

    get botManager() {
        return appManager.simulationManager.primary;
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
            getUserBotAsync(sim).subscribe(
                (bot) => {
                    this._updatePlayerTags(sim, bot, Object.keys(oldQuery));
                },
                (err) => console.error(err)
            );
        }
    }

    @Watch('url')
    async onUrlChanged() {
        for (let [sim, sub] of this._simulations) {
            getUserBotAsync(sim).subscribe(
                (bot) => {
                    this._updateUrlTag(sim, bot);
                },
                (err) => console.error(err)
            );
        }
    }

    @Watch('biosSelection')
    async onBiosSelectionChanged() {
        if (this.biosSelection === 'static inst') {
            this.instOptions = await appManager.listStaticInsts();
        } else {
            this.instOptions = [];
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
        this.biosOptions = [];
        this.errors = [];
        this._simulations = new Map();

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

        if (this.query) {
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
                    const biosOption = this.query['bios'];

                    let hasValidBiosOption = false;
                    if (biosOption) {
                        const bios = getFirst(biosOption) as BiosOption;
                        const options = await this._getBiosOptions();

                        if (options.some((o) => o === bios)) {
                            this.biosSelection = bios;
                            if (
                                bios !== 'enter join code' &&
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
                this._showBiosOptions();
            }
        } else if (option === 'sign out') {
            await appManager.auth.primary.logout();
            this.biosSelection = null;
            this._showBiosOptions();
        } else if (option === 'static inst') {
            this._loadStaticInst(inst);
        } else if (option === 'private inst') {
            this._loadPrivateInst();
        } else if (option === 'public inst') {
            this._loadPublicInst();
        } else if (option === 'enter join code') {
            this._loadJoinCode(joinCode);
        }
    }

    async cancelLogin() {
        this.showLoggingIn = false;
        await appManager.auth.primary.cancelLogin();
    }

    private _loadStaticInst(instSelection: string) {
        const update: Dictionary<string | string[]> = {};
        const inst =
            instSelection === 'new-inst' || !instSelection
                ? uniqueNamesGenerator(namesConfig)
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
                'static inst',
                'private inst',
                'public inst',
                'sign in',
                'sign up',
                'sign out',
            ]
        ).filter((option) => {
            if (
                option === 'private inst' &&
                privacyFeatures.publishData &&
                authenticated
            ) {
                return true;
            } else if (
                option === 'public inst' &&
                privacyFeatures.allowPublicInsts
            ) {
                return true;
            } else if (option === 'static inst') {
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
            } else if (
                option === 'enter join code' &&
                privacyFeatures.allowPublicInsts
            ) {
                return true;
            } else {
                return false;
            }
        });
    }

    private _setupSimulation(sim: BrowserSimulation): Subscription {
        let setInitialValues = false;
        return userBotTagsChanged(sim).subscribe(
            (update) => {
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
                                if (wasStatic) {
                                    final.query.staticInst = inst;
                                } else {
                                    final.query.inst = inst;
                                }
                                window.history.pushState(
                                    {},
                                    window.document.title
                                );
                                this.$router.replace(final);
                                this._setServer(recordName, inst, wasStatic);
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
            (err) => console.log(err)
        );
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
        const record = appManager.getRecordName(owner);
        if (typeof newServer === 'string') {
            await this._loadPrimarySimulation(record, newServer, isStatic);
        } else if (newServer.length === 1) {
            await this._loadPrimarySimulation(record, newServer[0], isStatic);
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
                    id: getSimulationId(record, s),
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
        owner: string,
        newServer: string,
        isStatic: boolean
    ) {
        const recordName = appManager.getRecordName(owner);
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
