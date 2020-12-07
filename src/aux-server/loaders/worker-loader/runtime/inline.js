'use strict';

/* eslint-env browser */

/* eslint-disable no-undef, no-use-before-define, new-cap */
module.exports = function (content, workerConstructor, workerOptions, url) {
    try {
        try {
            var blob;

            try {
                // New API
                blob = new window.Blob([content]);
            } catch (e) {
                // BlobBuilder = Deprecated, but widely implemented
                var BlobBuilder =
                    window.BlobBuilder ||
                    window.WebKitBlobBuilder ||
                    window.MozBlobBuilder ||
                    window.MSBlobBuilder;
                blob = new BlobBuilder();
                blob.append(content);
                blob = blob.getBlob();
            }

            var URL = window.URL || window.webkitURL;
            var objectURL = URL.createObjectURL(blob);
            var worker = new window[workerConstructor](
                objectURL,
                workerOptions
            );
            setTimeout(() => {
                URL.revokeObjectURL(objectURL);
            }, 1000);
            return worker;
        } catch (e) {
            return new window[workerConstructor](
                'data:application/javascript,'.concat(
                    encodeURIComponent(content)
                ),
                workerOptions
            );
        }
    } catch (e) {
        if (!url) {
            throw Error('Inline worker is not supported');
        }

        return new window[workerConstructor](url, workerOptions);
    }
};
