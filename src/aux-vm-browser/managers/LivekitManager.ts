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
import type { Bot } from '@casual-simulation/aux-common';
import {
    asyncResult,
    hasValue,
    ON_ROOM_JOINED,
    ON_ROOM_LEAVE,
    ON_ROOM_OPTIONS_CHANGED,
    ON_ROOM_REMOTE_JOINED,
    ON_ROOM_REMOTE_LEAVE,
    ON_ROOM_SPEAKERS_CHANGED,
    ON_ROOM_STREAMING,
    ON_ROOM_STREAM_LOST,
    ON_ROOM_TRACK_SUBSCRIBED,
    ON_ROOM_TRACK_UNSUBSCRIBED,
} from '@casual-simulation/aux-common';
import type {
    GetRoomRemoteOptionsAction,
    GetRoomTrackOptionsAction,
    RoomOptions,
    RoomRemoteOptions,
    RuntimeActions,
    SetRoomTrackOptionsAction,
    TrackVideoQuality,
} from '@casual-simulation/aux-runtime';
import type {
    BotHelper,
    GetRoomOptions,
    RoomJoin,
    RoomLeave,
    SetRoomOptions,
} from '@casual-simulation/aux-vm/managers';
import type {
    LocalParticipant,
    LocalTrackPublication,
    Participant,
    RemoteParticipant,
    Room,
    Track,
    TrackPublication,
} from 'livekit-client';
import type Livekit from 'livekit-client';
import type { Observable, SubscriptionLike } from 'rxjs';
import { Subject } from 'rxjs';

/**
 * Defines a class that is able to manage Livekit rooms and make streams available to scripts.
 */
export class LivekitManager implements SubscriptionLike {
    private _helper: BotHelper;
    private _rooms: Room[] = [];

    private _addressToTrack = new Map<string, Track>();
    private _addressToPublication = new Map<string, TrackPublication>();
    private _addressToParticipant = new Map<string, Participant>();
    private _addressToVideo = new Map<string, HTMLVideoElement>();
    private _trackToAddress = new Map<Track, string>();
    private _closed: boolean = false;

    private _onTrackNeedsAttachment = new Subject<Track>();
    private _onTrackNeedsDetachment = new Subject<Track>();
    private _livekit: typeof Livekit;

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
    private async _requestMediaPermissions(): Promise<void> {
        // Request audio and video permission (required)
        try {
            await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            console.log('[LivekitManager] Media permissions granted.');
        } catch (error) {
            console.error('[LivekitManager] Media permissions denied:', error);
            throw new Error('Media permissions are required to join the room.');
        }
    }

    async joinRoom(join: RoomJoin): Promise<void> {
        try {
            await this._requestMediaPermissions();

            this._livekit = await import('livekit-client');
            const room = new this._livekit.Room({
                adaptiveStream: false,
                dynacast: true,
                ...join.options,
            });

            room.on(
                this._livekit.RoomEvent.TrackSubscribed,
                this._onTrackSubscribed(room)
            )
                .on(
                    this._livekit.RoomEvent.TrackUnsubscribed,
                    this._onTrackUnsubscribed(room)
                )
                .on(
                    this._livekit.RoomEvent.Disconnected,
                    this._onDisconnected(room)
                )
                .on(
                    this._livekit.RoomEvent.Reconnected,
                    this._onReconnected(room)
                )
                .on(
                    this._livekit.RoomEvent.LocalTrackPublished,
                    this._onLocalTrackPublished(room)
                )
                .on(
                    this._livekit.RoomEvent.LocalTrackUnpublished,
                    this._onLocalTrackUnpublished(room)
                )
                .on(
                    this._livekit.RoomEvent.TrackMuted,
                    this._onTrackMuted(room)
                )
                .on(
                    this._livekit.RoomEvent.TrackUnmuted,
                    this._onTrackUnmuted(room)
                )
                .on(
                    this._livekit.RoomEvent.ActiveSpeakersChanged,
                    this._onActiveSpeakersChanged(room)
                )
                .on(
                    this._livekit.RoomEvent.ParticipantConnected,
                    this._onParticipantConnected(room)
                )
                .on(
                    this._livekit.RoomEvent.ParticipantDisconnected,
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
            for (let participant of room.remoteParticipants.values()) {
                actions.push({
                    eventName: ON_ROOM_REMOTE_JOINED,
                    bots: null,
                    arg: {
                        roomName: room.name,
                        remoteId: participant.identity,
                    },
                });
            }

            this._helper.transaction(...this._helper.actions(actions));
        } catch (err) {
            join.reject('server_error', err.toString());
        }
    }

    async leaveRoom(leave: RoomLeave): Promise<void> {
        try {
            const index = this._rooms.findIndex(
                (r) => r.name === leave.roomName
            );
            let room: Room;
            let actions = [] as { eventName: string; bots: Bot[]; arg: any }[];
            if (index >= 0) {
                room = this._rooms[index];
                this._rooms.splice(index, 1);

                if (room) {
                    // Send ON_ROOM_REMOTE_LEAVE events
                    for (let participant of room.remoteParticipants.values()) {
                        actions.push({
                            eventName: ON_ROOM_REMOTE_LEAVE,
                            bots: null,
                            arg: {
                                roomName: room.name,
                                remoteId: participant.identity,
                            },
                        });
                    }
                    room.disconnect(true);
                }
            }
            leave.resolve();

            if (room) {
                actions.push(
                    {
                        eventName: ON_ROOM_STREAM_LOST,
                        bots: null as Bot[],
                        arg: { roomName: leave.roomName } as any,
                    },
                    {
                        eventName: ON_ROOM_LEAVE,
                        bots: null as Bot[],
                        arg: { roomName: leave.roomName } as any,
                    }
                );

                this._helper.transaction(...this._helper.actions(actions));
            }
        } catch (err) {
            leave.reject('error', err.toString());
        }
    }

    async setRoomOptions(setRoomOptions: SetRoomOptions): Promise<void> {
        try {
            const room = this._rooms.find(
                (r) => r.name === setRoomOptions.roomName
            );
            if (!room || !this._livekit) {
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
        return this._getParticipantOptions(room.localParticipant);
    }

    private _getParticipantOptions(participant: Participant) {
        let options: RoomOptions = {
            video: false,
            audio: false,
            screen: false,
        };

        if (this._livekit) {
            for (let [id, pub] of participant.trackPublications) {
                if (!pub.isMuted && pub.isEnabled) {
                    if (
                        pub.kind === this._livekit.Track.Kind.Audio &&
                        pub.source === this._livekit.Track.Source.Microphone
                    ) {
                        options.audio = true;
                    } else if (
                        pub.kind === this._livekit.Track.Kind.Video &&
                        pub.source === this._livekit.Track.Source.Camera
                    ) {
                        options.video = true;
                    } else if (
                        pub.source === this._livekit.Track.Source.ScreenShare
                    ) {
                        options.screen = true;
                    }
                }
            }
        }

        return options;
    }

    handleEvents(events: RuntimeActions[]): void {
        for (let event of events) {
            if (event.type === 'get_room_track_options') {
                this._getRoomTrackOptions(event);
            } else if (event.type === 'set_room_track_options') {
                this._setRoomTrackOptions(event);
            } else if (event.type === 'get_room_remote_options') {
                this._getRoomRemoteOptions(event);
            }
        }
    }

    private async _getRoomTrackOptions(event: GetRoomTrackOptionsAction) {
        try {
            const room = this._rooms.find((r) => r.name === event.roomName);
            if (!room || !this._livekit) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: false,
                        errorCode: 'room_not_found',
                        errorMessage: 'The specified room was not found.',
                        roomName: event.roomName,
                    })
                );
                return;
            }
            const pub = this._addressToPublication.get(event.address);
            const participant = this._addressToParticipant.get(event.address);
            if (!pub || !participant) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: false,
                        errorCode: 'track_not_found',
                        errorMessage: 'The specified track was not found.',
                        roomName: event.roomName,
                        address: event.address,
                    })
                );
                return;
            }
            const options = this._getTrackOptions(pub, participant);

            this._helper.transaction(
                asyncResult(event.taskId, {
                    success: true,
                    roomName: room.name,
                    address: event.address,
                    options,
                })
            );
        } catch (err) {
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: false,
                        errorCode: 'error',
                        errorMessage: err.toString(),
                        roomName: event.roomName,
                        address: event.address,
                    })
                );
            }
        }
    }

    private async _setRoomTrackOptions(event: SetRoomTrackOptionsAction) {
        try {
            const room = this._rooms.find((r) => r.name === event.roomName);
            if (!room || !this._livekit) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: false,
                        errorCode: 'room_not_found',
                        errorMessage: 'The specified room was not found.',
                        roomName: event.roomName,
                    })
                );
                return;
            }
            const pub = this._addressToPublication.get(event.address);
            const participant = this._addressToParticipant.get(event.address);
            if (!pub || !participant) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: false,
                        errorCode: 'track_not_found',
                        errorMessage: 'The specified track was not found.',
                        roomName: event.roomName,
                        address: event.address,
                    })
                );
                return;
            }

            let promises = [] as Promise<void>[];
            if ('muted' in event.options) {
                if (pub instanceof this._livekit.LocalTrackPublication) {
                    if (event.options.muted) {
                        promises.push(pub.mute().then(() => {}));
                    } else {
                        promises.push(pub.unmute().then(() => {}));
                    }
                } else if (
                    pub instanceof this._livekit.RemoteTrackPublication
                ) {
                    pub.setEnabled(!event.options.muted);
                }
            }

            if ('videoQuality' in event.options) {
                if (pub instanceof this._livekit.RemoteTrackPublication) {
                    let quality = this._livekit.VideoQuality.HIGH;
                    if (event.options.videoQuality === 'medium') {
                        quality = this._livekit.VideoQuality.MEDIUM;
                    } else if (event.options.videoQuality === 'low') {
                        quality = this._livekit.VideoQuality.LOW;
                    } else if (event.options.videoQuality === 'high') {
                        quality = this._livekit.VideoQuality.HIGH;
                    } else if (event.options.videoQuality === 'off') {
                        pub.setEnabled(false);
                    }
                    pub.setVideoQuality(quality);
                }
            }

            await Promise.allSettled(promises);

            const options = this._getTrackOptions(pub, participant);

            this._helper.transaction(
                asyncResult(event.taskId, {
                    success: true,
                    roomName: room.name,
                    address: event.address,
                    options,
                })
            );
        } catch (err) {
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: false,
                        errorCode: 'error',
                        errorMessage: err.toString(),
                        roomName: event.roomName,
                        address: event.address,
                    })
                );
            }
        }
    }

    private _findRemoteParticipant(room: Room, identity: string): Participant {
        for (let p of room.remoteParticipants.values()) {
            if (p.identity === identity) {
                return p;
            }
        }
        return null;
    }

    private async _getRoomRemoteOptions(event: GetRoomRemoteOptionsAction) {
        try {
            const room = this._rooms.find((r) => r.name === event.roomName);
            if (!room || !this._livekit) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: false,
                        errorCode: 'room_not_found',
                        errorMessage: 'The specified room was not found.',
                        roomName: event.roomName,
                    })
                );
                return;
            }
            const participant = this._findRemoteParticipant(
                room,
                event.remoteId
            );
            if (!participant) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: false,
                        errorCode: 'remote_not_found',
                        errorMessage: 'The specified remote was not found.',
                        roomName: event.roomName,
                        remoteId: event.remoteId,
                    })
                );
                return;
            }
            const basicOptions = this._getParticipantOptions(participant);
            const options: RoomRemoteOptions = {
                ...basicOptions,
                audioLevel: participant.audioLevel,
                connectionQuality: participant.connectionQuality,
            };

            this._helper.transaction(
                asyncResult(event.taskId, {
                    success: true,
                    roomName: room.name,
                    remoteId: event.remoteId,
                    options,
                })
            );
        } catch (err) {
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: false,
                        errorCode: 'error',
                        errorMessage: err.toString(),
                        roomName: event.roomName,
                        remoteId: event.remoteId,
                    })
                );
            }
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
        room: Room
    ): (
        track: Track,
        pub: TrackPublication,
        participant: RemoteParticipant
    ) => void {
        return (track, pub, participant) => {
            console.log('[LivekitManager] Track subscribed!', track);
            const address = this._getTrackAddress(pub, participant);
            this._saveTrack(address, track, pub, participant);
            this._helper.action(
                ON_ROOM_TRACK_SUBSCRIBED,
                null,
                this._trackArg(room.name, pub, participant, address, track)
            );
            if (
                track.kind === this._livekit.Track.Kind.Audio ||
                track.kind === this._livekit.Track.Kind.Video
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
                    this._trackArg(room.name, pub, participant, address, track)
                );
            }

            if (
                track.kind === this._livekit.Track.Kind.Audio ||
                track.kind === this._livekit.Track.Kind.Video
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
            this._saveTrack(address, track, pub, participant);
            this._helper.action(
                ON_ROOM_TRACK_SUBSCRIBED,
                null,
                this._trackArg(room.name, pub, participant, address, track)
            );
            if (track.kind === this._livekit.Track.Kind.Video) {
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
                    this._trackArg(room.name, pub, participant, address, track)
                );
            }

            if (track.kind === this._livekit.Track.Kind.Video) {
                this._onTrackNeedsDetachment.next(track);
            }
        };
    }

    private _trackArg(
        roomName: string,
        pub: TrackPublication,
        participant: Participant,
        address: string,
        track: Track
    ) {
        return {
            roomName: roomName,
            address: address,
            ...this._getTrackOptions(pub, participant, track),
        };
    }

    private _getTrackOptions(
        pub: TrackPublication,
        participant: Participant,
        t?: Track
    ) {
        const track = t ?? pub.track;
        const isRemote = pub instanceof this._livekit.RemoteTrackPublication;
        const common = {
            isRemote: isRemote,
            remoteId: participant.identity,
            muted: pub.isMuted || !pub.isEnabled,
            kind: this._getTrackKind(track),
            source: track.source,
        };
        if (pub.kind === this._livekit.Track.Kind.Video) {
            return {
                ...common,
                dimensions: pub.dimensions,
                aspectRatio: pub.dimensions.width / pub.dimensions.height,
                videoQuality: this._getTrackQuality(pub),
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
                this._trackArg(room.name, pub, participant, address, null)
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
                this._trackArg(room.name, pub, participant, address, null)
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

    private _saveTrack(
        address: string,
        track: Track,
        pub: TrackPublication,
        participant: Participant
    ) {
        this._addressToTrack.set(address, track);
        this._addressToPublication.set(address, pub);
        this._addressToParticipant.set(address, participant);
        if (track.kind === this._livekit.Track.Kind.Video) {
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
            this._addressToPublication.delete(address);
            this._addressToParticipant.delete(address);
            this._trackToAddress.delete(track);
            return address;
        }
        return null;
    }

    private _getTrackKind(track: Track): 'video' | 'audio' {
        return track.kind === this._livekit.Track.Kind.Video
            ? 'video'
            : 'audio';
    }

    private _getTrackQuality(publication: TrackPublication): TrackVideoQuality {
        if (publication instanceof this._livekit.RemoteTrackPublication) {
            if (publication.isMuted || !publication.isEnabled) {
                return 'off';
            }
            const quality = publication.videoQuality;
            if (quality === this._livekit.VideoQuality.HIGH) {
                return 'high';
            } else if (quality === this._livekit.VideoQuality.MEDIUM) {
                return 'medium';
            } else if (quality === this._livekit.VideoQuality.LOW) {
                return 'low';
            } else {
                return 'high';
            }
        } else if (publication.videoTrack) {
            return publication.isMuted || !publication.isEnabled
                ? 'off'
                : 'high';
        }
        return null;
    }

    private _getTrackAddress(
        publication: TrackPublication,
        participant: Participant
    ): string {
        if (publication.kind === this._livekit.Track.Kind.Video) {
            return `casualos://video-element/${participant.identity}-${publication.trackSid}`;
        } else {
            return `casualos://audio-element/${participant.identity}-${publication.trackSid}`;
        }
    }
}
