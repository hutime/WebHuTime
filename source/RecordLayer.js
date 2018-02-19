// **** 年表、グラフレイヤの基底クラス ****
// グラフ用を想定した造りにしており、年表はグラフの特殊な形と位置づけ
HuTime.RecordLayerBase = function (recordset, vBreadth, vMarginTop, vMarginBottom, vTop, vBottom) {
    HuTime.Layer.apply(this, [vBreadth, vMarginTop, vMarginBottom, vTop, vBottom]);
    this.recordsets = [];
    Object.defineProperty(this, "recordsets", {writable: false});
    this.vScales = [];
    Object.defineProperty(this, "vScales", {writable: false});
    this.appendVScale();    // 既定のv軸目盛を追加
    this.defaultVScaleLineStyle = new HuTime.FigureStyle(null, "#CCCCCC", 1);
    this.defaultVScaleLineStyle.lineDash = [3, 1];
    this.vScaleLineStyle = this.defaultVScaleLineStyle;

    this._fixedInfoCanvas = document.createElement("canvas");   // 固定canvas（軸などを表示）
    this._fixedInfoCanvas.style.overflow = "hidden";
    this._fixedInfoCanvas.style.position = "absolute";
    this._fixedInfoCanvas.style.background = "none";
    this._fixedInfoCanvas.style.borderStyle = "none";
    this._fixedInfoCanvas.style.zIndex = 3000;
    this._element.appendChild(this._fixedInfoCanvas);

    this._systemCanvas = document.createElement("canvas");      // システム用canvas（ハイライトなどを表示）
    this._systemCanvas.style.overflow = "hidden";
    this._systemCanvas.style.position = "absolute";
    this._systemCanvas.style.background = "none";
    this._systemCanvas.style.borderStyle = "none";
    this._systemCanvas.style.zIndex = 5000;
    this._element.appendChild(this._systemCanvas);

    this._syncInfoCanvas = document.createElement("canvas");    // 同期canvas（ラベルなどを表示）
    this._syncInfoCanvas.style.overflow = "hidden";
    this._syncInfoCanvas.style.position = "absolute";
    this._syncInfoCanvas.style.background = "none";
    this._syncInfoCanvas.style.borderStyle = "none";
    this._syncInfoCanvas.style.zIndex = 6000;
    this._element.appendChild(this._syncInfoCanvas);
};
HuTime.RecordLayerBase.prototype = Object.create(HuTime.Layer.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.RecordLayerBase
    },
    fixedLayer: {   // 固定レイヤ（固定レイヤとしては使わないので、falseで固定）
        value: false
    },

    _vTop: {
        writable: true,
        value: 100
    },
    _vBottom: {
        writable: true,
        value: 0
    },
    vTop: {
        get: function() {
            return this._vTop;
        },
        set: function(val) {
            if (isFinite(val)) {
                this._vTop = val;
                this.vScaleTop = val;

            }
        }
    },
    vBottom: {
        get:function () {
            return this._vBottom;
        },
        set: function (val) {
            if (isFinite(val)) {
                this._vBottom = val;
                this.vScaleBottom = val;
            }
        }
    },
    _vForX: {   // v軸がヨコの時の値の適用（0: vTopが左の値, 1: vBottomが左の値）
        writable: true,
        value: 1    // 既定値を変更
    },

    _syncInfoCanvas: {     // ドラッグ等の動きと同期するcanvas（ラベルなどを表示）
        writable: true,
        value: null
    },
    syncInfoCanvas: {
        get: function() {
            return this._syncInfoCanvas;
        }
    },
    _fixedInfoCanvas: {      // ドラッグ等の動きと同期しない（固定された）canvas（軸などを表示）
        writable: true,
        value: null
    },
    fixedInfoCanvas: {
        get: function() {
            return this._fixedInfoCanvas;
        }
    },
    _systemCanvas: {      // システム関係のcanvas（ハイライトの表示など）
        writable: true,
        value: null
    },
    systemCanvas: {
        get: function() {
            return this._systemCanvas;
        }
    },

    recordsets: {    // レコードセット
        writable: true,
        value: null
    },
    appendRecordset: {      // レコードセットの追加
        value: function (recordset) {
            this.recordsets.push(recordset);
            this._isRecordsSorted = false;           // ソート結果を初期化
        }
    },
    removeRecordset: {      // レコードセットの削除（最初に見つかったレコードセットのみ削除）
        value: function (recordset) {
            for (var i = 0; i < this.recordsets.length; ++i) {
                if (this.recordsets[i] === recordset) {
                    this.recordsets.splice(i, 1);
                    this._isRecordsSorted = false;   // ソート結果を初期化
                    return;
                }
            }
        }
    },
    updateRecordsets: {      // レコードセットを更新（レコードセット内のレコードを操作した時などに使用）
        value: function () {
            this._isRecordsSorted = false;  // ソート済みフラグをfalseにし、次の描画時に再ソート
        }
    },
    loadRecordsets: {
        value: function() {
            for (var i = 0; i < this.recordsets.length; ++i){
                this.recordsets[i].loadRecordset();
            }
            this._isRecordsSorted = false;
        }
    },

    // **** レコードの書式 ****
    allowHighlight: {    // ハイライト表示のOn/Off
        writable: true,
        value: true
    },
    highlightColor: {   // ハイライトの色
        writable: true,
        value: "#FFFF00"    // 黄色
    },
    selectRecord: {     // レコード単位で選択する（ハイライトやクリックの処理）
        writable: true,
        value: false
    },

    // レイヤ単位での可視・不可視の設定（レイヤ単位のfalse（不可視）の設定は、データセット単位の設定に優先）
    showReliableTRange: {   // 確実範囲の表示
        writable: true,
        value: false
    },
    showPossibleTRange: {   // 可能範囲の表示
        writable: true,
        value: false
    },
    showLine: {             // 線（プロット間）の表示
        writable: true,
        value: true
    },
    showPlot: {             // プロットの表示
        writable: true,
        value: true
    },

    // v軸目盛
    showVScale: {           // v軸目盛の表示（レイヤ単位）
        writable: true,
        value: true
    },
    vScales: {             // v軸目盛（の描画情報）の配列
        writable: true,
        value: null
    },
    appendVScale: {
        value: function (side, offset, legend, vBegin, vEnd, style, dataset) {
            var updateStyle = function() {};            // 初期値として空の関数
            var updateDatasetConfig = function() {};    // 初期値として空の関数

            // 値指定が無い場合に既定値を設定
            if (side != 1)
                side = 0;
            if (!isFinite(offset) || offset == null)
                offset = 40;
            if (!isFinite(vBegin) || vBegin == null)
                vBegin = this._vBottom;
            if (!isFinite(vEnd) || vEnd == null)
                vEnd = this._vTop;
            if (!style) {
                style = new HuTime.TickScaleStyle();
                updateStyle = this.defaultUpdateVScaleStyle;
            }
            if (!dataset) {
                dataset = new HuTime.StandardScaleDataset();
                updateDatasetConfig = this.defaultUpdateVScaleDatasetConfig;
            }
            this.vScales.push({
                side: side,         // v軸目盛の位置（0: t値の最小側, 1: t値の最大側）
                offset: offset,     // v軸目盛の位置のオフセット（t値の最大、最小端からの距離（px））
                vBottom: vBegin,    // v軸目盛の下端（ヨコ表示時）または左端（タテ表示時）の値
                vTop: vEnd,         // v軸目盛の上端（ヨコ表示時）または右端（タテ表示時）の値
                style: style,       // v軸目盛の書式
                dataset: dataset,   // v軸目盛のデータセット

                showLegend: true,   // v軸目盛の説明を表示
                legend: legend,     // v軸目盛の説明内容
                legendOffset: 30,   // v軸目盛の説明の位置（軸からのオフセット）

                visible: true,      // v軸目盛の可視・不可視
                layer: this,        // v軸目盛が属するレイヤ
                updateStyle: updateStyle,                   // v軸目盛の書式更新処理
                updateDatasetConfig: updateDatasetConfig    // v軸目盛のデータセット設定更新処理
            });
        }
    },
    removeVScale: {
        value: function(vScale) {
            if (vScale instanceof Function) {       // vScaleを受け取ってboolを返す判定用の関数
                var i = 0;
                while (i < this.vScales.length) {
                    if (vScale(this.vScales[i])) {
                        this.vScales.splice(i, 1);
                        continue;
                    }
                    ++i;
                }
            }
            if (isFinite(vScale) && vScale != null &&       // インデックスを指定
                vScale >= 0 && vScale < this.vScales.length)
                this.vScales.splice(vScale, 1);
        }
    },
    defaultUpdateVScaleStyle: { // 既定のv軸目盛の書式更新処理
        value: function() {         // ここでのthisは_vScalesに配列化された目盛情報のオブジェクト
            this.style.tickSize = [10, 15, 20];
            this.style.labelRotate = 0;
            this.style.labelStyle.fontSize = 12;
            if (this.layer._tDirection == this.side) {  // _tDirection == 0 && side == 0 || _tDirection == 1 && side == 1
                this.style.labelOffset = -3;            // 左、または、上
                this.style.tickPosition = 0;
                this.style.labelStyle.textBaseline = "bottom";
                this.style.labelStyle.textAlign = "right";
            }
            else {                                      // _tDirection == 0 && side == 1 || _tDirection == 1 && side == 0
                this.style.labelOffset = 3;             // 右、または、下
                this.style.tickPosition = 1;
                this.style.labelStyle.textBaseline = "top";
                this.style.labelStyle.textAlign = "left";
            }
            if (this.layer._tRotation == 1) {
                this.style.labelStyle.textAlign = "center";
            }
            else {
                this.style.labelStyle.textBaseline = "middle";
            }
        }
    },
    defaultUpdateVScaleDatasetConfig: {     // v軸目盛のデータセット設定更新処理
        value: function() {     // ここでのthisは_vScalesに配列化された目盛情報のオブジェクト
            this.dataset.minLabeledLevel = 1;
            if (this.layer._tRotation == 1) {
                this.dataset.minCnvTickInterval = 8;
                this.dataset.adjustTickIntervalToLabel = true;
            }
            else {
                this.dataset.minCnvTickInterval = 5;
                this.dataset.adjustTickIntervalToLabel = false;
            }
        }
    },

    // 既定のv軸目盛の設定（v軸目盛が１つしかない場合は、こちらを使う）
    vScaleSide: {   // v軸目盛の位置（既定のv軸目盛）（0: t値の最小側, 1: t値の最大側）
        get: function() {
            if (this.vScales.length > 0)
                return this.vScales[0].side;
        },
        set: function(val) {
            if (this.vScales.length > 0)
                this.vScales[0].side = val;
        }
    },
    vScaleOffset: { // v軸目盛の位置のオフセット（既定のv軸目盛）（t値の最大、最小端からの距離（px））
        get: function() {
            if (this.vScales.length > 0)
                return this.vScales[0].offset;
        },
        set: function(val) {
            if (this.vScales.length > 0)
                this.vScales[0].offset = val;
        }
    },
    vScaleBottom: { // v軸目盛の下端（ヨコ表示時）または左端（タテ表示時）の値（既定のv軸目盛）
        get: function() {
            if (this.vScales.length > 0)
                return this.vScales[0].vBottom;
        },
        set: function(val) {
            if (this.vScales.length > 0)
                this.vScales[0].vBottom = val;
        }
    },
    vScaleTop: {    // v軸目盛の上端（ヨコ表示時）または右端（タテ表示時）の値（既定のv軸目盛）
        get: function() {
            if (this.vScales.length > 0)
                return this.vScales[0].vTop;
        },
        set: function(val) {
            if (this.vScales.length > 0)
                this.vScales[0].vTop = val;
        }
    },
    vScaleStyle: {  // v軸目盛の書式（既定のv軸目盛）
        get: function() {
            if (this.vScales.length > 0)
                return this.vScales[0].style;
        },
        set: function(val) {
            if (this.vScales.length > 0)
                this.vScales[0].style = val;
        }
    },
    vScaleDataset: {    // v軸目盛のデータセット（既定のv軸目盛）
        get: function() {
            if (this.vScales.length > 0)
                return this.vScales[0].dataset;
        },
        set: function(val) {
            if (this.vScales.length > 0)
                this.vScales[0].dataset = val;
        }
    },

    vScaleShowLegend: {  // v軸目盛の説明を表示（既定のv軸目盛）
        get: function() {
            if (this.vScales.length > 0)
                return this.vScales[0].showLegend;
        },
        set: function(val) {
            if (this.vScales.length > 0)
                this.vScales[0].showLegend = val;
        }
    },
    vScaleLegend: {      // v軸目盛の説明内容（既定のv軸目盛）
        get: function() {
            if (this.vScales.length > 0)
                return this.vScales[0].legend;
        },
        set: function(val) {
            if (this.vScales.length > 0)
                this.vScales[0].legend = val;
        }
    },
    vScaleLegendOffset: {    // v軸目盛の説明の位置（軸からのオフセット）（既定のv軸目盛）
        get: function() {
            if (this.vScales.length > 0)
                return this.vScales[0].legendOffset;
        },
        set: function(val) {
            if (this.vScales.length > 0)
                this.vScales[0].legendOffset = val;
        }
    },
    vScaleVisible: {        // v軸目盛の可視・不可視（既定のv軸目盛）
        get: function() {
            if (this.vScales.length > 0)
                return this.vScales[0].visible;
        },
        set: function(val) {
            if (this.vScales.length > 0)
                this.vScales[0].visible = val;
        }
    },
    vScaleUpdateStyle: {        // v軸目盛の書式更新処理（既定のv軸目盛）
        get: function() {
            if (this.vScales.length > 0)
                return this.vScales[0].updateStyle;
        },
        set: function(val) {
            if (this.vScales.length > 0)
                this.vScales[0].updateStyle = val;
        }
    },
    vScaleUpdateDatasetConfig: {    // v軸目盛のデータセット設定更新処理（既定のv軸目盛）
        get: function() {
            if (this.vScales.length > 0)
                return this.vScales[0].updateDatasetConfig;
        },
        set: function(val) {
            if (this.vScales.length > 0)
                this.vScales[0].updateDatasetConfig = val;
        }
    },

    // 図内の目盛線
    showVScaleLine: {       // 目盛線の表示
        writable: true,
        value: true
    },
    vScaleLine: {           // 目盛線に用いる目盛のvScales配列内インデックス
        writable: true,
        value: 0
    },
    vScaleLineStyle: {
        writable: true,
        value: null
    },
    defaultVScaleLineStyle: {
        writable: true,
        value: null
    },

    // **** 描画関係 ****
    _redrawBeforeChild: {
        value: function () {
            if (!this._isRecordsSorted)
                this._sortRecords();

            HuTime.Layer.prototype._redrawBeforeChild.apply(this, arguments);   // 継承元の処理

            // canvasの大きさの更新（親オブジェクトで更新される_canvas以外）
            if (this._tRotation == 1) {
                this._fixedInfoCanvas.style.top = 0;
                this._fixedInfoCanvas.height = this._currentTLength;
                this._fixedInfoCanvas.style.height = this._currentTLength + "px";
                this._fixedInfoCanvas.width = this._currentVBreadth;
                this._fixedInfoCanvas.style.width = this._currentVBreadth + "px";

                this._syncInfoCanvas.style.top = 0;
                this._syncInfoCanvas.height = this._currentTLength;
                this._syncInfoCanvas.style.height = this._currentTLength + "px";
                this._syncInfoCanvas.width = this._currentVBreadth;
                this._syncInfoCanvas.style.width = this._currentVBreadth + "px";

                this._systemCanvas.style.top = 0;
                this._systemCanvas.height = this._currentTLength;
                this._systemCanvas.style.height = this._currentTLength + "px";
                this._systemCanvas.width = this._currentVBreadth;
                this._systemCanvas.style.width = this._currentVBreadth + "px";
            }
            else {
                this._fixedInfoCanvas.style.left = 0;
                this._fixedInfoCanvas.width = this._currentTLength;
                this._fixedInfoCanvas.style.width = this._currentTLength + "px";
                this._fixedInfoCanvas.height = this._currentVBreadth;
                this._fixedInfoCanvas.style.height = this._currentVBreadth + "px";

                this._syncInfoCanvas.style.left = 0;
                this._syncInfoCanvas.width = this._currentTLength;
                this._syncInfoCanvas.style.width = this._currentTLength + "px";
                this._syncInfoCanvas.height = this._currentVBreadth;
                this._syncInfoCanvas.style.height = this._currentVBreadth + "px";

                this._systemCanvas.style.left = 0;
                this._systemCanvas.width = this._currentTLength;
                this._systemCanvas.style.width = this._currentTLength + "px";
                this._systemCanvas.height = this._currentVBreadth;
                this._systemCanvas.style.height = this._currentVBreadth + "px";
            }
            //this._drawRecordset();      // レコードセット描画
        }
    },
    _redrawContent: {
        value: function () {
            HuTime.Layer.prototype._redrawContent.apply(this);
            this._drawRecordset();      // レコードセット描画
        }
    },
    _isRecordsSorted: {     // レコードのソート状態のフラグ（ソート済みの場合にtrue）
        writable: true,
        value: false
    },

    autoAdjustV: {      // v軸をレコードに自動的に合わせる
        writable: true,
        value: true
    },
    adjustV: {      // v軸をレコードに合わせる（積み重ねグラフに対応するため、分けておく）
        value: function() {
            var vMin = Number.POSITIVE_INFINITY;
            var vMax = Number.NEGATIVE_INFINITY;
            var loadend = true;
            for (var i = 0; i < this.recordsets.length; ++i) {  // 最大値、最小値の探索
                if (!this.recordsets[i].visible)
                    continue;
                if (this.recordsets[i]._reader)
                    loadend &= this.recordsets[i]._reader._stream.loadState == "loadend";
                for (var j = 0; j < this.recordsets[i].records.length; ++j) {
                    for (var k = 0; k < this.recordsets[i]._valueItems.length; ++k) {
                        var value = this.recordsets[i].records[j].data[this.recordsets[i]._valueItems[k].name].content;
                        if (!isFinite(value) || value == null)
                            continue;
                        if (value < vMin)
                            vMin = value;
                        if (value > vMax)
                            vMax = value;
                    }
                }
            }
            if (isFinite(vMin) && isFinite(vMax)) {     // 最大値、最小値に基づいたv軸の設定
                var order = Math.pow(10, Math.floor(Math.log(vMax) * Math.LOG10E));
                if (vMax < order) {
                    this.vTop = 0.1 * Math.ceil((vMax / order + 0.05) / 0.1) * order;
                    this.vBottom = 0.1 * Math.floor((vMin / order - 0.05) / 0.1) * order;
                }
                else if (vMax < 2 * order) {
                    this.vTop = 0.2 * Math.ceil((vMax / order + 0.1) / 0.2) * order;
                    this.vBottom = 0.2 * Math.floor((vMin / order - 0.1) / 0.2) * order;
                }
                else {
                    this.vTop = 0.5 * Math.ceil((vMax / order + 0.25) / 0.5) * order;
                    this.vBottom = 0.5 * Math.floor((vMin / order - 0.25) / 0.5) * order;
                }
            }
        }
    },

    _sortRecords: {      // レコードのソート
        value: function() {
            var loadend = true;
            for (var i = 0; i < this.recordsets.length; ++i) {
                if (!this.recordsets[i].visible)
                    continue;

                if (this.recordsets[i]._reader && this.recordsets[i]._reader._stream)
                    loadend &= this.recordsets[i]._reader._stream.loadState == "loadend";

                // レコードのソート
                if (!this.recordsets[i].disableSortRecords) {
                    this.recordsets[i].records.sort(function (record1, record2) {
                        // 代表値がNaNのレコードは末尾
                        if (isNaN(record1.tRange._centralValue)) {
                            if (isNaN(record2.tRange._centralValue))
                                return 0;
                            else
                                return 1
                        }
                        if (isNaN(record2.tRange._centralValue))
                            return -1;

                        // 代表値で比較
                        if (record1.tRange._centralValue < record2.tRange._centralValue)
                            return -1;
                        else if (record1.tRange._centralValue > record2.tRange._centralValue)
                            return 1;
                        else
                            return 0;
                    });
                }

                // 値タグのソート（valueOrdersに従って値タグをソート）
                this.recordsets[i]._valueItems.sort(
                    function (value1, value2) {
                        var order1 = value1.order;
                        var order2 = value2.order;

                        // 順番の指定がない値は末尾
                        if (isNaN(order1)) {
                            if (isNaN(order2))
                                return 0;
                            else
                                return 1
                        }
                        if (isNaN(order2))
                            return -1;

                        // 指定された順番で比較
                        if (order1 < order2)
                            return -1;
                        else if (order1 > order2)
                            return 1;
                        else
                            return 0;
                    }
                );
            }
            if (this.autoAdjustV)
                this.adjustV();     // v軸をレコードに合わせる。
            if (loadend)
                this._isRecordsSorted = true;
        }
    },
    _drawRecordset: {               // レコードセットの描画
        value: function() {
            var i, j;     // レコードセット、レコードのカウンタ
            // 範囲外の判定
            for (i = 0; i < this.recordsets.length; ++i) {
                for (j = 0; j < this.recordsets[i].records.length; ++j) {
                    if (this.recordsets[i].records[j].tRange._pBegin > this._maxLyrT ||
                        (this.recordsets[i].records[j].tRange._pEnd < this._minLyrT)) {
                        this.recordsets[i].records[j]._oLVisible = false;   // 範囲外のレコード
                        continue;
                    }
                    // 範囲内としてフラグをセット
                    this.recordsets[i].records[j]._oLVisible = true;     // oLVisible (onLayerVisibleの略)
                }
            }

            // t値範囲の描画
            if (this.showReliableTRange || this.showPossibleTRange) {
                var drawRange, rangeStyle;      // 描画処理と書式
                for (i = 0; i < this.recordsets.length; ++i) {
                    if (!this.recordsets[i].visible)
                        continue;
                    if (!this.recordsets[i].showReliableTRange && !this.recordsets[i].showPossibleTRange)
                        continue;   // 確実範囲・可能範囲ともレコードセット単位で非表示の場合は次のレコードセットへ

                    if (typeof this.recordsets[i].drawRange == "function" &&    // 範囲描画処理の取得
                        this.recordsets[i].drawRange != this.recordsets[i].__proto__.drawRange)
                        drawRange = this.recordsets[i].drawRange;   // レコードセットごとの処理
                    else
                        drawRange = this.defaultDrawRange;          // 既定の処理
                    for (j = 0; j < this.recordsets[i].records.length; ++j) {
                        if (!this.recordsets[i].records[j]._oLVisible)     // 範囲外のレコード
                            continue;

                        // 描画しないレコード（全可能期間のみや、確実期間の無いレコード）
                        if ((this.recordsets[i].hideTRangeTotalPRangeOnly &&    // 全可能期間のみのレコード
                            //this.recordsets[i].records[j].tRange._isTotalPRangeOnly) ||
                            this.recordsets[i].records[j].tRange.isTotalPRangeOnly) ||
                            (this.recordsets[i].hideTRangeNonRRange &&          // 確実期間の無いレコード
                            //this.recordsets[i].records[j].tRange._isNonRRange) ||
                            this.recordsets[i].records[j].tRange.isNonRRange) ||
                            (this.recordsets[i].hideTRangeNonCentralValue &&       // 期間代表値のないレコード
                            isNaN(this.recordsets[i].records[j].tRange._centralValue)))
                            continue;

                        // レコード内の各値の処理
                        this._drawRecordRange(drawRange,
                            this, this.recordsets[i], this.recordsets[i].records[j]);
                    }
                }
            }

            // 線の描画
            if (this.showLine) {
                var drawLine, lineStyle;    // 描画処理と書式
                for (i = 0; i < this.recordsets.length; ++i) {
                    if (!this.recordsets[i].visible)
                        continue;
                    if (!this.recordsets[i].showRecordset || !this.recordsets[i].showRecordsetLine)
                        continue;   // レコードセット単位で線が非表示の場合は次のレコードセットへ
                    if (this.recordsets[i].records.length < 2)
                        continue;   // レコードが2つ未満の場合は次のレコードセットへ

                    if (typeof this.recordsets[i].drawLine == "function" && // 線描画処理の取得
                        this.recordsets[i].drawLine != this.recordsets[i].__proto__.drawLine)

                            drawLine = this.recordsets[i].drawLine;
                    else
                        drawLine = this.defaultDrawLine;
                    for (j = 1; j < this.recordsets[i].records.length; ++j) {
                        if (!this.recordsets[i].records[j]._oLVisible &&     // 範囲外のレコード
                            !this.recordsets[i].records[j - 1]._oLVisible)   // 線のもう一端も確認
                            continue;

                        if (isNaN(this.recordsets[i].records[j].tRange._centralValue) ||    // 代表値の無いレコード
                            isNaN(this.recordsets[i].records[j - 1].tRange._centralValue))
                            continue;


                        // 線を引かないレコード（自分が条件に当てはまるか、前のレコードが条件に当てはまる場合）
                        if (this.recordsets[i].hideLineNonRRange &&          // 確実期間の無いレコード
                            //(this.recordsets[i].records[j].tRange._isNonRRange ||
                            //this.recordsets[i].records[j - 1].tRange._isNonRRange))
                            (this.recordsets[i].records[j].tRange.isNonRRange ||
                            this.recordsets[i].records[j - 1].tRange.isNonRRange))
                            continue;
                        if (this.recordsets[i].hideLineTotalPRangeOnly &&    // 全可能期間のみのレコード
                            //(this.recordsets[i].records[j].tRange._isTotalPRangeOnly ||
                            //this.recordsets[i].records[j - 1].tRange._isTotalPRangeOnly))
                            (this.recordsets[i].records[j].tRange.isTotalPRangeOnly ||
                            this.recordsets[i].records[j - 1].tRange.isTotalPRangeOnly))
                            continue;

                        // 描画処理
                        this._drawRecordLine(drawLine, this, this.recordsets[i],
                            this.recordsets[i].records[j], this.recordsets[i].records[j - 1]);
                    }
                }
            }

            // プロットの描画
            if (this.showPlot) {
                var drawPlot, plotStyle;        // 描画処理と書式
                for (i = 0; i < this.recordsets.length; ++i) {
                    if (!this.recordsets[i].visible)
                        continue;
                    // プロットがレコードセット単位で非表示の場合は次のレコードセットへ
                    if (!this.recordsets[i].showRecordset || !this.recordsets[i].showRecordsetPlot)
                        continue;

                    if (typeof this.recordsets[i].drawPlot == "function" && // プロット描画処理の取得
                        this.recordsets[i].drawPlot != this.recordsets[i].__proto__.drawPlot)
                        drawPlot = this.recordsets[i].drawPlot;
                    else
                        drawPlot = this.defaultDrawPlot;
                    for (j = 0; j < this.recordsets[i].records.length; ++j) {
                        if (!this.recordsets[i].records[j]._oLVisible)     // 範囲外のレコード
                            continue;
                        if (isNaN(this.recordsets[i].records[j].tRange._centralValue))   // 代表値の無いレコード
                            continue;

                        // 非表示指定のレコード（レコードセット単位の指定）
                        if ((this.recordsets[i].hidePlotTotalPRangeOnly &&      // 全可能期間のみのレコード
                            //this.recordsets[i].records[j].tRange._isTotalPRangeOnly) ||
                            this.recordsets[i].records[j].tRange.isTotalPRangeOnly) ||
                            (this.recordsets[i].hidePlotNonRRange &&            // 確実期間の無いレコード
                            //this.recordsets[i].records[j].tRange._isNonRRange))
                            this.recordsets[i].records[j].tRange.isNonRRange))
                            continue;

                        // レコードの描画処理
                        this._drawRecordPlot(drawPlot,
                            this, this.recordsets[i], this.recordsets[i].records[j]);
                    }
                }
            }

            // v軸目盛の描画
            if (this.showVScale) {
                var vScalePosition;     // 目盛位置のオブジェクト
                var axisT, offsetT;     // 目盛位置のt値とpx単位のオフセット量
                var scaleDataset;       // 目盛のデータセット
                for (i = 0; i < this.vScales.length; ++i) {
                    if (!this.vScales[i].visible)
                        continue;

                    // 書式とデータセット設定の更新
                    if (this.vScales[i].updateStyle instanceof Function)
                        this.vScales[i].updateStyle();
                    if (this.vScales[i].updateDatasetConfig instanceof Function)
                        this.vScales[i].updateDatasetConfig();

                    // 位置オブジェクト生成
                    if (this.vScales[i].side == 1) {
                        axisT = HuTime.PositionConstant.tMax;
                        offsetT = -this.vScales[i].offset;
                    }
                    else {
                        axisT = HuTime.PositionConstant.tMin;
                        offsetT = this.vScales[i].offset;
                    }
                    // _lyrTResolutionを使って、t軸の方向にpx単位での相対値を得る
                    vScalePosition = new HuTime.ScalePosition(
                        new HuTime.RelativeTVPosition(
                            new HuTime.TVPosition(axisT, this._vTop), offsetT / this._lyrTResolution, 0),
                        new HuTime.RelativeTVPosition(
                            new HuTime.TVPosition(axisT, this._vBottom), offsetT / this._lyrTResolution, 0),
                        this.vScales[i].vTop, this.vScales[i].vBottom, this);

                    scaleDataset = this.vScales[i].dataset.getScaleData(
                        this.vScales[i].vBottom, this.vScales[i].vTop, vScalePosition);

                    // 図内の目盛り線描画
                    if (this.showVScaleLine && this.vScaleLine == i) {
                        for (j = 0; j < scaleDataset.length; ++j) {
                            if (scaleDataset[j].label != null && scaleDataset[j].label != "") {
                                if (this._tRotation == 1) {
                                    HuTime.Drawing.drawLine(this.vScaleLineStyle, this,
                                        [new HuTime.XYPosition(
                                            vScalePosition.cnvX(scaleDataset[j].value), 0),
                                         new HuTime.XYPosition(
                                            vScalePosition.cnvX(scaleDataset[j].value), this._currentTLength)],
                                        this._fixedInfoCanvas);
                                }
                                else {
                                    HuTime.Drawing.drawLine(this.vScaleLineStyle, this,
                                        [new HuTime.XYPosition(
                                            0, vScalePosition.cnvY(scaleDataset[j].value)),
                                         new HuTime.XYPosition(
                                            this._currentTLength, vScalePosition.cnvY(scaleDataset[j].value))],
                                        this._fixedInfoCanvas);
                                }
                            }
                        }
                    }

                    // 目盛描画
                    HuTime.Drawing.drawScale(this.vScales[i].style, this, vScalePosition,
                        scaleDataset, this._fixedInfoCanvas);

                    // 目盛の説明描画
                    if (this.vScales[i].showLegend && this.vScales[i].legend) {
                        var scaleLabelStyle = new HuTime.StringStyle(12, "black");
                        scaleLabelStyle.textAlign = "center";
                        scaleLabelStyle.textBaseline = "middle";
                        var legendOffset =
                            this.vScales[i].side == 1 ? this.vScales[i].legendOffset : -this.vScales[i].legendOffset;
                        // _lyrTResolutionを使って、t軸の方向にpx単位での相対値を得る
                        HuTime.Drawing.drawString(scaleLabelStyle, this,
                            new HuTime.RelativeTVPosition(
                                new HuTime.TVPosition(axisT, (this._vTop + this._vBottom) / 2),
                                (offsetT + legendOffset) / this._lyrTResolution, 0),
                            this.vScales[i].legend, this._tRotation == 1 ? 0 : -90, this._fixedInfoCanvas);
                    }
                }
            }
        }
    },

    // **** レコード単位での描画（レコード内の列間の関係（積み重ねグラフなど）に対応するため分離） ****
    _drawRecordRange: {      // レコード単位のt範囲描画
        value: function (drawRange, layer, recordset, record, canvas) {
            for (var i = 0; i <  recordset._valueItems.length; ++i) {
                var itemName = recordset._valueItems[i].name;
                if (!(itemName in record.data))   // レコード内に該当列が無い場合
                    continue;
                if (!recordset._appliedShowReliableTRange(itemName, record) &&
                    !recordset._appliedShowPossibleTRange(itemName, record))
                    continue;

                var rangeStyle = recordset._appliedItemRangeStyle(itemName, record);
                drawRange(record.tRange, record.data[itemName].content, rangeStyle,
                    this, recordset, record, itemName, canvas);
            }
        }
    },
    _drawRecordLine: {      // レコード単位の線（プロット間の）描画
        value: function(drawLine, layer, recordset, record, prevRecord, canvas) {
            if (isNaN(record.tRange._centralValue) || isNaN(prevRecord.tRange._centralValue))
                return;   // レコード内にt値の代表値が無い場合（不連続）
            for (var i = 0; i <  recordset._valueItems.length; ++i) {
                var itemName = recordset._valueItems[i].name;
                if (!(itemName in record.data) || !(itemName in prevRecord.data))
                    continue;   // レコード内に該当列が無い場合（不連続）
                if (!recordset._appliedItemShowLine(itemName, record, prevRecord))
                    continue;

                var lineStyle = recordset._appliedItemLineStyle(itemName, record, prevRecord);
                drawLine(record.tRange._centralValue, record.data[itemName].content,
                    prevRecord.tRange._centralValue, prevRecord.data[itemName].content, lineStyle,
                    this, recordset, record, prevRecord, itemName, canvas);
            }
        }
    },
    _drawRecordPlot: {      // レコード単位のプロット描画
        value: function(drawPlot, layer, recordset, record, canvas) {
            for (var i = 0; i <  recordset._valueItems.length; ++i) {
                var itemName = recordset._valueItems[i].name;
                if (!(itemName in record.data))   // レコード内に該当列が無い場合
                    continue;
                if (!recordset._appliedItemShowPlot(itemName, record))
                    continue;

                var plotStyle = recordset._appliedItemPlotStyle(itemName, record);
                drawPlot(record.tRange._centralValue, record.data[itemName].content, plotStyle,
                    this, recordset, record, itemName, canvas);
            }
        }
    },

    // **** 各値の描画（t値、v値に基づいて描画する） ****
    defaultDrawRange: {     // 範囲の描画
        value: function(tRange, v, style, layer, recordset, record, itemName, canvas) {
            if (!(style instanceof HuTime.FigureStyle))
                style = new HuTime.FigureStyle(null, "black", 2);
            if (style.lineWidth <= 0)
                style.lineWidth = 2;
            var tickHeight = recordset.rangeTickHeight / 2;
            var begin, end;     // 描画の始点、終点のt値
            var bPos, ePos;

            // 可能範囲を確実範囲として描画する場合
            if (recordset.drawPRangeAsRRange && recordset._appliedItemShowPossibleTRange(itemName, record)) {
                style.lineDash = [];        // 実線を指定（点線を解除）
                //begin =     // 無限大は表示範囲に合わせて表示
                //    tRange._pRangeBegin == Number.NEGATIVE_INFINITY ? layer._minLyrT : tRange._pRangeBegin;
                //end =
                //    tRange._pRangeEnd == Number.POSITIVE_INFINITY ? layer._maxLyrT : tRange._pRangeEnd;
                begin =     // 無限大は表示範囲に合わせて表示
                    tRange._pBegin == Number.NEGATIVE_INFINITY ? layer._minLyrT : tRange._pBegin;
                end =
                    tRange._pEnd == Number.POSITIVE_INFINITY ? layer._maxLyrT : tRange._pEnd;
                bPos = new HuTime.TVPosition(begin, v);      // 始点のPositionオブジェクト
                ePos = new HuTime.TVPosition(end, v);        // 終点のPositionオブジェクト

                HuTime.Drawing.drawLine(style, layer, [bPos, ePos], canvas);     // 範囲本体
                HuTime.Drawing.drawLine(style, layer,                            // 始点のtick（区切り線）
                    [new HuTime.RelativeXYPosition(bPos, 0, -tickHeight),
                        new HuTime.RelativeXYPosition(bPos, 0, tickHeight)], canvas);
                HuTime.Drawing.drawLine(style, layer,                            // 終点のtick（区切り線）
                    [new HuTime.RelativeXYPosition(ePos, 0, -tickHeight),
                        new HuTime.RelativeXYPosition(ePos, 0, tickHeight)], canvas);
                return;
            }

            // 確実期間の表示
            if (layer.showReliableTRange && recordset._appliedItemShowReliableTRange(itemName, record)) {
                //if (!tRange._isNonRRange) {     // 確実期間がある場合は、実線で表示
                if (!tRange.isNonRRange) {     // 確実期間がある場合は、実線で表示
                    style.lineDash = [];        // 実線を指定（点線を解除）
                    //begin =     // 無限大は表示範囲に合わせて表示
                    //    tRange._rRangeBegin == Number.NEGATIVE_INFINITY ? layer._minLyrT : tRange._rRangeBegin;
                    //end =
                    //    tRange._rRangeEnd == Number.POSITIVE_INFINITY ? layer._maxLyrT : tRange._rRangeEnd;
                    begin =     // 無限大は表示範囲に合わせて表示
                        tRange._rBegin == Number.NEGATIVE_INFINITY ? layer._minLyrT : tRange._rBegin;
                    end =
                        tRange._rEnd == Number.POSITIVE_INFINITY ? layer._maxLyrT : tRange._rEnd;
                    bPos = new HuTime.TVPosition(begin, v);      // 始点のPositionオブジェクト
                    ePos = new HuTime.TVPosition(end, v);        // 終点のPositionオブジェクト

                    HuTime.Drawing.drawLine(style, layer, [bPos, ePos], canvas);     // 範囲本体
                    HuTime.Drawing.drawLine(style, layer,                            // 始点のtick（区切り線）
                        [new HuTime.RelativeXYPosition(bPos, 0, -tickHeight),
                            new HuTime.RelativeXYPosition(bPos, 0, tickHeight)], canvas);
                    HuTime.Drawing.drawLine(style, layer,                            // 終点のtick（区切り線）
                        [new HuTime.RelativeXYPosition(ePos, 0, -tickHeight),
                            new HuTime.RelativeXYPosition(ePos, 0, tickHeight)], canvas);
                }
            }

            // 可能期間の表示
            if (layer.showPossibleTRange && recordset._appliedItemShowPossibleTRange(itemName, record)) {
                //if (!isNaN(tRange._pRangeDuration) && (    // 全可能範囲の描画
                //    (isNaN(tRange._rRangeDuration) &&                                 // 全可能期間のみの場合
                //    isNaN(tRange._antePRangeDuration) && isNaN(tRange._postPRangeDuration)) ||
                //    ((!layer.showReliableTRange || !recordset._appliedItemShowReliableTRange(itemName, record)) &&
                //    !isNaN(tRange._rRangeDuration))         // 確実期間が非表示の場合、全体を可能期間として描画
                //)) {
                if (!isNaN(tRange._pEnd) && !isNaN(tRange._pBegin) && ( // 全可能範囲の描画
                    (isNaN(tRange._rEnd) || isNaN(tRange._rBegin)) ||  // 全可能期間のみの場合
                    ((!layer.showReliableTRange || !recordset._appliedItemShowReliableTRange(itemName, record)) &&
                    (!isNaN(tRange._rEnd) && !isNaN(tRange._rBegin)))   // 確実期間が非表示の場合、全体を可能期間として描画
                )) {
                    //begin = tRange._pRangeBegin == Number.NEGATIVE_INFINITY ? layer._minLyrT : tRange._pRangeBegin;
                    //end = tRange._pRangeEnd == Number.POSITIVE_INFINITY ? layer._maxLyrT : tRange._pRangeEnd;
                    begin = tRange._pBegin == Number.NEGATIVE_INFINITY ? layer._minLyrT : tRange._pBegin;
                    end = tRange._pEnd == Number.POSITIVE_INFINITY ? layer._maxLyrT : tRange._pEnd;
                    var center = (begin + end) / 2;     // 分けて描画するための中間点

                    // 始点・終点が破線の隙間に入らないようにするために、２つに分けて描画
                    style.lineDash = [5, 3];   // 破線の設定
                    HuTime.Drawing.drawLine(style, layer,
                        [new HuTime.TVPosition(begin, v), new HuTime.TVPosition(center, v)], canvas);
                    HuTime.Drawing.drawLine(style, layer,
                        [new HuTime.TVPosition(end, v), new HuTime.TVPosition(center, v)], canvas);
                    style.lineDash = [];        // 破線を元に戻す
                }
                else {      // 前後の可能範囲を分けて表示する場合
                    style.lineDash = [5, 3];
                    //if (!isNaN(tRange._antePRangeDuration)) {   // 前期可能範囲
                    if (!isNaN(tRange._rBegin) && !isNaN(tRange._pBegin)) {   // 前期可能範囲
                        //begin = tRange._antePRangeBegin == Number.NEGATIVE_INFINITY ?
                        //    layer._minLyrT : tRange._antePRangeBegin;
                        //end = tRange._antePRangeEnd == Number.POSITIVE_INFINITY ?
                        //    layer._maxLyrT : tRange._antePRangeEnd;
                        begin = tRange._pBegin == Number.NEGATIVE_INFINITY ?
                            layer._minLyrT : tRange._pBegin;
                        end = tRange._rBegin == Number.POSITIVE_INFINITY ?
                            layer._maxLyrT : tRange._rBegin;

                        HuTime.Drawing.drawLine(style, layer,
                            [new HuTime.TVPosition(begin, v), new HuTime.TVPosition(end, v)], canvas);
                    }
                    if (!isNaN(tRange._pEnd) || !isNaN(tRange._rEnd)) {   // 後期可能範囲
                        //begin = tRange._postPRangeBegin == Number.NEGATIVE_INFINITY ?
                        //    layer._minLyrT : tRange._postPRangeBegin;
                        //end = tRange._postPRangeEnd == Number.POSITIVE_INFINITY ?
                        //    layer._maxLyrT : tRange._postPRangeEnd;
                        begin = tRange._rEnd == Number.NEGATIVE_INFINITY ?
                            layer._minLyrT : tRange._rEnd;
                        end = tRange._pEnd == Number.POSITIVE_INFINITY ?
                            layer._maxLyrT : tRange._pEnd;

                        HuTime.Drawing.drawLine(style, layer,
                            [new HuTime.TVPosition(end, v), new HuTime.TVPosition(begin, v)], canvas);
                    }
                    style.lineDash = [];
                }
            }
        }
    },
    defaultDrawPlot: {      // プロット（代表値）の描画
        value: function(t, v, style, layer, recordset, record, itemName, canvas) {
            // 基底クラスでは宣言のみ（派生先で内容を記述）
        }
    },
    defaultDrawLine: {      // 線の描画
        value: function(t, v, tPrev, vPrev, style, layer, recordset, record, recordPrev, itemName, canvas) {
            // 基底クラスでは宣言のみ（派生先で内容を記述）
        }
    },

    // **** イベント関係 ****
    _handleMouseEventBubbling: {
        value: function(ev, eventX, eventY) {
            // t値v値の取得（当たり判定をTV値でするため）
            var eventT, eventV;
            var clickedRecords;
            var newEv;
            if (this._tRotation == 1) {
                eventT = this.getTFromXY(eventY);
                eventV = this.getVFromXY(eventX - this._currentVXYOrigin);
            }
            else {
                eventT = this.getTFromXY(eventX);
                eventV = this.getVFromXY(eventY - this._currentVXYOrigin);
            }

            if (this.allowHighlight && (ev._type == "mousemove")) {
                this._systemCanvas.getContext('2d').clearRect(      // systemCanvasの内容消去
                    0, 0, this._systemCanvas.width, this._systemCanvas.height);

                if (this._parent._parent._isDragging)   // 属するPanelCollectionを見る
                    return;     // ドラッグ中はハイライトの消去のみ

                this._drawHighlight(eventT, eventV);    // マウスのある位置のレコードをハイライト
            }

            else if (ev._type == "mouseout") {
                this._systemCanvas.getContext('2d').clearRect(        // systemCanvasの内容消去
                    0, 0, this._systemCanvas.width, this._systemCanvas.height);
            }

            else if (ev._type == "click") {
                clickedRecords = this._getClickedRecords(eventT, eventV);  // クリックされたレコードを収集

                // イベント発火
                if (clickedRecords.length > 0) {
                    //newEv = new HuTime.Event("plotclick", this);
                    newEv = HuTime.MouseEvent.createFromDomEv(ev, "plotclick", this);
                    newEv.records = clickedRecords;
                    this._hutimeRoot._handleEvent(newEv);
                }
            }

            else if (ev._type == "dblclick") {
                clickedRecords = this._getClickedRecords(eventT, eventV);  // ダブルクリックされたレコードを収集

                // イベント発火
                if (clickedRecords.length > 0) {
                    newEv = new HuTime.Event("plotdblclick", this);
                    newEv.records = clickedRecords;
                    this._hutimeRoot._handleEvent(newEv);
                }
            }
        }
    },
    _isInPlot: {        // マウスカーソルの当たり判定（t値の代表値が無い－無限大を含む全可能期間のみなど－はヒットしない）
        value: function(record, itemName, eventT, eventV) {
            if (isNaN(record.tRange._centralValue))
                return;
            return (eventT <= record.tRange._centralValue + 5 / this._lyrTResolution &&  // 描画中心から5pxの正方形が有効
            eventT >= record.tRange._centralValue - 5 / this._lyrTResolution &&
            eventV <= record.data[itemName].content + 5 / Math.abs(this._lyrVResolution) &&
            eventV >= record.data[itemName].content - 5 / Math.abs(this._lyrVResolution));
        }
    },
    _drawHighlight: {       // ハイライト表示の処理
        value: function(eventT, eventV) {   // マウスのある位置のレコードをハイライト
            var drawPlot, plotStyle;
            var itemName, valueTagForAll;  // 探索用の値名、レコード単位で選択された場合に全値を処理するための値名
            var originalLineColor, originalFillColor;   // ハイライト色を設定するための元の色の退避先
            for (var i = 0; i < this.recordsets.length; ++i) {
                if (!this.recordsets[i].visible)
                    continue;
                if (typeof this.recordsets[i].drawPlot == "function" && // プロット描画処理の取得
                    this.recordsets[i].drawPlot != this.recordsets[i].__proto__.drawPlot)
                    drawPlot = this.recordsets[i].drawPlot;
                else
                    drawPlot = this.defaultDrawPlot;
                for (var j = 0; j < this.recordsets[i].records.length; ++j) {
                    if (!this.recordsets[i].records[j]._oLVisible)
                        continue;   // 範囲外の場合は、次のレコードへ
                    for (var k = 0; k <  this.recordsets[i]._valueItems.length; ++k) {
                        itemName = this.recordsets[i]._valueItems[k].name;
                        if (!(itemName in this.recordsets[i].records[j].data))
                            continue;

                        // ヒットした場合の処理
                        if (this._isInPlot(this.recordsets[i].records[j], itemName, eventT, eventV)) {
                            if (this.recordsets[i].selectRecord || this.selectRecord) {     // レコード単位での選択
                                for (var m = 0; m < this.recordsets[i]._valueItems.length; ++m) {
                                    valueTagForAll = this.recordsets[i]._valueItems[m].name;
                                    if (!(valueTagForAll in this.recordsets[i].records[j].data))
                                        continue;
                                    plotStyle = this.recordsets[i]._appliedItemPlotStyle(
                                        valueTagForAll, this.recordsets[i].records[j]);
                                    originalLineColor = plotStyle.lineColor;
                                    originalFillColor = plotStyle.fillColor;
                                    plotStyle.lineColor = this.highlightColor;
                                    plotStyle.fillColor = this.highlightColor;
                                    drawPlot(this.recordsets[i].records[j].tRange._centralValue,
                                        this.recordsets[i].records[j].data[valueTagForAll].content, plotStyle,
                                        this, this.recordsets[i], this.recordsets[i].records[j], valueTagForAll,
                                        this._systemCanvas);
                                    plotStyle.lineColor = originalLineColor;
                                    plotStyle.fillColor = originalFillColor;
                                }
                                break;  // ヒットした列（値）を探すループから抜ける
                            }
                            else {          // 列（値）単位での選択
                                plotStyle = this.recordsets[i]._appliedItemPlotStyle(itemName, this.recordsets[i].records[j]);
                                originalLineColor = plotStyle.lineColor;
                                originalFillColor = plotStyle.fillColor;
                                plotStyle.lineColor = this.highlightColor;
                                plotStyle.fillColor = this.highlightColor;
                                drawPlot(this.recordsets[i].records[j].tRange._centralValue,
                                    this.recordsets[i].records[j].data[itemName].content, plotStyle,
                                    this, this.recordsets[i], this.recordsets[i].records[j], itemName,
                                    this._systemCanvas);
                                plotStyle.lineColor = originalLineColor;
                                plotStyle.fillColor = originalFillColor;
                            }
                        }
                    }
                }
            }
        }
    },
    _getClickedRecords: {       // クリックされたレコードを収集
        value: function (eventT, eventV) {
            var clickedRecords = [];
            var itemName, valueTagForAll;
            for (var i = 0; i < this.recordsets.length; ++i) {
                if (!this.recordsets[i].visible)
                    continue;
                for (var j = 0; j < this.recordsets[i].records.length; ++j) {
                    if (!this.recordsets[i].records[j]._oLVisible)
                        continue;   // 範囲外の場合は、次のレコードへ
                    for (var k = 0; k <  this.recordsets[i]._valueItems.length; ++k) {
                        itemName = this.recordsets[i]._valueItems[k].name;
                        if (!(itemName in this.recordsets[i].records[j].data))
                            continue;

                        // ヒットした場合の処理
                        if (this._isInPlot(this.recordsets[i].records[j], itemName, eventT, eventV)) {
                            if (this.recordsets[i].selectRecord || this.selectRecord) {     // レコード単位での選択
                                for (var m = 0; m < this.recordsets[i]._valueItems.length; ++m) {
                                    valueTagForAll = this.recordsets[i]._valueItems[m].name;
                                    if (!(valueTagForAll in this.recordsets[i].records[j].data))
                                        continue;
                                    clickedRecords.push({   // レコードと値タグをセットにしたオブジェクトを追加
                                        record: this.recordsets[i].records[j],
                                        itemName: valueTagForAll
                                    });
                                }
                                break;  // ヒットした列（値）を探すループから抜ける
                            }
                            else {          // 列（値）単位での選択
                                clickedRecords.push({   // レコードと値タグをセットにしたオブジェクトを追加
                                    record: this.recordsets[i].records[j],
                                    itemName: itemName
                                });
                            }
                        }
                    }
                }
            }
            return clickedRecords;
        }
    },
    mouseEventCapture: {    // マウスイベントをキャプチャする範囲（0:なし, 1:子を除く, 2:子のみ, 3:全て）
        writable: true,
        value: 3    // 既定値：全て（レコード表示をOLObjectにしないので、Layer全体のイベントを取得する必要がある）
    },

    _handleInnerEventBubbling: {
        value: function (ev) {    // 内部イベントの処理（親オブジェクトからの継承処理はなし）
            if (ev.type == "tmove") {
                HuTime.Layer.prototype._handleInnerEventBubbling.apply(this, arguments);
                switch (this.displayMode) {
                    case 0:
                        this._syncInfoCanvas.style.left = ((this._minLyrT - this._parent.minPnlT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._syncInfoCanvas.style.width = ((this._maxLyrT - this._minLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";

                        this._systemCanvas.style.left = ((this._minLyrT - this._parent.minPnlT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._systemCanvas.style.width = ((this._maxLyrT - this._minLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        break;

                    case 1:
                        this._syncInfoCanvas.style.left = ((this._parent.maxPnlT - this._maxLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._syncInfoCanvas.style.width = ((this._maxLyrT - this._minLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._systemCanvas.style.left = ((this._parent.maxPnlT - this._maxLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._systemCanvas.style.width = ((this._maxLyrT - this._minLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        break;

                    case 2:
                        this._syncInfoCanvas.style.top = ((this._minLyrT - this._parent.minPnlT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._syncInfoCanvas.style.height = ((this._maxLyrT - this._minLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._systemCanvas.style.top = ((this._minLyrT - this._parent.minPnlT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._systemCanvas.style.height = ((this._maxLyrT - this._minLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        break;

                    case 3:
                        this._syncInfoCanvas.style.top = ((this._parent.maxPnlT - this._maxLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._syncInfoCanvas.style.height = ((this._maxLyrT - this._minLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._systemCanvas.style.top = ((this._parent.maxPnlT - this._maxLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._systemCanvas.style.height = ((this._maxLyrT - this._minLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        break;
                }
                return;
            }
            if (ev.type == "tmovestop") {   // tmoveendでは全体が再描画されるので、Layerではtmovestopのみ対応
                this.redraw();
            }
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.Layer.prototype._toJSONProperties, {
            _vTop: { value: "vTop" },
            _vBottom: { value: "vBottom" },
            _vForX: { value: "vForX" },

            recordsets: { value: "recordsets" },

            allowHighlight: { value: "allowHighlight" },
            highlightColor: { value: "highlightColor" },
            selectRecord: { value: "selectRecord" },

            showReliableTRange: { value: "showReliableTRange" },
            showPossibleTRange: { value: "showPossibleTRange" },
            showLine: { value: "showLine" },
            showPlot: { value: "showPlot" },

            showVScale: { value: "showVScale" },
            vScales: {
                value: function (objForJSON) {
                    objForJSON.vScales = [];
                    for (var i = 0; i < this.vScales.length; ++i) {
                        objForJSON.vScales.push({});
                        for (var prop in this.vScales[i]) {
                            switch (prop) {     // 出力しない項目
                                case "layer":
                                    continue;

                                case "updateStyle":
                                    if (this.vScales[i][prop] ==
                                        HuTime.RecordLayerBase.prototype.defaultUpdateVScaleStyle)
                                        continue;
                                    break;

                                case "updateDatasetConfig":
                                    if (this.vScales[i][prop] ==
                                        HuTime.RecordLayerBase.prototype.defaultUpdateVScaleDatasetConfig)
                                        continue;
                                    break;
                            }
                            objForJSON.vScales[i][prop] = HuTime.JSON.stringify(this.vScales[i][prop]);
                        }
                    }
                }
            },

            showVScaleLine: { value: "showVScaleLine" },
            vScaleLine: { value: "vScaleLine" },
            vScaleLineStyle: { value: "vScaleLineStyle" },

            autoAdjustV: { value: "autoAdjustV" },
            mouseEventCapture: { value: "mouseEventCapture" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.Layer.prototype._parseJSONProperties, {
            vTop: { value: "_vTop" },
            vBottom: { value: "_vBottom" },
            vForX: { value: "_vForX" },
            recordsets: {
                value: function (objRaw) {
                    this.recordsets = [];
                    for (var i = 0; i < objRaw.recordsets.length; ++i) {
                        this.appendRecordset(
                            HuTime.JSON.parse(objRaw.recordsets[i]));
                    }
                    this.loadRecordsets();
                }
            }
        })
    }
});

