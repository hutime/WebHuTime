
// **** タイムライン（年表） ****
// 基底クラス（RecordLayerBase）のグラフ用の機能を応用して年表を実現
HuTime.TLineLayer = function TLineLayer(recordset, vBreadth, vMarginTop, vMarginBottom) {
    HuTime.RecordLayerBase.apply(this, arguments);
    this._vTop = 0;     // vBottomはXYと同じにする（再描画時に更新）
    if (recordset instanceof HuTime.TLineRecordset)
        this.appendRecordset(recordset);
};
HuTime.TLineLayer.prototype = Object.create(HuTime.RecordLayerBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.TLineLayer
    },

    // **** 座標 ****
    vForX: {            // タテ表示の場合のV軸設定（v値を帯の描画位置に使うので、0（x軸の方向と同じ）に固定する）
        get: function() {
            return 0;
        }
    },
    appendRecordset: {      // レコードセットの追加
        value: function (recordset) {
            if (recordset instanceof HuTime.TLineRecordset) {
                HuTime.RecordLayerBase.prototype.appendRecordset.apply(this, arguments);
                var onloadend = function(obj){      // データ読み込み後に再描画させる
                    recordset.onloadend = function() {
                        obj._isRecordsSorted = false;
                        obj.redraw();
                    }
                }(this);
            }
        }
    },

    // **** レコードの書式 ****
    useBandStyle: {     // 範囲を帯表示する場合はtrue（falseの場合は線表示）
        writable: true,
        value: true
    },
    plotInterval: {     // プロット（帯）の間隔
        writable: true,
        value: 22       // 既定値；帯の幅 20px（TLineRecordset内で既定） + 帯間 2px
    },
    padding: {          // プロット（帯）の表示領域の余白（px）
        writable: true,
        value: 5
    },
    showLabel: {        // ラベル表示のOn/Off
        writable: true,
        value: true
    },
    plotDirection: {    // 帯の表示位置の方向（0:上から下（左から右）、1:下から上（右から左））
        writable: true,
        value: 0
    },

    // **** レイヤ単位での設定（データセット単位の設定に優先） ****
    showReliableTRange: {   // 確実範囲の表示
        writable: true,
        value: true     // 既定値の変更
    },
    showPossibleTRange: {   // 可能範囲の表示
        writable: true,
        value: true     // 既定値の変更
    },
    showLine: {             // 線（プロット間）の表示
        value: false    // falseで固定
    },
    showPlot: {             // プロットの表示
        value: false    // falseで固定
    },

    // **** 描画関係 ****
    _sortedRecords: {     // ソートされたレコードセット
        writable: true,
        value: null
    },
    _redrawBeforeChild: {
        value: function () {
            this._vBottom = this.currentVBreadth;   // v軸とY軸を一致させる（_setVが実行される前に処理）
            HuTime.RecordLayerBase.prototype._redrawBeforeChild.apply(this, arguments); // _setVの実行を含む
        }
    },
    _sortRecords: {      // レコードのソート
        value: function() {
            this._sortedRecords = [];
            for (var i = 0; i < this.recordsets.length; ++i) {
                if (!this.recordsets[i].visible)
                    continue;

                // レコードの追加（スクロールにより表示位置が変わらないよう、範囲外も含めてすべて対象とする）
                for (var j = 0; j < this.recordsets[i].records.length; ++j) {
                    this._sortedRecords.push({
                            recordset: this.recordsets[i],
                            record: this.recordsets[i].records[j]
                        }
                    );
                }
            }

            // ソート
            this._sortedRecords.sort(function(record1, record2) {
                // 代表値がNaNのレコード場合は末尾
                if (isNaN(record1.record.tRange._centralValue)) {
                    if (isNaN(record2.record.tRange._centralValue))
                        return 0;
                    else
                        return 1
                }
                if (isNaN(record2.record.tRange._centralValue))
                    return -1;

                // 代表値で比較
                if (record1.record.tRange._centralValue < record2.record.tRange._centralValue)
                    return -1;
                else if (record1.record.tRange._centralValue > record2.record.tRange._centralValue)
                    return 1;
                else
                    return 0;
            });
            this._isRecordsSorted = true;
        }
    },
    _drawRecordset: {       // レコードセットの描画
        value: function() {
            if (!this._isRecordsSorted)
                this._sortRecords();

            var vPos;    // 帯のv方向の描画位置（上または左の位置）
            if (this.plotDirection == 1)
                vPos = this._currentVBreadth - this.padding;  // 下から上の場合の初期値
            else
                vPos = this.padding + this.plotInterval;     // 上か下の場合の初期値
            var drawRange, drawLabel;       // 描画処理の関数
            var rangeStyle, labelStyle;     // 書式
            for (var i = 0; i < this._sortedRecords.length; ++i) {  // 表示解像度の確認
                if (!this._sortedRecords[i].recordset._appliedShowRecordAtTResolution(
                          this._lyrTResolution, this._sortedRecords[i].record))
                    continue;
                if (!this._sortedRecords[i].recordset.showReliableTRange &&   // 可能・確実範囲とも非表示の場合
                    !this._sortedRecords[i].recordset.showPossibleTRange)
                    continue;

                // 描画しないレコード（全可能期間のみや、確実期間の無いレコード）
                if ((this._sortedRecords[i].recordset.hideTRangeTotalPRangeOnly &&    // 全可能期間のみのレコード
                    this._sortedRecords[i].record.tRange._isTotalPRangeOnly) ||
                    (this._sortedRecords[i].recordset.hideTRangeNonRRange &&          // 確実期間の無いレコード
                    this._sortedRecords[i].record.tRange._isNonRRange) ||
                    (this._sortedRecords[i].recordset.hideTRangeNonCentralValue &&       // 期間代表値のないレコード
                    isNaN(this._sortedRecords[i].record.tRange._centralValue)))
                    continue;

                if (this._sortedRecords[i].record.tRange._pBegin <= this._maxLyrT &&       // 表示範囲内なら描画処理
                    (this._sortedRecords[i].record.tRange._pEnd >= this._minLyrT)) {
                    // t値範囲の描画処理の取得
                    if (this._sortedRecords[i].recordset.drawRange instanceof Function
                        && this._sortedRecords[i].recordset.drawRange != HuTime.RecordsetBase.prototype.drawRange)
                        drawRange = this._sortedRecords[i].recordset.drawRange;
                    else {
                        if (this.useBandStyle)
                            drawRange = this.defaultDrawRange;      // t値範囲の帯表示
                        else
                            drawRange = HuTime.RecordLayerBase.prototype.defaultDrawRange;  // t値範囲の線表示
                    }

                    rangeStyle = this._sortedRecords[i].recordset._appliedRangeStyle(this._sortedRecords[i].record);
                    drawRange(this._sortedRecords[i].record.tRange, vPos, rangeStyle,
                        this, this._sortedRecords[i].recordset,
                        this._sortedRecords[i].record);      // t値範囲の描画

                    if (this.showLabel &&   // ラベルの描画
                        this._sortedRecords[i].recordset._appliedShowLabel(this._sortedRecords[i].record)) {
                        if (this._sortedRecords[i].recordset.drawLabel instanceof Function)  // ラベル描画処理の取得
                            drawLabel = this._sortedRecords[i].recordset.drawLabel;
                        else
                            drawLabel = this.defaultDrawLabel;

                        labelStyle =
                            this._sortedRecords[i].recordset._appliedLabelStyle(this._sortedRecords[i].record);

                        drawLabel(this._sortedRecords[i].record.tRange, vPos, labelStyle,
                            this, this._sortedRecords[i].recordset,
                            this._sortedRecords[i].record, this._sortedRecords[i].recordset._labelItem);
                    }
                }

                // 帯の表示位置の更新
                if (this.plotDirection == 1) {
                    vPos -= this.plotInterval;    // 下から上
                    if (vPos - this.plotInterval - this.padding < 0)
                        vPos = this._currentVBreadth - this.padding;
                }
                else {
                    vPos += this.plotInterval;    // 上から下
                    if (vPos + this.padding > this._currentVBreadth)
                        vPos = this.padding + this.plotInterval;
                }
            }
        }
    },
    defaultDrawRange: {  // 既定の帯の描画処理
        value: function(tRange, v, style, layer, recordset, record, itemName, canvas) {
            if (!tRange || !isFinite(v) || v == null)
                return;
            if (!(style instanceof HuTime.FigureStyle))
                style = HuTime.TLineRecordset.prototype._rangeStyle;
            var bandBreadth = recordset._appliedBandBreadth(record);
            var begin, end;

            // 可能範囲を確実範囲として描画する場合
            if (recordset.drawPRangeAsRRange) {
                if (tRange._pRangeDuration * layer.lyrTResolution < 5) {
                    // 表示幅が5px以下の場合は、丸で表示
                    HuTime.Drawing.drawCircle(style, layer,
                        new HuTime.TVPosition(tRange._centralValue, v - bandBreadth / 2),
                        bandBreadth * 0.75, canvas);
                }
                else {
                    begin = tRange._pRangeBegin < layer._minLyrT ? layer._minLyrT : tRange._pRangeBegin;
                    end = tRange._pRangeEnd > layer._maxLyrT ? layer._maxLyrT : tRange._pRangeEnd;
                    HuTime.Drawing.drawRect(style, layer,
                        new HuTime.PositionFloor(new HuTime.TVPosition(begin, v)),
                        new HuTime.PositionFloor(new HuTime.TVPosition(end, v - bandBreadth)),
                        0, canvas);
                }
                return;
            }

            // 確実範囲の描画
            if (layer.showReliableTRange && recordset.showReliableTRange &&
                !isNaN(tRange._rRangeDuration)) {
                if (tRange._pRangeDuration * layer.lyrTResolution < 5) {
                    // 表示幅が5px以下の場合は、丸で表示
                    HuTime.Drawing.drawCircle(style, layer,
                        new HuTime.TVPosition(tRange._centralValue, v - bandBreadth / 2),
                        bandBreadth * 0.75, canvas);
                }
                else {
                    begin = tRange._rRangeBegin < layer._minLyrT ? layer._minLyrT : tRange._rRangeBegin;
                    end = tRange._rRangeEnd > layer._maxLyrT ? layer._maxLyrT : tRange._rRangeEnd;
                    HuTime.Drawing.drawRect(style, layer,
                        new HuTime.PositionFloor(new HuTime.TVPosition(begin, v)),
                        new HuTime.PositionFloor(new HuTime.TVPosition(end, v - bandBreadth)),
                        0, canvas);
                }
            }

            // 可能期間の表示
            if (layer.showPossibleTRange && recordset.showPossibleTRange) {
                if (!isNaN(tRange._pRangeDuration) && (    // 全可能範囲の描画
                        (isNaN(tRange._rRangeDuration) &&                                   // 全可能期間のみの場合
                        isNaN(tRange._antePRangeDuration) && isNaN(tRange._postPRangeDuration)) ||
                        ((!layer.showReliableTRange || !recordset.showReliableTRange) &&    // 確実期間が非表示の場合
                        !isNaN(tRange._rRangeDuration))                                     // 全体を可能期間として描画
                    )) {

                    if (tRange._pRangeDuration == 0) {
                        // 確実範囲の長さが0で可能範囲が無いの場合は、丸で表示
                        var lineWidthOriginal = style.lineWidth;
                        var fillColorOriginal = style.fillColor;
                        style.lineWidth = 2;
                        style.fillColor = null;
                        HuTime.Drawing.drawCircle(style, layer,
                            new HuTime.TVPosition(tRange._pRangeBegin, v - bandBreadth / 2),
                            bandBreadth * 0.75, canvas);
                        style.lineWidth = lineWidthOriginal;
                        style.fillColor = fillColorOriginal;
                    }
                    else {
                        // 表示範囲に合わせる
                        begin = tRange._pRangeBegin < layer._minLyrT ? layer._minLyrT : tRange._pRangeBegin;
                        end = tRange._pRangeEnd > layer._maxLyrT ? layer._maxLyrT : tRange._pRangeEnd;
                        var center = (begin + end) / 2;     // 全可能期間の真ん中の点

                        layer._setGradation(layer, style, center, begin);
                        HuTime.Drawing.drawRect(style, layer,
                            new HuTime.PositionFloor(new HuTime.TVPosition(begin, v)),
                            new HuTime.PositionFloor(new HuTime.TVPosition(center, v - bandBreadth)),
                            0, canvas);
                        layer._setGradation(layer, style, center, end);
                        HuTime.Drawing.drawRect(style, layer,
                            new HuTime.PositionFloor(new HuTime.TVPosition(center, v)),
                            new HuTime.PositionFloor(new HuTime.TVPosition(end, v - bandBreadth)),
                            0, canvas);
                        layer._setGradation(layer, style);  // グラデーションの解除
                    }
                }
                else {  // 前期・後期可能範囲の描画
                    // 前期可能範囲の描画
                    if (!isNaN(tRange._antePRangeDuration)) {
                        begin = tRange._antePRangeBegin < layer._minLyrT ? layer._minLyrT : tRange._antePRangeBegin;
                        end = tRange._antePRangeEnd > layer._maxLyrT ? layer._maxLyrT : tRange._antePRangeEnd;
                        layer._setGradation(layer, style, end, begin);
                        HuTime.Drawing.drawRect(style, layer,
                            // 範囲（帯）の間に隙間ができることがあるので、座標を整数化する
                            new HuTime.PositionFloor(new HuTime.TVPosition(begin, v)),
                            new HuTime.PositionFloor(new HuTime.TVPosition(end, v - bandBreadth)),
                            0, canvas);
                    }

                    // 後期可能範囲の描画
                    if (!isNaN(tRange._postPRangeDuration)) {
                        begin = tRange._postPRangeBegin < layer._minLyrT ? layer._minLyrT : tRange._postPRangeBegin;
                        end = tRange._postPRangeEnd > layer._maxLyrT ? layer._maxLyrT : tRange._postPRangeEnd;
                        layer._setGradation(layer, style, begin, end);
                        HuTime.Drawing.drawRect(style, layer,
                            new HuTime.PositionFloor(new HuTime.TVPosition(begin, v)),
                            new HuTime.PositionFloor(new HuTime.TVPosition(end, v - bandBreadth)),
                            0, canvas);
                    }
                    layer._setGradation(layer, style);  // グラデーションの解除
                }
            }
        }
    },
    defaultDrawLabel: {     // 既定のラベル描画処理
        value: function(tRange, v, style, layer, recordset, record, itemName, canvas) {
            if (!tRange || !isFinite(v) || v == null)
                return;
            if (!itemName)
                itemName = "label";
            if (!(itemName in record.data))
                return;

            // 書式等の取得
            if (!canvas)
                canvas = layer._syncInfoCanvas;
            var label = record.data[itemName].content;
            var bandBreadth = recordset._appliedBandBreadth(record);
            var labelOffsetT = recordset.labelOffsetT / layer._lyrTResolution;
            var labelOffsetV = recordset.labelOffsetV / layer._lyrVResolution;
            var labelRotate = recordset.labelRotate;

            // 描画位置の決定
            var begin, end;
            var labelPos;

            if (!isNaN(tRange._rRangeBegin)) {   // 確実範囲がある場合（始点）
                begin = tRange._rRangeBegin < layer._minLyrT ? layer._minLyrT : tRange._rRangeBegin;
                labelPos = new HuTime.RelativeTVPosition(
                    new HuTime.TVPosition(begin, v - bandBreadth / 2), labelOffsetT, labelOffsetV);
            }
            else if (!isNaN(tRange._postPRangeDuration) && tRange._postPRangeDuration > 0) {   // 後期可能期間がある場合（始点）
                begin = tRange._centralValue < layer._minLyrT ? layer._minLyrT : tRange._centralValue;
                labelPos = new HuTime.RelativeTVPosition(
                    new HuTime.TVPosition(begin, v - bandBreadth / 2), labelOffsetT, labelOffsetV);
            }
            else if (!isNaN(tRange._antePRangeDuration) && tRange._antePRangeDuration > 0) {   // 前期可能期間がある場合（終点）
                begin = tRange._centralValue > layer._maxLyrT ? layer._maxLyrT : tRange._centralValue;
                var ctx = canvas.getContext('2d');
                ctx.font = style.font;
                labelPos = new HuTime.RelativeTVPosition(
                    new HuTime.TVPosition(begin, v - bandBreadth / 2),
                    - ctx.measureText(label).width - labelOffsetT, labelOffsetV);
                // （ラベルを回転させた場合に左端を基準にするため「擬似的」な右寄せ）
            }
            else if (!isNaN(tRange._pRangeDuration)) {   // 全可能期間がある場合（表示範囲の中心）
                begin = tRange._pBegin < layer._minLyrT ? layer._minLyrT : tRange._pBegin;
                end = tRange._pEnd > layer._maxLyrT ? layer._maxLyrT : tRange._pEnd;
                labelPos = new HuTime.RelativeTVPosition(
                    new HuTime.TVPosition((begin + end) / 2, v - bandBreadth / 2), labelOffsetT, labelOffsetV);
            }
            else
                return;     // 範囲外、または、エラー

            // ラベル描画
            if (layer._tDirection == 1)
                style.textAlign = "right";
            else
                style.textAlign = "left";

            if (layer._tRotation == 1) {
                HuTime.Drawing.drawString(style, layer, labelPos,
                    label, 90 + labelRotate, canvas);
            }
            else {
                HuTime.Drawing.drawString(style, layer, labelPos,
                    label, labelRotate, canvas);
            }
        }
    },
    _setGradation: {     // グラデーションの設定
        value: function (obj, style, begin, end) {
            // beginまたはendが指定されていない場合は、グラデーションの設定をクリア（既定の処理に戻る）
            if (!isFinite(begin) && begin != 0 || !isFinite(end) && end != 0) {
                style.applyStyle = HuTime.FigureStyle.prototype.defaultApplyStyle;
                return;
            }

            // t座標値からxy座標値に変換
            if (obj._tDirection == 1) {
                begin = (obj._maxLyrT - begin) * obj._lyrTResolution;
                end = (obj._maxLyrT - end) * obj._lyrTResolution;
            }
            else {
                begin = (begin - obj._minLyrT) * obj._lyrTResolution;
                end = (end - obj._minLyrT) * obj._lyrTResolution;
            }
            style.applyStyle = function(ctx) {
                var alphaOld = ctx.globalAlpha;
                ctx.globalAlpha = this.alpha;
                if (this.fillColor) {
                    var grad;
                    if (obj._tRotation == 1)
                        grad = ctx.createLinearGradient(0, begin, 0, end);
                    else
                        grad = ctx.createLinearGradient(begin, 0, end, 0);
                    grad.addColorStop(0, style.fillColor);
                    grad.addColorStop(1.0, "rgba(255, 255, 255, 0.5)");     // 末端は半透明の白
                    ctx.fillStyle = grad;
                    ctx.fill();
                }
                style.applyLineStyle(ctx);
                ctx.globalAlpha = alphaOld;
            };
        }
    },

    // **** イベント関係 ****
    _isInPlot: {
        value: function(record, vPos, bandBreadth, eventT, eventV) {
            if (eventT >= record.tRange._pBegin && eventT < record.tRange._pEnd &&
                eventV >= vPos - bandBreadth && eventV <= vPos)
                return true;    // 帯内

            if (record.tRange._pRangeDuration * this._lyrTResolution >= 5)
                return false;   // 点表示対象でない場合

            if (eventT >= record.tRange._pBegin - bandBreadth / 3 / this._lyrTResolution &&
                eventT < record.tRange._pEnd  + bandBreadth / 3 / this._lyrTResolution &&
                eventV <= vPos - bandBreadth / 6 &&
                eventV >= vPos - 5 * bandBreadth / 6)
                return true;    // 正方形で近似された円内

            return false;
        }
    },
    _drawHighlight: {
        value: function(eventT, eventV) {
            var vPos;
            if (this.plotDirection == 1)
                vPos = this._currentVBreadth - this.padding;  // 下から上の場合の初期値
            else
                vPos = this.padding + this.plotInterval;     // 上か下の場合の初期値
            var drawRange;
            var style;
            var originalLineColor, originalFillColor;   // ハイライト色を設定するための退避先
            for (var i = 0; i < this._sortedRecords.length; ++i) {
                if (!this._sortedRecords[i].recordset._appliedShowRecordAtTResolution(  // 表示解像度の確認
                        this._lyrTResolution, this._sortedRecords[i].record))
                    continue;

                // 描画しないレコード（全可能期間のみや、確実期間の無いレコード）
                if ((this._sortedRecords[i].recordset.hideTRangeTotalPRangeOnly &&    // 全可能期間のみのレコード
                    this._sortedRecords[i].record.tRange._isTotalPRangeOnly) ||
                    (this._sortedRecords[i].recordset.hideTRangeNonRRange &&          // 確実期間の無いレコード
                    this._sortedRecords[i].record.tRange._isNonRRange) ||
                    (this._sortedRecords[i].recordset.hideTRangeNonCentralValue &&       // 期間代表値のないレコード
                    isNaN(this._sortedRecords[i].record.tRange._centralValue)))
                    continue;

                if (this._sortedRecords[i].record.tRange._pBegin <= this._maxLyrT &&
                    (this._sortedRecords[i].record.tRange._pEnd >= this._minLyrT)) {    // 表示範囲内のデータ
                    // ヒットした場合の処理
                    if (this._isInPlot(this._sortedRecords[i].record, vPos,
                            this._sortedRecords[i].recordset._appliedBandBreadth(this._sortedRecords[i].record),
                            eventT, eventV)) {

                        // t値範囲の描画処理の取得
                        if (this._sortedRecords[i].recordset.drawRange instanceof Function
                            && this._sortedRecords[i].recordset.drawRange != HuTime.RecordsetBase.prototype.drawRange)
                            drawRange = this._sortedRecords[i].recordset.drawRange;
                        else {
                            if (this.useBandStyle)
                                drawRange = this.defaultDrawRange;
                            else
                                drawRange = HuTime.RecordLayerBase.prototype.defaultDrawRange;
                        }
                        style = this._sortedRecords[i].recordset._appliedRangeStyle(this._sortedRecords[i].record);
                        originalLineColor = style.lineColor;
                        originalFillColor = style.fillColor;
                        style.lineColor = this.highlightColor;
                        style.fillColor = this.highlightColor;
                        drawRange(this._sortedRecords[i].record.tRange, vPos, style,
                            this, this._sortedRecords[i].recordset,
                            this._sortedRecords[i].record, null, this._systemCanvas);
                        style.lineColor = originalLineColor;
                        style.fillColor = originalFillColor;
                    }
                }

                // 帯の表示位置の更新
                if (this.plotDirection == 1) {
                    vPos -= this.plotInterval;    // 下から上
                    if (vPos - this.plotInterval - this.padding < 0)
                        vPos = this._currentVBreadth - this.padding;
                }
                else {
                    vPos += this.plotInterval;    // 上から下
                    if (vPos + this.padding > this._currentVBreadth)
                        vPos = this.padding + this.plotInterval;
                }
            }
        }
    },
    _getClickedRecords: {       // クリックされたレコードを収集
        value: function (eventT, eventV) {
            var vPos;
            if (this.plotDirection == 1)
                vPos = this._currentVBreadth - this.padding;  // 下から上の場合の初期値
            else
                vPos = this.padding + this.plotInterval;     // 上か下の場合の初期値
            var clickedRecords = [];
            for (var i = 0; i < this._sortedRecords.length; ++i) {
                if (!this._sortedRecords[i].recordset._appliedShowRecordAtTResolution(    // 表示解像度の確認
                        this._lyrTResolution, this._sortedRecords[i].record))
                    continue;

                // 描画しないレコード（全可能期間のみや、確実期間の無いレコード）
                if ((this._sortedRecords[i].recordset.hideTRangeTotalPRangeOnly &&    // 全可能期間のみのレコード
                    this._sortedRecords[i].record.tRange._isTotalPRangeOnly) ||
                    (this._sortedRecords[i].recordset.hideTRangeNonRRange &&          // 確実期間の無いレコード
                    this._sortedRecords[i].record.tRange._isNonRRange) ||
                    (this._sortedRecords[i].recordset.hideTRangeNonCentralValue &&       // 期間代表値のないレコード
                    isNaN(this._sortedRecords[i].record.tRange._centralValue)))
                    continue;

                if (this._sortedRecords[i].record.tRange._pBegin <= this._maxLyrT &&
                    (this._sortedRecords[i].record.tRange._pEnd >= this._minLyrT)) {    // 表示範囲内のデータ
                    // ヒットした場合の処理（レコードクリックの処理）
                    if (this._isInPlot(this._sortedRecords[i].record, vPos,
                        this._sortedRecords[i].recordset._appliedBandBreadth(this._sortedRecords[i].record),
                        eventT, eventV))
                        clickedRecords.push({
                            record: this._sortedRecords[i].record,
                            itemName: null
                        });
                }

                // 帯の表示位置の更新
                if (this.plotDirection == 1) {
                    vPos -= this.plotInterval;    // 下から上
                    if (vPos - this.plotInterval - this.padding < 0)
                        vPos = this._currentVBreadth - this.padding;
                }
                else {
                    vPos += this.plotInterval;    // 上から下
                    if (vPos + this.padding > this._currentVBreadth)
                        vPos = this.padding + this.plotInterval;
                }
            }
            return clickedRecords;
        }
    }
});
