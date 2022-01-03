declare interface What3WordsApi {
    convertTo3wa(
        latLon: What3WordsLatLng,
        lang?: string
    ): Promise<What3WordsAddressResult>;
    convertToCoordinates(w3w: string): Promise<What3WordsLatLng>;
}

declare interface What3WordsLatLng {
    lat: number;
    lng: number;
}

declare interface What3WordsAddressResult {
    words: string;
    coordinates: What3WordsLatLng;
    country: string;
    language: string;
    map: string;
    nearestPlace: string;
    square: {
        southwest: What3WordsLatLng;
        northeast: What3WordsLatLng;
    };
}

declare interface What3Words {
    api: What3WordsApi;
}

declare var what3words: What3Words;
