/**
 * The options for the snackbar.
 */
export default interface SnackbarOptions {
    visible: boolean;
    message: string;
    duration?: number;
    action?: {
        type: string;
        label: string;
    };
}
