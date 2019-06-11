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
     * This event is fired when the presenting state of a VR display changes
     * i.e. goes from presenting to not presenting, or vice versa.
     */
    export var onVRDisplayPresentChange: ArgEvent<VRDisplay> = new ArgEvent<
        VRDisplay
    >();

    export async function init(): Promise<void> {
        if ('getVRDisplays' in navigator) {
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

        // Fire the manager's connect event.
        onVRDisplayConnect.invoke(display);
    }

    function handleVRDisplayDisconnect(display: VRDisplay): void {
        console.log('[WebVRDisplays] VR display disconnected:', display);

        // Remove display from array.
        if (vrDisplays) {
            vrDisplays = vrDisplays.filter(display => display !== display);
        }

        // Fire the manager's disconnect event.
        onVRDisplayDisconnect.invoke(display);
    }

    function handleVRDisplayActivate(display: VRDisplay): void {
        console.log('[WebVRDisplays] VR display activate:', display);

        // Fire the manager's activate event.
        onVRDisplayActivate.invoke(display);
    }

    function handleVRDisplayPresentChange(display: VRDisplay): void {
        console.log('[WebVRDisplays] VR display present change:', display);

        // fire the manager's present change event.
        onVRDisplayPresentChange.invoke(display);
    }
}
