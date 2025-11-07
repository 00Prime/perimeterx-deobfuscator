var e = 0,
    r = 0,
    a = {};

function t(t) {
    return t && (r += Date.now() - t, e += 1), {
        total: r,
        amount: e
    }
}

export function da(t) {
    var a = arguments['length'] > 1 && void 0 !== arguments[1] ? arguments[1] : 13;
    return t['replace'](/[A-Za-z]/g, function (t) {
        return String['fromCharCode'](t['charCodeAt'](0) + (t['toUpperCase']() <= 'M' ? a : -a));
    });
}

export function i(e) {
    var r = Date.now(),
        i = a[e];
    if (i) u = i;
    else {
        for (var c = atob(e), u = "", l = 0; l < c.length; ++l) {
            var f = "cBjMwp1".charCodeAt(l % 7);
            u += String.fromCharCode(f ^ c.charCodeAt(l));
        }
        a[e] = u;
    }
    return t(r), u;
}

function u(t) {
    //@ts-ignore
    u = 'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator ? function (t) {
        return typeof t;
    } : function (t) {
        return t && 'function' == typeof Symbol && t.constructor === Symbol && t !== Symbol.prototype ? 'symbol' : typeof t;
    };
    return u(t);
}


var j = function () {
    try {
        return window.atob;
    } catch (t) { }
}();
export function U(t) {
    return u(j) === 'function' ? j(t) : function (t) {
        var e, n, r, a, o = [],
            i = 0,
            c = t.length;
        try {
            if (/[^+/=0-9A-Za-z]/.test(t) || /=/.test(t) && (/=[^=]/.test(t) || /={3}/.test(t)))
                return null;
            for (c % 4 > 0 && (c = (t += window.Array(4 - c % 4 + 1).join('=')).length); i < c;) {
                for (n = [], a = i; i < a + 4;)
                    n.push('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.indexOf(t.charAt(i++)));
                for (r = [
                    ((e = (n[0] << 18) + (n[1] << 12) + ((63 & n[2]) << 6) + (63 & n[3])) & 255 << 16) >> 16,
                    64 === n[2] ? -1 : (65280 & e) >> 8,
                    64 === n[3] ? -1 : 255 & e
                ], a = 0; a < 3; ++a)
                    if (r[a] >= 0 || 0 === a) {
                        o.push(String.fromCharCode(r[a]));
                    }
            }
            return o.join('');
        } catch (t) {
            return null;
        }
    }(t);
}