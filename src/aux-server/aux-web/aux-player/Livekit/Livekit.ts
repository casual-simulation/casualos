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
    JoinRoomAction,
    LeaveRoomAction,
    action,
} from '@casual-simulation/aux-common';
import { appManager } from '../../shared/AppManager';
import { DimensionItem } from '../DimensionItem';
import { first } from '@casual-simulation/causal-trees';
import { safeParseURL } from '../PlayerUtils';
import PieProgress from '../../shared/vue-components/PieProgress/PieProgress';
import { Input } from '../../shared/scene/Input';
import { SvgIcon } from '@casual-simulation/aux-components';
import { Subscription, SubscriptionLike } from 'rxjs';
import { BotManager } from '@casual-simulation/aux-vm-browser';
import { Room, RoomEvent, Track } from 'livekit-client';
import { RoomJoin, RoomLeave, Simulation } from '@casual-simulation/aux-vm';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { store } from './LivekitTrackStore';

@Component({
    components: {},
})
export default class Livekit extends Vue {
    private _subs: SubscriptionLike[] = [];
    private _simulationSubs: Map<Simulation, SubscriptionLike[]>;

    private _rooms: Room[];

    created() {
        this._subs = [];
        this._simulationSubs = new Map();
        this._rooms = [];

        this._subs.push(
            appManager.simulationManager.simulationAdded
                .pipe(tap((sim) => this._simulationAdded(sim)))
                .subscribe(),
            appManager.simulationManager.simulationRemoved
                .pipe(tap((sim) => this._simulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        for (let sub of this._subs) {
            sub.unsubscribe();
        }
    }

    private _simulationAdded(sim: BotManager): void {
        let subs: SubscriptionLike[] = [];

        subs.push(
            sim.records.onRoomJoin.subscribe((join) =>
                this._joinRoom(sim, join)
            ),
            sim.records.onRoomLeave.subscribe((leave) =>
                this._leaveRoom(sim, leave)
            )
        );
        this._simulationSubs.set(sim, subs);
    }

    private _simulationRemoved(sim: BotManager): void {
        const subs = this._simulationSubs.get(sim);
        if (subs) {
            subs.forEach((s) => {
                s.unsubscribe();
            });
        }
        this._simulationSubs.delete(sim);
    }

    private async _joinRoom(sim: BotManager, join: RoomJoin) {
        try {
            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
            });

            room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
                console.log('[Livekit] Track subscribed!', track);

                if (
                    track.kind === Track.Kind.Video ||
                    track.kind === Track.Kind.Audio
                ) {
                    // const element = track.attach();
                    if (track.kind === Track.Kind.Video) {
                        const id = `${participant.identity}-${uuid()}`;
                        store.set(id, track);
                        sim.helper.action('onRemoteTrackSubscribed', null, {
                            remoteId: participant.identity,
                            address: `casualos://video-element/${id}`,
                            kind:
                                track.kind === Track.Kind.Video
                                    ? 'video'
                                    : 'audio',
                        });
                    }
                }
            })
                .on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
                    console.log('[LiveKit] Track unsubscribed!', track);
                    if (
                        track.kind === Track.Kind.Video ||
                        track.kind === Track.Kind.Audio
                    ) {
                        if (track.kind === Track.Kind.Video) {
                            const id = store.delete(track);
                            sim.helper.action(
                                'onRemoteTrackUnsubscribed',
                                null,
                                {
                                    remoteId: participant.identity,
                                    address: `casualos://video-element/${id}`,
                                    kind:
                                        track.kind === Track.Kind.Video
                                            ? 'video'
                                            : 'audio',
                                }
                            );
                        }
                    }
                })
                .on(RoomEvent.Disconnected, () => {
                    console.log('[Livekit] Disconnected!');
                    sim.helper.action('onRoomStreamLost', null, {
                        roomName: room.name,
                    });
                })
                .on(RoomEvent.Reconnected, () => {
                    console.log('[Livekit] Reconnected!');
                    sim.helper.action('onRoomStreaming', null, {
                        roomName: room.name,
                    });
                })
                .on(RoomEvent.LocalTrackPublished, (pub, participant) => {
                    const track = pub.track;
                    console.log('[Livekit] Track subscribed!', track);
                    if (
                        track.kind === Track.Kind.Video ||
                        track.kind === Track.Kind.Audio
                    ) {
                        if (track.kind === Track.Kind.Video) {
                            const id = `${participant.identity}-${uuid()}`;
                            store.set(id, track);
                            sim.helper.action('onLocalTrackSubscribed', null, {
                                remoteId: participant.identity,
                                address: `casualos://video-element/${id}`,
                                kind:
                                    track.kind === Track.Kind.Video
                                        ? 'video'
                                        : 'audio',
                            });
                        }
                    }
                })
                .on(RoomEvent.LocalTrackUnpublished, (pub, participant) => {
                    const track = pub.track;
                    console.log('[LiveKit] Track unsubscribed!', track);
                    if (
                        track.kind === Track.Kind.Video ||
                        track.kind === Track.Kind.Audio
                    ) {
                        if (track.kind === Track.Kind.Video) {
                            const id = store.delete(track);
                            sim.helper.action(
                                'onLocalTrackUnsubscribed',
                                null,
                                {
                                    remoteId: participant.identity,
                                    address: `casualos://video-element/${id}`,
                                    kind:
                                        track.kind === Track.Kind.Video
                                            ? 'video'
                                            : 'audio',
                                }
                            );
                        }
                    }
                });

            await room.connect(join.url, join.token, {});
            await room.localParticipant.enableCameraAndMicrophone();

            this._rooms.push(room);
            join.resolve();

            sim.helper.actions([
                {
                    eventName: 'onRoomJoined',
                    bots: null,
                    arg: { roomName: room.name },
                },
                {
                    eventName: 'onRoomStreaming',
                    bots: null,
                    arg: { roomName: room.name },
                },
            ]);
        } catch (err) {
            join.reject('server_error', err.toString());
        }
    }

    private _leaveRoom(sim: BotManager, leave: RoomLeave) {
        try {
            const room = this._rooms.find((r) => r.name === leave.roomName);

            if (room) {
                room.disconnect(true);
            }
            leave.resolve();
        } catch (err) {
            leave.reject('error', err.toString());
        }
    }
}

function _simulation(item: any) {
    return appManager.simulationManager.simulations.get(item.simulationId);
}
