import {
    AnimationObjectGroup,
    AnimationMixer,
    Object3D,
    AnimationAction,
    LoopOnce,
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
} from '@casual-simulation/aux-common';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { Simulation } from '@casual-simulation/aux-vm';

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

    state: 'playing' | 'stopped';
}

export class AnimationHelper {
    private _mixers: Map<string, MixerGroup> = new Map();

    private _simulation: Simulation;

    constructor(simulation: Simulation) {
        this._simulation = simulation;
    }

    // 3DBots register with the helper.
    // Helper receives new animation events.
    // 3DBots get told by the helper when to start and stop their animation mixer.

    update(deltaTime: number) {
        for (let [id, group] of this._mixers) {
            group.mixer.update(deltaTime);
            for (let sub of group.subscriptions) {
                sub.object.updateMatrixWorld(true);
            }
        }
    }

    async startAnimation(event: StartFormAnimationAction): Promise<void> {
        try {
            let promises = event.botIds.map((id) =>
                this._startAnimationForBot(id, event)
            );
            await Promise.all(promises);

            this._simulation.helper.transaction(
                asyncResult(event.taskId, null)
            );
        } catch (err) {
            this._simulation.helper.transaction(
                asyncError(event.taskId, err.toString())
            );
        }
    }

    private async _startAnimationForBot(
        botId: string,
        options: StartFormAnimationAction
    ) {
        const mixer = this._getMixerForBot(botId);
        const bot = this._simulation.helper.botsState[botId];
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
            // Play clip
            mixer.state = 'playing';

            if (mixer.currentClip) {
                mixer.currentClip.stop();
            }

            clip.play();
            clip.setLoop(LoopOnce, 1);

            mixer.currentClip = clip;

            for (let sub of mixer.subscriptions) {
                sub.stopLocalMixer();
            }

            const listener = () => {
                console.log('[AnimationHelper] Finished Animation!');
                mixer.mixer.removeEventListener('finished', listener);

                mixer.state = 'stopped';
                for (let sub of mixer.subscriptions) {
                    sub.startLocalMixer();
                }
            };

            mixer.mixer.addEventListener('finished', listener);
        }
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
