// ********************************
// Web HuTime
// Copyright (C) 2016-2018 Tatsuki Sekino.
// ********************************

// ******** WebHuTime本体 ********
HuTime = function(elementId) {
    Object.defineProperty(this, "constructor", {writable: false, value: HuTime});

    if (elementId)  // elementIdが指定されていた場合はtargetElementに設定（旧バージョンとの互換）
        this._targetElement = document.getElementById(elementId);   // 要素が見つからなければnullになる
    this._panelCollections = [];     // コンテナの配列
    this._userEvents = [];      // ユーザイベント

    window.onresize = function(obj) {   // ウィンドウ幅が変更された場合の処理（タイマにより時間差で再描画）
        return function() {
            clearTimeout(obj._mouseTimer);
            obj._mouseTimer = setTimeout(
                function() {
                    obj.redraw.call(obj);
                },
                obj.mouseTimeOut);
        };
    }(this);
};
HuTime.prototype = {
    // **** 基本構造 ****
    constructor: HuTime,
    id: "",
    name: "",
    _targetElement: null,

    // **** 座標関係 ****
    minT: 0.0,              // t軸の表示範囲（最小値）
    maxT: 200.0,            // t軸の表示範囲（最大値）
    _currentMinT: 0.0,       // 最後に再描画した後のt軸の表示範囲（最小値）
    get currentMinT() {
        return this._currentMinT;
    },
    _currentMaxT: 200.0,     // 最後に再描画した後のt軸の表示範囲（最大値）
    get currentMaxT() {
        return this._currentMaxT;
    },
    minTLimit: Number.NEGATIVE_INFINITY,    // tの範囲（下限）
    maxTLimit: Number.POSITIVE_INFINITY,    // tの範囲（上限）

    // **** コンテナ（PanelCollection）関係 ****
    _panelCollections: null,   // コンテナの配列
    get panelCollections() {
        return this._panelCollections;
    },

    appendPanelCollection: function (panelCollection, targetElement) {     // コンテナを一番下に追加
        if (!(panelCollection instanceof HuTime.PanelCollection))     // 型のチェック
            return;

        this.removePanelCollection(panelCollection);    // 重複を避けるため、削除を実行
        panelCollection._setParent(this);
        panelCollection._setHutimeRoot(this);
        this._panelCollections.push(panelCollection);
        if (targetElement && targetElement instanceof HTMLElement)
            targetElement.appendChild(panelCollection.element);
        else if (this._targetElement && this._targetElement instanceof HTMLElement)
            this._targetElement.appendChild(panelCollection.element);
        // 紐づけられるDOM要素が無い場合は何もしない
    },
    removePanelCollection: function (panelCollection) {     // コンテナの削除
        if (!(panelCollection instanceof HuTime.PanelCollection))     // 型のチェック
            return;
        for (var i = this._panelCollections.length; i--; ) {
            if (this._panelCollections[i] === panelCollection) {
                panelCollection._element.parentNode.removeChild(panelCollection._element);
                this._panelCollections.splice(i, 1);
                panelCollection._setParent(null);
                panelCollection._setHutimeRoot(null);
                break;
            }
        }
    },

    // **** 描画関係 ****
    redraw: function (minT, maxT) {     // コンテナの再描画
        if (isFinite(minT) && minT != null && isFinite(maxT) && maxT != null && minT < maxT) {
            this.minT = minT;
            this.maxT = maxT;
        }
        if (this.minT < this.minTLimit)
            this.minT = this.minTLimit;
        if (this.maxT > this.maxTLimit)
            this.maxT = this.maxTLimit;

        if (this.processBeforeRedraw instanceof Function)   // ユーザ定義の処理
            this.processBeforeRedraw(this);
        // 各コンテナの再描画
        for (var i = this._panelCollections.length; i--; ) {
            this._panelCollections[i].redraw();
        }
        if (this.processAfterRedraw instanceof Function)    // ユーザ定義の処理
            this.processAfterRedraw(this);

        if (this.minT != this._currentMinT || this.maxT != this._currentMaxT) {
            // イベント発火
            var newEv = new HuTime.Event("tmoved", this);
            this._handleEvent(newEv)
        }
        this._currentMinT = this.minT;
        this._currentMaxT = this.maxT;
    },
    processBeforeRedraw: null,      // ユーザによる描画処理など（オブジェクトの描画前）
    processAfterRedraw: null,       // ユーザによる描画処理など（オブジェクトの描画後）
    clear: function () {      // コンテナのクリア
        for (var i = this._panelCollections.length; i--; ) {
            this._panelCollections[i].clear();
        }
    },

    // **** イベント関係 ****
    _userEvents: null,  // ユーザイベントの情報を収容する配列
    addEventListener: function (type, handler, useCapture) {    // ユーザ定義イベントの追加
        if (type && handler)
            this._userEvents.push(new HuTime.UserEvent(type, handler, useCapture));
    },
    dispatchEvent: function(ev) {
        this._handleEvent(ev);
    },

    _handleInnerTouchEvent: function (ev) {
        if (!(ev.target.hutimeObject instanceof HuTime.ContainerBase))
            return;

        ev.target.hutimeObject._extractInnerTouchEvent(ev, ev.offsetX, ev.offsetY);
        this._handleEvent(ev);
    },
    _handleMouseEvent: function (domEv) {     // マウスイベントの処理
        // イベントの抽出とtypeを特定し、配列に収容
        var eventInfos;
        var newEv;          // 新たに発火させるための拡張されたのイベントオブジェクト

        eventInfos = domEv.target.hutimeObject._extractMouseEvent(domEv, domEv.offsetX, domEv.offsetY);
        for (var i = 0; i < eventInfos.length; ++i) {
            newEv = HuTime.MouseEvent.createFromDomEv(domEv, eventInfos[i].type, eventInfos[i].target);
            if (newEv._type == "mouseup" || newEv._type == "mouseout" || newEv._originalEvent.type == "mouseout")
                newEv._cancelable = false;  // 各種操作終了に関するイベントはキャンセル不可にする
            this._handleEvent(newEv);
        }
    },
    _handleEvent: function(ev) {
        if (ev._preventEvent)   // イベントが抑止された場合は終了
            return;

        var eventResult;    // イベントの結果を収容するブール値
        var i;

        // オブジェクトツリーに沿って、ハンドラの呼び出し先を配列化し、targetArrayに収容する
        ev._targetArray = [ev._target];
        while (!(ev._targetArray[0] === this) && ev._targetArray[0]._parent) {
            ev._targetArray.unshift(ev._targetArray[0]._parent);    // 先頭に上位のオブジェクトを追加していく
        }

        // ユーザイベント（Capture Phase）
        if(!ev._preventUserEvent) {
            for (i = this._userEvents.length; i--; ) {
                if (this._userEvents[i].type == ev._type && this._userEvents[i].userCapture) {
                    eventResult = this._userEvents[i].handler.apply(ev._target, [ev]);
                    if (eventResult != undefined && !eventResult) {
                        ev._preventUserEvent = true;
                        break;
                    }
                }
            }
        }

        // 子オブジェクト(PanelCollection)にイベントフローを渡す
        if (ev._targetArray.length > 1) {
            ev._targetArray.splice(0, 1);    // 呼び出し先一覧から自分自身を除く
            if (ev instanceof HuTime.MouseEvent)    // マウスイベントの場合
                ev._targetArray[0]._handleMouseEvent(ev, ev._offsetX, ev._offsetY);
            else if (ev instanceof HuTime.TouchEvent)
                ev._targetArray[0]._handleMouseEvent(ev, ev._offsetX, ev._offsetY);
            else                                    // その他のイベントの場合
                ev._targetArray[0]._handleEvent(ev);
            if (ev._preventEvent)   // イベントが抑止された場合は終了
                return;
        }

        // ユーザイベント（Bubbling Phase）
        if(!ev._preventUserEvent) {
            for (i = this._userEvents.length; i--;) {
                if (this._userEvents[i].type == ev._type && !this._userEvents[i].userCapture) {
                    eventResult = this._userEvents[i].handler.apply(ev._target, [ev]);
                    if (eventResult != undefined && !eventResult) {
                        ev._preventUserEvent = true;
                        break;
                    }
                }
            }
        }
    },

    _handleInnerEvent: function (ev) {     // 内部イベントの処理
        if (!(ev instanceof HuTime.InnerEvent))
            return;

        var oldMinT = this.minT;
        var oldMaxT = this.maxT;

        // イベントの結果変更される座標値をイベントオブジェクトから受け取りセットする
        if (ev.minT >= ev.maxT)
            return;     // 同値または逆転の場合、何もしない
        // 上限、下限を超えた場合は、そのまま（ここでは、上限値、下限値を設定することはしない）
        if (ev.minT >= this.minTLimit)
            this.minT = ev.minT;
        if (ev.maxT <= this.maxTLimit)
            this.maxT = ev.maxT;

        // 桁落ちする場合は、前の値に戻して何もしない（目盛のプロットが2～3ケタの精度があるので、余裕をみる）
        if ((oldMaxT - oldMinT > this.maxT - this.minT &&           // 範囲の拡大による桁落ち
            this.maxT.toPrecision(12) == this.minT.toPrecision(12))) {
            this.minT = oldMinT;
            this.maxT = oldMaxT;
            return;
        }

        // 各PanelCollectionのハンドラを呼び出す（Target Phase）
        for (var i = this._panelCollections.length; i--; ) {
            this._panelCollections[i]._handleInnerEvent(ev);
        }
    },

    mouseTimeOut: 300,      // タイマの設定値（ms）
    _mouseTimer: null,      // タイマ

    // **** touch イベント関係 ****
    isInTouchSeries: false,    // 一連のtouch処理中
    touchCount: 0,              // タッチの数

    // 1つ目のタッチ位置
    touchOneId: undefined,          // touch ID
    touchOneOriginX: undefined,     // 元のX座標
    touchOneOriginY: undefined,     // 元のY座標
    touchOneX: undefined,           // X座標
    touchOneY: undefined,           // Y座標

    // 2つ目のタッチ位置
    touchTwoId: undefined,
    touchTwoOriginX: undefined,
    touchTwoOriginY: undefined,
    touchTwoX: undefined,
    touchTwoY: undefined,

    // 距離
    touchDistanceOrigin: undefined,     // 元の距離
    touchDistance: undefined,           // 距離

    // タップ
    tapTimer: null,
    tapTime: 300,           // タップを判断する時間（touchstartからtouceendまで）
    tapCount: 0,            // タップの数（0 の場合はタイムアウト後などで無効）

    // タップ－クリック互換
    clickAfterTap: true,    // trueの場合、タップ後にクリックイベントを発火させる
    touchOneScreenX: undefined,     // クリックイベント（マウスイベント）に渡す座標値
    touchOneScreenY: undefined,
    touchOneClientX: undefined,
    touchOneClientY: undefined,

    // ピンチとスワイプ
    minPinchDistance: 1,    // ピンチ開始を判断する距離の変化
    isPinching: false,      // ピンチ操作中
    isSwiping: false,       // スワイプ操作中

    // ホールド（指の静止）
    holdTimer: null,        // ホールドを検出するためのタイマ
    holdTime: 800,          // ホールドを判断する時間（ms）
    tapArea: 1,             // tap時の移動許容量

    // タッチイベント処理
    _handleTouchEvent: function _handleTouchEvent(ev, obj) {
        var i;
        var mouseEv;
        if (ev.type == "touchstart") {
            this.touchCount = ev.touches.length;
            if (!this.isInTouchSeries) {   // 最初のtouch
                // 各座標の初期化
                this.touchOneId = ev.touches[0].identifier;
                this.touchOneX = ev.touches[0].pageX
                    - ev.target.getBoundingClientRect().left - window.pageXOffset;
                this.touchOneY = ev.touches[0].pageY
                    - ev.target.getBoundingClientRect().top - window.pageYOffset;
                this.touchOneOriginX = this.touchOneX;
                this.touchOneOriginY = this.touchOneY;

                this.touchOneScreenX = ev.touches[0].screenX;
                this.touchOneScreenY = ev.touches[0].screenY;
                this.touchOneClientX = ev.touches[0].clientX;
                this.touchOneClientY = ev.touches[0].clientY;

                this.touchTwoX = undefined;
                this.touchTwoY = undefined;
                this.touchTwoOriginX = undefined;
                this.touchTwoOriginY = undefined;

                this.isInTouchSeries = true;
                this._handleInnerTouchEvent(
                    HuTime.TouchEvent.createFromDomEv(ev, this, "touchinit", obj));

                // タップ処理の開始
                clearTimeout(this.tapTimer);
                this.tapCount = ev.touches.length;
                this.tapTimer = setTimeout(function () {
                    this.tapCount = 0;
                }.bind(this), this.tapTime);

                // 最初のホールドをセット
                this.holdTimer = setTimeout(function () {
                    switch (this.touchCount) {
                        case 1:
                            this._handleInnerTouchEvent(
                                HuTime.TouchEvent.createFromDomEv(ev, this, "tapholdone", obj));
                            break;

                        case 2:
                            this._handleInnerTouchEvent(
                                HuTime.TouchEvent.createFromDomEv(ev, this, "tapholdtwo", obj));
                            break;
                    }
                }.bind(this), this.holdTime);
            }

            // 2か所目以降の位置の処理
            if (this.touchTwoId == undefined && ev.touches.length >= 2) {
                for (i = 0; i < ev.touches.length; ++i) {
                    if (ev.touches[i].identifier == this.touchOneId)
                        continue;
                    this.touchTwoId = ev.touches[i].identifier;
                    this.touchTwoX = ev.touches[i].pageX
                        - ev.target.getBoundingClientRect().left - window.pageXOffset;
                    this.touchTwoY = ev.touches[i].pageY
                        - ev.target.getBoundingClientRect().top - window.pageYOffset;
                    this.touchTwoOriginX = this.touchTwoX;
                    this.touchTwoOriginY = this.touchTwoY;
                    break;
                }
            }
            if (this.tapCount) {      // タップ2か所目以降
                this.tapCount = ev.touches.length;
            }
        }
        else if (ev.type == "touchend") {
            this.touchCount = ev.touches.length;
            // 1st, 2nd touch が終了した場合
            var existFirst = false;
            var existSecond = false;
            for (i = 0; i < ev.touches.length; ++i) {
                existFirst |= ev.touches[i].identifier == this.touchOneId;
                existSecond |= ev.touches[i].identifier == this.touchTwoId;
            }
            if (!existFirst) {
                this.touchOneId = undefined;
                clearTimeout(this.holdTimer);
                if (this.isPinching) {
                    this.isPinching = false;
                    this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "pinchend", obj));
                }
                if (this.isSwiping) {
                    this.isSwiping = false;
                    this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "swipeend", obj));
                }
            }
            if (!existSecond) {
                this.touchTwoId = undefined;
                clearTimeout(this.holdTimer);
                if (this.isPinching) {
                    this.isPinching = false;
                    this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "pinchend", obj));
                }
            }

            if (ev.touches.length == 0) {   // シリーズの終了
                // タップの処理
                if (this.tapCount) {
                    switch (this.tapCount) {
                        case 1:
                            this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "tapone", obj));
                            break;

                        case 2:
                            this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "taptwo", obj));
                            break;
                    }
                    clearTimeout(this.tapTimer);
                    this.tapCount = 0;

                    // タップ－クリック互換
                    if (this.clickAfterTap) {
                        mouseEv = new MouseEvent("click", {
                            bubbles: true,
                            cancelable: true,
                            clientX: this.touchOneClientX,
                            clientY: this.touchOneClientY,
                            screenX: this.touchOneScreenX,
                            screenY: this.touchOneScreenY,
                            ctrlKey: ev.ctrlKey,
                            shiftKey: ev.shiftKey,
                            altKey: ev.altKey,
                            metaKey: ev.metaKey
                        });
                        ev.target.dispatchEvent(mouseEv);
                    }
                }

                // 終了処理
                clearTimeout(this.holdTimer);
                this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "touchfinish", obj));
                this.isInTouchSeries = false;
            }
        }
        else if (ev.type == "touchmove") {
            // touch位置および距離を更新
            for (i = 0; i < ev.touches.length; ++i) {
                if (ev.touches[i].identifier == this.touchOneId) {
                    this.touchOneOriginX = this.touchOneX;
                    this.touchOneOriginY = this.touchOneY;
                    this.touchOneX = ev.touches[i].pageX
                        - ev.target.getBoundingClientRect().left - window.pageXOffset;
                    this.touchOneY = ev.touches[i].pageY
                        - ev.target.getBoundingClientRect().top - window.pageYOffset;
                }
                if (ev.touches[i].identifier == this.touchTwoId) {
                    this.touchTwoOriginX = this.touchTwoX;
                    this.touchTwoOriginY = this.touchTwoY;
                    this.touchTwoX = ev.touches[i].pageX
                        - ev.target.getBoundingClientRect().left - window.pageXOffset;
                    this.touchTwoY = ev.touches[i].pageY
                        - ev.target.getBoundingClientRect().top - window.pageYOffset;
                }
            }
            this.touchDistanceOrigin = this.touchDistance;
            this.touchDistance = Math.sqrt(
                Math.pow((this.touchOneX - this.touchTwoX), 2) + Math.pow((this.touchOneY - this.touchTwoY), 2));

            // 実質的なtouch位置の移動をチェック
            if (this.touchOneId != undefined &&
                (Math.abs(this.touchOneX - this.touchOneOriginX) > this.tapArea ||
                Math.abs(this.touchOneY - this.touchOneOriginY) > this.tapArea ||
                Math.abs(this.touchTwoX - this.touchTwoOriginX) > this.tapArea ||
                Math.abs(this.touchTwoY - this.touchTwoOriginY) > this.tapArea)) {

                // 動いた場合、tapは無効
                if (this.tapCount) {
                    this.tapCount = 0;
                    clearTimeout(this.tapTimer);
                }

                // ピンチの処理
                if (!this.isPinching && this.touchTwoId != undefined &&
                    Math.abs(this.touchDistance - this.touchDistanceOrigin) > this.minPinchDistance) {
                    if (this.isSwiping) {   // スワイプからピンチに移行した場合
                        clearTimeout(this.holdTimer);
                        this.isSwiping = false;
                        this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "swipeend", obj));
                    }
                    this.isPinching = true;  // 距離に一定以上の変化があれば、ピンチを開始
                    this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "pinchstart", obj));
                }
                if (this.isPinching) {
                    clearTimeout(this.holdTimer);
                    this.holdTimer = setTimeout(function () {   // 一定時間はピンチ中として扱う
                        this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "pinchend", obj));
                        this.isPinching = false;
                        switch (this.touchCount) {
                            case 1:
                                this._handleInnerTouchEvent(
                                    HuTime.TouchEvent.createFromDomEv(ev, this, "tapholdone", obj));
                                break;

                            case 2:
                                this._handleInnerTouchEvent(
                                    HuTime.TouchEvent.createFromDomEv(ev, this, "tapholdtwo", obj));
                                break;
                        }
                    }.bind(this), this.holdTime);
                    this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "pinch", obj));
                }

                // スワイプの処理
                if (!this.isSwiping && !this.isPinching) {
                    this.isSwiping = true;
                    this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "swipestart", obj));
                }
                if (this.isSwiping) {
                    clearTimeout(this.holdTimer);
                    this.holdTimer = setTimeout(function () {   // 一定時間はスワイプ中として扱う
                        this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "swipeend", obj));
                        this.isSwiping = false;
                        switch (this.touchCount) {
                            case 1:
                                this._handleInnerTouchEvent(
                                    HuTime.TouchEvent.createFromDomEv(ev, this, "tapholdone", obj));
                                break;

                            case 2:
                                this._handleInnerTouchEvent(
                                    HuTime.TouchEvent.createFromDomEv(ev, this, "tapholdtwo", obj));
                                break;
                        }
                    }.bind(this), this.holdTime);
                    this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "swipe", obj));
                }
            }
        }

        else if (ev.type == "touchcancel") {
            this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "touchcancel", obj));

            // 終了処理
            clearTimeout(this.holdTimer);
            if (this.isSwiping) {
                this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "swipeend", obj));
                this.isSwiping = false;
            }
            if (this.isPinching) {
                this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "pinchend", obj));
                this.isPinching = false;
            }
            this.touchOneId = undefined;
            this.touchTwoId = undefined;
            this._handleInnerTouchEvent(HuTime.TouchEvent.createFromDomEv(ev, this, "touchfinish", obj));
            this.isInTouchSeries = false;

        }
    }
};

// JSON関係
HuTime.JSON = {
    // シリアライズ
    stringify: function stringify (obj) {
        return JSON.stringify(obj);
    },

    // デシリアライズ
    parse: function parse (json) {
        var obj;
        if (typeof json === "string")
            json = JSON.parse(json);

        /*
        if (json instanceof Array) {
            obj = [];
            for (var i = 0; i < json.length; ++i) {
                obj.push(HuTime.JSON.parse(json[i]));
            }
            return obj;
        }
        // */

        if (!json.constructor)
            return json;

        var constructor = eval("HuTime." + json.constructor);
        if (constructor == undefined)
            return json;

        obj = new constructor();
        obj.parseJSON(json);
        return obj;

        /*
        switch (json.constructor) {
            // HuTime.ContainerBase
            case "TilePanel":
                return HuTime.TilePanel.createFromJSON(json);

            case "Layer":
                return HuTime.Layer.createFromJSON(json);

            case "LineChartLayer":
                return HuTime.LineChartLayer.createFromJSON(json);

            case "PlotChartLayer":
                return HuTime.PlotChartLayer.createFromJSON(json);

            case "BarChartLayer":
                return HuTime.BarChartLayer.createFromJSON(json);

            case "TLineLayer":
                return HuTime.TLineLayer.createFromJSON(json);

            case "CalendarScaleLayer":
                return HuTime.CalendarScaleLayer.createFromJSON(json);

            case "TickScaleLayer":
                return HuTime.TickScaleLayer.createFromJSON(json);

            // HuTime.StreamBase
            case "FileStream":
                return HuTime.FileStream.createFromJSON(json);

            case "HttpStream":
                return HuTime.HttpStream.createFromJSON(json);
                
            // HuTime.StreamReaderBase
            case "TextReader":
                return HuTime.TextReader.createFromJSON(json);

            case "CsvReader":
                return HuTime.CsvReader.createFromJSON(json);

            case "TsvReader":
                return HuTime.TsvReader.createFromJSON(json);

            // HuTime.RecordSettingBase
            case "RecordDataSetting":
                return HuTime.RecordDataSetting.createFromJSON(json);

            case "RecordTSetting":
                return HuTime.RecordTSetting.createFromJSON(json);

            case "RecordTCalendarSetting":
                return HuTime.RecordTCalendarSetting.createFromJSON(json);

            // HuTime.RecordSettings
            case "RecordSettings":
                return HuTime.RecordSettings.createFromJSON(json);

            // HuTime.RecordsetBase
            case "ChartRecordset":
                return HuTime.ChartRecordset.createFromJSON(json);

            case "CalendarChartRecordset":
                return HuTime.CalendarChartRecordset.createFromJSON(json);

            case "TLineRecordset":
                return HuTime.TLineRecordset.createFromJSON(json);

            case "CalendarTLineRecordset":
                return HuTime.CalendarTLineRecordset.createFromJSON(json);

            // HuTime.ScalePosition
            case "ScalePosition":
                return HuTime.ScalePosition.createFromJSON(json);

            // HuTime.ScaleStyleBase
            case "ScaleStyleBase":
                return HuTime.ScaleStyleBase.createFromJSON(json);

            // HuTime.PositionBase
            case "TVPosition":
                return HuTime.TVPosition.createFromJSON(json);

            case "XYPosition":
                return HuTime.XYPosition.createFromJSON(json);

            case "RelativeTVPosition":
                return HuTime.RelativeTVPosition.createFromJSON(json);

            case "RelativeXYPosition":
                return HuTime.RelativeXYPosition.createFromJSON(json);

            case "PositionFloor":
                return HuTime.PositionFloor.createFromJSON(json);

            case "PositionCeil":
                return HuTime.PositionCeil.createFromJSON(json);

            case "PositionRound":
                return HuTime.PositionRound.createFromJSON(json);

            // HuTime.OnLayerObjectBase
            case "Line":
                return HuTime.Line.createFromJSON(json);

            case "Polygon":
                return HuTime.Polygon.createFromJSON(json);

            case "Square":
                return HuTime.Square.createFromJSON(json);

            case "Rect":
                return HuTime.Rect.createFromJSON(json);

            case "Circle":
                return HuTime.Circle.createFromJSON(json);

            case "Arc":
                return HuTime.Arc.createFromJSON(json);

            case "Pie":
                return HuTime.Pie.createFromJSON(json);

            case "Triangle":
                return HuTime.Triangle.createFromJSON(json);

            case "Image":
                return HuTime.Image.createFromJSON(json);

            case "String":
                return HuTime.String.createFromJSON(json);

            // HuTime.Style
            case "FigureStyle":
                return HuTime.FigureStyle.createFromJSON(json);

            case "StringStyle":
                return HuTime.StringStyle.createFromJSON(json);

            default:
                return JSON.parse(json);
        }
        // */
    },

    // シリアライズデータの保存
    save: function save (obj) {

    },

    // シリアライズデータの読み込み
    load: function load (source) {

    }
};
