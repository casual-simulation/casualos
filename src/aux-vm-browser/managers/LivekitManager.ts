import {
    Bot,
    ON_ROOM_JOINED,
    ON_ROOM_OPTIONS_CHANGED,
    ON_ROOM_REMOTE_JOINED,
    ON_ROOM_REMOTE_LEAVE,
    ON_ROOM_SPEAKERS_CHANGED,
    ON_ROOM_STREAMING,
    ON_ROOM_STREAM_LOST,
    ON_ROOM_TRACK_SUBSCRIBED,
    ON_ROOM_TRACK_UNSUBSCRIBED,
    RoomJoinOptions,
    RoomOptions,
} from '@casual-simulation/aux-common';
import {
    BotHelper,
    GetRoomOptions,
    RoomJoin,
    RoomLeave,
    SetRoomOptions,
} from '@casual-simulation/aux-vm/managers';
import {
    createLocalVideoTrack,
    LocalParticipant,
    LocalTrackPublication,
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
    private _onTrackNeedsDetachment = new Subject<Track>();

    /**
     * Gets an observable that resolves whenever a track needs to be attached to the document.
     */
    get onTrackNeedsAttachment(): Observable<Track> {
        return this._onTrackNeedsAttachment;
    }

    /**
     * Gets an observable that resolves whenever a track needs to be detached from the document.
     */
    get onTrackNeedsDetachment(): Observable<Track> {
        return this._onTrackNeedsDetachment;
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
                ...join.options,
            });

            room.on(RoomEvent.TrackSubscribed, this._onTrackSubscribed(room))
                .on(
                    RoomEvent.TrackUnsubscribed,
                    this._onTrackUnsubscribed(room)
                )
                .on(RoomEvent.Disconnected, this._onDisconnected(room))
                .on(RoomEvent.Reconnected, this._onReconnected(room))
                .on(
                    RoomEvent.LocalTrackPublished,
                    this._onLocalTrackPublished(room)
                )
                .on(
                    RoomEvent.LocalTrackUnpublished,
                    this._onLocalTrackUnpublished(room)
                )
                .on(RoomEvent.TrackMuted, this._onTrackMuted(room))
                .on(RoomEvent.TrackUnmuted, this._onTrackUnmuted(room))
                .on(
                    RoomEvent.ActiveSpeakersChanged,
                    this._onActiveSpeakersChanged(room)
                )
                .on(
                    RoomEvent.ParticipantConnected,
                    this._onParticipantConnected(room)
                )
                .on(
                    RoomEvent.ParticipantDisconnected,
                    this._onParticipantDisconnected(room)
                );

            await room.connect(join.url, join.token, {});
            try {
                await this._setRoomOptions(room, {
                    video: true,
                    audio: true,
                    ...join.options,
                });
            } catch (err) {
                console.warn(
                    '[LivekitManager] Unable to set room options:',
                    err
                );
            }

            this._rooms.push(room);

            const options = this._getRoomOptions(room);

            join.resolve(options);

            let actions = [
                {
                    eventName: ON_ROOM_JOINED,
                    bots: null as Bot[],
                    arg: { roomName: room.name, options } as any,
                },
                {
                    eventName: ON_ROOM_STREAMING,
                    bots: null as Bot[],
                    arg: { roomName: room.name, options } as any,
                },
            ];

            // Send initial ON_ROOM_REMOTE_JOINED events
            for (let participant of room.participants.values()) {
                actions.push({
                    eventName: ON_ROOM_REMOTE_JOINED,
                    bots: null,
                    arg: {
                        roomName: room.name,
                        remoteId: participant.identity,
                    },
                });
            }

            this._helper.actions(actions);
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

    async setRoomOptions(setRoomOptions: SetRoomOptions): Promise<void> {
        try {
            const room = this._rooms.find(
                (r) => r.name === setRoomOptions.roomName
            );
            if (!room) {
                setRoomOptions.reject(
                    'room_not_found',
                    'The specified room was not found.'
                );
                return;
            }

            const changed = await this._setRoomOptions(
                room,
                setRoomOptions.options
            );
            const options = this._getRoomOptions(room);

            let rejected = false;
            for (let key in setRoomOptions.options) {
                const targetValue = (setRoomOptions.options as any)[key];
                const currentValue = (options as any)[key];

                if (targetValue !== currentValue) {
                    setRoomOptions.reject(
                        'error',
                        `Unable to set "${key}" to ${targetValue}`
                    );
                    rejected = true;
                }
            }

            if (!rejected) {
                setRoomOptions.resolve(options);
            }

            if (changed) {
                this._helper.action(ON_ROOM_OPTIONS_CHANGED, null, {
                    roomName: room.name,
                    options,
                });
            }
        } catch (err) {
            setRoomOptions.reject('error', err.toString());
        }
    }

    async _setRoomOptions(
        room: Room,
        options: Partial<RoomOptions>
    ): Promise<boolean> {
        let promises = [] as Promise<LocalTrackPublication>[];

        if ('video' in options) {
            promises.push(
                room.localParticipant.setCameraEnabled(!!options.video)
            );
        }
        if ('audio' in options) {
            promises.push(
                room.localParticipant.setMicrophoneEnabled(!!options.audio)
            );
        }
        if ('screen' in options) {
            promises.push(
                room.localParticipant.setScreenShareEnabled(!!options.screen)
            );
        }

        const results = await Promise.allSettled(promises);
        return results.some((r) => r.status === 'fulfilled');
    }

    async getRoomOptions(getRoomOptions: GetRoomOptions): Promise<void> {
        try {
            const room = this._rooms.find(
                (r) => r.name === getRoomOptions.roomName
            );
            if (!room) {
                getRoomOptions.reject(
                    'room_not_found',
                    'The specified room was not found.'
                );
                return;
            }

            const options = this._getRoomOptions(room);

            getRoomOptions.resolve(options);
        } catch (err) {
            getRoomOptions.reject('error', err.toString());
        }
    }

    private _getRoomOptions(room: Room) {
        let options: RoomOptions = {
            video: false,
            audio: false,
            screen: false,
        };

        for (let [id, pub] of room.localParticipant.tracks) {
            if (!pub.isMuted && pub.isEnabled) {
                if (
                    pub.kind === Track.Kind.Audio &&
                    pub.source === Track.Source.Microphone
                ) {
                    options.audio = true;
                } else if (
                    pub.kind === Track.Kind.Video &&
                    pub.source === Track.Source.Camera
                ) {
                    options.video = true;
                } else if (pub.source === Track.Source.ScreenShare) {
                    options.screen = true;
                }
            }
        }

        return options;
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
        room: Room
    ): (
        track: Track,
        pub: TrackPublication,
        participant: RemoteParticipant
    ) => void {
        return (track, pub, participant) => {
            console.log('[LivekitManager] Track subscribed!', track);
            const address = this._getTrackAddress(pub, participant);
            this._saveTrack(address, track);
            this._helper.action(
                ON_ROOM_TRACK_SUBSCRIBED,
                null,
                this._trackArg(room.name, pub, participant, address)
            );
            if (
                track.kind === Track.Kind.Audio ||
                track.kind === Track.Kind.Video
            ) {
                this._onTrackNeedsAttachment.next(track);
            }
        };
    }

    private _onTrackUnsubscribed(
        room: Room
    ): (
        track: Track,
        pub: TrackPublication,
        participant: RemoteParticipant
    ) => void {
        return (track, pub, participant) => {
            console.log('[LivekitManager] Track unsubscribed!', track);
            const address = this._deleteTrack(track);
            if (address) {
                this._helper.action(
                    ON_ROOM_TRACK_UNSUBSCRIBED,
                    null,
                    this._trackArg(room.name, pub, participant, address)
                );
            }

            if (
                track.kind === Track.Kind.Audio ||
                track.kind === Track.Kind.Video
            ) {
                this._onTrackNeedsDetachment.next(track);
            }
        };
    }

    private _onLocalTrackPublished(
        room: Room
    ): (pub: TrackPublication, participant: LocalParticipant) => void {
        return (pub, participant) => {
            const track = pub.track;
            console.log('[LivekitManager] Track subscribed!', track);
            const address = this._getTrackAddress(pub, participant);
            this._saveTrack(address, track);
            this._helper.action(
                ON_ROOM_TRACK_SUBSCRIBED,
                null,
                this._trackArg(room.name, pub, participant, address)
            );
            if (track.kind === Track.Kind.Video) {
                this._onTrackNeedsAttachment.next(track);
            }
        };
    }

    private _onLocalTrackUnpublished(
        room: Room
    ): (pub: TrackPublication, participant: LocalParticipant) => void {
        return (pub, participant) => {
            const track = pub.track;
            console.log('[LivekitManager] Track unsubscribed!', track);
            const address = this._deleteTrack(track);
            if (address) {
                this._helper.action(
                    ON_ROOM_TRACK_UNSUBSCRIBED,
                    null,
                    this._trackArg(room.name, pub, participant, address)
                );
            }

            if (track.kind === Track.Kind.Video) {
                this._onTrackNeedsDetachment.next(track);
            }
        };
    }

    private _trackArg(
        roomName: string,
        pub: TrackPublication,
        participant: Participant,
        address: string
    ) {
        const track = pub.track;
        const isRemote = pub instanceof RemoteTrackPublication;
        const common = {
            roomName: roomName,
            isRemote: isRemote,
            remoteId: participant.identity,
            address: address,
            kind: this._getTrackKind(track),
            source: track.source,
        };
        if (pub.kind === Track.Kind.Video) {
            return {
                ...common,
                dimensions: pub.dimensions,
                aspectRatio: pub.dimensions.width / pub.dimensions.height,
            };
        } else {
            return {
                ...common,
            };
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

    private _onTrackMuted(
        room: Room
    ): (pub: TrackPublication, participant: Participant) => void {
        return (pub, participant) => {
            console.log('[LivekitManager] Track muted!', pub, participant);
            const address = this._trackToAddress.get(pub.track);
            this._helper.action(
                ON_ROOM_TRACK_UNSUBSCRIBED,
                null,
                this._trackArg(room.name, pub, participant, address)
            );
        };
    }

    private _onTrackUnmuted(
        room: Room
    ): (pub: TrackPublication, participant: Participant) => void {
        return (pub, participant) => {
            console.log('[LivekitManager] Track unmuted!', pub, participant);
            const address = this._trackToAddress.get(pub.track);
            this._helper.action(
                ON_ROOM_TRACK_SUBSCRIBED,
                null,
                this._trackArg(room.name, pub, participant, address)
            );
        };
    }

    private _onActiveSpeakersChanged(
        room: Room
    ): (speakers: Participant[]) => void {
        return (speakers) => {
            this._helper.action(ON_ROOM_SPEAKERS_CHANGED, null, {
                roomName: room.name,
                speakerIds: speakers.map((s) => s.identity),
            });
        };
    }

    private _onParticipantConnected(
        room: Room
    ): (participant: Participant) => void {
        return (participant) => {
            this._helper.action(ON_ROOM_REMOTE_JOINED, null, {
                roomName: room.name,
                remoteId: participant.identity,
            });
        };
    }

    private _onParticipantDisconnected(
        room: Room
    ): (participant: Participant) => void {
        return (participant) => {
            this._helper.action(ON_ROOM_REMOTE_LEAVE, null, {
                roomName: room.name,
                remoteId: participant.identity,
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
        if (publication.kind === Track.Kind.Video) {
            return `casualos://video-element/${participant.identity}-${publication.trackSid}`;
        } else {
            return `casualos://audio-element/${participant.identity}-${publication.trackSid}`;
        }
    }
}
