
// ******** 座標の基底クラス ********
HuTime.PositionBase = function PositionBase () {
};
HuTime.PositionBase.prototype = {
    constructor: HuTime.PositionBase,
    cnvX: function(layer) {
        return 0;
    },
    cnvY: function(layer) {
        return 0;
    },

    // **** JSON出力 ****
    _toJSONProperties: {
    },
    _parseJSONProperties: {
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// ******** t-v座標系での絶対座標 ********
HuTime.TVPosition = function TVPosition (t, v) {
    this.t = t;
    this.v = v;
};
HuTime.TVPosition.prototype = Object.create(HuTime.PositionBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.TVPosition
    },

    _t: {            // t軸 座標
        writable: true,
        value: 0
    },
    t: {
        get: function() {
            return this._t;
        },
        set: function(val) {
            if ((isFinite(val) && val != null) ||
                (val instanceof Function &&
                    (val === HuTime.PositionConstant.tMin || val === HuTime.PositionConstant.tMax)))
                this._t = val;
        }
    },

    _v: {            // v軸 座標
        writable: true,
        value: 0
    },
    v: {
        get: function() {
            return this._v;
        },
        set: function(val) {
            if ((isFinite(val) && val != null) ||
                (val instanceof Function &&
                    (val === HuTime.PositionConstant.vMin || val === HuTime.PositionConstant.vMax)))
                this._v = val;
        }
    },

    // **** 座標の取得 ****
    cnvX: {
        value: function(layer) {    // canvasのx座標
            if (layer._tRotation == 1) {
                var v = this._v instanceof Function ? this._v(layer) : this._v;
                if (layer.vForX == 1)
                    return (layer._vBottom - v) * layer._lyrVResolution;
                else
                    return (v - layer._vTop) * layer._lyrVResolution;
            }
            else {
                var t = this._t instanceof Function ? this._t(layer) : this._t;
                if (layer._tDirection == 1)
                    return (layer._maxLyrT - t) * layer._lyrTResolution;
                else
                    return (t - layer._minLyrT) * layer._lyrTResolution;
            }
        }
    },
    cnvY: {
        value: function(layer) {    // canvasのy座標
            if (layer._tRotation == 1) {
                var t = this._t instanceof Function ? this._t(layer) : this._t;
                if (layer._tDirection == 1)
                    return (layer._maxLyrT - t) * layer._lyrTResolution;
                else
                    return (t - layer._minLyrT) * layer._lyrTResolution;
            }
            else {
                var v = this._v instanceof Function ? this._v(layer) : this._v;
                return (v - layer._vTop) * layer._lyrVResolution;
            }
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._toJSONProperties, {
            _t: { value: "t" },
            _v: { value: "v" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._parseJSONProperties, {
        })
    }
});

// ******** x-y座標系での絶対座標 ********
HuTime.XYPosition = function XYPosition (x, y) {
    this.x = x;
    this.y = y;
};
HuTime.XYPosition.prototype = Object.create(HuTime.PositionBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.XYPosition
    },
    _x: {                // x軸 座標
        writable: true,
        value: null
    },
    x: {
        get: function() {
            return this._x;
        },
        set: function(val) {
            if ((isFinite(val) && val != null) ||
                (val instanceof Function &&
                    (val === HuTime.PositionConstant.xLeft || val === HuTime.PositionConstant.xRight)))
                this._x = val;
        }
    },
    _y: {                // y軸 座標
        writable: true,
        value: null
    },
    y: {
        get: function() {
            return this._y;
        },
        set: function(val) {
            if ((isFinite(val) && val != null) ||
                (val instanceof Function &&
                    (val === HuTime.PositionConstant.yTop || val === HuTime.PositionConstant.yBottom)))
                this._y = val;
        }
    },

    // **** 座標の取得 ****
    cnvX: {             // canvasのx座標
        value: function(layer) {
            return this._x instanceof Function ? this._x(layer) : this._x;
        }
    },
    cnvY: {             // canvasのy座標
        value: function(layer) {
            return this._y instanceof Function ? this._y(layer) : this._y;
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._toJSONProperties, {
            _x: { value: "x" },
            _y: { value: "y" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._parseJSONProperties, {
        })
    }
});

// ******** t-v座標系での相対座標 ********
// t値、v値の進む方向を正とした、基準座標からの相対位置（px単位）
HuTime.RelativeTVPosition = function RelativeTVPosition (position, ofsT, ofsV) {
    this.ofsT = ofsT;
    this.ofsV = ofsV;
    this.position = position;
};
HuTime.RelativeTVPosition.prototype = Object.create(HuTime.PositionBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.RelativeTVPosition
    },

    _position: {
        writable: true,
        value: null
    },
    position: {     // 基準位置
        get: function() {
            return this._position;
        },
        set: function(val) {
            if (val instanceof HuTime.PositionBase)
                this._position = val;
        }
    },
    _ofsT: {         // t軸 オフセット値
        writable: true,
        value:0
    },
    ofsT: {
        get: function() {
            return this._ofsT;
        },
        set: function(val) {
            if (isFinite(val) && val != null)
                this._ofsT = val;
        }
    },
    _ofsV: {         // v軸 オフセット値
        writable: true,
        value: 0
    },
    ofsV: {
        get: function() {
            return this._ofsV;
        },
        set: function(val) {
            if (isFinite(val) && val != null)
                this._ofsV = val;
        }
    },

    // **** 座標の取得 ****
    cnvX: {                     // canvasのx座標
        value: function(layer) {
            if (layer._tRotation == 1) {
                var vDirection =
                    (layer._vBottom - layer._vTop) < 0 ? -1 : 1 * layer.vForX == 1 ? -1 : 1;
                return this._position.cnvX(layer) + vDirection * this._ofsV * layer._lyrVResolution;
            }
            else {
                var a = this._position.cnvX(layer);
                if (layer._tDirection == 1)
                    return this._position.cnvX(layer) - this._ofsT * layer._lyrTResolution;
                else
                    return this._position.cnvX(layer) + this._ofsT * layer._lyrTResolution;
            }
        }
    },
    cnvY: {                     // canvasのy座標
        value: function(layer) {
            if (layer._tRotation == 1) {
                if (layer._tDirection == 1)
                    return this._position.cnvY(layer) - this._ofsT * layer._lyrTResolution;
                else
                    return this._position.cnvY(layer) + this._ofsT * layer._lyrTResolution;
            }
            else {
                var vDirection = (layer._vBottom - layer._vTop) < 0 ? -1 : 1;
                return this._position.cnvY(layer) + vDirection * this._ofsV * layer._lyrVResolution;
            }
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._toJSONProperties, {
            _position: { value: "position" },
            _ofsT: { value: "ofsT" },
            _ofsV: { value: "ofsV" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._parseJSONProperties, {
        })
    }
});

// ******** x-y座標系での相対座標 ********
HuTime.RelativeXYPosition = function RelativeXYPosition (position, ofsX, ofsY) {
    this.ofsX = ofsX;
    this.ofsY = ofsY;
    this.position = position;
};
HuTime.RelativeXYPosition.prototype = Object.create(HuTime.PositionBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.RelativeXYPosition
    },

    _position: {
        writable: true,
        value: null
    },
    position: {     // 基準位置
        get: function() {
            return this._position;
        },
        set: function(val) {
            if (val instanceof HuTime.PositionBase)
                this._position = val;
        }
    },
    _ofsX: {        // x軸 オフセット値（px）
        writable: true,
        value: 0
    },
    ofsX: {
        get: function() {
            return this._ofsX;
        },
        set: function(val) {
            if (isFinite(val) && val != null)
                this._ofsX = val;
        }
    },
    _ofsY: {        // y軸 オフセット値（px）
        writable: true,
        value: 0
    },
    ofsY: {
        get: function() {
            return this._ofsY;
        },
        set: function(val) {
            if (isFinite(val) && val != null)
                this._ofsY = val;
        }
    },

    // **** 座標の取得 ****
    cnvX: {
        value: function(layer) {    // canvasのx座標
            return this._position.cnvX(layer) + this._ofsX;
        }
    },
    cnvY: {
        value: function(layer) {    // canvasのy座標
            return this._position.cnvY(layer) + this._ofsY;
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._toJSONProperties, {
            _position: { value: "position" },
            _ofsX: { value: "ofsX" },
            _ofsY: { value: "ofsY" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._parseJSONProperties, {
        })
    }
});

// ******** 座標の整数化 ********
HuTime.PositionFloor = function PositionFloor (position) {
    this.position = position;
};
HuTime.PositionFloor.prototype = Object.create(HuTime.PositionBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.PositionFloor
    },

    _position: {
        writable: true,
        value: null
    },
    position: {     // 基準位置
        get: function() {
            return this._position;
        },
        set: function(val) {
            if (val instanceof HuTime.PositionBase)
                this._position = val;
        }
    },

    // **** 座標の取得 ****
    cnvX: {
        value: function(layer) {    // canvasのx座標
            return Math.floor(this._position.cnvX(layer));
        }
    },
    cnvY: {
        value: function(layer) {    // canvasのy座標
            return Math.floor(this._position.cnvY(layer));
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._toJSONProperties, {
            _position: { value: "position" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._parseJSONProperties, {
            position: {
                value: function (json) {
                    this.position = HuTime.PositionBase.createFromJSON(json.position);
                }
            }
        })
    }
});

HuTime.PositionCeil = function PositionCeil (position) {
    this.position = position;
};
HuTime.PositionCeil.prototype = Object.create(HuTime.PositionBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.PositionCeil
    },

    _position: {
        writable: true,
        value: null
    },
    position: {     // 基準位置
        get: function() {
            return this._position;
        },
        set: function(val) {
            if (val instanceof HuTime.PositionBase)
                this._position = val;
        }
    },

    // **** 座標の取得 ****
    cnvX: {
        value: function(layer) {    // canvasのx座標
            return Math.ceil(this._position.cnvX(layer));
        }
    },
    cnvY: {
        value: function(layer) {    // canvasのy座標
            return Math.ceil(this._position.cnvY(layer));
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._toJSONProperties, {
            _position: { value: "position" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._parseJSONProperties, {
            position: {
                value: function (json) {
                    this.position = HuTime.PositionBase.createFromJSON(json.position);
                }
            }
        })
    }
});

HuTime.PositionRound = function PositionRound (position) {
    this.position = position;
};
HuTime.PositionRound.prototype = Object.create(HuTime.PositionBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.PositionRound
    },

    _position: {
        writable: true,
        value: null
    },
    position: {     // 基準位置
        get: function() {
            return this._position;
        },
        set: function(val) {
            if (val instanceof HuTime.PositionBase)
                this._position = val;
        }
    },

    // **** 座標の取得 ****
    cnvX: {
        value: function(layer) {    // canvasのx座標
            return Math.round(this._position.cnvX(layer));
        }
    },
    cnvY: {
        value: function(layer) {    // canvasのy座標
            return Math.round(this._position.cnvY(layer));
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._toJSONProperties, {
            _position: { value: "position" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.PositionBase.prototype._parseJSONProperties, {
        })
    }
});

// ******** 座標上の固定位置 ********
HuTime.PositionConstant = {
    // t軸、v軸の最少、最大値
    tMin: function tMin (layer) {     // tの最小値
        return layer._minLyrT;
    },
    tMax: function tMax (layer) {     // tの最大値
        return layer._maxLyrT;
    },
    vMin: function vMin (layer) {     // vの最小値
        return layer._vTop;
    },
    vMax: function vMax (layer) {     // vの最大値
        return layer._vBottom;
    },

    // xy座標の固定値
    xLeft: function xLeft (layer) {      // t軸の向きにかかわらず、左端
        return 0;
    },
    xRight: function xRight (layer) {    // t軸の向きにかかわらず、右端
        return layer._element.width;    // canvas要素なので、style.widthでなく、width属性が使える
    },
    yTop: function yTop (layer) {        // v軸の向きにかかわらず、上端
        return 0;
    },
    yBottom: function yBottom (layer) {  // v軸の向きにかかわらず、下端
        return layer._element.height;   // canvas要素なので、style.heightでなく、height属性が使える
    }
};
