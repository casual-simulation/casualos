import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import {
    Bot,
    BotCalculationContext,
    calculateFormattedBotValue,
    calculateBotValue,
    isFormula,
    BotLabelAlignment,
    getBotLabelAlignment,
    CLICK_ACTION_NAME,
    onClickArg,
    ANY_CLICK_ACTION_NAME,
    onAnyClickArg,
    hasValue,
    getBotScale,
    calculateStringTagValue,
    calculateNumericalTagValue,
    clamp,
    onPointerUpDownArg,
    onPointerEnterExitArg,
    ON_POINTER_ENTER,
    ON_POINTER_EXIT,
    ON_ANY_POINTER_EXIT,
    ON_ANY_POINTER_ENTER,
    MenuBotForm,
    getMenuBotForm,
    ON_SUBMIT_ACTION_NAME,
    onSubmitArg,
    ON_INPUT_TYPING_ACTION_NAME,
    TEMPORARY_BOT_PARTITION_ID,
    getSpaceForTag,
    getTagValueForSpace,
    MenuBotResolvedHoverStyle,
    getMenuBotHoverStyle,
    ON_POINTER_DOWN,
    ON_POINTER_UP,
    ON_ANY_POINTER_UP,
    ON_ANY_POINTER_DOWN,
    getBotCursor,
    getCursorCSS,
    getPortalTag,
    asyncResult,
    asyncError,
    calculateBooleanTagValue,
    getMenuBotSubtype,
    MenuBotSubtype,
} from '@casual-simulation/aux-common';
import { appManager } from '../../shared/AppManager';
import { DimensionItem } from '../DimensionItem';
import { first } from '@casual-simulation/aux-common';
import { safeParseURL } from '../PlayerUtils';
import PieProgress from '../../shared/vue-components/PieProgress/PieProgress';
import { Input } from '../../shared/scene/Input';
import { SvgIcon } from '@casual-simulation/aux-components';
import { Subscription } from 'rxjs';
import { BotManager } from '@casual-simulation/aux-vm-browser';

@Component({
    components: {
        'svg-icon': SvgIcon,
        // 'cube-icon': CubeIcon,
        // 'egg-icon': EggIcon,
        // 'helix-icon': HelixIcon,
        'pie-progress': PieProgress,
    },
})
export default class MenuBot extends Vue {
    @Prop() item: DimensionItem;
    @Prop() index: number;
    @Prop({ default: false })
    selected: boolean;

    label: string = '';
    labelColor: string = '#000';
    labelAlign: BotLabelAlignment = 'center';
    backgroundColor: string = '#FFF';
    scaleY: number | 'auto' = 1;
    extraStyle: any = {};
    extraLabelStyle: any = {};
    icon: string = null;
    iconIsURL: boolean = false;
    progress: number = null;
    progressBarForeground: string = null;
    progressBarBackground: string = null;
    text: string = null;
    form: MenuBotForm = 'button';
    subType: MenuBotSubtype = 'input';
    hoverStyle: MenuBotResolvedHoverStyle = 'hover';
    cursor: string = null;
    alwaysShowSubmit: boolean = false;

    private _down: boolean = false;
    private _hover: boolean = false;
    private _updatingText: boolean = false;
    private _sub: Subscription;
    private _currentSimId: string;

    get hasProgress() {
        return hasValue(this.progress);
    }

    get hasIcon() {
        return hasValue(this.icon);
    }

    get style(): any {
        return {
            ...this.extraStyle,
            'background-color': this.backgroundColor,
            height: this.scaleY === 'auto' ? 'auto' : this.scaleY * 40 + 'px',
        };
    }

    get labelStyle(): any {
        return {
            ...this.extraLabelStyle,
        };
    }

    get inputStyleVariables() {
        return {
            '--menu-label-color': this.labelColor || 'rgba(0,0,0,0.54)',
        };
    }

    get whiteSpace() {
        return (
            this.extraStyle?.['white-space'] ??
            this.extraStyle?.['whiteSpace'] ??
            'normal'
        );
    }

    @Watch('item')
    private async _botChanged(item: DimensionItem) {
        if (item) {
            const simulation = _simulation(item);
            const calc = simulation.helper.createContext();
            this._updateLabel(calc, item.bot);
            this._updateColor(calc, item.bot);
            this._updateAlignment(calc, item.bot);
            this._updateScale(calc, item.bot);
            this._updateStyle(calc, item.bot);
            this._updateIcon(calc, item.bot);
            this._updateProgress(calc, item.bot);
            this._updateForm(calc, item.bot);
            this._updateFormSubtype(calc, item.bot);
            this._updateText(calc, item.bot);
            this._updateCursor(calc, item.bot);
            this._updateAlwaysShowSubmit(calc, item.bot);

            this._updateSim(simulation);
        } else {
            this.label = '';
            this.labelColor = '#000';
            this.backgroundColor = '#FFF';
            this.scaleY = 1;
            this.extraStyle = {};
            this.icon = null;
            this.iconIsURL = false;
            this.progress = null;
            this.form = 'button';
            this.subType = 'input';
            this.text = '';
            this.cursor = null;
            this.alwaysShowSubmit = false;
        }
    }

    constructor() {
        super();
    }

    mounted() {
        this._botChanged(this.item);
        this.mouseUp = this.mouseUp.bind(this);
        this.touchStart = this.touchStart.bind(this);
        this.touchEnd = this.touchEnd.bind(this);
        this.touchCancel = this.touchCancel.bind(this);
        window.addEventListener('mouseup', this.mouseUp);
        window.addEventListener('touchstart', this.touchStart);
    }

    beforeDestroy() {
        window.removeEventListener('mouseup', this.mouseUp);
        window.removeEventListener('touchstart', this.touchStart);

        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    async click() {
        const simulation = _simulation(this.item);
        const dimension = first(this.item.dimensions.values());
        simulation.helper.action(
            CLICK_ACTION_NAME,
            [this.item.bot],
            onClickArg(null, dimension, null, 'mouse', null, null)
        );
        simulation.helper.action(
            ANY_CLICK_ACTION_NAME,
            null,
            onAnyClickArg(
                null,
                dimension,
                this.item.bot,
                null,
                'mouse',
                null,
                null
            )
        );
    }

    async mouseDown() {
        this._down = true;

        const simulation = _simulation(this.item);
        const dimension = first(this.item.dimensions.values());
        let arg = onPointerUpDownArg(this.item.bot, dimension);
        simulation.helper.transaction(
            ...simulation.helper.actions([
                {
                    eventName: ON_POINTER_DOWN,
                    bots: [this.item.bot],
                    arg,
                },
                {
                    eventName: ON_ANY_POINTER_DOWN,
                    bots: null,
                    arg,
                },
            ])
        );
    }

    async mouseEnter() {
        this._hover = true;
        const simulation = _simulation(this.item);
        const dimension = first(this.item.dimensions.values());
        simulation.helper.transaction(
            ...simulation.helper.actions([
                {
                    eventName: ON_POINTER_ENTER,
                    bots: [this.item.bot],
                    arg: onPointerEnterExitArg(
                        this.item.bot,
                        dimension,
                        'mouse',
                        null,
                        null
                    ),
                },
                {
                    eventName: ON_ANY_POINTER_ENTER,
                    bots: null,
                    arg: onPointerEnterExitArg(
                        this.item.bot,
                        dimension,
                        'mouse',
                        null,
                        null
                    ),
                },
            ])
        );
    }

    async mouseLeave() {
        if (this._hover === true) {
            this._hover = false;
            const simulation = _simulation(this.item);
            const dimension = first(this.item.dimensions.values());
            simulation.helper.transaction(
                ...simulation.helper.actions([
                    {
                        eventName: ON_POINTER_EXIT,
                        bots: [this.item.bot],
                        arg: onPointerEnterExitArg(
                            this.item.bot,
                            dimension,
                            'mouse',
                            null,
                            null
                        ),
                    },
                    {
                        eventName: ON_ANY_POINTER_EXIT,
                        bots: null,
                        arg: onPointerEnterExitArg(
                            this.item.bot,
                            dimension,
                            'mouse',
                            null,
                            null
                        ),
                    },
                ])
            );
        }
    }

    async mouseUp() {
        if (this._down === true) {
            this._down = false;
            const simulation = _simulation(this.item);
            const dimension = first(this.item.dimensions.values());
            let arg = onPointerUpDownArg(this.item.bot, dimension);
            simulation.helper.transaction(
                ...simulation.helper.actions([
                    {
                        eventName: ON_POINTER_UP,
                        bots: [this.item.bot],
                        arg,
                    },
                    {
                        eventName: ON_ANY_POINTER_UP,
                        bots: null,
                        arg,
                    },
                ])
            );
        }
    }

    async touchStart(event: TouchEvent) {
        const isForThisElement = Input.isEventForAnyElement(event, [
            this.$el as HTMLElement,
        ]);
        if (isForThisElement) {
            event.target.addEventListener('touchend', this.touchEnd);
            event.target.addEventListener('touchcancel', this.touchCancel);

            this.mouseDown();
        }
    }

    touchEnd(event: TouchEvent) {
        event.target.removeEventListener('touchend', this.touchEnd);
        event.target.removeEventListener('touchcancel', this.touchCancel);

        this.mouseUp();
    }

    touchCancel(event: TouchEvent) {
        event.target.removeEventListener('touchend', this.touchEnd);
        event.target.removeEventListener('touchcancel', this.touchCancel);

        this.mouseUp();
    }

    async onTextUpdated() {
        if (!this._updatingText) {
            const simulation = _simulation(this.item);
            const hasDefaultValue = hasValue(
                getTagValueForSpace(this.item.bot, 'menuItemText', null)
            );
            await simulation.editBot(
                this.item.bot,
                'menuItemText',
                !hasDefaultValue || hasValue(this.text) ? this.text : false,
                TEMPORARY_BOT_PARTITION_ID
            );
            await simulation.helper.action(
                ON_INPUT_TYPING_ACTION_NAME,
                [this.item.bot],
                onSubmitArg(this.text)
            );
        }
    }

    async submitInput(dropFocus: boolean) {
        if (dropFocus) {
            const input = <Vue>this.$refs.textInput;
            if (input) {
                (input.$el as HTMLElement).blur();
            }
        }
        const simulation = _simulation(this.item);
        await simulation.helper.action(
            ON_SUBMIT_ACTION_NAME,
            [this.item.bot],
            onSubmitArg(this.text)
        );
    }

    private _updateColor(calc: BotCalculationContext, bot: Bot) {
        this.backgroundColor = calculateBotValue(calc, bot, 'auxColor');
        if (!hasValue(this.backgroundColor)) {
            this.backgroundColor = '#FFF';
        }
    }

    private _updateLabel(calc: BotCalculationContext, bot: Bot) {
        this.label = calculateFormattedBotValue(calc, bot, 'auxLabel');
        if (!hasValue(this.label)) {
            this.label = '';
        }

        this.labelColor = calculateFormattedBotValue(
            calc,
            bot,
            'auxLabelColor'
        );
        if (!hasValue(this.labelColor)) {
            this.labelColor = '#000';
        }
    }

    private _updateAlignment(calc: BotCalculationContext, bot: Bot) {
        this.labelAlign = getBotLabelAlignment(calc, bot);
    }

    private _updateScale(calc: BotCalculationContext, bot: Bot) {
        const isAuto = calculateBotValue(calc, bot, 'auxScaleY') === 'auto';
        if (isAuto) {
            this.scaleY = 'auto';
        } else {
            const scale = getBotScale(calc, bot, 1);
            this.scaleY = scale.y;
        }
    }

    private _updateStyle(calc: BotCalculationContext, bot: Bot) {
        let style = calculateBotValue(calc, bot, 'menuItemStyle');
        if (typeof style !== 'object') {
            style = null;
        }
        this.extraStyle = style || {};
        let labelStyle = calculateBotValue(calc, bot, 'menuItemLabelStyle');
        if (typeof labelStyle !== 'object') {
            labelStyle = null;
        }
        this.extraLabelStyle = labelStyle || {};
        this.hoverStyle = getMenuBotHoverStyle(calc, bot);
    }

    private _updateIcon(calc: BotCalculationContext, bot: Bot) {
        const icon = calculateStringTagValue(calc, bot, 'auxFormAddress', null);
        this.icon = icon;
        this.iconIsURL = !!safeParseURL(icon);
    }

    private _updateProgress(calc: BotCalculationContext, bot: Bot) {
        let progress = calculateNumericalTagValue(
            calc,
            bot,
            'auxProgressBar',
            null
        );

        this.progress = hasValue(progress) ? clamp(progress, 0, 1) : null;

        let colorTagValue: any = calculateBotValue(
            calc,
            bot,
            'auxProgressBarColor'
        );
        let bgColorTagValue: any = calculateBotValue(
            calc,
            bot,
            'auxProgressBarBackgroundColor'
        );

        this.progressBarForeground = hasValue(colorTagValue)
            ? colorTagValue
            : '#fff';
        this.progressBarBackground = hasValue(bgColorTagValue)
            ? bgColorTagValue
            : '#000';
    }

    private _updateForm(calc: BotCalculationContext, bot: Bot) {
        const form = getMenuBotForm(calc, bot);
        this.form = form;
    }

    private _updateFormSubtype(calc: BotCalculationContext, bot: Bot) {
        const subtype = getMenuBotSubtype(calc, bot);
        this.subType = subtype;
    }

    private _updateText(calc: BotCalculationContext, bot: Bot) {
        const space = getSpaceForTag(bot, 'menuItemText');
        const text = getTagValueForSpace(bot, 'menuItemText', space);

        if (text !== this.text) {
            this._ignoreTextUpdates(async () => {
                this.text = text === false ? '' : text;
            });
        }
    }

    private _updateCursor(calc: BotCalculationContext, bot: Bot) {
        this.cursor = getCursorCSS(getBotCursor(calc, bot));
    }

    private _updateAlwaysShowSubmit(calc: BotCalculationContext, bot: Bot) {
        this.alwaysShowSubmit = calculateBooleanTagValue(
            calc,
            bot,
            'menuItemShowSubmitWhenEmpty',
            false
        );
    }

    private async _ignoreTextUpdates(action: (text: string) => Promise<void>) {
        try {
            this._updatingText = true;
            await action(this.text);
        } finally {
            this._updatingText = false;
        }
    }

    private _updateSim(simulation: BotManager) {
        if (this._currentSimId !== simulation.id) {
            this._currentSimId = simulation.id;

            if (this._sub) {
                this._sub.unsubscribe();
            }
            this._sub = new Subscription();

            this._sub.add(
                simulation.localEvents.subscribe((e) => {
                    if (e.type === 'focus_on') {
                        if (hasValue(e.portal)) {
                            const targetPortal = getPortalTag(e.portal);
                            if (targetPortal !== 'menuPortal') {
                                return;
                            }
                        }
                        if (e.botId === this.item.bot.id) {
                            // focus this input
                            const input = <Vue>this.$refs.textInput;
                            if (input) {
                                try {
                                    (input.$el as HTMLElement).focus();
                                    if (
                                        hasValue(e.taskId) &&
                                        hasValue(e.portal)
                                    ) {
                                        simulation.helper.transaction(
                                            asyncResult(e.taskId, null)
                                        );
                                    }
                                } catch (err) {
                                    if (
                                        hasValue(e.taskId) &&
                                        hasValue(e.portal)
                                    ) {
                                        simulation.helper.transaction(
                                            asyncError(
                                                e.taskId,
                                                `Could not focus the bot. ${err}`
                                            )
                                        );
                                    }
                                }
                            } else {
                                if (hasValue(e.taskId) && hasValue(e.portal)) {
                                    simulation.helper.transaction(
                                        asyncError(
                                            e.taskId,
                                            `Could not focus the bot because it is not an input bot.`
                                        )
                                    );
                                }
                            }
                        }
                    }
                })
            );
        }
    }
}

function _simulation(item: any) {
    return appManager.simulationManager.simulations.get(item.simulationId);
}
