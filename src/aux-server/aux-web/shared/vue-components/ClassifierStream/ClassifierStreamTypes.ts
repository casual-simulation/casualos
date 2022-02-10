export interface ModelLoadedEvent {
    model: ImageClassifierModel;
}

export interface ModelLoadError {
    error: any;
    model: Partial<ImageClassifierModel>;
}

export interface ImageClassifierModel {
    modelJsonUrl: string;
    modelMetadataUrl: string;
    classLabels: string[];
}

export interface ClassificationEvent {
    model: ImageClassifierModel;
    prediction: {
        className: string;
        probability: number;
    }[];
}
