import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import { Subscription } from 'rxjs';
import { CameraType } from '@casual-simulation/aux-common';
import {
    ImageClassifierModel,
    ModelLoadedEvent,
    ModelLoadError,
    ClassificationEvent,
} from './ClassifierStreamTypes';
// import * as tf from '@tensorflow/tfjs';
import * as tmImage from '@teachablemachine/image';
import { sortBy } from 'lodash';

@Component({
    components: {},
})
export default class ClassifierStream extends Vue {
    private _sub: Subscription;
    private _model: tmImage.CustomMobileNet;
    private _currentModel: ImageClassifierModel;
    private _streamingVideo: boolean = false;

    @Prop({ required: true, default: null })
    modelJson: string;

    @Prop({ required: true, default: null })
    modelMetadata: string;

    @Prop({ default: null as CameraType })
    camera: CameraType;

    private get _video() {
        return this.$refs.video as HTMLVideoElement;
    }

    constructor() {
        super();
    }

    created() {
        this._sub = new Subscription();
        this._streamingVideo = false;
        this._loop = this._loop.bind(this);

        this._sub.add(
            this.$watch(
                () => [this.modelJson, this.modelMetadata],
                () => {
                    this._modelChanged();
                },
                { immediate: true }
            )
        );
    }

    mounted() {
        const listener = () => {
            this._video.height = this._video.videoHeight;
            this._video.width = this._video.videoWidth;
            this._video.style.height = this._video.videoHeight + 'px';
            this._video.style.width = this._video.videoWidth + 'px';
        };
        this._video.addEventListener('resize', listener);
        this._sub.add(() =>
            this._video.removeEventListener('resize', listener)
        );
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
        }
    }

    private async _modelChanged() {
        if (!this.modelJson && !this.modelMetadata) {
            this._model?.dispose();
            await this._stopVideoStream();
            this._currentModel = null;
            this._emitModelLoaded(null);
            return;
        }

        try {
            const model = await tmImage.load(
                this.modelJson,
                this.modelMetadata
            );
            if (this._model) {
                this._model.dispose();
            }
            if (this._sub.closed) {
                model.dispose();
                return;
            }

            this._model = model;

            if (await this._startVideoStream()) {
                this._currentModel = {
                    modelJsonUrl: this.modelJson,
                    modelMetadataUrl: this.modelMetadata,
                    classLabels: model.getClassLabels().slice(),
                };
                this._emitModelLoaded(this._currentModel);

                this._requestFrame();
            }
        } catch (err) {
            this._emitModelLoadError(
                {
                    modelJsonUrl: this.modelJson,
                    modelMetadataUrl: this.modelMetadata,
                },
                err
            );
        }
    }

    private async _startVideoStream(): Promise<boolean> {
        if (this._streamingVideo) {
            return true;
        }
        if (this._sub.closed) {
            return false;
        }

        const media = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 400,
                height: 400,
                facingMode: {
                    ideal: this.camera === 'front' ? 'user' : 'environment',
                },
            },
        });

        if (this._sub.closed) {
            return false;
        }

        this._video.srcObject = media;
        this._video.play().catch((err) => {
            if (!this._sub.closed) {
                throw err;
            }
        });
        this._streamingVideo = true;
        this._sub.add(() => this._stopVideoStream());
        return true;
    }

    private async _stopVideoStream() {
        if (this._streamingVideo) {
            this._streamingVideo = false;
            const source = this._video.srcObject;
            if (source instanceof MediaStream) {
                const tracks = source.getTracks();
                for (let track of tracks) {
                    track.stop();
                }
            }

            // this._video.pause();
            this._video.srcObject = null;
        }
    }

    private _requestFrame() {
        if (this._streamingVideo && this._model) {
            window.requestAnimationFrame(this._loop);
        }
    }

    private async _loop() {
        await this._predict();
        this._requestFrame();
    }

    private async _predict() {
        const prediction = await this._model.predict(this._video);
        this._emitClassification(sortBy(prediction, (p) => -p.probability));
    }

    private _emitModelLoaded(model: ImageClassifierModel) {
        const event: ModelLoadedEvent = {
            model: model,
        };
        this.$emit('modelLoaded', event);
    }

    private _emitModelLoadError(model: ModelLoadError['model'], error: any) {
        const event: ModelLoadError = {
            model,
            error,
        };
        this.$emit('modelLoadError', event);
    }

    private _emitClassification(prediction: ClassificationEvent['prediction']) {
        const event: ClassificationEvent = {
            model: this._currentModel,
            prediction,
        };
        this.$emit('classified', event);
    }
}
