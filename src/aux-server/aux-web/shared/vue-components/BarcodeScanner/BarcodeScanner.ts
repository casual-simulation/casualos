/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import Vue from 'vue';
import Component from 'vue-class-component';
import VueQuagga from '../../public/VueQuagga';
import { Prop } from 'vue-property-decorator';
import type { CameraType } from '@casual-simulation/aux-common';

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

    @Prop() camera: CameraType;

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
