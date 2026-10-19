"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.icon = exports.background = exports.color = exports.media = exports.unique = exports.record = exports.shape = exports.arr = exports.one = exports.bool = exports.num = exports.identity = exports.str = exports.obj = exports.fail = void 0;
const fail = (path) => { throw new Error(`Invalid module ${path}`); };
exports.fail = fail;
const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
exports.obj = obj;
const str = (v, p) => { if (typeof v !== 'string' || v.length > 100000)
    (0, exports.fail)(p); };
exports.str = str;
const identity = (v, p) => { if (typeof v !== 'string' || !v || v.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(v))
    (0, exports.fail)(p); };
exports.identity = identity;
const num = (min = 0, max = 1000000, integer = false) => (v, p) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v)))
    (0, exports.fail)(p); };
exports.num = num;
const bool = (v, p) => { if (typeof v !== 'boolean')
    (0, exports.fail)(p); };
exports.bool = bool;
const one = (values) => (v, p) => { if (typeof v !== 'string' || !values.includes(v))
    (0, exports.fail)(p); };
exports.one = one;
const arr = (item, min = 0, max = 2000) => (v, p) => { if (!Array.isArray(v) || v.length < min || v.length > max)
    (0, exports.fail)(p); v.forEach((x, i) => item(x, `${p}/${i}`)); };
exports.arr = arr;
const shape = (required, optional = {}) => (v, p) => {
    if (!(0, exports.obj)(v))
        (0, exports.fail)(p);
    const o = v;
    for (const key of Object.keys(o)) {
        const check = required[key] ?? optional[key];
        if (!Object.hasOwnProperty.call(required, key) && !Object.hasOwnProperty.call(optional, key))
            (0, exports.fail)(`${p}/${key}`);
        check(o[key], `${p}/${key}`);
    }
    for (const key of Object.keys(required))
        if (!Object.hasOwnProperty.call(o, key))
            (0, exports.fail)(`${p}/${key}`);
};
exports.shape = shape;
const record = (item, keyCheck = exports.identity, max = 2000) => (v, p) => { if (!(0, exports.obj)(v) || Object.keys(v).length > max)
    (0, exports.fail)(p); for (const [key, value] of Object.entries(v)) {
    keyCheck(key, `${p}/key`);
    item(value, `${p}/${key}`);
} };
exports.record = record;
const unique = (items, p) => { if (new Set(items).size !== items.length)
    (0, exports.fail)(p); };
exports.unique = unique;
const media = (v, p) => { (0, exports.str)(v, p); if (v !== '' && !(typeof v === 'string' && (/^asset:[^\s/\\:?#]{1,200}$/.test(v) || /^builtin:(language-snake|final-boss-hero|activation-cards)\/[a-zA-Z0-9_./-]+$/.test(v) && !v.split('/').includes('..'))))
    (0, exports.fail)(p); };
exports.media = media;
const color = (v, p) => { (0, exports.str)(v, p); if (typeof v !== 'string' || !(/^(#[\da-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|hsl)a?\([\d.,%\s+-]+\))$/.test(v)))
    (0, exports.fail)(p); };
exports.color = color;
const background = (v, p) => { try {
    (0, exports.media)(v, p);
    return;
}
catch { } try {
    (0, exports.color)(v, p);
    return;
}
catch { } if (typeof v !== 'string' || !/^(linear|radial)-gradient\([#\da-zA-Z.,%()\s+-]+\)$/.test(v) || /url|expression/i.test(v))
    (0, exports.fail)(p); };
exports.background = background;
const icon = (v, p) => { try {
    (0, exports.media)(v, p);
    return;
}
catch { } if (typeof v !== 'string' || v.length > 40 || /[/:\\.]|url\(/i.test(v))
    (0, exports.fail)(p); };
exports.icon = icon;
