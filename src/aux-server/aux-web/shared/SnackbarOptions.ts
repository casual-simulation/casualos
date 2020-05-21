/**
 * The options for the snackbar.
 */
export default interface SnackbarOptions {
    visible: boolean;
    message: any;
    duration?: number;
    action?: {
        type: string;
        label: string;
    };
}
