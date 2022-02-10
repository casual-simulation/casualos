import Vue from 'vue';
import Component from 'vue-class-component';
import {
    hasValue,
    CameraType,
    ON_IMAGE_CLASSIFIER_CLOSED_ACTION_NAME,
    ON_IMAGE_CLASSIFIER_OPENED_ACTION_NAME,
    ON_IMAGE_CLASSIFIED_ACTION_NAME,
    OpenImageClassifierAction,
    action,
    asyncResult,
    asyncError,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { getImageClassifierUrls } from './ImageClassifierUtils';
import { pick } from 'lodash';
import {
    ClassificationEvent,
    ModelLoadedEvent,
    ModelLoadError,
} from '../ClassifierStream/ClassifierStreamTypes';
import ClassifierLoader from '../ClassifierLoader/ClassifierLoader';
import ClassifierLoaderError from '../ClassifierLoaderError/ClassifierLoaderError';

const ClassifierAsync = () => ({
    component: import('../ClassifierStream/ClassifierStream').catch((err) => {
        console.error('Unable to load Image Classifier:', err);
        throw err;
    }),
    loading: ClassifierLoader,
    error: ClassifierLoaderError,

    delay: 50,
    timeout: 1000 * 60 * 5, // 5 minutes
});

@Component({
    components: {
        'classifier-stream': ClassifierAsync,
    },
})
export default class ImageClassifier extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _portals: Map<BrowserSimulation, string> = new Map();
    private _currentSimulation: BrowserSimulation;

    showImageClassifier: boolean = false;
    modelJsonUrl: string = null;
    modelMetadataUrl: string = null;
    cameraType: CameraType = null;

    private _openEvent: OpenImageClassifierAction;

    constructor() {
        super();
    }

    created() {
        this._sub = new Subscription();
        this._simulations = new Map();
        this._portals = new Map();
        this.showImageClassifier = false;
        this.cameraType = null;
        this.modelJsonUrl = null;
        this.modelMetadataUrl = null;

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap((sim) => this._onSimulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap((sim) => this._onSimulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    onImageClassifierClosed() {
        this._superAction(ON_IMAGE_CLASSIFIER_CLOSED_ACTION_NAME);
    }

    hideImageClassifier() {
        this.showImageClassifier = false;
    }

    onImageClassified(event: ClassificationEvent) {
        this._superAction(ON_IMAGE_CLASSIFIED_ACTION_NAME, {
            model: {
                ...pick(
                    this._openEvent,
                    'modelUrl',
                    'modelJsonUrl',
                    'modelMetadataUrl',
                    'cameraType'
                ),
                classLabels: event.model.classLabels,
            },
            prediction: event.prediction,
        });
    }

    onModelLoadError(error: ModelLoadError) {
        if (this._openEvent && this._currentSimulation) {
            if (hasValue(this._openEvent.taskId)) {
                this._currentSimulation.helper.transaction(
                    asyncError(this._openEvent.taskId, error.error.toString())
                );
            }
        }
    }

    onModelLoaded(event: ModelLoadedEvent) {
        if (this._openEvent && this._currentSimulation) {
            const arg = {
                ...pick(
                    this._openEvent,
                    'modelUrl',
                    'modelJsonUrl',
                    'modelMetadataUrl',
                    'cameraType'
                ),
            };

            if (event.model) {
                (<any>arg).classLabels = event.model.classLabels;
            }
            if (hasValue(this._openEvent.taskId)) {
                this._currentSimulation.helper.transaction(
                    asyncResult(this._openEvent.taskId, arg)
                );
            }

            if (event.model) {
                this._superAction(ON_IMAGE_CLASSIFIER_OPENED_ACTION_NAME, arg);
            }
        }
    }

    private _onSimulationAdded(sim: BrowserSimulation) {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        sub.add(
            sim.localEvents.subscribe((e) => {
                if (e.type === 'show_image_classifier') {
                    this.showImageClassifier = !!e.open;
                    if (this.showImageClassifier) {
                        if (
                            this._openEvent &&
                            hasValue(this._openEvent.taskId)
                        ) {
                            const arg = {
                                ...pick(
                                    this._openEvent,
                                    'modelUrl',
                                    'modelJsonUrl',
                                    'modelMetadataUrl',
                                    'cameraType'
                                ),
                            };
                            this._currentSimulation.helper.transaction(
                                asyncResult(this._openEvent.taskId, arg)
                            );
                        }

                        const urls = getImageClassifierUrls(e);
                        this.modelJsonUrl = urls.json;
                        this.modelMetadataUrl = urls.metadata;
                        this.cameraType = e.cameraType;
                        this._openEvent = e;
                        this._currentSimulation = sim;
                    } else {
                        this.modelJsonUrl = null;
                        this.modelMetadataUrl = null;
                        this._openEvent = null;
                        this._currentSimulation = null;

                        if (hasValue(e.taskId)) {
                            sim.helper.transaction(asyncResult(e.taskId, null));
                        }
                        this._superAction(
                            ON_IMAGE_CLASSIFIER_CLOSED_ACTION_NAME
                        );
                    }
                }
            })
        );
    }

    private _onSimulationRemoved(sim: BrowserSimulation) {
        const sub = this._simulations.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulations.delete(sim);
        this._portals.delete(sim);
    }

    /**
     * Sends the given event and argument to every loaded simulation.
     * @param eventName The event to send.
     * @param arg The argument to send.
     */
    private async _superAction(eventName: string, arg?: any) {
        for (let [, sim] of appManager.simulationManager.simulations) {
            await sim.helper.action(eventName, null, arg);
        }
    }
}
