
// **** 折れ線グラフ ****
HuTime.LineChartLayer = function LineChartLayer (recordset, vBreadth, vMarginTop, vMarginBottom, vTop, vBottom) {
    HuTime.RecordLayerBase.apply(this, arguments);
    this.appendRecordset(recordset);
};
HuTime.LineChartLayer.prototype = Object.create(HuTime.RecordLayerBase.prototype, {
    constructor: {
        value: HuTime.LineChartLayer
    },
    appendRecordset: {      // レコードセットの追加（型チェックのため、オーバライド）
        value: function (recordset) {
            if (recordset instanceof HuTime.ChartRecordset) {
                this.recordsets.push(recordset);
                var onloadend = function(obj){      // データ読み込み後に再描画させる
                    recordset.onloadend = function() {
                        obj.redraw();
                    }
                }(this);
            }
        }
    },

    defaultDrawLine: {
        value: function (t, v, tPrev, vPrev, style, layer, recordset, record, prevRecord, itemName, canvas) {
            if (isNaN(t) || !isFinite(v) || v == null ||
                isNaN(tPrev) || !isFinite(vPrev) || vPrev == null)
                return;
            if (!(style instanceof HuTime.FigureStyle))
                style = new HuTime.FigureStyle();

            // t値を画面内に収める（座標変換でオーバフローするのを防ぐ）
            if (tPrev < t) {
                if (tPrev < layer._minLyrT)
                    tPrev = layer._minLyrT;
                if (t > layer._maxLyrT)
                    t = layer._maxLyrT;
            }
            else if (tPrev < t) {
                if (tPrev > layer._maxLyrT)
                    tPrev = layer._maxLyrT;
                if (t < layer._minLyrT)
                    t = layer._minLyrT;
            }

            // v値が座標変換でオーバフローするのを防ぐ（10000pxを限度に想定）
            var limit = 10000;
            var dV = Math.abs(layer._vTop - layer._vBottom);
            if (Math.abs(v - layer._vTop) > dV * limit) {   // limitが十分大きければ、_vTopでも_vBottomでも実質同じ
                if (v > layer._vTop)
                    v = layer._vTop + dV * limit;
                else
                    v = layer._vTop - dV * limit;
            }
            if (Math.abs(vPrev - layer._vTop) > dV * limit) {
                if (vPrev > layer._vTop)
                    vPrev = layer._vTop + dV * limit;
                else
                    vPrev = layer._vTop - dV * limit;
            }

            HuTime.Drawing.drawLine(style, layer,
                [new HuTime.TVPosition(tPrev, vPrev), new HuTime.TVPosition(t, v)]);
        }
    },
    defaultDrawPlot: {
        value: function (t, v, style, layer, recordset, record, itemName, canvas) {
            if (isNaN(t) || !isFinite(v) || v == null)
                return;
            var dV = Math.abs(layer._vTop - layer._vBottom);
            if (v + dV < layer._vBottom && v + dV < layer._vTop || v - dV > layer._vBottom && v - dV > layer._vTop)
                return;     // v値が表示範囲の倍以上はみ出した場合は、描画しない

            if (!(style instanceof HuTime.FigureStyle))
                style = new HuTime.FigureStyle();

            var width = recordset._appliedItemPlotWidth(itemName, record);
            var rotate = recordset._appliedItemPlotRotate(itemName, record);
            switch (recordset._appliedItemPlotSymbol(itemName, record)) {
                case 1:     // 四角
                    HuTime.Drawing.drawSquare(style, layer,
                        new HuTime.TVPosition(t, v), width, rotate, canvas);
                    break;

                case 2:     // 三角
                    HuTime.Drawing.drawTriangle(style, layer,
                        new HuTime.TVPosition(t, v), width, rotate, canvas);
                    break;

                case 3:     // 十字
                    HuTime.Drawing.drawPlusMark(style, layer,
                        new HuTime.TVPosition(t, v), width, rotate, canvas);
                    break;

                case 0:     // 丸
                default:
                    HuTime.Drawing.drawCircle(style, layer,
                        new HuTime.TVPosition(t, v), width, canvas);
                    break;
            }
        }
    },

    // **** JSON出力 ****
    toJSON: {
        value: function toJSON () {
            var json = HuTime.RecordLayerBase.prototype.toJSON.apply(this);
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON (json) {
            HuTime.RecordLayerBase.prototype.parseJSON.apply(this, arguments);
        }
    }
});
HuTime.LineChartLayer.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.LineChartLayer();
    obj.parseJSON(json);
    return obj;
};

// **** プロットチャート ****
HuTime.PlotChartLayer = function PlotChartLayer (recordset, vBreadth, vMarginTop, vMarginBottom, vTop, vBottom) {
    HuTime.LineChartLayer.apply(this, arguments);
    this.appendRecordset(recordset);
};
HuTime.PlotChartLayer.prototype = Object.create(HuTime.LineChartLayer.prototype, {  // LineChartがベース
    constructor: {
        value: HuTime.PlotChartLayer
    },

    showLine: {                 // 線（プロット間）の表示（非表示で固定）
        value: false            // 既定値の変更
    },
    defaultDrawLine: {          // 線（プロット間）の描画（何もしない処理に差し替え）
        value: function () {
        }
    },

    // **** JSON出力 ****
    toJSON: {
        value: function toJSON () {
            var json = HuTime.RecordLayerBase.prototype.toJSON.apply(this);
            json.showLine = this.showLine;
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON (json) {
            HuTime.RecordLayerBase.prototype.parseJSON.apply(this, arguments);
            this.showLine = json.showLine;
        }
    }
});
HuTime.PlotChartLayer.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.PlotChartLayer();
    obj.parseJSON(json);
    return obj;
};

// **** 棒グラフ ****
HuTime.BarChartLayer = function BarChartLayer (recordset, vBreadth, vMarginTop, vMarginBottom, vTop, vBottom) {
    HuTime.RecordLayerBase.apply(this, arguments);
    this.appendRecordset(recordset);
};
HuTime.BarChartLayer.prototype = Object.create(HuTime.RecordLayerBase.prototype, {
    constructor: {
        value: HuTime.BarChartLayer
    },
    appendRecordset: {      // レコードセットの追加（型チェックのため、オーバライド）
        value: function (recordset) {
            if (recordset instanceof HuTime.ChartRecordset) {
                this.recordsets.push(recordset);
                var onloadend = function(obj){      // データ読み込み後に再描画させる
                    recordset.onloadend = function() {
                        obj.redraw();
                    }
                }(this);
            }
        }
    },

    _drawRecordRange: {      // レコード単位のt範囲描画
        value: function (drawRange, layer, recordset, record, canvas) {
            var itemName;
            var rangeStyle;
            var baseV = 0;  // 棒を積み上げるための積算値
            for (var i = 0; i <  recordset._valueItems.length; ++i) {
                itemName = recordset._valueItems[i].name;
                if (!(itemName in record.data))   // レコード内に該当列が無い場合
                    continue;

                rangeStyle = recordset._appliedItemRangeStyle(itemName, record);
                drawRange(record.tRange, baseV + record.data[itemName].content / 2, rangeStyle,
                    this, recordset, record, itemName, canvas);
                baseV += record.data[itemName].content;
            }
        }
    },
    _drawRecordLine: {      // レコード単位の線（プロット間の）描画
        value: function(drawLine, layer, recordset, record, prevRecord, canvas) {
            var itemName;
            var lineStyle;
            var baseV = 0;      // 棒を積み上げるための積算値
            var baseVPrev = 0;  // 棒を積み上げるための積算値（前のレコード）
            for (var i = 0; i <  recordset._valueItems.length; ++i) {
                itemName = recordset._valueItems[i].name;
                if (!(itemName in record.data) || !(itemName in prevRecord.data))
                    continue;   // レコード内に該当列が無い場合（不連続）
                if (!recordset._appliedItemShowLine(itemName, record, prevRecord))
                    continue;

                lineStyle = recordset._appliedItemLineStyle(itemName, record, prevRecord);
                drawLine(record.tRange, baseV + record.data[itemName].content,
                    prevRecord.tRange, baseVPrev + prevRecord.data[itemName].content, lineStyle,
                    this, recordset, record, itemName, canvas);
                baseV += record.data[itemName].content;
                baseVPrev += prevRecord.data[itemName].content;
            }
        }
    },
    _drawRecordPlot: {      // レコード単位のプロット描画（列の値を積み重ねるため、処理をオーバライド）
        value: function(drawPlot, layer, recordset, record, canvas) {
            var itemName;
            var plotStyle;
            var baseV = 0;
            for (var i = 0; i <  recordset._valueItems.length; ++i) {
                itemName = recordset._valueItems[i].name;
                if (!(itemName in record.data))   // レコード内に該当列が無い場合
                    continue;
                if (!recordset._appliedItemShowPlot(itemName, record))
                    continue;
                plotStyle = recordset._appliedItemPlotStyle(itemName, record);
                drawPlot(record.tRange, record.data[itemName].content, baseV, plotStyle,
                    this, recordset, record, itemName, canvas);
                baseV += record.data[itemName].content;
            }
        }
    },

    defaultDrawLine: {
        value: function (tRange, v, tRangePrev, vPrev, style, layer, recordset, record, recordPrev, itemName, canvas) {
            if (!tRange || v == null || !tRangePrev || vPrev == null)
                return;
            if (!(style instanceof HuTime.FigureStyle))
                style = new HuTime.FigureStyle();

            var begin, end;
            var barWidth;   // 棒の幅（実際にはplotWidthの値）
            switch (recordset.plotWidthType) {
                case 0:     // 確実範囲に基づく
                    begin = tRangePrev._rRangeEnd;
                    end = tRange._rRangeBegin;
                    break;

                case 1:     // 可能範囲に基づく
                    begin = tRangePrev._pRangeEnd;
                    end = tRange._pRangeBegin;
                    break;

                case 2:     // t値固定（centralValueが無いレコードは、前の段階ではじかれている）
                    barWidth = recordset._appliedItemPlotWidth(itemName, record);
                    begin = tRangePrev._centralValue + barWidth / 2;
                    end = tRange._centralValue - barWidth / 2;
                    break;

                case 3:     // xy値固定
                    barWidth = recordset._appliedItemPlotWidth(itemName, record);
                    begin = tRangePrev._centralValue + barWidth / 2 / layer._lyrTResolution;
                    end = tRange._centralValue - barWidth / 2 / layer._lyrTResolution;
                    break;

                default:    // 指定エラーは描画せず終了
                    return;
            }

            if (begin < end) {
                // t値を画面内に収める（座標変換でオーバフローするのを防ぐ）
                if (begin < layer._minLyrT)
                    begin = layer._minLyrT;
                if (end > layer._maxLyrT)
                    end = layer._maxLyrT;

                // v値が座標変換でオーバフローするのを防ぐ（10000pxを限度に想定）
                var limit = 10000;
                var dV = Math.abs(layer._vTop - layer._vBottom);
                if (Math.abs(v - layer._vTop) > dV * limit) {   // limitが十分大きければ、_vTopでも_vBottomでも実質同じ
                    if (v > layer._vTop)
                        v = layer._vTop + dV * limit;
                    else
                        v = layer._vTop - dV * limit;
                }
                if (Math.abs(vPrev - layer._vTop) > dV * limit) {
                    if (vPrev > layer._vTop)
                        vPrev = layer._vTop + dV * limit;
                    else
                        vPrev = layer._vTop - dV * limit;
                }

                HuTime.Drawing.drawLine(style, layer,
                    [new HuTime.TVPosition(begin, vPrev), new HuTime.TVPosition(end, v)], canvas);
            }
        }
    },

    defaultDrawPlot: {  // 既定の棒の描画
        value: function (tRange, v, baseV, style, layer, recordset, record, itemName, canvas) {
            if (!tRange || v == null)
                return;
            if (!(style instanceof HuTime.FigureStyle))
                style = new HuTime.FigureStyle();

            var begin, end;
            var barWidth;
            switch (recordset.plotWidthType) {
                case 0:     // 確実範囲に基づく
                    begin = tRange._rRangeBegin;
                    end = tRange._rRangeEnd;
                    break;

                case 1:     // 可能範囲に基づく
                    begin = tRange._pRangeBegin;
                    end = tRange._pRangeEnd;
                    break;

                case 2:     // t値固定（centralValueが無いレコードは、前の段階ではじかれている）
                    begin = tRange._centralValue - recordset.plotWidth / 2;
                    end = tRange._centralValue + recordset.plotWidth / 2;
                    break;

                case 3:     // xy値固定
                    begin = tRange._centralValue - recordset.plotWidth / 2 / layer._lyrTResolution;
                    end = tRange._centralValue + recordset.plotWidth / 2 / layer._lyrTResolution;
                    break;

                default:    // 指定エラーは描画せず終了
                    return;
            }

            // 棒を描画
            if (begin < end) {
                // t値を画面内に収める（座標変換でオーバフローするのを防ぐ）
                if (begin < layer._minLyrT)
                    begin = layer._minLyrT;
                if (end > layer._maxLyrT)
                    end = layer._maxLyrT;

                // v値が座標変換でオーバフローするのを防ぐ（上下とも画面幅分のマージンをとる）
                var dV = Math.abs(layer._vTop - layer._vBottom);
                if (baseV + dV < layer._vBottom && baseV + dV < layer._vTop) {
                    if (layer._vBottom < layer._vTop) {   // 棒の根元が外れる場合
                        baseV = layer._vBottom - dV;
                        v -= baseV;
                    }
                    else {
                        baseV = layer._vTop - dV;
                        v -= baseV;
                    }
                }
                if (baseV + v - dV > layer._vBottom && baseV + v - dV > layer._vTop) {
                    if (layer._vTop > layer._vBottom)   // 棒の先が外れる場合
                        v = layer._vTop + dV - baseV;
                    else
                        v = layer._vBottom + dV - baseV;
                }

                HuTime.Drawing.drawRect(style, layer,
                    new HuTime.TVPosition(begin, baseV), new HuTime.TVPosition(end, baseV + v), 0, canvas);
            }
        }
    },

    // **** イベント関係 ****
    _isInPlot: {        // マウスカーソルの当たり判定（t値の代表値が無い－無限大を含む全可能期間のみなど－はヒットしない）
        //value: function(record, v, baseV, eventT, eventV) {
        value: function(recordset, record, v, baseV, eventT, eventV) {
            if (isNaN(record.tRange._centralValue))
                return;

            var begin, end;
            switch (recordset.plotWidthType) {
                case 0:     // 確実範囲に基づく
                    begin = record.tRange._rRangeBegin;
                    end = record.tRange._rRangeEnd;
                    break;

                case 1:     // 可能範囲に基づく
                    begin = record.tRange._pRangeBegin;
                    end = record.tRange._pRangeEnd;
                    break;

                case 2:     // t値固定（centralValueが無いレコードは、前の段階ではじかれている）
                    begin = record.tRange._centralValue - recordset.plotWidth / 2;
                    end = record.tRange._centralValue + recordset.plotWidth / 2;
                    break;

                case 3:     // xy値固定
                    begin = record.tRange._centralValue - recordset.plotWidth / 2 / layer._lyrTResolution;
                    end = record.tRange._centralValue + recordset.plotWidth / 2 / layer._lyrTResolution;
                    break;

                default:    // 指定エラーは判定せず終了
                    return;
            }

            if ((end - begin) > 5 / this._lyrTResolution)   // 棒の幅が5px以上の場合
                return (eventT >= begin && eventT <= end &&
                    eventV <= baseV + v && eventV >= baseV);
            else                                            // 棒の幅が5px以下の場合は、t代表値から前後5px
                return (eventT <= record.tRange._centralValue + 5 / this._lyrTResolution &&
                    eventT >= record.tRange._centralValue - 5 / this._lyrTResolution &&
                    eventV <= baseV + v && eventV >= baseV);
        }
    },
    _drawHighlight: {  // ハイライト表示
        value: function(eventT, eventV) {   // マウスのある位置のレコードをハイライト
            var drawPlot;
            var plotStyle;
            var baseV, baseVForAll;     // 積算値と、レコード単位で選択された場合の処理するための積算値
            var originalLineColor, originalFillColor;   // ハイライト色を設定するための退避先
            var itemName, valueTagForAll;  // 探索用の値名、レコード単位で選択された場合に全値を処理するための値名

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
                    baseV = 0;
                    for (var k = 0; k < this.recordsets[i]._valueItems.length; ++k) {
                        itemName = this.recordsets[i]._valueItems[k].name;
                        if (!(itemName in this.recordsets[i].records[j].data))
                            continue;

                        // ヒットした場合の処理
                        if (this._isInPlot(this.recordsets[i], this.recordsets[i].records[j],
                                this.recordsets[i].records[j].data[itemName].content, baseV, eventT, eventV)) {
                            if (this.recordsets[i].selectRecord || this.selectRecord) {     // レコード単位での選択
                                baseVForAll = 0;
                                for (var m = 0; m < this.recordsets[i]._valueItems.length; ++m) {
                                    valueTagForAll = this.recordsets[i]._valueItems[m].name;
                                    if (!(valueTagForAll in this.recordsets[i].records[j].data))
                                        continue;
                                    plotStyle =
                                        this.recordsets[i]._appliedItemPlotStyle(valueTagForAll, this.recordsets[i].records[j]);
                                    originalLineColor = plotStyle.lineColor;
                                    originalFillColor = plotStyle.fillColor;
                                    plotStyle.lineColor = this.highlightColor;
                                    plotStyle.fillColor = this.highlightColor;
                                    drawPlot(this.recordsets[i].records[j].tRange,
                                        this.recordsets[i].records[j].data[valueTagForAll].content, baseVForAll, plotStyle,
                                        this, this.recordsets[i], this.recordsets[i].records[j], valueTagForAll,
                                        this._systemCanvas);
                                    plotStyle.lineColor = originalLineColor;
                                    plotStyle.fillColor = originalFillColor;
                                    baseVForAll += this.recordsets[i].records[j].data[valueTagForAll].content;
                                }
                                break;  // ヒットした列（値）を探すループから抜ける
                            }
                            else {
                                plotStyle = this.recordsets[i]._appliedItemPlotStyle(itemName, this.recordsets[i].records[j]);
                                originalLineColor = plotStyle.lineColor;
                                originalFillColor = plotStyle.fillColor;
                                plotStyle.lineColor = this.highlightColor;
                                plotStyle.fillColor = this.highlightColor;
                                drawPlot(this.recordsets[i].records[j].tRange,
                                    this.recordsets[i].records[j].data[itemName].content, baseV, plotStyle,
                                    this, this.recordsets[i], this.recordsets[i].records[j], itemName,
                                    this._systemCanvas);
                                plotStyle.lineColor = originalLineColor;
                                plotStyle.fillColor = originalFillColor;
                            }
                        }
                        baseV += this.recordsets[i].records[j].data[itemName].content;
                    }
                }
            }
        }
    },
    _getClickedRecords: {       // クリックされたレコードを収集
        value: function (eventT, eventV) {
            var clickedRecords = [];
            var itemName, valueTagForAll;
            var baseV, baseVForAll;
            for (var i = 0; i < this.recordsets.length; ++i) {
                if (!this.recordsets[i].visible)
                    continue;
                for (var j = 0; j < this.recordsets[i].records.length; ++j) {
                    if (!this.recordsets[i].records[j]._oLVisible)
                        continue;   // 範囲外の場合は、次のレコードへ
                    baseV = 0;
                    for (var k = 0; k <  this.recordsets[i]._valueItems.length; ++k) {
                        itemName = this.recordsets[i]._valueItems[k].name;
                        if (!(itemName in this.recordsets[i].records[j].data))
                            continue;

                        // ヒットした場合の処理
                        if (this._isInPlot(this.recordsets[i], this.recordsets[i].records[j],
                                this.recordsets[i].records[j].data[itemName].content, baseV,
                                eventT, eventV)) {

                            if (this.recordsets[i].selectRecord || this.selectRecord) {    // レコード単位での選択
                                for (var m = 0; m <  this.recordsets[i]._valueItems.length; ++m) {
                                    valueTagForAll = this.recordsets[i]._valueItems[m].name;
                                    if (!(valueTagForAll in this.recordsets[i].records[j].data))
                                        continue;
                                    clickedRecords.push({
                                        record: this.recordsets[i].records[j],
                                        itemName: valueTagForAll
                                    });
                                }
                                break;  // ヒットした列（値）を探すループから抜ける
                            }
                            else {
                                clickedRecords.push({
                                    record: this.recordsets[i].records[j],
                                    itemName: itemName
                                });
                            }
                        }
                        baseV += this.recordsets[i].records[j].data[itemName].content;
                    }
                }
            }
            return clickedRecords;
        }
    },

    // **** JSON出力 ****
    toJSON: {
        value: function toJSON () {
            var json = HuTime.RecordLayerBase.prototype.toJSON.apply(this);
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON (json) {
            HuTime.RecordLayerBase.prototype.parseJSON.apply(this, arguments);
        }
    }
});
HuTime.BarChartLayer.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.BarChartLayer();
    obj.parseJSON(json);
    return obj;
};
