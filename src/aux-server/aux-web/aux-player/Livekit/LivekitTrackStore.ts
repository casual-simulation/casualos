import { RemoteTrack, LocalTrack } from 'livekit-client';

export class LivekitTrackStore {
    private _idToTrack = new Map<string, RemoteTrack | LocalTrack>();
    private _trackToId = new Map<RemoteTrack | LocalTrack, string>();

    set(id: string, track: RemoteTrack | LocalTrack) {
        this._idToTrack.set(id, track);
        this._trackToId.set(track, id);
    }

    delete(track: RemoteTrack | LocalTrack) {
        const id = this._trackToId.get(track);
        if (id) {
            this._trackToId.delete(track);
            this._idToTrack.delete(id);
        }
        return id;
    }

    getById(id: string) {
        return this._idToTrack.get(id);
    }
}

export const store = new LivekitTrackStore();
