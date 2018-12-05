import {
    merge
} from 'lodash';

import {File} from './File';
import { ReducingStateStore, Event } from './channels-core';

export type UIEvent = FileSelectedEvent;

export interface FileSelectedEvent extends Event {
    type: 'file_selected';
    id: string;
}

export interface UIState {
    selected_files: string[];
}

export function uiReducer(state: UIState, event: UIEvent) {
    state = state || {
        selected_files: []
    };

    if (event.type === 'file_selected') {
        const index = state.selected_files.indexOf(event.id);
        if (index >= 0) {
            return {
                ...state,
                selected_files: state.selected_files.filter(f => f !== event.id)
            };
        } else {
            return {
                ...state,
                selected_files: [
                    ...state.selected_files,
                    event.id
                ]
            };
        }
    }

    return state;
}

export class UIStateStore extends ReducingStateStore<UIState> {
    constructor(defaultState?: UIState) {
        super(defaultState || {
            selected_files: []
        }, uiReducer);
    }
}

export function selectFile(id: string): FileSelectedEvent {
    return {
        type: 'file_selected',
        creation_time: new Date(),
        id: id
    };
}