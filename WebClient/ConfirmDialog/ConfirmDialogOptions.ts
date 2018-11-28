export default class ConfirmDialogOptions {
    public title: string = null;
    public body: string = null;
    public okCallback: () => void;
    public cancelCallback: () => void;
}