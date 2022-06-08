import {
    ON_ROOM_JOINED,
    ON_ROOM_SPEAKERS_CHANGED,
    ON_ROOM_STREAMING,
    ON_ROOM_STREAM_LOST,
    ON_ROOM_TRACK_SUBSCRIBED,
    ON_ROOM_TRACK_UNSUBSCRIBED,
} from '@casual-simulation/aux-common';
import {
    BotHelper,
    RoomJoin,
    RoomLeave,
} from '@casual-simulation/aux-vm/managers';
import {
    LocalParticipant,
    Participant,
    RemoteParticipant,
    RemoteTrackPublication,
    Room,
    RoomEvent,
    Track,
    TrackPublication,
} from 'livekit-client';
import { Observable, Subject, Subscription, SubscriptionLike } from 'rxjs';

/**
 * Defines a class that is able to manage Livekit rooms and make streams available to scripts.
 */
export class LivekitManager implements SubscriptionLike {
    private _helper: BotHelper;
    private _rooms: Room[] = [];

    private _addressToTrack = new Map<string, Track>();
    private _addressToVideo = new Map<string, HTMLVideoElement>();
    private _trackToAddress = new Map<Track, string>();
    private _closed: boolean = false;

    private _onTrackNeedsAttachment = new Subject<Track>();

    /**
     * Gets an observable that resolves whenever a track needs to be attached to the document.
     */
    get onTrackNeedsAttachment(): Observable<Track> {
        return this._onTrackNeedsAttachment;
    }

    get closed(): boolean {
        return this._closed;
    }

    constructor(helper: BotHelper) {
        this._helper = helper;
    }

    unsubscribe(): void {
        if (this._closed) {
            return;
        }
        this._closed = true;
        for (let room of this._rooms) {
            room.disconnect(true);
        }
        this._rooms = [];
        this._addressToTrack = null;
        this._trackToAddress = null;
    }

    async joinRoom(join: RoomJoin): Promise<void> {
        try {
            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
            });

            room.on(RoomEvent.TrackSubscribed, (track, pub, participant) =>
                this._onTrackSubscribed(track, pub, participant)
            )
                .on(RoomEvent.TrackUnsubscribed, (track, pub, participant) =>
                    this._onTrackUnsubscribed(track, pub, participant)
                )
                .on(RoomEvent.Disconnected, this._onDisconnected(room))
                .on(RoomEvent.Reconnected, this._onReconnected(room))
                .on(RoomEvent.LocalTrackPublished, (pub, participant) =>
                    this._onLocalTrackPublished(pub, participant)
                )
                .on(RoomEvent.LocalTrackUnpublished, (pub, participant) =>
                    this._onLocalTrackUnpublished(pub, participant)
                )
                .on(RoomEvent.TrackStreamStateChanged, (pub, state) =>
                    this._onTrackStreamStateChanged(pub, state)
                )
                .on(
                    RoomEvent.ActiveSpeakersChanged,
                    this._onActiveSpeakersChanged(room)
                );

            await room.connect(join.url, join.token, {});
            await room.localParticipant.enableCameraAndMicrophone();

            this._rooms.push(room);
            join.resolve();

            this._helper.actions([
                {
                    eventName: ON_ROOM_JOINED,
                    bots: null,
                    arg: { roomName: room.name },
                },
                {
                    eventName: ON_ROOM_STREAMING,
                    bots: null,
                    arg: { roomName: room.name },
                },
            ]);
        } catch (err) {
            join.reject('server_error', err.toString());
        }
    }

    async leaveRoom(leave: RoomLeave): Promise<void> {
        try {
            const index = this._rooms.findIndex(
                (r) => r.name === leave.roomName
            );
            if (index >= 0) {
                const room = this._rooms[index];
                this._rooms.splice(index, 1);

                if (room) {
                    room.disconnect(true);
                }
            }
            leave.resolve();
        } catch (err) {
            leave.reject('error', err.toString());
        }
    }

    /**
     * Gets the media stream that is referenced by the given address.
     * @param address The address that should be used.
     */
    getMediaByAddress(address: string): MediaStream {
        const track = this._addressToTrack.get(address);
        if (track) {
            return track.mediaStream;
        }
        return null;
    }

    /**
     * Gets the video that is referenced by the given address.
     * @param address The address that should be used.
     */
    getVideoByAddress(address: string): HTMLVideoElement {
        const track = this._addressToVideo.get(address);
        if (track) {
            return track;
        }
        return null;
    }

    private _onTrackSubscribed(
        track: Track,
        pub: TrackPublication,
        participant: RemoteParticipant
    ) {
        console.log('[LivekitManager] Track subscribed!', track);
        if (track.kind === Track.Kind.Video) {
            const address = this._getTrackAddress(pub, participant);
            this._saveTrack(address, track);
            this._helper.action(ON_ROOM_TRACK_SUBSCRIBED, null, {
                isRemote: true,
                remoteId: participant.identity,
                address: address,
                kind: this._getTrackKind(track),
            });

            this._onTrackNeedsAttachment.next(track);
        }
    }

    private _onTrackUnsubscribed(
        track: Track,
        pub: TrackPublication,
        participant: RemoteParticipant
    ) {
        console.log('[LivekitManager] Track unsubscribed!', track);
        if (track.kind === Track.Kind.Video) {
            const address = this._deleteTrack(track);
            this._helper.action(ON_ROOM_TRACK_UNSUBSCRIBED, null, {
                isRemote: true,
                remoteId: participant.identity,
                address: address,
                kind: this._getTrackKind(track),
            });
        }
    }

    private _onLocalTrackPublished(
        pub: TrackPublication,
        participant: LocalParticipant
    ) {
        const track = pub.track;
        console.log('[LivekitManager] Track subscribed!', track);
        if (track.kind === Track.Kind.Video) {
            const address = this._getTrackAddress(pub, participant);
            this._saveTrack(address, track);
            this._helper.action(ON_ROOM_TRACK_SUBSCRIBED, null, {
                isRemote: false,
                remoteId: participant.identity,
                address: address,
                kind: this._getTrackKind(track),
            });
        }
    }

    private _onLocalTrackUnpublished(
        pub: TrackPublication,
        participant: LocalParticipant
    ) {
        const track = pub.track;
        console.log('[LivekitManager] Track unsubscribed!', track);
        if (track.kind === Track.Kind.Video) {
            const address = this._deleteTrack(track);
            this._helper.action(ON_ROOM_TRACK_UNSUBSCRIBED, null, {
                isRemote: false,
                remoteId: participant.identity,
                address: address,
                kind: this._getTrackKind(track),
            });
        }
    }

    private _onDisconnected(room: Room): () => void {
        return () => {
            console.log('[LivekitManager] Disconnected!');
            this._helper.action(ON_ROOM_STREAM_LOST, null, {
                roomName: room.name,
            });
        };
    }

    private _onReconnected(room: Room): () => void {
        return () => {
            console.log('[LivekitManager] Reconnected!');
            this._helper.action(ON_ROOM_STREAMING, null, {
                roomName: room.name,
            });
        };
    }

    private _onTrackStreamStateChanged(
        pub: RemoteTrackPublication,
        state: Track.StreamState
    ): void {
        console.log('[LivekitManager] Track stream state changed!', pub, state);
    }

    private _onActiveSpeakersChanged(
        room: Room
    ): (speakers: Participant[]) => void {
        return (speakers) => {
            // console.log('[LivekitManager] Speakers ')
            this._helper.action(ON_ROOM_SPEAKERS_CHANGED, null, {
                roomName: room.name,
                speakerIds: speakers.map((s) => s.identity),
            });
        };
    }

    private _saveTrack(address: string, track: Track) {
        this._addressToTrack.set(address, track);
        if (track.kind === Track.Kind.Video) {
            this._addressToVideo.set(
                address,
                track.attach() as HTMLVideoElement
            );
        }
        this._trackToAddress.set(track, address);
    }

    private _deleteTrack(track: Track): string {
        const address = this._trackToAddress.get(track);
        if (address) {
            this._addressToTrack.delete(address);
            this._addressToVideo.delete(address);
            this._trackToAddress.delete(track);
            return address;
        }
        return null;
    }

    private _getTrackKind(track: Track): 'video' | 'audio' {
        return track.kind === Track.Kind.Video ? 'video' : 'audio';
    }

    private _getTrackAddress(
        publication: TrackPublication,
        participant: Participant
    ): string {
        return `casualos://video-element/${participant.identity}-${publication.trackSid}`;
    }
}
