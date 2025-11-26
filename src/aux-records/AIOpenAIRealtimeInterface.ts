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

import type { KnownErrorCodes } from '@casual-simulation/aux-common';
import OpenAI from 'openai';
import { traced } from './tracing/TracingDecorators';
import { v7 as uuidv7 } from 'uuid';

export interface AIOpenAIRealtimeInterface {
    /**
     * Creates a new realtime session.
     * @param request The request to send.
     */
    createRealtimeSessionToken(
        request: CreateRealtimeSessionTokenRequest
    ): Promise<CreateRealtimeSessionTokenResult>;
}

/**
 * Defines a request to create a new realtime session.
 *
 * @dochash types/ai
 * @docname RealtimeSessionRequest
 */
export interface CreateRealtimeSessionTokenRequest {
    /**
     * The default system instructions (i.e. system message) prepended to model calls. This field allows the client to guide the model on desired responses. The model can be instructed on response content and format, (e.g. "be extremely succinct", "act friendly", "here are examples of good responses") and on audio behavior (e.g. "talk quickly", "inject emotion into your voice", "laugh frequently"). The instructions are not guaranteed to be followed by the model, but they provide guidance to the model on the desired behavior.
     *
     * Note that the server sets default instructions which will be used if this field is not set and are visible in the session.created event at the start of the session.
     */
    instructions?: string;

    /**
     * The Realtime model used for this session.
     */
    model: string;

    /**
     * The set of modalities the model can respond with. To disable audio, set this to ["text"].
     */
    modalities?: ('audio' | 'text')[];

    /**
     * Maximum number of output tokens for a single assistant response, inclusive of tool calls. Provide an integer between 1 and 4096 to limit output tokens, or inf for the maximum available tokens for a given model. Defaults to inf.
     */
    maxResponseOutputTokens?: number;

    /**
     * The format of input audio. Options are `pcm16`, `g711_ulaw`, or `g711_alaw`. For `pcm16`, input audio must be 16-bit PCM at a 24kHz sample rate, single channel (mono), and little-endian byte order.
     */
    inputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';

    /**
     * Configuration for input audio noise reduction. This can be set to null to turn off. Noise reduction filters audio added to the input audio buffer before it is sent to VAD and the model. Filtering the audio can improve VAD and turn detection accuracy (reducing false positives) and model performance by improving perception of the input audio.
     */
    inputAudioNoiseReduction?: {
        /**
         * Type of noise reduction. `near_field` is for close-talking microphones such as headphones, `far_field` is for far-field microphones such as laptop or conference room microphones.
         */
        type?: 'near_field' | 'far_field';
    } | null;

    /**
     * Configuration for input audio transcription, defaults to off and can be set to `null` to turn off once on. Input audio transcription is not native to the model, since the model consumes audio directly. Transcription runs asynchronously through the /audio/transcriptions endpoint and should be treated as guidance of input audio content rather than precisely what the model heard. The client can optionally set the language and prompt for transcription, these offer additional guidance to the transcription service.
     */
    inputAudioTranscription?: {
        /**
         * The language of the input audio. Supplying the input language in [ISO-639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) (e.g. `en`) format will improve accuracy and latency.
         */
        language?: string;

        /**
         * The model to use for transcription, current options are `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, and `whisper-1`.
         */
        model?: string;

        /**
         * An optional text to guide the model's style or continue a previous audio segment. For `whisper-1`, the prompt is a list of keywords. For `gpt-4o-transcribe` models, the prompt is a free text string, for example "expect words related to technology".
         */
        prompt?: string;
    } | null;

    /**
     * The format of output audio. Options are pcm16, g711_ulaw, or g711_alaw. For pcm16, output audio is sampled at a rate of 24kHz.
     */
    outputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';

    /**
     * Sampling temperature for the model, limited to [0.6, 1.2]. For audio models a temperature of 0.8 is highly recommended for best performance.
     */
    temperature?: number;

    /**
     * How the model chooses tools. Options are `auto`, `none`, `required`, or specify a function.
     */
    toolChoice?: string;

    /**
     * Tools (functions) available to the model.
     */
    tools?: {
        /**
         * The description of the function, including guidance on when and how to call it, and guidance about what to tell the user when calling (if anything).
         */
        description?: string;

        /**
         * The name of the function.
         */
        name: string;

        /**
         * Parameters of the function in JSON Schema.
         */
        parameters?: any;

        /**
         * The type of the tool, i.e. `function`.
         */
        type?: 'function';
    }[];

    /**
     * Configuration for turn detection, ether Server VAD or Semantic VAD. This can be set to `null` to turn off, in which case the client must manually trigger model response. Server VAD means that the model will detect the start and end of speech based on audio volume and respond at the end of user speech. Semantic VAD is more advanced and uses a turn detection model (in conjuction with VAD) to semantically estimate whether the user has finished speaking, then dynamically sets a timeout based on this probability. For example, if user audio trails off with "uhhm", the model will score a low probability of turn end and wait longer for the user to continue speaking. This can be useful for more natural conversations, but may have a higher latency.
     */
    turnDetection?: {
        /**
         * Whether or not to automatically generate a response when a VAD stop event occurs.
         */
        createResponse?: boolean;

        /**
         * Used only for `semantic_vad` mode. The eagerness of the model to respond. `low` will wait longer for the user to continue speaking, `high` will respond more quickly. `auto` is the default and is equivalent to `medium`.
         */
        eagerness?: 'low' | 'medium' | 'high';

        /**
         * Whether or not to automatically interrupt any ongoing response with output to the default conversation (i.e. `conversation` of `auto`) when a VAD start event occurs.
         */
        interruptResponse?: boolean;

        /**
         * Used only for `server_vad` mode. Amount of audio to include before the VAD detected speech (in milliseconds). Defaults to 300ms.
         */
        prefixPaddingMs?: number;

        /**
         * Used only for `server_vad` mode. Duration of silence to detect speech stop (in milliseconds). Defaults to 500ms. With shorter values the model will respond more quickly, but may jump in on short pauses from the user.
         */
        silenceDurationMs?: number;

        /**
         * Used only for `server_vad` mode. Activation threshold for VAD (0.0 to 1.0), this defaults to 0.5. A higher threshold will require louder audio to activate the model, and thus might perform better in noisy environments.
         */
        threshold?: number;

        /**
         * Type of turn detection.
         */
        type?: 'server_vad' | 'semantic_vad';
    } | null;

    /**
     * The voice the model uses to respond. Voice cannot be changed during the session once the model has responded with audio at least once. Current voice options are `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `onyx`, `nova`, `sage`, `shimmer`, and `verse`.
     */
    voice?: string;
}

export type CreateRealtimeSessionTokenResult =
    | CreateRealtimeSessionTokenSuccess
    | CreateRealtimeSessionTokenFailure;

export interface CreateRealtimeSessionTokenSuccess {
    success: true;
    sessionId: string;
    clientSecret: {
        value: string;
        expiresAt: number;
    };
}

export interface CreateRealtimeSessionTokenFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}

export interface OpenAIRealtimeOptions {
    /**
     * The API key to use.
     */
    apiKey: string;
}

const TRACE_NAME = 'OpenAIRealtimeInterface';

export class OpenAIRealtimeInterface implements AIOpenAIRealtimeInterface {
    private _options: OpenAIRealtimeOptions;
    private _client: OpenAI;

    constructor(options: OpenAIRealtimeOptions) {
        this._options = options;
        this._client = new OpenAI({
            apiKey: options.apiKey,
        });
    }

    @traced(TRACE_NAME)
    async createRealtimeSessionToken(
        request: CreateRealtimeSessionTokenRequest
    ): Promise<CreateRealtimeSessionTokenResult> {
        try {
            const session = await this._client.beta.realtime.sessions.create({
                input_audio_format: request.inputAudioFormat,
                input_audio_noise_reduction: request.inputAudioNoiseReduction,
                input_audio_transcription: request.inputAudioTranscription,
                instructions: request.instructions,
                max_response_output_tokens: request.maxResponseOutputTokens,
                modalities: request.modalities,
                model: request.model as any,
                output_audio_format: request.outputAudioFormat,
                temperature: request.temperature,
                tool_choice: request.toolChoice,
                tools: request.tools,
                turn_detection: request.turnDetection
                    ? {
                          create_response: request.turnDetection.createResponse,
                          eagerness: request.turnDetection.eagerness,
                          interrupt_response:
                              request.turnDetection.interruptResponse,
                          prefix_padding_ms:
                              request.turnDetection.prefixPaddingMs,
                          silence_duration_ms:
                              request.turnDetection.silenceDurationMs,
                          threshold: request.turnDetection.threshold,
                          type: request.turnDetection.type,
                      }
                    : request.turnDetection === null
                    ? null
                    : undefined,
                voice: request.voice as any,
            });

            const sessionId = uuidv7();
            return {
                success: true,
                sessionId,
                clientSecret: {
                    value: session.client_secret.value,
                    expiresAt: session.client_secret.expires_at,
                },
            };
        } catch (err) {
            console.error(
                '[OpenAIRealtimeInterface] Error creating realtime session',
                err
            );
            if (
                err instanceof OpenAI.APIError &&
                (err.status === 400 || err.status === 404)
            ) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: err.message,
                };
            } else if (err instanceof OpenAI.APIError && err.status === 429) {
                return {
                    success: false,
                    errorCode: 'rate_limit_exceeded',
                    errorMessage:
                        'The rate limit for creating realtime sessions has been exceeded.',
                };
            } else {
                return {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage:
                        'A server error occurred while creating the realtime session.',
                };
            }
        }
    }
}
