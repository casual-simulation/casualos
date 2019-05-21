interface Array<T> {
    last(): T | undefined;
}

if (!Array.prototype['last']) {
    Object.defineProperty(Array.prototype, 'last', {
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
                // 4. Return the last element
                return o[len - 1];
            }

            // 5. Return undefined.
            return undefined;
        },
        configurable: true,
        writable: true,
    });
}
