declare namespace XR8 {
    function initialize(): Promise<void>;

    /**
     * Open the camera and start running the camera run loop.
     * @param canvas The HTML Canvas that the camera feed will be drawn to.
     * @param webgl2 If true, use WebGL2 if available, otherwise fallback to WebGL1. If false, always use WebGL1.
     * @param ownRunLoop If true, XR should use it's own run loop. If false, you will provide your own run loop and be responsible for calling runPreRender and runPostRender yourself [Advanced Users only].
     * @param cameraConfig Desired camera to use. Supported values for direction are XR8.XrConfig.camera().BACK or XR8.XrConfig.camera().FRONT.
     * @param glContextConfig The attributes to configure the WebGL canvas context.
     * @param allowedDevices Specify the class of devices that the pipeline should run on. If the current device is not in that class, running will fail prior prior to opening the camera. If allowedDevices is XR8.XrConfig.device().ANY, always open the camera. Note that world tracking can only be used with XR8.XrConfig.device().MOBILE_AND_HEADSETS or XR8.XrConfig.device().MOBILE.
     * @param sessionConfiguration Configure options related to varying types of sessions.
     */
    function run(
        canvas: HTMLCanvasElement,
        webgl2: boolean,
        ownRunLoop: boolean,
        cameraConfig?: any,
        glContextConfig?: any,
        allowedDevices?: any,
        sessionConfiguration?: any
    ): void;

    /**
     * While stopped, the camera feed is closed and device motion is not tracked. Must call XR8.run() to restart after the engine is stopped.
     */
    function stop(): void;

    function runPreRender(timestamp: number): void;
    function runPostRender(): void;

    /**
     * Adds the given camera pipeline module.
     * @param module The module to add.
     */
    function addCameraPipelineModule(module: CameraPipelineModule): void;

    /**
     * Adds the given camera pipeline modules.
     * @param modules The modules to add.
     */
    function addCameraPipelineModules(modules: CameraPipelineModule[]): void;

    /**
     * 8th Wall camera applications are built using a camera pipeline module framework. Applications install modules which then control the behavior of the application at runtime.
     *
     * Refer to XR8.addCameraPipelineModule() for details on adding camera pipeline modules to your application.
     *
     * A camera pipeline module object must have a .name string which is unique within the application. It should implement one or more of the following camera lifecycle methods. These methods will be executed at the appropriate point in the run loop.
     *
     * During the main runtime of an application, each camera frame goes through the following cycle:
     *
     * onBeforeRun -> onCameraStatusChange (requesting -> hasStream -> hasVideo | failed) -> onStart -> onAttach -> onProcessGpu -> onProcessCpu -> onUpdate -> onRender
     *
     * Camera modules should implement one or more of the following camera lifecycle methods:
     */
    interface CameraPipelineModule {
        /**
         * The name of the module.
         */
        name: string;

        onStart?(context: ModuleContext): void;
        onResume?(): void;
        onPaused?(): void;
        onRender?(): void;
        onUpdate?(update: Update): void;
        onBeforeRun?(): void;
        onVideoSizeChange?(): void;
        onException?(error: any): void;
        listeners?: Listener[];
    }

    interface Listener {
        event: string;
        process: (data: any) => void;
    }

    interface ModuleContext {
        canvas: HTMLCanvasElement;
        GLctx: WebGL2RenderingContext;
        computeCtx: WebGL2RenderingContext;
        isWebgl2: boolean;
    }

    interface Update {
        frameStartResult: any;
        processGpuResult: ProcessGpuResult;
        processCpuResult: ProcessCpuResult;
    }

    interface ProcessGpuResult {
        reality: {
            /**
             * The orientation (quaternion) of the camera in the scene.
             */
            rotation: { w: number; x: number; y: number; z: number };

            /**
             * The position of the camera in the scene.
             */
            position: { x: number; y: number; z: number };

            /**
             * 	A 16 dimensional column-major 4x4 projection matrix that gives the scene camera the same field of view as the rendered camera feed.
             */
            intrinsics: number[];

            /**
             * One of 'LIMITED' or 'NORMAL'.
             */
            trackingStatus: string;

            /**
             * One of 'UNSPECIFIED' or'INITIALIZING'.
             */
            trackingReason: string;

            /**
             * An array of detected points in the world at their location in the scene. Only filled if XrController is configured to return world points and trackingReason != 'INITIALIZING'.
             */
            woldPoints: Point[];

            /**
             * The texture containing camera feed data.
             */
            realityTexture: WebGLTexture;

            /**
             * Exposure of the lighting in your environment. Note: temperature has not yet been implemented.
             */
            lighting: {
                exposure: number;
                temperature: number;
            };
        };
    }

    interface ProcessCpuResult {}

    interface Point {
        id: any;
        confidence: number;
        position: { x: number; y: number; z: number };
    }

    export namespace GlTextureRenderer {
        function pipelineModule(): CameraPipelineModule;
    }

    export namespace XrController {
        function pipelineModule(): CameraPipelineModule;
    }
}
