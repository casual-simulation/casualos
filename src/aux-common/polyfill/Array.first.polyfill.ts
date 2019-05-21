interface Array<T> {
    first(): T | undefined;
}

if (!Array.prototype['first']) {
    Object.defineProperty(Array.prototype, 'first', {
        value: function() {
            // 1. Let O be ? ToObject(this value).
            if (this == null) {
                throw new TypeError('"this" is null or not defined');
            }

            var o = Object(this);

            // 2. Let len be ? ToLength(? Get(O, "length")).
            var len = o.length >>> 0;

            // 3. Check if we have at least one element
            if (len > 0) {
                // 4. Return first element
                return o[0];
            }

            // 5. Return undefined.
            return undefined;
        },
        configurable: true,
        writable: true,
    });
}
