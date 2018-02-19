
// **** 目盛の描画 ****
HuTime.Drawing.drawScale =  function(scaleStyle, layer, scalePos, scaleDataset, canvas) {
    if (scaleDataset == null)   // データセットがnullの場合（空配列ではない）は何もしない
        //return;
        scaleDataset = [];

    scalePos.update(layer);         // 目盛位置の更新
    if (scaleStyle.showAxis)     // 目盛軸の表示
        HuTime.Drawing.drawLine(scaleStyle.axisStyle, layer, [scalePos.positionBegin, scalePos.positionEnd], canvas);

    for (var i = 0; i < scaleDataset.length; ++i) {     // データに従って、目盛とラベルを描画
        scaleStyle.applyScaleStyle(scalePos, scaleDataset[i], canvas);
        scaleStyle.applyLabelStyle(scalePos, scaleDataset[i], canvas);
    }
};

// **** 目盛の位置情報 ****
HuTime.ScalePosition = function ScalePosition (positionBegin, positionEnd, valueBegin, valueEnd, layer) {
    if (!(positionBegin instanceof HuTime.PositionBase) || !(positionEnd instanceof HuTime.PositionBase) ||
        !isFinite(valueBegin) || valueBegin == null || !isFinite(valueEnd) || valueEnd == null)
        return;

    this.positionBegin = positionBegin;
    this.positionEnd = positionEnd;
    this.valueBegin = valueBegin;
    this.valueEnd = valueEnd;
    this._dValue = valueEnd - valueBegin;
    this.update(layer);     // layerが指定されていない場合は、update処理内で無視される
};
HuTime.ScalePosition.prototype = {
    constructor: HuTime.ScalePosition,
    layer: null,            // レイヤ

    // 目盛の位置情報等
    positionBegin: null,    // 目盛の始点位置
    positionEnd: null,      // 目盛の終点位置
    _beginX: 0,             // 目盛始点のx座標値
    get beginX() {
        return this._beginX;
    },
    _beginY: 0,             // 目盛始点のy座標値
    get beginY() {
        return this._beginY
    },
    _endX: 0,               // 目盛終点のx座標値
    get endX() {
        return this._endX;
    },
    _endY: 0,               // 目盛終点のy座標値
    get endY() {
        return this._endY;
    },
    _dX: 0,                 // 目盛のy方向の長さ
    get dX() {
        return this._dX;
    },
    _dY: 0,                 // 目盛のx方向の長さ
    get dY() {
        return this._dY;
    },
    _scaleLength: 0,        // 目盛の長さ（px）
    get scaleLength() {
        return this._scaleLength;
    },
    _rotate: 0,             // 目盛の回転角（x軸基準）
    get rotate() {
        return this._rotate;
    },

    // 目盛の値の情報
    valueBegin: 0,  // 目盛の始点の値
    valueEnd: 0,    // 目盛の終点の値
    _dValue: 0,     // 値の幅
    get dValue() {
        return this._dValue;
    },

    // 座標データをレイヤに合わせて更新
    update: function(layer) {
        if (layer instanceof HuTime.Layer)
            this.layer = layer;     // 既存の設定を引数に置き換え
        if (!this.layer)
            return;     // 既存の設定も引数の指定も無い場合
        if (!(this.positionBegin instanceof HuTime.PositionBase) || !(this.positionEnd instanceof HuTime.PositionBase))
            return;     // 位置情報が正しく設定されていない場合
        this._beginX = this.positionBegin.cnvX(this.layer);
        this._beginY = this.positionBegin.cnvY(this.layer);
        this._endX =  this.positionEnd.cnvX(this.layer);
        this._endY =  this.positionEnd.cnvY(this.layer);
        this._dX = this._endX - this._beginX;
        this._dY = this._endY - this._beginY;
        this._scaleLength = Math.sqrt(this._dX * this._dX + this._dY * this._dY);
        this._rotate = Math.atan(this._dY / this._dX) / Math.PI * 180;
    },

    // xy座標を出力（offsetは軸に直交する距離で軸の進む方向に対して左が+）
    cnvXYPosition: function(value, offset, alignOffset) {
        if (!offset)
            offset = 0;
        if (!alignOffset)
            alignOffset = 0;
        return new HuTime.XYPosition(
            (value - this.valueBegin) / this._dValue * this._dX + this._beginX
            + offset / this._scaleLength * this._dY + alignOffset / this._scaleLength * this._dX,
            (value - this.valueBegin) / this._dValue * this._dY + this._beginY
            - offset / this._scaleLength * this._dX + alignOffset / this._scaleLength * this._dY);
    },
    cnvX: function(value, offset, alignOffset) {
        if (!offset)
            offset = 0;
        if (!alignOffset)
            alignOffset = 0;
        return (value - this.valueBegin) / this._dValue * this._dX + this._beginX
            + offset / this._scaleLength * this._dY + alignOffset / this._scaleLength * this._dX;
    },
    cnvY: function(value, offset) {
        if (!offset)
            offset = 0;
        return (value - this.valueBegin) / this._dValue * this._dY + this._beginY
            - offset / this._scaleLength * this._dX;
    },

    _toJSONProperties: {
        positionBegin: "positionBegin",
        positionEnd: "positionEnd",
        valueBegin: "valueBegin",
        valueEnd: "valueEnd"
    },
    _parseJSONProperties: {
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// **** 目盛の書式 ****
// 目盛の書式の基底クラス
HuTime.ScaleStyleBase = function ScaleStyleBase () {
};
HuTime.ScaleStyleBase.prototype = {
    constructor: HuTime.ScaleStyleBase,

    _toJSONProperties: {
    },
    _parseJSONProperties: {
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// 目盛線による目盛の書式
HuTime.TickScaleStyle = function TickScaleStyle () {
    // 軸
    this.defaultAxisStyle = new HuTime.FigureStyle(null, "black", 1);
    this.axisStyle = this.defaultAxisStyle;

    // 目盛線
    this.defaultTickStyle = new HuTime.FigureStyle(null, "black", 1);
    this.tickStyle = this.defaultTickStyle;
    this.tickSize = this.defaultTickSize;
    this.applyScaleStyle = this.defaultApplyScaleStyle;

    // ラベル
    this.defaultLabelStyle = new HuTime.StringStyle(14, "black");
    this.defaultLabelStyle.textBaseline = "top";   // 既定値として、横向きの軸、ラベル位置は軸の下を想定
    this.defaultLabelStyle.textAlign = "center";
    this.labelStyle = this.defaultLabelStyle;
    this.applyLabelStyle = this.defaultApplyLabelStyle;
};
HuTime.TickScaleStyle.prototype = Object.create(HuTime.ScaleStyleBase.prototype, {
    // 基本構造
    constructor: {
        value: HuTime.TickScaleStyle
    },

    // 軸
    axisStyle: {            // 軸の書式
        writable: true,
        value:null
    },
    defaultAxisStyle: {     // 既定の軸の書式
        writable: true,
        value: null
    },
    showAxis: {          // 軸の表示
        writable: true,
        value: true
    },

    // 目盛線
    tickStyle: {            // 目盛線の書式（レベルに応じた配列指定も可能）
        writable: true,
        value: null
    },
    defaultTickStyle: {     // 既定の目盛の書式
        writable: true,
        value: null
    },
    tickSize: {             // 目盛の高さ（px）（レベルに応じた配列指定も可能）
        writable: true,
        value: null
    },
    defaultTickSize: {      // 既定の目盛の高さ
        writable: true,
        value: 10
    },
    tickPosition: {         // 目盛の位置 0:左、1:右、2:中央
        writable: true,
        value: 0
    },
    tickOffset: {           // 目盛位置のオフセット（軸からのオフセット－軸方向の左側が+）（レベルに応じた配列指定も可能）
        writable: true,
        value: 0
    },
    applyScaleStyle: {            // 目盛を表示
        writable: true,
        value: null
    },
    defaultApplyScaleStyle: {
        value: function(scalePos, scaleData, canvas) {      // 既定の目盛を表示
            var scaleSize = this.tickSize instanceof Array ? this.tickSize[scaleData.level] : this.tickSize;
            var style = this.tickStyle instanceof Array ? this.tickStyle[scaleData.level] : this.tickStyle;
            var offset = this.tickOffset instanceof Array ? this.tickOffset[scaleData.level] : this.tickOffset;

            switch (this.tickPosition) {
                case 1:     // 右
                    HuTime.Drawing.drawLine(style, scalePos.layer,
                        [scalePos.cnvXYPosition(scaleData.value, offset),
                            scalePos.cnvXYPosition(scaleData.value, offset - scaleSize)], canvas);
                    break;

                case 2:     // 中央
                    HuTime.Drawing.drawLine(style, scalePos.layer,
                        [scalePos.cnvXYPosition(scaleData.value, offset -scaleSize / 2),
                            scalePos.cnvXYPosition(scaleData.value, offset + scaleSize / 2)], canvas);
                    break;

                case 0:     // 左
                default:    // 既定－左と同じ
                    HuTime.Drawing.drawLine(style, scalePos.layer,
                        [scalePos.cnvXYPosition(scaleData.value, offset),
                            scalePos.cnvXYPosition(scaleData.value, offset + scaleSize)], canvas);
                    break;
            }
        }
    },

    // ラベル
    labelStyle: {           // ラベルの書式（レベルに応じた配列指定も可能）
        writable: true,
        value: null
    },
    defaultLabelStyle: {
        writable: true,
        value: null
    },
    labelOffset: {          // ラベルの位置（基準位置からのオフセット）（レベルに応じた配列指定も可能）
        writable: true,
        value: -3
    },

    ////////
    labelAlignOffset: {
        writable: true,
        value: 0
    },
    ////////

    labelRotate: {          // ラベルの回転（nullなどの場合は、軸の方向）
        writable: true,
        value: null
    },
    labelOnTick: {          // ラベルの位置 true:tickの先が基準、false:軸が基準
        writable: true,
        value: false
    },
    labelLineHeight: {      // ラベルの行の高さ（複数行表示の場合）符号で改行方向を指定（正:軸左方向、負:軸右方向）
        writable: true,
        value: 14
    },
    applyLabelStyle: {      // ラベルの描画
        writable: true,
        value: null
    },
    defaultApplyLabelStyle: {
        value: function(scalePos, scaleData, canvas) {
            var style = this.labelStyle instanceof Array ? this.labelStyle[scaleData.level] : this.labelStyle;
            var offset = this.labelOffset instanceof Array ? this.labelOffset[scaleData.level] : this.labelOffset;
            var alignOffset =
                this.labelAlignOffset instanceof Array ? this.labelAlignOffset[scaleData.level] : this.labelAlignOffset;
            var rotate = isFinite(this.labelRotate) && this.labelRotate != null ? this.labelRotate : scalePos._rotate;

            if (this.labelOnTick) {
                var scaleSize = this.tickSize instanceof Array ? this.tickSize[scaleData.level] : this.tickSize;
                var scaleOffset = this.tickOffset instanceof Array ? this.tickOffset[scaleData.level] : this.tickOffset;
                switch(this.tickPosition) {
                    case 1:     // 右
                        offset += scaleOffset - scaleSize ;
                        break;

                    case 2:     // 中央
                        // 何もしない
                        break;

                    case 0:     // 左
                    default:
                        offset += scaleOffset + scaleSize;
                        break;
                }
            }

            HuTime.Drawing.drawString(style, scalePos.layer,
                scalePos.cnvXYPosition(scaleData.value, offset, alignOffset),
                scaleData.label, rotate, canvas);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.ScaleStyleBase.prototype._toJSONProperties, {
            axisStyle: { value: "axisStyle" },
            showAxis: { value: "showAxis" },
            tickStyle: { value: "tickStyle" },
            tickSize: { value: "tickSize" },
            tickPosition: { value: "tickPosition" },
            tickOffset: { value: "tickOffset" },
            labelStyle: { value: "labelStyle" },
            labelOffset: { value: "labelOffset" },
            labelAlignOffset: { value: "labelAlignOffset" },
            labelRotate: { value: "labelRotate" },
            labelOnTick: { value: "labelOnTick" },
            labelLineHeight: { value: "labelLineHeight" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.ScaleStyleBase.prototype._parseJSONProperties, {
        })
    }
});

// **** 目盛のデータ ****
// 基底の目盛のデータセット
HuTime.ScaleDatasetBase = function ScaleDatasetBase () {
};
HuTime.ScaleDatasetBase.prototype = {
    constructor: HuTime.ScaleDatasetBase,
    getScaleData: function(min, max, scalePos) {
        // 派生先で実装（以下のプロパティを持つオブジェクトの配列を返す）
        // value: 目盛の値
        // level: 目盛のレベル
        // label: 目盛のラベル（無い場合は空文字）
    },

    _toJSONProperties: {
    },
    _parseJSONProperties: {
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// 標準の目盛データ（値をそのまま出力）
HuTime.StandardScaleDataset = function StandardScaleDataset () {
};
HuTime.StandardScaleDataset.prototype = Object.create(HuTime.ScaleDatasetBase.prototype,{
    constructor: {
        value: HuTime.StandardScaleDataset
    },
    minCnvTickInterval: {           // canvas上の目盛の最小間隔（px）（初期値）
        writable: true,
        value:7
    },
    minLabeledLevel: {              // ラベルを付する最小のレベル
        writable: true,
        value: 2
    },
    adjustTickIntervalToLabel: {    // ラベルに合わせて目盛の間隔を調整する
        writable: true,
        value: true
    },
    coefficientOfLabelSize: {       // ラベルに合わせて目盛の間隔を調整する際の係数（ラベルのフォントサイズに合わせて調整）
        writable: true,
        value: 1
    },

    getScaleData: {       // 新たな目盛データを取得する
        value: function (min, max, scalePos) {
            if (min > max) {    // 大小が逆の場合は入れ替える
                var exMinMax = min;
                min = max;
                max = exMinMax;
            }
            var data = [];         // 結果を収容する配列
            var minCnvTickInterval = this.minCnvTickInterval;

            // ラベルの桁数の概算
            if(this.adjustTickIntervalToLabel) {
                var minInt = Math.floor(-Math.abs(min));    // 整数化、"-"の有無で、目盛間隔が変わると見づらいので負数にする
                var maxInt = Math.floor(-Math.abs(max));
                var ticksPerLabel = 5;      // ラベルの頻度（何目盛に１つラベルを置くか？）
                var fixedOrder = Math.floor(Math.log(
                        (max - min) / scalePos._scaleLength * minCnvTickInterval * ticksPerLabel) * Math.LOG10E);
                fixedOrder = fixedOrder >= 0 ? 0 : -fixedOrder;
                var minLabelLength = minInt.toFixed(fixedOrder).length;
                var maxLabelLength = maxInt.toFixed(fixedOrder).length;
                var labelLength = minLabelLength > maxLabelLength ? minLabelLength : maxLabelLength;
                labelLength = this.coefficientOfLabelSize * labelLength;

                if(labelLength > minCnvTickInterval)    // ラベル幅に基づく間隔の方が広い場合
                    minCnvTickInterval = labelLength;   // 桁数に応じて目盛間隔を調整
            }

            var minTickInterval     // 目盛間隔の最小値（canvas上の目盛の最小間隔で詰め込んだ場合）
                = (max - min) / (scalePos._scaleLength / minCnvTickInterval);
            var tickIntervalOrder   // 目盛間隔のオーダー(eg. 2->1, 20->10, 0.2->0.1)
                = Math.pow(10, Math.round(Math.log(minTickInterval) * Math.LOG10E));
            var tickInterval;       // 目盛間隔（指数表示の仮数部分）

            // 目盛の間隔（tickInterval）を決める（1, 2, 5）
            var tickTypeValue = minTickInterval / tickIntervalOrder;
            if (tickTypeValue < 1.0)
                tickInterval = 1;
            else if (tickTypeValue < 2.0)
                tickInterval = 2;
            else
                tickInterval = 5;

            // 以下は、指数表示の仮数部分で処理を行い、出力時点で元に戻す（tickIntervalOrderをかける）
            // 1, 2, 5や剰余の計算など、同じ基準や値で処理を進めるため
            var level;
            var label;
            var scaleStartValue = min / tickIntervalOrder;    // 最初の目盛（指数表示の仮数部分）
            scaleStartValue = Math.ceil(scaleStartValue / tickInterval) * tickInterval;     // 計算値より小さい最初の整数
            var scaleEndValue = max / tickIntervalOrder;      // 目盛の終了値（指数表示の仮数部分）

            for (var x = scaleStartValue; x <= scaleEndValue; x = Math.round(x + tickInterval)) {
                // 1, 2, 5の目盛の間隔別にtickの種類を設定
                if (tickInterval == 1.0) {
                    if (x % 10.0 == 0)
                        level = 2;
                    else if (x % 5.0 == 0)
                        level = 1;
                    else
                        level = 0;
                }
                else if (tickInterval == 2.0) {
                    if (x % 10.0 == 0)
                        level = 2;
                    else
                        level = 0;
                }
                else {
                    if (x % 50.0 == 0)
                        level = 2;
                    else if (x % 10.0 == 0)
                        level = 1;
                    else
                        level = 0;
                }

                // ラベルの設定
                var FixedValue; // 表示桁数
                if (tickIntervalOrder < 1)  // 小数を1.1, 1.11でなく、1.10, 1.11と表示させる
                    FixedValue = Math.abs(Math.round(Math.log(tickIntervalOrder) * Math.LOG10E));
                else
                    FixedValue = 0;

                if (level >= this.minLabeledLevel)
                    label = (x * tickIntervalOrder).toFixed(FixedValue);
                else
                    label = "";

                // データを配列に出力
                data.push({
                    value: x * tickIntervalOrder,
                    level: level,
                    label: label
                });
            }
            return data;
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.ScaleDatasetBase.prototype._toJSONProperties, {
            minCnvTickInterval: { value: "minCnvTickInterval" },
            minLabeledLevel: { value: "minLabeledLevel" },
            adjustTickIntervalToLabel: { value: "adjustTickIntervalToLabel" },
            coefficientOfLabelSize: { value: "coefficientOfLabelSize" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.ScaleDatasetBase.prototype._parseJSONProperties, {
        })
    }
});

// 手動設定によりデータセット
HuTime.ManualScaleDataset = function ManualScaleDataset () {
    this._scaleData = [];
};
HuTime.ManualScaleDataset.prototype = Object.create(HuTime.ScaleDatasetBase.prototype, {
    constructor: {
        value: HuTime.ManualScaleDataset
    },

    _scaleData: {
        writable: true,
        value: null
    },
    scaleData: {
        get: function () {
            return this._scaleData;
        }
    },
    appendScaleData: {
        value: function (value, level, label) {
            this._scaleData.push({
                value: value,
                level: level,
                label: label
            });
        }
    },

    getScaleData: {
        value: function(min, max, scalePos) {
            return this._scaleData;
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.ScaleDatasetBase.prototype._toJSONProperties, {
            _scaleData: { value: "scaleData" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.ScaleDatasetBase.prototype._parseJSONProperties, {
        })
    }
});

// **** 目盛レイヤ ****
HuTime.TickScaleLayer = function TickScaleLayer (vBreadth, vMarginTop, vMarginBottom, scaleStyle, scaleDataset) {
    HuTime.Layer.apply(this, arguments);

    // 目盛の書式
    if (scaleStyle instanceof HuTime.ScaleStyleBase)
        this.scaleStyle = scaleStyle;
    else {
        this.scaleStyle = new HuTime.TickScaleStyle();
        this.scaleStyle.showAxis = false;
        this.scaleStyle.tickStyle = new HuTime.FigureStyle(null, "black", 1);
        this.scaleStyle.tickSize = [10, 15, 20];
        this.scaleStyle.labelStyle = new HuTime.StringStyle(12, "black");
        this.scaleStyle.labelStyle.textBaseline = "bottom";
        this.scaleStyle.labelStyle.textAlign = "center";
        this.scaleStyle.labelOnTick = true;
        this.scaleStyle.labelOffset = 1;
    }

    // 目盛のデータ
    if (scaleDataset instanceof HuTime.ScaleDatasetBase)
        this.scaleDataset = scaleDataset;
    else
        this.scaleDataset = new HuTime.StandardScaleDataset();
};
HuTime.TickScaleLayer.prototype = Object.create(HuTime.Layer.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.TickScaleLayer
    },

    // **** 描画関係 ****
    scaleDataset: {    // 目盛データ
        writable: true,
        value: null
    },
    _scalePosition: {
        writable: true,
        value: null
    },
    scaleStyle: {
        writable: true,
        value: null
    },

    processAfterRedraw: {
        value: function () {
            switch(this.displayMode) {
                case 0:
                    this._scalePosition = new HuTime.ScalePosition(
                        new HuTime.XYPosition(0, this._currentVBreadth),
                        new HuTime.XYPosition(this._currentTLength, this._currentVBreadth),
                        this._minLyrT, this._maxLyrT, this);
                    break;

                case 1:
                    this._scalePosition = new HuTime.ScalePosition(
                        new HuTime.XYPosition(0, this._currentVBreadth),
                        new HuTime.XYPosition(this._currentTLength, this._currentVBreadth),
                        this._maxLyrT, this._minLyrT, this);
                    break;

                case 2:
                    this._scalePosition = new HuTime.ScalePosition(
                        new HuTime.XYPosition(0, 0),
                        new HuTime.XYPosition(0, this._currentTLength),
                        this._minLyrT, this._maxLyrT, this);
                    break;

                case 3:
                    this._scalePosition = new HuTime.ScalePosition(
                        new HuTime.XYPosition(0, 0),
                        new HuTime.XYPosition(0, this._currentTLength),
                        this._maxLyrT, this._minLyrT, this);
                    break;
            }
            this._scalePosition.update(this);

            HuTime.Drawing.drawScale(this.scaleStyle, this, this._scalePosition,
                this.scaleDataset.getScaleData(this._minLyrT, this._maxLyrT, this._scalePosition), this._canvas);
        }
    },

    // **** イベント関係 ****
    _handleInnerEventBubbling: {
        value: function (ev) {    // 内部イベントの処理（自身の描画処理を追加）
            if (!(this._parent instanceof HuTime.SliderPanel)) {   // スライダ用の目盛でない場合は、継承元Layerと同じ処理
                HuTime.Layer.prototype._handleInnerEventBubbling.apply(this, arguments);
                return;
            }

            // 以下、スライダ用の場合
            if (ev.target._parent !== this._parent && (ev.type == "tmove" || ev.type == "tzoom")) {
                this.redraw();  // 自分（スライダ）以外が操作されている場合は、動きに追従して再描画する
            }
        }
    },
    mouseEventCapture: {
        writable: true,
        value: 0    //HuTime.EventCapture.None
    },

    _toJSONProperties: {
        value: Object.create(HuTime.Layer.prototype._toJSONProperties, {
            scaleDataset: { value: "scaleDataset" },
            _scalePosition: { value: "scalePosition" },
            scaleStyle: { value: "scaleStyle" },
            mouseEventCapture: { value: "mouseEventCapture" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.Layer.prototype._parseJSONProperties, {
        })
    }
});
