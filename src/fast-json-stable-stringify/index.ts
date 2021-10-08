export interface CompareValue {
    key: string;
    value: any;
}

export type CompareFunction = (
    first: CompareValue,
    second: CompareValue
) => number;

export interface StringifyOptions {
    cmp?: CompareFunction;
    cycles?: boolean;
    space?: string | number;
}

export default function (
    data: any,
    options?: StringifyOptions | CompareFunction
) {
    if (!options) options = {};
    if (typeof options === 'function') options = { cmp: options };
    let cycles = typeof options.cycles === 'boolean' ? options.cycles : false;
    options.space = options.space || '';
    let space =
        typeof options.space === 'number'
            ? Array(options.space + 1).join(' ')
            : options.space;

    let cmp =
        options.cmp &&
        ((f) => {
            return (node: any) => {
                return (a: string, b: string) => {
                    let aobj = { key: a, value: node[a] };
                    let bobj = { key: b, value: node[b] };
                    return f(aobj, bobj);
                };
            };
        })(options.cmp);

    let seen: any[] = [];
    return (function stringify(node: any, level: number) {
        let indent = space ? '\n' + new Array(level + 1).join(space) : '';
        let colonSeparator = space ? ': ' : ':';
        if (node && node.toJSON && typeof node.toJSON === 'function') {
            node = node.toJSON();
        }

        if (node === undefined) return;
        if (typeof node === 'number')
            return isFinite(node) ? '' + node : 'null';
        if (typeof node !== 'object')
            return JSON.stringify(node, undefined, space);

        let i: number;
        let out: string;
        if (Array.isArray(node)) {
            out = '[';
            for (i = 0; i < node.length; i++) {
                if (i) out += ',';
                out +=
                    indent + space + (stringify(node[i], level + 1) || 'null');
            }
            return out + indent + ']';
        }

        if (node === null) return 'null';

        if (seen.indexOf(node) !== -1) {
            if (cycles) return JSON.stringify('__cycle__');
            throw new TypeError('Converting circular structure to JSON');
        }

        let seenIndex = seen.push(node) - 1;
        let keys = Object.keys(node).sort(cmp && cmp(node));
        out = '';
        for (i = 0; i < keys.length; i++) {
            let key = keys[i];
            let value = stringify(node[key], level + 1);

            if (!value) continue;
            if (out) out += ',';
            out +=
                indent + space + JSON.stringify(key) + colonSeparator + value;
        }
        seen.splice(seenIndex, 1);
        return '{' + out + indent + '}';
    })(data, 0);
}

// module.exports = function (data, opts) {
//     if (!opts) opts = {};
//     if (typeof opts === 'function') opts = { cmp: opts };
//     var cycles = (typeof opts.cycles === 'boolean') ? opts.cycles : false;

//     var cmp = opts.cmp && (function (f) {
//         return function (node) {
//             return function (a, b) {
//                 var aobj = { key: a, value: node[a] };
//                 var bobj = { key: b, value: node[b] };
//                 return f(aobj, bobj);
//             };
//         };
//     })(opts.cmp);

//     var seen = [];
//     return (function stringify (node) {
//         if (node && node.toJSON && typeof node.toJSON === 'function') {
//             node = node.toJSON();
//         }

//         if (node === undefined) return;
//         if (typeof node == 'number') return isFinite(node) ? '' + node : 'null';
//         if (typeof node !== 'object') return JSON.stringify(node);

//         var i, out;
//         if (Array.isArray(node)) {
//             out = '[';
//             for (i = 0; i < node.length; i++) {
//                 if (i) out += ',';
//                 out += stringify(node[i]) || 'null';
//             }
//             return out + ']';
//         }

//         if (node === null) return 'null';

//         if (seen.indexOf(node) !== -1) {
//             if (cycles) return JSON.stringify('__cycle__');
//             throw new TypeError('Converting circular structure to JSON');
//         }

//         var seenIndex = seen.push(node) - 1;
//         var keys = Object.keys(node).sort(cmp && cmp(node));
//         out = '';
//         for (i = 0; i < keys.length; i++) {
//             var key = keys[i];
//             var value = stringify(node[key]);

//             if (!value) continue;
//             if (out) out += ',';
//             out += JSON.stringify(key) + ':' + value;
//         }
//         seen.splice(seenIndex, 1);
//         return '{' + out + '}';
//     })(data);
// };
