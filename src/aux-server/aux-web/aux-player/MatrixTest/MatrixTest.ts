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
} from '@casual-simulation/aux-common';
import { appManager } from '../../shared/AppManager';
import { DimensionItem } from '../DimensionItem';
import { first } from '@casual-simulation/causal-trees';
import { safeParseURL } from '../PlayerUtils';
import PieProgress from '../../shared/vue-components/PieProgress/PieProgress';
import { Input } from '../../shared/scene/Input';
import { SvgIcon } from '@casual-simulation/aux-components';
import { Subscription } from 'rxjs';
import { BotManager } from '@casual-simulation/aux-vm-browser';
import { v4 as uuid } from 'uuid';
import Matrix, { ClientEvent, MatrixClient } from 'matrix-js-sdk';
import {
    CallErrorCode,
    CallEvent,
    MatrixCall,
} from 'matrix-js-sdk/lib/webrtc/call';

const baseUrl = 'https://matrix.org';
const userId = 'TODO';
const accessToken = 'TODO';
const deviceId = uuid();
const roomId = `!room:test-casualos-room`;

@Component({
    components: {},
})
export default class MatrixTest extends Vue {
    private _matrix: MatrixClient;
    private _call: MatrixCall;

    remoteElement() {
        return this.$refs.remoteVideo as HTMLVideoElement;
    }

    localElement() {
        return this.$refs.localVideo as HTMLVideoElement;
    }

    created() {
        this._matrix = Matrix.createClient({
            baseUrl,
            userId,
            accessToken,
            deviceId,
        });
        this._matrix.on(ClientEvent.Sync, () => {
            console.log('[MatrixTest] Sync complete');
        });
        this._matrix.on('Call.incoming' as any, (call: MatrixCall) => {
            this._call = call;
            this._addCallListeners();
        });
    }

    call() {
        console.log('[MatrixTest] Making call...');
        this._call = Matrix.createNewMatrixCall(this._matrix, roomId, {});
        this._addCallListeners();
        this._call.placeVideoCall();
    }

    answer() {
        if (this._call) {
            this._call.answer();
        }
    }

    hangup() {
        if (this._call) {
            this._call.hangup(CallErrorCode.UserHangup, false);
            this._call = null;
        }
    }

    private _addCallListeners() {
        this._call.on(CallEvent.Hangup, () => {
            console.log('[MatrixTest] Hangup!');
        });

        this._call.on(CallEvent.Error, (err) => {
            console.error('[MatrixTest] Error!', err);
        });

        this._call.on(CallEvent.FeedsChanged, (feeds) => {
            const localFeed = feeds.find((feed) => feed.isLocal());
            const remoteFeed = feeds.find((feed) => !feed.isLocal());

            const remoteElement = this.remoteElement();
            const localElement = this.localElement();
            if (remoteFeed) {
                remoteElement.srcObject = remoteFeed.stream;
                remoteElement.play();
            }
            if (localFeed) {
                localElement.muted = true;
                localElement.srcObject = localFeed.stream;
                localElement.play();
            }
        });

        console.log('[MatrixTest] Call => %s', this._call);
    }
}
