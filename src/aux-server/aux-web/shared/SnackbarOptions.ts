/**
 * The options for the snackbar.
 */
export default interface SnackbarOptions {
    visible: boolean;
    message: string;
    action?: {
        type: string;
        label: string;
    };
}
