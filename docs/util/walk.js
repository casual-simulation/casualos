
const keysMap = {
    'Property': ['type'],
    'reflection': ['declaration'],
    'Type literal': ['children', 'signatures'],
    'Call signature': ['parameters', 'comment', 'type']
}

export function walk(obj, callback, parent = null) {
    walkSingle(obj, (value, parent, key) => {
        callback(value, parent, key);
        walk(value, callback, value); 
    });
}

export function walkSingle(obj, callback, parent = null) {
    let keys = keysMap[obj.kindString ?? obj.type] || [];
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
    return getByFilter(type, v => v.kindString === kind);
}

export function getTypeReferences(type) {
    return getByFilter(type, v => v.type === 'reference');
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