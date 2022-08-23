import {
    AnimationObjectGroup,
    AnimationMixer,
    Object3D,
    AnimationAction,
    LoopOnce,
    LoopRepeat,
    LoopPingPong,
} from '@casual-simulation/three';
import { SubscriptionLike } from 'rxjs';
import { GLTF } from '@casual-simulation/three/examples/jsm/loaders/GLTFLoader';
import { gltfPool } from './decorators/BotShapeDecorator';
import {
    calculateBotValue,
    StartFormAnimationAction,
    StartFormAnimationOptions,
    hasValue,
    asyncResult,
    asyncError,
    realNumberOrDefault,
    ON_FORM_ANIMATION_STARTED,
    Bot,
    ON_ANY_FORM_ANIMATION_STARTED,
    ON_FORM_ANIMATION_LOOPED,
    ON_ANY_FORM_ANIMATION_LOOPED,
    ON_FORM_ANIMATION_FINISHED,
    ON_ANY_FORM_ANIMATION_FINISHED,
    ON_FORM_ANIMATION_STOPPED,
    ON_ANY_FORM_ANIMATION_STOPPED,
    StopFormAnimationAction,
} from '@casual-simulation/aux-common';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { Simulation } from '@casual-simulation/aux-vm';

const CANCEL_SYMBOL = Symbol('cancel');

export interface AnimationMixerHandle extends SubscriptionLike {
    mixer: AnimationMixer;
}

export interface MixerSubscription {
    object: Object3D;
    stopLocalMixer: () => void;
    startLocalMixer: () => void;
}

interface MixerGroup {
    mixer: AnimationMixer;
    group: AnimationObjectGroup;
    subscriptions: MixerSubscription[];

    addresses: Map<
        string,
        {
            clips: AnimationAction[];
            clipMap: Map<string, AnimationAction>;
        }
    >;
    currentClip: AnimationAction;
    cancelCurrentClip: (stop?: boolean) => void;

    state: 'playing' | 'stopped';
}

export class AnimationHelper {
    private _mixers: Map<string, MixerGroup> = new Map();
    private _numAnimations: number = 0;

    private _simulation: Simulation;

    constructor(simulation: Simulation) {
        this._simulation = simulation;
    }

    // 3DBots register with the helper.
    // Helper receives new animation events.
    // 3DBots get told by the helper when to start and stop their animation mixer.

    update(deltaTime: number) {
        if (this._numAnimations <= 0) {
            return;
        }
        for (let [id, group] of this._mixers) {
            group.mixer.update(deltaTime);
            for (let sub of group.subscriptions) {
                sub.object.updateMatrixWorld(true);
            }
        }
    }

    startAnimation(event: StartFormAnimationAction): Promise<any> {
        try {
            let promises = event.botIds
                .map((id) => this._startAnimationForBot(id, event))
                .filter((p) => !!p);

            if (promises.length > 0) {
                return Promise.all(promises);
            }
            return null;
        } catch (err) {
            throw err;
        }
    }

    stopAnimation(event: StopFormAnimationAction): Promise<any> {
        try {
            let promises = event.botIds
                .map((id) => this._stopAnimationForBot(id, event))
                .filter((p) => !!p);

            if (promises.length > 0) {
                return Promise.all(promises);
            }
            return null;
        } catch (err) {
            throw err;
        }
    }

    private _startAnimationForBot(
        botId: string,
        options: StartFormAnimationAction
    ) {
        const mixer = this._getMixerForBot(botId);
        if (mixer.subscriptions.length <= 0) {
            return null;
        }
        const bot = this._simulation.helper.botsState[botId];
        if (!bot) {
            return null;
        }

        return this._runAnimationForBot(mixer, bot, options);
    }

    private async _runAnimationForBot(
        mixer: MixerGroup,
        bot: Bot,
        options: StartFormAnimationAction
    ) {
        const animationAddress =
            options.animationAddress ??
            calculateBotValue(null, bot, 'auxFormAddress');
        if (!hasValue(animationAddress)) {
            throw new Error(
                'Cannot start animation because the bot has no formAddress.'
            );
        }

        let addressClips = mixer.addresses.get(animationAddress);
        if (!addressClips) {
            const gltf = await gltfPool.loadGLTF(animationAddress);
            const clips = this._processGLTFAnimations(gltf, mixer.mixer);
            mixer.addresses.set(animationAddress, clips);
            addressClips = clips;
        }

        const clip =
            typeof options.nameOrIndex === 'string'
                ? addressClips.clipMap.get(options.nameOrIndex)
                : addressClips.clips[options.nameOrIndex];

        if (clip) {
            let isPlayingPreviousClip = false;
            let previousClip = mixer.currentClip;
            let cancelPreviousClip = mixer.cancelCurrentClip;

            // Play clip
            mixer.state = 'playing';
            mixer.currentClip = clip;

            if (previousClip) {
                isPlayingPreviousClip = previousClip.isRunning();
            }

            clip.reset();

            if (options.loop) {
                const mode =
                    options.loop.mode === 'repeat' ? LoopRepeat : LoopPingPong;
                clip.setLoop(mode, options.loop.count);
            } else {
                clip.setLoop(LoopOnce, 1);
            }

            clip.clampWhenFinished = !!options.clampWhenFinished;
            clip.timeScale = realNumberOrDefault(options.timeScale, 1);
            clip.weight = 1;
            clip.time =
                (realNumberOrDefault(options.initialTime, 0) / 1000) *
                clip.timeScale;

            const now = Date.now();
            let startTimeRelativeToNow =
                realNumberOrDefault(options.startTime, now) - now;
            mixer.mixer.time = 0;
            clip.startAt(startTimeRelativeToNow);

            let timeoutId: any;

            if (previousClip === clip) {
                if (cancelPreviousClip) {
                    cancelPreviousClip();
                }
            } else if (
                isPlayingPreviousClip &&
                hasValue(options.crossFadeDuration)
            ) {
                const durationMs = realNumberOrDefault(
                    options.crossFadeDuration,
                    0
                );
                clip.crossFadeFrom(previousClip, durationMs / 1000, true);

                if (cancelPreviousClip) {
                    timeoutId = setTimeout(() => {
                        cancelPreviousClip();
                    }, durationMs);
                }
            } else if (
                !isPlayingPreviousClip &&
                hasValue(options.fadeDuration)
            ) {
                clip.fadeIn(
                    realNumberOrDefault(options.fadeDuration / 1000, 0)
                );
            } else if (previousClip) {
                previousClip.stop();
                if (cancelPreviousClip) {
                    cancelPreviousClip();
                }
            }

            clip.play();

            let loopCount = 0;
            const loopListener = (event: any) => {
                if (event.action === clip) {
                    loopCount += event.loopDelta;
                    const animationLoopArg = {
                        animation: options.nameOrIndex,
                        loopCount: loopCount,
                    };
                    this._simulation.helper.action(
                        ON_FORM_ANIMATION_LOOPED,
                        [bot],
                        animationLoopArg
                    );
                    this._simulation.helper.action(
                        ON_ANY_FORM_ANIMATION_LOOPED,
                        null,
                        {
                            ...animationLoopArg,
                            bot: bot,
                        }
                    );
                }
            };

            let finished = false;
            const finishListener = (event: any) => {
                if (event.action === clip) {
                    if (finished) {
                        return;
                    }
                    finished = true;
                    if (hasValue(timeoutId)) {
                        cancelPreviousClip();
                        clearTimeout(timeoutId);
                    }
                    mixer.mixer.removeEventListener('finished', finishListener);
                    mixer.mixer.removeEventListener('loop', loopListener);
                    this._numAnimations -= 1;

                    if (!event[CANCEL_SYMBOL] && mixer.currentClip === clip) {
                        if (clip.isRunning()) {
                            clip.stop();
                        }
                        mixer.currentClip = null;
                        mixer.state = 'stopped';
                        for (let sub of mixer.subscriptions) {
                            sub.startLocalMixer();
                        }
                    }

                    const animationFinishArg = {
                        animation: options.nameOrIndex,
                    };
                    this._simulation.helper.action(
                        ON_FORM_ANIMATION_FINISHED,
                        [bot],
                        animationFinishArg
                    );
                    this._simulation.helper.action(
                        ON_ANY_FORM_ANIMATION_FINISHED,
                        null,
                        {
                            ...animationFinishArg,
                            bot: bot,
                        }
                    );
                }
            };

            mixer.mixer.addEventListener('finished', finishListener);
            mixer.mixer.addEventListener('loop', loopListener);

            mixer.cancelCurrentClip = (stop?: boolean) => {
                finishListener({
                    action: clip,
                    [CANCEL_SYMBOL]: !stop,
                });
            };

            for (let sub of mixer.subscriptions) {
                sub.stopLocalMixer();
            }
            this._numAnimations += 1;

            const animationStartArg = {
                animation: options.nameOrIndex,
            };
            this._simulation.helper.action(
                ON_FORM_ANIMATION_STARTED,
                [bot],
                animationStartArg
            );
            this._simulation.helper.action(
                ON_ANY_FORM_ANIMATION_STARTED,
                null,
                {
                    ...animationStartArg,
                    bot: bot,
                }
            );
        }
    }

    private _stopAnimationForBot(
        botId: string,
        options: StopFormAnimationAction
    ) {
        const mixer = this._getMixerForBot(botId);
        if (mixer.subscriptions.length <= 0) {
            return null;
        }
        const bot = this._simulation.helper.botsState[botId];
        if (!bot) {
            return null;
        }

        return this._cancelAnimationForBot(mixer, bot, options);
    }

    private _cancelAnimationForBot(
        mixer: MixerGroup,
        bot: Bot,
        options: StopFormAnimationAction
    ) {
        return new Promise<void>((resolve, reject) => {
            const currentClip = mixer.currentClip;
            const cancelCurrentClip = mixer.cancelCurrentClip;

            if (!currentClip || !cancelCurrentClip) {
                resolve();
                return;
            }

            const stopAnimation = () => {
                cancelCurrentClip(true);
                resolve();

                const animationStopArg = {
                    animation: currentClip.getClip().name,
                };
                this._simulation.helper.action(
                    ON_FORM_ANIMATION_STOPPED,
                    [bot],
                    animationStopArg
                );
                this._simulation.helper.action(
                    ON_ANY_FORM_ANIMATION_STOPPED,
                    null,
                    {
                        ...animationStopArg,
                        bot: bot,
                    }
                );
            };

            const initStop = () => {
                if (hasValue(options.fadeDuration)) {
                    const fadeDurationMs = realNumberOrDefault(
                        options.fadeDuration,
                        0
                    );
                    currentClip.fadeOut(fadeDurationMs / 1000);
                    setTimeout(() => {
                        stopAnimation();
                    }, fadeDurationMs);
                } else {
                    stopAnimation();
                }
            };

            if (hasValue(options.stopTime)) {
                const now = Date.now();
                setTimeout(
                    initStop,
                    realNumberOrDefault(options.stopTime, now) - now
                );
            } else {
                initStop();
            }
        });
    }

    getAnimationMixerHandle(
        botId: string,
        sub: MixerSubscription
    ): AnimationMixerHandle {
        let mixer = this._getMixerForBot(botId);

        const index = mixer.subscriptions.indexOf(sub);
        if (index < 0) {
            mixer.subscriptions.push(sub);
            mixer.group.add(sub.object);
        }

        if (mixer.state === 'playing') {
            sub.stopLocalMixer();
        }

        let closed = false;
        return {
            mixer: mixer.mixer,

            get closed() {
                return closed;
            },

            unsubscribe() {
                const index = mixer.subscriptions.indexOf(sub);
                if (index >= 0) {
                    mixer.subscriptions.splice(index, 1);
                    mixer.group.uncache(sub.object);
                }
            },
        };
    }

    private _getMixerForBot(botId: string) {
        let mixer = this._mixers.get(botId);
        if (!mixer) {
            const group = new AnimationObjectGroup();
            const anim = new AnimationMixer(group);
            mixer = {
                mixer: anim,
                group: group,
                subscriptions: [],
                addresses: new Map(),
                currentClip: null,
                cancelCurrentClip: null,
                state: 'stopped',
            };
            this._mixers.set(botId, mixer);
        }

        return mixer;
    }

    private _processGLTFAnimations(gltf: GLTF, mixer: AnimationMixer) {
        // Animations
        let clipMap = new Map<string, AnimationAction>();
        let clips = [] as AnimationAction[];
        if (gltf.animations.length > 0) {
            for (let anim of gltf.animations) {
                const action = mixer.clipAction(anim);
                clips.push(action);
                clipMap.set(anim.name, action);
            }
        }

        return {
            clips,
            clipMap,
        };
    }
}
