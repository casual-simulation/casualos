import { ReflectionKind } from './reflectionKind';

console.log('ReflectionKind', ReflectionKind); // 1024

const keysMap = new Map([
    [ReflectionKind.Property, ['type']],
    ['reflection', ['declaration']],
    [ReflectionKind.TypeLiteral, ['children', 'signatures']],
    [ReflectionKind.CallSignature, ['parameters', 'comment', 'type']]
]);

export function walk(obj, callback, parent = null) {
    walkSingle(obj, (value, parent, key) => {
        callback(value, parent, key);
        walk(value, callback, value); 
    });
}

export function walkSingle(obj, callback, parent = null) {
    let keys = keysMap.get(obj.kind ?? obj.type) || [];
    for(let key of keys) {
        let value = obj[key];
        if (Array.isArray(value)) {
            for (let v of value) {
                if (v) {
                    callback(v, parent, key);
                }
            }
        } else if (value) {
            callback(value, parent, key);
        }
    }
}

export function getByKind(type, kind) {
    return getByFilter(type, v => v.kind === kind);
}

export function getTypeReferences(type) {
    return getByFilter(type, v => v.type === 'reference');
}

export function getCommentTags(type, tag) {
    let result = [];
    walk(type, (value, parent, key) => {
        if (key === 'comment') {
            console.log(value);
            result.push(...value.blockTags.filter(v => v.tag === tag));
        }
    });

    return result;
}

export function getByFilter(type, filter) {
    let result = [];
    if (filter(type)) {
        result.push(type);
    }
    walk(type, (value, parent, key) => {
        if (filter(value, parent, key)) {
            result.push(value);
        }
    });
    return result;
}