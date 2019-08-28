import Vue from 'vue';
import Component from 'vue-class-component';
import VueQuagga from '../../public/VueQuagga';

const defaultReaders = [
    'code_128_reader',
    'ean_reader',
    'ean_8_reader',
    'code_39_reader',
    'code_39_vin_reader',
    'codabar_reader',
    'upc_reader',
    'upc_e_reader',
    'i2of5_reader',
    '2of5_reader',
    'code_93_reader',
];

interface BarcodeResult {
    codeResult: {
        code: string;
        decodedCodes: {
            error: number;
        }[];
    };
}

@Component({
    components: {
        'v-barcode': VueQuagga,
    },
})
export default class BarcodeScanner extends Vue {
    private _lastCode: string;
    private _lastScanTime: number;

    readers: string[];

    barcodeDetected(result: BarcodeResult) {
        // Count up the error percentage of each detected digit/letter in the code.
        let count = 0;
        let errors = 0;
        for (let decoded of result.codeResult.decodedCodes) {
            if (typeof decoded.error !== 'undefined') {
                count += 1;
                errors += decoded.error;
            }
        }

        if (errors / count < 0.1) {
            // Code detected correctly
            this._emitCode(result.codeResult.code);
        }
    }

    created() {
        this._lastScanTime = 0;
        this.readers = defaultReaders;
    }

    private _emitCode(code: string) {
        const now = Date.now();
        if (code === this._lastCode) {
            if (now - this._lastScanTime < 2500) {
                this._lastScanTime = now;
                return;
            }
        }
        this._lastScanTime = now;
        this._lastCode = code;
        this.$emit('decode', code);
    }
}
