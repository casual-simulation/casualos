import { ArgEvent } from '@casual-simulation/aux-common/Events';

/**
 * This is a simple wrapper for the WebVR API for VR Displays.
 * It listens hooks up to all the WebVR events and fires off its own events in response.
 */
export namespace WebVRDisplays {
    export var vrCapable: boolean = false;
    export var vrDisplays: VRDisplay[] = null;

    /**
     * Return the current main VR display.
     */
    export function mainVRDisplay(): VRDisplay | null {
        if (vrDisplays && vrDisplays.length > 0) {
            return vrDisplays[0];
        } else {
            return null;
        }
    }

    /**
     * Is a VR display currently presenting?
     */
    export function isPresenting(): boolean {
        if (vrDisplays && vrDisplays.length > 0) {
            return vrDisplays.some(display => display.isPresenting === true);
        } else {
            return false;
        }
    }

    /**
     * Gets whether VR is supported.
     */
    export function supportsVR(): boolean {
        return 'getVRDisplays' in navigator;
    }

    /**
     * This is fired when a compatible VR display is connected to the computer.
     */
    export var onVRDisplayConnect: ArgEvent<VRDisplay> = new ArgEvent<
        VRDisplay
    >();

    /**
     * This event is fired when a compatible VR display is disconnected from the computer.
     */
    export var onVRDisplayDisconnect: ArgEvent<VRDisplay> = new ArgEvent<
        VRDisplay
    >();

    /**
     * This event is fired when a VR display is able to be presented to, for example
     * if an HMD has been moved to bring it out of standby, or woken up by being put on.
     */
    export var onVRDisplayActivate: ArgEvent<VRDisplay> = new ArgEvent<
        VRDisplay
    >();

    /**
     * This event is fired when a VR display can no longer be presented to,
     * for example if an HMD has gone into standby or sleep mode due to a period of inactivity.
     * */
    export var onVRDisplayDeactivate: ArgEvent<VRDisplay> = new ArgEvent<
        VRDisplay
    >();

    /**
     * This event is fired when presentation to a VR display has been paused for some reason by
     * the browser, OS, or VR hardware — for example, while the user is interacting with a system
     * menu or browser, to prevent tracking or loss of experience.
     */
    export var onVRDisplayBlur: ArgEvent<VRDisplay> = new ArgEvent<VRDisplay>();

    /**
     * This event is fired when presentation to a VR display has resumed after being blurred.
     */
    export var onVRDisplayFocus: ArgEvent<VRDisplay> = new ArgEvent<
        VRDisplay
    >();

    /**
     * This event is fired when the presenting state of a VR display changes
     * i.e. goes from presenting to not presenting, or vice versa.
     */
    export var onVRDisplayPresentChange: ArgEvent<VRDisplay> = new ArgEvent<
        VRDisplay
    >();

    export async function init(): Promise<void> {
        if (WebVRDisplays.supportsVR()) {
            console.log('[WebVRDisplays] Device is capable of VR.');
            vrCapable = true;

            window.addEventListener(
                'vrdisplayconnect',
                (event: VRDisplayEvent) => {
                    handleVRDisplayConnect(event.display);
                }
            );

            window.addEventListener(
                'vrdisplaydisconnect',
                (event: VRDisplayEvent) => {
                    handleVRDisplayDisconnect(event.display);
                }
            );

            window.addEventListener(
                'vrdisplayactivate',
                (event: VRDisplayEvent) => {
                    handleVRDisplayActivate(event.display);
                }
            );

            window.addEventListener(
                'vrdisplaydeactivate',
                (event: VRDisplayEvent) => {
                    handleVRDisplayBlur(event.display);
                }
            );

            window.addEventListener(
                'vrdisplayfocus',
                (event: VRDisplayEvent) => {
                    handleVRDisplayFocus(event.display);
                }
            );

            window.addEventListener(
                'vrdisplayblur',
                (event: VRDisplayEvent) => {
                    handleVRDisplayDeactivate(event.display);
                }
            );

            window.addEventListener(
                'vrdisplaypresentchange',
                (event: VRDisplayEvent) => {
                    handleVRDisplayPresentChange(event.display);
                }
            );

            let displays = await navigator.getVRDisplays();

            if (displays) {
                displays.forEach(display => {
                    handleVRDisplayConnect(display);
                });
            }
        } else {
            console.log('[WebVRDisplays] Device is not capable of VR.');
            vrCapable = false;
        }
    }

    function handleVRDisplayConnect(display: VRDisplay): void {
        console.log('[WebVRDisplays] VR display connected:', display);

        if (!vrDisplays) vrDisplays = [];

        // Add display to array.
        vrDisplays.push(display);

        onVRDisplayConnect.invoke(display);
    }

    function handleVRDisplayDisconnect(display: VRDisplay): void {
        console.log('[WebVRDisplays] VR display disconnected:', display);

        // Remove display from array.
        if (vrDisplays) {
            vrDisplays = vrDisplays.filter(display => display !== display);
        }

        onVRDisplayDisconnect.invoke(display);
    }

    function handleVRDisplayActivate(display: VRDisplay): void {
        console.log('[WebVRDisplays] VR display activate:', display);
        onVRDisplayActivate.invoke(display);
    }

    function handleVRDisplayDeactivate(display: VRDisplay): void {
        console.log('[WebVRDisplays] VR display deactivate:', display);
        onVRDisplayDeactivate.invoke(display);
    }

    function handleVRDisplayBlur(display: VRDisplay): void {
        console.log('[WebVRDisplays] VR display blur:', display);
        onVRDisplayBlur.invoke(display);
    }

    function handleVRDisplayFocus(display: VRDisplay): void {
        console.log('[WebVRDisplays] VR display focus:', display);
        onVRDisplayFocus.invoke(display);
    }

    function handleVRDisplayPresentChange(display: VRDisplay): void {
        console.log('[WebVRDisplays] VR display present change:', display);
        onVRDisplayPresentChange.invoke(display);
    }
}
