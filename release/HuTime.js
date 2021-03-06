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





// ブラウザ判定
HuTime.userAgent = function () {
    var userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.indexOf("opera") != -1) {
        return "opera";
    } else if (userAgent.indexOf("msie") != -1) {
        return "ie";
    } else if (userAgent.indexOf("chrome") != -1) {
        return "chrome";
    } else if (userAgent.indexOf("safari") != -1) {
        return "safari";
    } else if (userAgent.indexOf("firefox") != -1) {
        return "firefox";
    } else {
        return "other";
    }
};

// **** イベント処理 ****
// ** ユーザイベント収容クラス **
HuTime.UserEvent = function (type, handler, useCapture) {  // ユーザイベントの情報を収容する
    this.type = type;
    this.handler = handler;
    if (useCapture)
        this.userCapture = useCapture;
};
HuTime.UserEvent.prototype = {
    constructor: HuTime.UserEvent,
    type: null,
    handler: null,
    userCapture: false
};

// ** マウスイベント抽出用クラス **
HuTime.EventInfo = function (type, target, x, y) {      // イベントの抽出で渡される情報
    this.type = type;
    this.target = target;
    this.x = x;
    this.y = y;
};
HuTime.EventInfo.prototype = {
    constructor: HuTime.EventInfo,
    type: null,
    target: null,
    x: Number.NaN,
    y: Number.NaN
};

// ** イベントクラス **
HuTime.Event = function (type, target) {     // 各種イベントの基底クラス
    this._type = type;
    this._target = target;
    this._targetArray = [];
};
HuTime.Event.prototype = {
    constructor: HuTime.Event,

    _type: null,
    get type() {
        return this._type;
    },
    _target: null,
    get target() {
        return this._target;
    },
    _relatedTarget: {
        writable: true,
        value: null
    },
    relatedTarget: {
        get: function () {
            return this._relatedTarget;
        }
    },
    _targetArray: null,     // ツリーに沿って呼び出すハンドラの配列（内部参照のみなので、getterは無し）
    _cancelable: true,
    get cancelable() {
        return this._cancelable;
    },
    _bubbles: true,
    get bubbles() {
        return this._bubbles;
    },
    _view: null,
    get view() {
        return this._view;
    },
    _detail: null,
    get detail() {
        return this._detail;
    },

    _preventUserEvent: false,   // ユーザイベントの抑止
    _preventEvent: false,       // 全てのイベントの抑止
    _originalEvent: null,       // 元のDOMイベント
    get originalEvent() {
        return this._originalEvent;
    },

    preventDefault: function () {    // 全てのイベント処理を中止
        if (this.cancelable)
            this._preventEvent = true;
    }
};

// ** マウスイベント **
HuTime.MouseEvent = function (type, target) {    // マウスイベントクラス
    HuTime.Event.apply(this, arguments);
};
HuTime.MouseEvent.prototype = Object.create(HuTime.Event.prototype, {
    constructor: {
        value: HuTime.MouseEvent
    },

    // 座標関係
    _screenX: {
        writable: true,
        value: 0
    },
    screenX: {
        get: function () {
            return this._screenX;
        }
    },
    _screenY: {
        writable: true,
        value: 0
    },
    screenY: {
        get: function () {
            return this._screenY;
        }
    },
    _clientX: {
        writable: true,
        value: 0
    },
    clientX: {
        get: function () {
            return this._clientX;
        }
    },
    _clientY: {
        writable: true,
        value: 0
    },
    clientY: {
        get: function () {
            return this._clientY;
        }
    },
    _offsetX: {
        writable: true,
        value: 0
    },
    offsetX: {
        get: function () {
            return this._offsetX;
        }
    },
    _offsetY: {
        writable: true,
        value: 0
    },
    offsetY: {
        get: function () {
            return this._offsetY;
        }
    },

    // キー操作関係
    _ctrlKey: {
        writable: true,
        value: false
    },
    ctrlKey: {
        get: function () {
            return this._ctrlKey;
        }
    },
    _shiftKey: {
        writable: true,
        value: false
    },
    shiftKey: {
        get: function () {
            return this._shiftKey;
        }
    },
    _altKey: {
        writable: true,
        value: false
    },
    altKey: {
        get: function () {
            return this._altKey;
        }
    },
    _metaKey: {
        writable: true,
        value: false
    },
    metaKey: {
        get: function () {
            return this._metaKey;
        }
    },

    // ボタン関係
    _button: {
        writable: true,
        value: 0
    },
    button: {
        get: function () {
            return this._button;
        }
    },
    _buttons: {
        writable: true,
        value: 0
    },
    buttons: {
        get: function () {
            return this._buttons;
        }
    },
    _deltaY: {
        writable: true,
        value: 0
    },
    deltaY: {
        get: function () {
            return this._deltaY;
        }
    }
});
HuTime.MouseEvent.createFromDomEv = function (domEv, type, hutimeTarget) {   // マウスイベントを基にして生成
    if (!domEv)
        return null;

    if (!type)
        type = domEv.type;     // イベントタイプの指定が無い場合はevのものを継承

    var newEv = new HuTime.MouseEvent(type, hutimeTarget, domEv._targetArray);
    newEv._originalEvent = domEv;
    newEv._bubbles = domEv.bubbles;
    newEv._cancelable = domEv.cancelable;
    newEv._view = window;
    newEv._detail = domEv.data;

    newEv._screenX = domEv.screenX;
    newEv._screenY = domEv.screenY;
    newEv._clientX = domEv.clientX;
    newEv._clientY = domEv.clientY;
    newEv._offsetX = domEv.offsetX;
    newEv._offsetY = domEv.offsetY;

    newEv._ctrlKey = domEv.ctrlKey;
    newEv._shiftKey = domEv.shiftKey;
    newEv._altKey = domEv.altKey;
    newEv._metaKey = domEv.metaKey;

    newEv._button = domEv.button;
    newEv._buttons = domEv.buttons;
    newEv._deltaY = domEv.deltaY;

    newEv._relatedTarget = domEv.relatedTarget;

    return newEv;
};

// ** タッチイベント **
HuTime.TouchEvent = function (handleObj, type, target) {
    HuTime.Event.call(this, type, target);
    this._handleObject = handleObj;
};
HuTime.TouchEvent.prototype = Object.create(HuTime.Event.prototype, {
    constructor: {
        value: HuTime.TouchEvent
    },

    _handleObject: {        // タッチイベントを処理したオブジェクト（関連情報が格納されている）
        writable: true,
        value: null
    },
    handleObject:{
        get: function (){
            return this._handleObject;
        }
    },

    // 座標関係
    offsetX: {
        get: function (){
            return this._handleObject.touchOneX;
        }
    },
    offsetY: {
        get: function (){
            return this._handleObject.touchOneY;
        }
    },
    _offsetX: {
        get: function (){
            return this._handleObject.touchOneX;
        }
    },
    _offsetY: {
        get: function (){
            return this._handleObject.touchOneY;
        }
    },
    touchOneX: {
        get: function (){
            return this._handleObject.touchOneX;
        }
    },
    touchOneY: {
        get: function (){
            return this._handleObject.touchOneY;
        }
    },
    touchOneOriginX: {
        get: function (){
            return this._handleObject.touchOneOriginX;
        }
    },
    touchOneOriginY: {
        get: function (){
            return this._handleObject.touchOneOriginY;
        }
    },
    touchTwoX: {
        get: function (){
            return this._handleObject.touchTwoX;
        }
    },
    touchTwoY: {
        get: function (){
            return this._handleObject.touchTwoY;
        }
    },
    touchTwoOriginX: {
        get: function (){
            return this._handleObject.touchTwoOriginX;
        }
    },
    touchTwoOriginY: {
        get: function (){
            return this._handleObject.touchTwoOriginY;
        }
    },
    touchDistance: {
        get: function (){
            return this._handleObject.touchDistance;
        }
    },
    touchDistanceOrigin: {
        get: function (){
            return this._handleObject.touchDistanceOrigin;
        }
    }
});
HuTime.TouchEvent.createFromDomEv = function (domEv, handleObj, type, hutimeTarget) {
    var ev = new HuTime.TouchEvent(handleObj, type, hutimeTarget);
    ev._originalEvent = domEv;
    return ev;
};


// **** 内部イベント ****
HuTime.InnerEvent = function (type, target) {
    if (!type || !target)
        return;
    this.type = type;
    this.target = target;
};
HuTime.InnerEvent.prototype = {
    constructor: HuTime.InnerEvent,
    type: null,
    target: null,
    minT: 0,
    maxT: 200
};
HuTime.InnerEvent.createWithT = function (type, target, minT, maxT) {    // 内部イベントの生成
    var ev = new HuTime.InnerEvent(type, target);
    if (isFinite(minT) && minT != null)
        ev.minT = minT;
    if (isFinite(maxT) && maxT != null)
        ev.maxT = maxT;
    return ev;
};

// ******** ポップアップウィンドウ ********
HuTime.Popup = function (content) {
    if (content)
        this.content = content;
    this._element = document.createElement("div");
    this._element.style.width = "600px";
    this._element.style.fontWeight = 700;
    this._element.style.position = "absolute";
    this._element.style.backgroundColor = "#ffffff";
    this._element.style.border = "solid 1px #000000";
    this._element.style.borderRadius = "10px";
    this._element.style.padding = "5px";
    this._element.style.top = "200px";
    this._element.style.left = (window.innerWidth / 2 - 300).toString() + "px";
    this._element.style.zIndex = 10000;

    var close = function (obj) {
        obj._element.addEventListener("click", function () {
            obj.close(obj);
        });
    }(this);
};
HuTime.Popup.prototype = {
    constructor: HuTime.Popup,
    content: "",
    _element: null,         // popupを表示するためのdiv要素
    get element() {
        return this._element;
    },

    show: function () {      // popupの表示
        this._element.innerHTML = this.content;
        document.body.appendChild(this._element);
    },
    close: function (obj) {  // popupを閉じる
        if (!obj)
            obj = this;
        document.body.removeChild(obj._element);
    }
};

// ******** 各種定数 ********
HuTime.EventCapture = {     // イベントをキャプチャする範囲を指定するための定数
    None: 0,
    WithoutChild: 1,
    Child: 2,
    All: 3
};
Object.freeze(HuTime.EventCapture); // EventCaptureを変更不可にする

HuTime.DisplayMode = {  // t軸の表示方向
    tLeftToRight: 0,
    tRightToLeft: 1,
    tTopToBottom: 2,
    tBottomToTop: 3
};
Object.freeze(HuTime.DisplayMode);

HuTime.VBreadthMode = { // ｖBreadthの決定方法
    fixed: 0,
    fitToParent: 1,
    fitToPanels: 2
};
Object.freeze(HuTime.VBreadthMode);

HuTime.TLengthMode = { // ｖLengthの決定方法
    fixedValue: 0,
    fitToParent: 1
};
Object.freeze(HuTime.TLengthMode);

HuTime.VMarginForX = {
    topForLeft: 0,      // vMarginTopに設定された値が左余白に適用される（）
    bottomForLeft: 1    // vMarginBottomに設定された値が左余白に適用される
};
Object.freeze(HuTime.VMarginForX);

HuTime.VForX = {
    topForLeft: 0,      // vTopに設定された値が左端の値に適用される
    bottomForLeft: 1    // vBottomに設定された値が左端の値に適用される
};
Object.freeze(HuTime.VForX);


// **** ユリウス通日－ユリウス・グレゴリオ暦変換
HuTime.jdToTime = function (jd, type) {   // jdから年月日を取得
    if (!type)
        type = 0;
    var time = {};   // 結果用の時刻を表すオブジェクト
    var rjd = Math.floor(jd + 0.5) - 0.5;    // ユリウス通日の日部分
    var aa, a, b, c, e, k, z;     // 計算途上の値
    var y, m, d;

    // ユリウス暦/グレゴリオ暦の違いによる処理
    z = Math.floor(rjd + 0.5);
    //if (this._getCalendar(jd) == 0) {   // グレゴリオ暦
    if (HuTime._getJGCalendarType(jd, type) == 0) {   // グレゴリオ暦
        aa = Math.floor((z - 1867216.25) / 36524.25);
        a = z + 1 + aa - Math.floor(aa / 4);
    }
    else {   // ユリウス暦
        a = z;
    }

    // 計算用の変数へ値を設定
    b = a + 1524;
    c = Math.floor((b - 122.1) / 365.25);
    k = Math.floor(365.25 * c);
    e = Math.floor((b - k) / 30.6001);

    d = b - k - Math.floor(30.6001 * e);    // 日の取得
    if (e < 13.5)       // 月の取得
        m = e - 1.0;
    else
        m = e - 13.0;
    if (m > 2.5)        // 年の取得
        y = c - 4716.0;
    else
        y = c - 4715.0;

    time.year = y;
    time.month = m;
    time.day = d;

    // 桁落ちするので、可能な限り大きな整数にして計算する（6ケタまでで調整）
    var order = Math.pow(10, (10 - Math.floor(Math.abs(jd)).toString().length));
    order = order < 1 ? 1 : order;
    order = order > 1000000 ? 1000000 : order;
    var second = Math.ceil(((jd % 1.0) * 86400 * order + 43200 * order) % (86400 * order));
    time.hour = Math.floor(second / (3600 * order));
    second -= time.hour * 3600 * order;
    time.minute = Math.floor(second / (60 * order));
    second -= time.minute * 60 * order;
    time.second = second / order;

    return time;
};

HuTime.timeToJd = function (year, month, day, hour, minute, second, type) {   // 年月日からjdを取得
    if (!isFinite(year))
        return null;
    if (!month || month < 0 || month > 12)
        month = 1;
    if (!day || day < 0 || day > 31)
        day = 1;
    if (!hour || hour < 0 || hour > 24)
        hour = 0;
    if (!minute || minute < 0 || minute > 60)
        minute = 0;
    if (!second || second < 0 || second > 60)
        second = 0;
    if (type < 0 || type > 2)
        type = 0;
    var y, m, a, b, c, d;

    // 3～14月への処理
    if (month <= 2) {
        y = year - 1;
        m = month + 12;
    }
    else {
        y = year;
        m = month;
    }

    // a, b の計算（ユリウス暦・グレゴリオ暦で別）
    var startOfGregorianDay = HuTime._getGregorianSatrtDay(type);
    if ((year > startOfGregorianDay.year) ||
        (year == startOfGregorianDay.year && month > startOfGregorianDay.month) ||
        (year == startOfGregorianDay.year && month == startOfGregorianDay.month && day >= startOfGregorianDay.day)) {

        // グレゴリオ暦
        a = Math.floor(y / 100.0);
        b = 2.0 - a + Math.floor(a / 4.0);
    }
    else {
        // ユリウス暦
        b = 0.0;
    }

    // c, d の計算
    c = Math.floor(365.25 * y);
    d = second / 86400.0 + minute / 1440.0 + hour / 24.0 + day;

    return 1720994.5 + Math.floor(30.6001 * (m + 1.0)) + b + c + d;
};

// 改暦タイプ（Gregorian -> Julian） (type 0:Proleptic Gregorian 1:ROMA, 2:LONDON)
// 改暦タイプから、改暦年月日を返す
HuTime._getGregorianSatrtDay = function _getGregorianStartDay(type) {
    switch (type) {
        case 1:     // Roma
            return {
                year: 1582,
                month: 10,
                day: 15
            };

        case 2:     // London
            return {
                year: 1752,
                month: 9,
                day: 14
            };

        default:    // Proleptic
            return {
                year: Number.NEGATIVE_INFINITY,
                month: 1,
                day: 1
            };
    }
};
// jdから暦の種類を返す（0: グレゴリオ暦, 1: ユリウス暦）
HuTime._getJGCalendarType = function _getJGCalendarType(jd, type) {
    if (type == 0)
        return 0;
    if (type == 1 && jd >= 2299160.5)
        return 0;
    if (type == 2 && jd >= 2361221.5)
        return 0;
    return 1;
};
// 改暦タイプの定数
HuTime.JGCalendarType = {
    Proleptic: 0,
    Roma: 1,
    London: 2
};
Object.freeze(HuTime.JGCalendarType);

// ISO8601表記からJDを得る
HuTime.isoToJd = function isoToJd(iso, type) {
    return HuTime.isoToJdRange(iso, type)[0];
};

// ISO8601表記からJDでの時間範囲を得る
HuTime.isoToJdRange = function isoToJdRange(iso, type) {
    var blocks = iso.toString().trim().split(["T"]);
    if (blocks[0].length == 0)
        return [Number.NaN, Number.NaN];
    var date = blocks[0].trim();
    if (blocks.length >= 2)
        var time = blocks[1].trim();
    var year, month, day, hour, minute, second;
    var yearSign = 1;
    var bJd, eJd;

    if (date[0] == "-") {   // 負の年が入った場合
        yearSign = -1;
        date = date.substring(1);
    }

    var ymd = date.split(["-"]);
    if (ymd.length >= 1 && isFinite(ymd[0]))
        year = yearSign * parseInt(ymd[0]);
    if (ymd.length >= 2 && isFinite(ymd[1]))
        month = parseInt(ymd[1]);
    if (ymd.length >= 3 && isFinite(ymd[2]))
        day = parseInt(ymd[2]);

    if (time && isFinite(year) && month && day) {   // 時刻あり
        var hms = time.split([":"]);
        if (hms.length >= 1 && isFinite(hms[0]))
            hour = parseInt(hms[0]);
        if (hms.length >= 2 && isFinite(hms[1]))
            minute = parseInt(hms[1]);
        if (hms.length >= 3 && isFinite(hms[2]))
            second = parseFloat(hms[2]);

        if (hour >= 0 && hour < 60) {
            if (minute >= 0 && minute < 60) {
                if (second >= 0 && second < 60) {      // 秒まで
                    bJd = HuTime.timeToJd(year, month, day, hour, minute, second, type);
                    eJd = bJd + 1 / 86400;
                }
                else {                  // 分まで
                    bJd = HuTime.timeToJd(year, month, day, hour, minute, 0, type);
                    eJd = bJd + 1 / 1440;
                }
            }
            else {                      // 時まで
                bJd = HuTime.timeToJd(year, month, day, hour, 0, 0, type);
                eJd = bJd + 1 / 24;
            }
        }
        else {                          // 日まで
            bJd = HuTime.timeToJd(year, month, day, 0, 0, 0, type);
            eJd = bJd + 1;
        }
    }
    else {      // 日付まで
        if (isFinite(year)) {
            if (month) {
                if (day) {  // 日まで
                    bJd = HuTime.timeToJd(year, month, day, 0, 0, 0, type);
                    eJd = bJd + 1;
                }
                else {      // 月まで
                    bJd = HuTime.timeToJd(year, month, 1, 0, 0, 0, type);
                    eJd = HuTime.timeToJd(month == 12 ? year + 1 : year, month == 12 ? 1 : month + 1, 1, 0, 0, 0, type);
                }
            }
            else {          // 年まで
                bJd = HuTime.timeToJd(year, 1, 1, 0, 0, 0, type);
                eJd = HuTime.timeToJd(year + 1, 1, 1, 0, 0, 0, type);
            }
        }
        else {
            bJd = Number.NaN;
            eJd = Number.NaN;
        }
    }
    return [bJd, eJd];
};

// 改行コードのチェック（引用符を考慮）
HuTime.checkNewLineCode =  function checkNewLineCode (text) {
    var pos = 0;        // 現在の探索開始位置
    var posNLCode;      // 改行コードの位置
    var posQuotation;   // 引用符の位置
    var NLCodes = [ "\r\n", "\r", "\n"];
    var NLCode;
    var countQuotation;

    while (pos < text.length) {
        for (var i = 0; i < NLCodes.length; ++i) {  // 改行コードを探索
            posNLCode = text.indexOf(NLCodes[i], pos);
            if (posNLCode >= 0) {
                NLCode = NLCodes[i];
                break;
            }
        }
        if (i >= NLCodes.length)    // 改行コードが見つからない場合
            return null;

        countQuotation = 0;
        posQuotation = pos;
        while (posQuotation < posNLCode) {
            posQuotation = text.indexOf("\"", posQuotation);
            if (posQuotation > posNLCode || posQuotation < 0)
                break;

            // 引用符内のエスケープされた引用符'""'は、結局、偶数個になるのでチェックしない
            ++countQuotation;
            ++posQuotation;
        }
        if (countQuotation % 2 == 0)
            return NLCode;   // 見つかった改行コードは引用符外

        // 見つかった改行コードは引用符内（引用の末端を探し、次の改行を探索）
        pos = posNLCode + NLCode.length;
        while (pos < text.length) {
            pos = text.indexOf("\"", pos);
             if (pos == text.length || text.substr(pos, 2) != "\"\"")    // 引用内のエスケープされた引用符'""'では無い
                break;
            pos += 2;
        }
        pos += NLCode.length;
    }
    return null;
};

// JSON関係
HuTime.JSON = {
    // シリアライズとデシリアライズ
    stringify: function stringify (obj) {
        if (typeof obj === "undefined")     // undefined
            return undefined;
        if (obj == null)                    // null
            return null;
        if (typeof obj === "function")      // function
            return obj.toString();

        var objForJSON; // 出力結果の収容用（JSONに変換するための整形済みオブジェクト）
        var propObj;    // 再帰によるHuTime.JSON.stringigyの結果収容用
        var prop;       // 処理対象のプロパティ名
        if (obj instanceof Array) {         // Array
            objForJSON = [];
            for (var i = 0; i < obj.length; ++i) {
                propObj = HuTime.JSON.stringify(obj[i]);
                if (typeof propObj !== "undefined")
                    objForJSON.push(propObj);
            }
            return objForJSON;
        }
        if (typeof obj === "object") {      // object（Arrayを含む）
            objForJSON = {};
            if ("_toJSONProperties" in obj) {   // JSONへの変換テーブルあり -> HuTime関係のオブジェクト
                objForJSON["constructor"] = obj.constructor.name;     // デシリアライズ用にconstructorの名前を保存
                for (prop in obj) {
                    switch (prop) {     // 各クラスに共通の読み飛ばすプロパティ
                        case "constructor":
                        case "_toJSONProperties":
                        case "_parseJSONProperties":
                        case "toJSON":
                            continue;
                    }

                    if (prop in obj._toJSONProperties) {     // JSONへの変換定義がある場合
                        if (obj._toJSONProperties[prop] == null)          // 出力指定がnullの場合は出力しない
                            continue;
                        if (typeof obj._toJSONProperties[prop] === "string") {    // 出力名が指定されている場合
                            if (obj[prop] == obj.__proto__[prop])   // 既定値と同じ場合は出力しない
                                continue;

                            propObj = HuTime.JSON.stringify(obj[prop]);
                            if (typeof propObj !== "undefined")
                                objForJSON[obj._toJSONProperties[prop]] = propObj;
                        }
                        else if (typeof obj._toJSONProperties[prop] === "function") {     // 出力関数が指定されている場合
                            obj._toJSONProperties[prop].apply(obj, [objForJSON]);
                        }
                    }
                    else {  // JSONへの変換定義が無い場合
                        if (prop in obj.__proto__)
                            continue;     // プロトタイプで定義されているのにJSONへの変換定義なし －＞ 出力しない
                        objForJSON[prop] = obj[prop];     // プロトタイプで定義されていない　－＞ ユーザ定義のプロパティ
                    }
                }
            }
            else {          // HuTime関係以外のオブジェクト
                for (prop in obj) {
                    objForJSON[prop] = HuTime.JSON.stringify(obj[prop]);
                }
            }
            return objForJSON;
        }
        return obj;     // 数値、文字列など
    },
    parse: function parse (json) {
        var objRaw;         // パースしただけの生のオブジェクト
        var obj;            // 結果（出力するオブジェクト）
        var prop;           // 処理対象のプロパティ名
        if (typeof json === "string") {
            try {           // jsonをいったん標準的な方法でparseseする
                var p = JSON.parse(json);
                objRaw = p;
            }
            catch (e) {     // JSONとしてパースできない（JSONでない生の値 -> そのまま）
                objRaw = json;
            }
        }
        else {
            objRaw = json;
        }

        if (typeof objRaw === "undefined")
            return undefined;
        if (objRaw == null)                   // null
            return null;
        if (objRaw instanceof Array) {        // Array
            obj = [];
            for (var i = 0; i < objRaw.length; ++i) {
                obj.push(HuTime.JSON.parse(objRaw[i]));
            }
            return obj;
        }
        if (typeof objRaw === "object") {     // オブジェクト一般
            // オブジェクトの生成
            if (typeof objRaw.constructor === "string") {     // HuTime関係のオブジェクト
                var constructor = eval("HuTime." + objRaw.constructor);
                if (constructor == undefined)
                    obj = {};   // コンストラクタの取得失敗
                else
                    obj = new constructor();
            }
            else {      // HuTime関係以外のオブジェクト
                obj = {};
            }

            // 各プロパティのデシリアライズ
            if ("_parseJSONProperties" in obj) {    // 出力指定がある場合（HuTime関係のオブジェクト）
                for (prop in objRaw) {
                    switch (prop) {             // 各クラスに共通の読み飛ばすプロパティ
                        case "constructor":
                            continue;
                    }

                    if (prop in obj._parseJSONProperties) {     // 出力指定がある場合
                        if (obj._parseJSONProperties[prop] == null)   // 出力指定がnullの場合は出力しない
                            continue;
                        if (typeof obj._parseJSONProperties[prop] === "string") {     // 出力方法が文字列指定
                            obj[obj._parseJSONProperties[prop]] = HuTime.JSON.parse(objRaw[prop]);
                        }
                        else if (typeof obj._parseJSONProperties[prop] === "function") {  // 出力方法が関数指定
                            obj._parseJSONProperties[prop].apply(obj, [objRaw]);
                        }
                    }
                    else {      // 出力指定が無い場合は、プロパティ名をそのまま利用
                        obj[prop] = HuTime.JSON.parse(objRaw[prop]);
                    }
                }
            }
            else {      // 出力指定が無い場合（HuTime関係以外のオブジェクト）
                for (var prop in objRaw) {
                    obj[prop] = HuTime.JSON.parse(objRaw[prop]);
                }
            }

            return obj;
        }
        if (typeof objRaw === "string" && objRaw.substr(0, 8) == "function")    // function
            return eval("(" + objRaw + ")");
        return objRaw;        // その他（数値、文字列など）
    },

    // シリアライズデータの保存と取得
    save: function save (obj) {
        var content =  JSON.stringify(obj);
        var blob = new Blob([ content ], { "type" : "application/json" });
        var elm = document.createElement("a");  // a要素を作って、一時的にbody要素直下に置く
        document.body.appendChild(elm);
        elm.href = window.URL.createObjectURL(blob);
        elm.download="data.json";
        elm.click();
        document.body.removeChild(elm);
    },
    load: function load (source, handler, id, pass) {     // ソースと取得後の処理関数を設定
        var reader = new HuTime.JSON.Reader(source);
        if (typeof handler === "function")
            reader.onloadend = handler;
        if (id && id.length > 0 && pass && pass.length > 0) {
            reader._stream.authorization = true;
            reader._stream.id = id;
            reader._stream.pass = pass;
        }
        reader.load();
        return reader;
    }
};

// JSONデータを読み込むためのリーダ
HuTime.JSON.Reader = function Reader (source) {
    this.source = source;
};
HuTime.JSON.Reader.prototype = {
    constructor: HuTime.JSON.Reader,

    _stream: null,      // レコードセットを取得するストリーム
    get stream () {
        return this._stream;
    },
    set stream (val) {
        if (!(val instanceof HuTime.StreamBase))
            return;
        this._stream = val;
        this._stream.onloadend = function () {
            this._parsedObject = HuTime.JSON.parse(this._stream.readAll());
            this._isParsed = true;
            this.onloadend.apply(this);
        }.bind(this);
    },

    _source: null,      // レコードセットの取得元
    get source () {
        return this._source;
    },
    set source (val) {      // 取得もとに応じて、適切なstreamオブジェクトを設定
        if (typeof  val === "string" && val != "")
            this.stream = new HuTime.HttpStream(val);
        else if (val instanceof File)       // Fileオブジェクトが入力された場合
            this.stream = new HuTime.FileStream(val);
        else if (val instanceof HuTime.StreamBase)  // streamオブジェクトが直接入力された場合
            this.stream = val;
        else
            return;
        this._source = val;
    },

    _isParsed: false,   // JSONデータのパース終了フラグ
    _parsedObject: null,
    get parsedObject () {
        if (this._isParsed)
            return this._parsedObject;
        else
            return undefined;
    },

    load: function load () {
        this._isParsed = false;     // パース終了フラグをクリア
        this._stream.load();
    },
    get loadState () {
        return this._stream.loadState;
    },
    onloadend: function onloadend () {}
};

// ******** ContainerBase (PanelCollection, Panel, Layer の基底クラス) ********
HuTime.ContainerBase = function ContainerBase () {
    this._contents = [];
    this._userEvents = [];
};
HuTime.ContainerBase.prototype = {
    // **** 基本構造 ****
    constructor: HuTime.ContainerBase,
    id: "",           // オブジェクトのID
    name: "",           // 名称
    _contents: null,    // 配下の子オブジェクト（コンテンツ）の配列
    get contents() {
        return this._contents
    },
    _element: null,     // オブジェクトに紐づくDOM要素
    get element() {
        return this._element;
    },
    get style() {       // スタイル（element.styleに紐づけられる）
        if (this._element)
            return this._element.style;
        else
            return null;
    },

    // **** 書式 ****
    // px単位の数値が保存され、描画時にDOM要素のstyleに反映される
    _tRotation: 0,       // t軸の表示方向（内部用）0: 水平, 1: 垂直
    get tRotation() {
        return this._tRotation;
    },
    _tDirection: 0,    // t軸の表示方向（内部用）0: xy軸と同方向, 1: xy軸と逆方向
    get tDirection() {
        return this._tDirection;
    },
    get displayMode() {         // t軸の表示方向（0:LtoR, 1:RtoL, 2:TtoB, 3:BtoT）
        return this._tRotation * 2 + this._tDirection;
    },
    _setDisplayMode: function(rotation, direction) {
        this._tRotation = rotation;
        this._tDirection = direction;
        for (var i = this._contents.length; i--; ) {
            if (this._contents[i]._setDisplayMode)
                this._contents[i]._setDisplayMode(rotation, direction);
        }
    },
    _tLength: 600,          // t軸の幅(px)
    get tLength() {
        return this._tLength;
    },
    _currentTXYOrigin: 0, // 現在（最後にredrawを呼び出した時）のt軸の位置（0で固定）
    get currentTXYOrigin() {  // 0で固定されているので、実際には使わない
        return this._currentTXYOrigin;
    },
    _currentTLength: 600,   // 現在（最後にredrawを呼び出した時）のt軸の幅
    get currentTLength() {
        return this._currentTLength;
    },
    _updateCurrentTLength: function() {  // t軸の幅を更新
        if (this._parent && isFinite(this._parent._currentTLength) && this._parent._currentTLength != null) {
            this._currentTLength = this._parent._currentTLength;    // 親オブジェクトと同じにする
        }
        else {
            // 親オブジェクトに設定が無い場合は、_tLengthDefaultがあるオブジェクト（PanelCollection）まで
            var obj = this;
            while (obj) {
                if (isFinite(this._tLengthDefault) && this._tLengthDefault != null) {
                    this._currentTLength = this._tLengthDefault;
                    return;
                }
                obj = obj._parent;
            }
            // PanelCollectionまで遡れない場合
            this._currentTLength = HuTime.PanelCollection.prototype._tLengthDefault;
        }
    } ,

    vBreadthDefault: 150,   // v軸の幅の規定値

    _vBreadth: null,         // v軸の幅(px)－nullの場合は自動設定
    get vBreadth() {
        return this._vBreadth;
    },
    set vBreadth(val) {
        if ((typeof val) != "number" || val < 0 || !isFinite(val))
            this._vBreadth = null;
        else
            this._vBreadth = val;
    },
    _vMarginTop: null,       // v軸方向の余白（上, 左）－nullの場合は自動設定
    get vMarginTop() {
        return this._vMarginTop;
    },
    set vMarginTop(val) {
        if ((typeof val) != "number" || val < 0 || !isFinite(val))
            this._vMarginTop = null;
        else
            this._vMarginTop = val;
    },
    _vMarginBottom: null,    // v軸方向の余白（下, 右）－nullの場合は自動設定
    get vMarginBottom() {
        return this._vMarginBottom;
    },
    set vMarginBottom(val) {
        if ((typeof val) != "number" || val < 0 || !isFinite(val))
            this._vMarginBottom = null;
        else
            this._vMarginBottom = val;
    },

    _vMarginForX: 0,         // v軸がヨコの時の余白の適用（0: vMarginTopが左の余白, 1: vMarginBottomが左の余白）
    get vMarginForX() {
        return this._vMarginForX;
    },
    set vMarginForX(val) {
        if ((typeof val) != "number" || val % 1 != 0 || val < 0 || val > 1)
            return;
        this._vMarginForX = val;
    },

    _currentVXYOrigin: null,  // 現在（最後にredrawを呼び出した時）のv軸の位置
    get currentVXYOrigin() {
        return this._currentVXYOrigin;
    },
    _currentVBreadth: null,  // 現在（最後にredrawを呼び出した時）のv軸の幅
    get currentVBreadth() {
        return this._currentVBreadth;
    },
    _updateCurrentVBreadth: function() {
        if (this.vBreadth != null && isFinite(this.vBreadth) &&
            !(this.vMarginTop != null && isFinite(this.vMarginTop) &&   // 3つとも値が入った場合はvBreadthは無視
            this.vMarginBottom != null && isFinite(this.vMarginBottom))) {
            this._currentVBreadth = this.vBreadth;
            return;
        }
        var top = (this.vMarginTop != null && isFinite(this.vMarginTop)) ? this.vMarginTop : 0;
        var bottom = (this.vMarginBottom != null && isFinite(this.vMarginBottom)) ? this.vMarginBottom : 0;
        if (this._parent) { // 親オブジェクトが設定されていないと、this._parent._currentVBreadthを取得できない
            var height = this._parent._currentVBreadth - top - bottom;
            this._currentVBreadth = (height < 0 ? 0 : height);    // 0未満の場合は0を返す
            return;
        }
        this._currentVBreadth = 0;   // 親オブジェクトが設定されていない場合は0を返す
    },
    _updateCurrentVXYOrigin: function() {    // xy座標に変換されたContainerBaseの表示位置 (px)
        if (this._tRotation == 1 && this.vMarginForX == 1) {
            if (this.vMarginBottom != null && isFinite(this.vMarginBottom)) {
                this._currentVXYOrigin = this.vMarginBottom;
                return;
            }
            if (this.vMarginTop != null && isFinite(this.vMarginTop) &&
                this.vBreadth != null && isFinite(this.vBreadth)) {
                this._currentVXYOrigin = this._parent._currentVBreadth - this.vBreadth - this.vMarginTop;
                return;
            }
        }
        else {
            if (this.vMarginTop != null && isFinite(this.vMarginTop)) {
                this._currentVXYOrigin = this.vMarginTop;
                return;
            }
            if (this.vMarginBottom != null && isFinite(this.vMarginBottom) &&
                this.vBreadth != null && isFinite(this.vBreadth)) {
                this._currentVXYOrigin = this._parent._currentVBreadth - this.vBreadth - this.vMarginBottom;
                return;
            }
        }
        this._currentVXYOrigin = 0;
    },
    get zIndex() {  // Z-Index
        if (this._element.style.zIndex)
            return parseFloat(this._element.style.zIndex);
        else
            return 0;
    },
    set zIndex(val) {
        if ((typeof val) != "number" || val < 0 || val > 2147483647)
            return;
        this._element.style.zIndex = val;
    },
    _visible: true, // 表示・非表示
    get visible() {
        return this._visible;
    },
    set visible(val) {
        if ((typeof val) != "boolean")
            return;
        if (val) {
            this._visible = true;
            this._element.style.visibility = null;  // 親要素のvisibilityと連動させるため、visibleではなくnull
        }
        else {
            this._visible = false;
            this._element.style.visibility = "hidden";
        }
    },

    // **** オブジェクトツリー ****
    _parent : null,      // 親オブジェクト
    get parent() {
        return this._parent;
    },
    _setParent: function(parent) {
        this._parent = parent;
        for (var i = this._contents.length; i--; ) {     // 子オブジェクトのparentに自分をセット
            if (this._contents[i]._setParent)
                this._contents[i]._setParent(this);
        }
    },
    _hutimeRoot: null,      // 最上位のHuTimeオブジェクト
    get hutimeRoot() {
        return this._hutimeRoot;
    },
    _setHutimeRoot: function(root) {
        this._hutimeRoot = root;
        for (var i = this._contents.length; i--; ) {
            if (this._contents[i]._setHutimeRoot)
                this._contents[i]._setHutimeRoot(root);
        }
    },
    _captureElement: null,  // マウスイベント取得用の一番上に表示されるcanvas要素
    get captureElement() {
        return this._captureElement;
    },
    _setCaptureElement: function(element) {
        this._captureElement = element;
        for (var i = this._contents.length; i--; ) {
            if (this._contents[i]._setCaptureElement)
                this._contents[i]._setCaptureElement(element);
        }
    },

    // **** 配下の子オブジェクト（コンテンツ）関係 ****
    appendContent: function (content) {     // コンテンツを上に追加（配列の末尾が一番上）
        // 型チェックは継承先で行う
        if (content._parent)
            content._parent.removeContent(content);    // 既に他に属している場合は削除
        content._setParent(this);
        content._setHutimeRoot(this._hutimeRoot);
        content._setCaptureElement(this._captureElement);
        content._setDisplayMode(this._tRotation, this._tDirection);
        this._contents.push(content);
        this._element.appendChild(content._element);
    },
    removeContent: function (content) {     // コンテンツを削除
        // 型チェックは継承先で行う
        for (var i = this._contents.length; i--; ) {
            if (this._contents[i] === content) {
                content._setParent(null);
                content._setHutimeRoot(null);
                content._setCaptureElement(null);
                content._setDisplayMode(0, 0);
                this._contents.splice(i, 1);
                this._element.removeChild(content._element);
                break;
            }
        }
    },
    _contentsIndex: -1,      // 親オブジェクトのcontents配列内での位置
    get contentIndex() {
        return this._contentsIndex;
    },

    // **** 描画関係 ****
    redraw: function () {   // コンテンツの再描画
        this.clear();   // 消去

        //if (!(this instanceof HuTime.PanelCollection)) {    // 互換性のため暫定的にPanelCollectionをはずす
            for (let i = 0; i < this._contents.length; ++i) {
                this._contents[i]._contentsIndex = i;
            }
        //}
        this._contents.sort(this.compZIndex);  // zIndexにしたがって並び替える

        this._updateCurrentTLength();
        this._updateCurrentVXYOrigin();
        this._updateCurrentVBreadth();

        this._redrawBeforeChild();
        if (this.processBeforeRedraw instanceof Function)
            this.processBeforeRedraw(this);
        this._redrawContent();
        if (this.processAfterRedraw instanceof Function)
            this.processAfterRedraw(this);
        this._redrawAfterChild();
    },
    _redrawBeforeChild: function() {    // 子要素の描画前の内部処理
        // 書式設定
        if (this._tRotation == 1) {
            this._element.style.left = this._currentVXYOrigin + "px";
            this._element.style.width = this._currentVBreadth + "px";
            this._element.style.top = "0";
            this._element.style.height = this._currentTLength + "px";
        }
        else {
            this._element.style.left = "0";
            this._element.style.width = this._currentTLength + "px";
            this._element.style.top = this._currentVXYOrigin + "px";
            this._element.style.height = this._currentVBreadth + "px";
        }
    },
    _redrawContent: function() {
        // 子要素の再描画（先頭から末尾に向かって描画：末尾が最前面になる）
        for (var i = 0; i < this._contents.length; ++i) {
            this._contents[i]._contentsIndex = i;
            if (this._contents[i]._visible)
                this._contents[i].redraw();
        }
    },
    _redrawAfterChild: function() {     // 子要素の描画後の内部処理
    },
    processBeforeRedraw: function(layer) {},      // ユーザによる描画処理など（オブジェクトの描画前）
    processAfterRedraw: function(layer) {},       // ユーザによる描画処理など（オブジェクトの描画後）

    compZIndex: function(a, b) {   // ｚIndexでソートするための関数
        // zIndexの比較（_elementを持たないOLObjectも対象になるので、getterを使う）
        if (a.zIndex < b.zIndex)
            return -1;
        if (a.zIndex > b.zIndex)
            return 1;

        // zIndexが同じ場合は配列順を維持（配列はzIndexの低い方から高い方の順で入っている）
        if (a._contentsIndex > b._contentsIndex)
            return 1;
        if (a._contentsIndex < b._contentsIndex)
            return -1;
        return 0;
    },
    clear: function () {    // 画面クリア
        for (var i = 0; i < this._contents.length; ++i) {
            this._contents[i].clear();
        }
    },

    // **** イベント関係（マウスイベント以外全般） ****
    _userEvents: null,  // ユーザイベントの情報を収容する配列
    addEventListener: function (type, handler, useCapture) {    // ユーザ定義イベントの追加
        if (type && handler)
            this._userEvents.push(new HuTime.UserEvent(type, handler, useCapture));
    },
    dispatchEvent: function(ev) {
        if (ev instanceof HuTime.Event)
            this._hutimeRoot._handleEvent(ev);
    },
    _handleInnerEvent: function(ev) {     // 内部イベントの処理
        this._handleInnerEventCapture(ev);    // 子オブジェクト処理前の処理
        for (var i = 0; i < this._contents.length; ++i) {       // 子オブジェクトの処理（実質的なTarget Phase）
            if (this._contents[i]._handleInnerEvent)
                this._contents[i]._handleInnerEvent(ev);
        }
        this._handleInnerEventBubbling(ev);     // 子オブジェクト処理後の処理
    },
    _handleInnerEventCapture: function(ev) {  // 内部イベントの処理（子オブジェクトの処理の前）
    },
    _handleInnerEventBubbling: function(ev) {   // 内部イベントの処理（子オブジェクトの処理の後）
    },

    _handleEvent: function(ev) {    // マウスイベント以外のイベント（ユーザイベント処理を駆動するだけ）
        if (ev._preventEvent || ev._preventUserEvent)
            return;     // ユーザイベント処理だけなので、ユーザイベントが抑止された時点で終了

        var i;  // ループカウント
        var eventResult;
        if(!ev._preventUserEvent) {
            for (i = this._userEvents.length; i--; ) {  // ユーザイベント処理（Capture Phase）
                if (this._userEvents[i].type == ev._type && this._userEvents[i].userCapture) {
                    eventResult = this._userEvents[i].handler.apply(ev._target, [ev]);
                    if (ev._preventEvent)
                        return;
                    if (eventResult != undefined && !eventResult) {
                        ev._preventUserEvent = true;
                        return;     // ユーザイベント処理だけなので、ユーザイベントが抑止された時点で終了
                    }
                }
            }
        }

        if (ev._targetArray.length > 1) {    // 子オブジェクトにイベントフローを渡す
            ev._targetArray.splice(0, 1);    // 呼び出し先一覧から自分自身を除く
            if (ev._targetArray[0]._handleEvent) {  // 呼び出し先一覧の先頭が次に呼ばれる処理
                ev._targetArray[0]._handleEvent(ev);
                if (ev._preventEvent || ev._preventUserEvent)   // イベントが抑止された場合は終了
                    return;
            }
        }

        if(!ev._preventUserEvent) {
            for (i = this._userEvents.length; i--;) {  // ユーザイベント処理（Bubbling Phase）
                if (this._userEvents[i].type == ev._type && !this._userEvents[i].userCapture) {
                    eventResult = this._userEvents[i].handler.apply(ev._target, [ev]);
                    if (ev._preventEvent)
                        return;
                    if (eventResult != undefined && !eventResult) {
                        ev._preventUserEvent = true;
                        return;
                    }
                }
            }
        }
    },

    // **** マウスイベント関係 ****
    _isMouseIn: false,    // マウスが域内にある場合true
    _mouseEventCapture: 3,    // マウスイベントをキャプチャする範囲（0:なし, 1:子を除く, 2:子のみ, 3:全て）
    get mouseEventCapture() {
        return this._mouseEventCapture;
    },
    set mouseEventCapture(val) {
        if ((typeof val) != "number" || val % 1 != 0 || val < 0 || val > 3)
            return;
        this._mouseEventCapture = val;
    },

    _handleMouseEvent: function (ev, eventX, eventY) {     // マウスイベントの処理
        // eventX/eventY: 直上の親オブジェクト上でのカーソル位置
        if (ev._preventEvent)
            return;

        var i;  // ループカウント
        var eventResult;

        if(!ev._preventUserEvent) {
            for (i = this._userEvents.length; i--; ) {  // ユーザイベント処理（Capture Phase）
                if (this._userEvents[i].type == ev._type && this._userEvents[i].userCapture) {
                    eventResult = this._userEvents[i].handler.apply(ev._target, [ev]);
                    if (eventResult != undefined && !eventResult) {
                        ev._preventUserEvent = true;
                        break;
                    }
                    if (ev._preventEvent)   // ユーザイベント処理内でpreventDefaultされた場合
                        return;
                }
            }
        }

        this._handleMouseEventCapture(ev, eventX, eventY);      // マウスイベント処理（子オブジェクト処理の前）
        if (ev._preventEvent)  // preventDefaultされた場合
            return;

        if (ev._targetArray.length > 1) {    // 子オブジェクトにイベントフローを渡す
            ev._targetArray.splice(0, 1);    // 呼び出し先一覧から自分自身を除く
            if (ev._targetArray[0]._handleMouseEvent) {  // 呼び出し先一覧の先頭が次に呼ばれる処理
                if (this._tRotation == 1)
                    ev._targetArray[0]._handleMouseEvent(ev, eventX - this._currentVXYOrigin, eventY);
                else
                    ev._targetArray[0]._handleMouseEvent(ev, eventX, eventY - this._currentVXYOrigin);
            }
            if (ev._preventEvent)  // preventDefaultされた場合
                return;
        }

        this._handleMouseEventBubbling(ev, eventX, eventY);     // マウスイベント処理（子オブジェクト処理の後）
        if (ev._preventEvent)  // preventDefaultされた場合
            return;

        if(!ev._preventUserEvent) {
            for (i = this._userEvents.length; i--;) {  // ユーザイベント（Bubbling Phase）
                if (this._userEvents[i].type == ev._type && !this._userEvents[i].userCapture) {
                    eventResult = this._userEvents[i].handler.apply(ev._target, [ev]);
                    if (eventResult != undefined && !eventResult) {
                        ev._preventUserEvent = true;
                        break;
                    }
                    if (ev._preventEvent)   // ユーザイベント処理内でpreventDefaultされた場合
                        return;
                }
            }
        }
    },
    _handleMouseEventCapture: function(ev, eventX, eventY) {    // マウスイベントの処理（子オブジェクトの処理の前）
        return;
    },
    _handleMouseEventBubbling: function(ev, eventX, eventY) {   // マウスイベントの処理（子オブジェクトの処理の後）
        return;
    },

    isInsideXY: function(x, y) {        // 自域内の座標であるかの判断
        if (this._tRotation == 1)
            return (x < this._currentVBreadth + this._currentVXYOrigin && x >= this._currentVXYOrigin);
        //return (x < this._currentVBreadth && x >= 0);
        else
            return (y < this._currentVBreadth + this._currentVXYOrigin && y >= this._currentVXYOrigin);
        //return (y < this._currentVBreadth && y >= 0);
    },

    _extractInnerTouchEvent: function(ev, eventX, eventY) {   // 内部タッチイベントの抽出
        if (this.mouseEventCapture == 0)    // HuTime.EventCapture.None = 0
            return;

        if (!this.isInsideXY(eventX, eventY))
            return;   // 自域内でない場合は終了

        // 子オブジェクトののイベント情報を抽出
        ev._target = this;
        if ((this.mouseEventCapture & 2) != 0) {    // HuTime.EventCapture.Child = 2
            for (var i = 0; i < this._contents.length; ++i) {
                //for (var i = this._contents.length; i--;) {
                if (this._contents[i]._visible) {
                    if (this._tRotation == 1)
                        this._contents[i]._extractInnerTouchEvent(ev, eventX  - this._currentVXYOrigin, eventY);
                    else
                        this._contents[i]._extractInnerTouchEvent(ev, eventX, eventY - this._currentVXYOrigin);
                }
            }
        }
        if (ev._target !== this)
            return;

        if ((this.mouseEventCapture & 1) == 0)    // イベント透過属性のチェック HuTime.EventCapture.WithoutChild = 1
            return;

        ev._target = this;
    },

    _extractMouseEvent: function(domEv, eventX, eventY) {      // イベント情報の抽出
        var eventInfos = [];    // 抽出されたイベント情報

        if (this.mouseEventCapture == 0)    // HuTime.EventCapture.None = 0
            return eventInfos;

        if (!this.isInsideXY(eventX, eventY) && !this._isMouseIn)
            return eventInfos;  // 自域内でなく、mouseoutでもない場合は終了

        // 子オブジェクトののイベント情報を抽出
        var childEventInfos;
        if ((this.mouseEventCapture & 2) != 0) {    // HuTime.EventCapture.Child = 2
            for (var i = this._contents.length; i--;) {
                if (this._contents[i]._visible) {
                    if (this._tRotation == 1)
                        childEventInfos =
                            this._contents[i]._extractMouseEvent(domEv, eventX  - this._currentVXYOrigin, eventY);
                    else
                        childEventInfos =
                            this._contents[i]._extractMouseEvent(domEv, eventX, eventY - this._currentVXYOrigin);

                    if (childEventInfos.length > 0)
                        this._addEventInfos(childEventInfos, eventInfos);
                }
            }
        }

        if ((this.mouseEventCapture & 1) == 0)    // イベント透過属性のチェック HuTime.EventCapture.WithoutChild = 1
            return eventInfos;

        if (!this.isInsideXY(eventX, eventY)) { // 自域内でない場合
            if (this._isMouseIn && (domEv.type == "mousemove" || domEv.type == "mouseout")) {
                this._isMouseIn = false;
                this._addEventInfos([new HuTime.EventInfo("mouseout", this, eventX, eventY)], eventInfos);
            }
            return eventInfos;
        }

        if (!this._isMouseIn && (domEv.type == "mousemove" || domEv.type == "mouseover")) {
            this._isMouseIn = true;
            this._addEventInfos(
                [new HuTime.EventInfo("mouseover", this, eventX, eventY),
                    new HuTime.EventInfo("mousemove", this, eventX, eventY)], eventInfos);
            return eventInfos;
        }

        this._addEventInfos([new HuTime.EventInfo(domEv.type, this, eventX, eventY)], eventInfos);
        return eventInfos;
    },
    _addEventInfos: function(addedEventInfos, eventInfos) {     // 抽出されたイベントを追加
        // addedEventInfos: 追加しようとする抽出されたイベント
        // eventInfos: 既に抽出されているイベント
        if (!addedEventInfos || addedEventInfos.length == 0)    // イベントが無効またはなしの場合
            return;

        var i, j;  // ループカウンタ

        // 既に抽出されたイベントとの整合性をとりながら、抽出されたイベントを追加してく
        if (eventInfos.length == 0) {   // 既に抽出されたイベントが無い場合はそのまま追加
            Array.prototype.push.apply(eventInfos, addedEventInfos);
            return;
        }

        var existMouseover = false;     // 既に抽出されたイベントの種類毎有無
        var existMouseout = false;
        var existMousemove = false;
        for (i = 0; i < eventInfos.length; ++i) {
            existMouseover |= eventInfos[i].type == "mouseover";
            existMouseout |= eventInfos[i].type == "mouseout";
            existMousemove |= eventInfos[i].type == "mousemove";
        }

        var existExtractedMouseover = false;    // 新たに抽出されたイベントの種類毎有無
        var existExtractedMouseout = false;
        var existExtractedMousemove = false;
        for (i = 0; i < addedEventInfos.length; ++i) {
            existExtractedMouseover |= addedEventInfos[i].type == "mouseover";
            existExtractedMouseout |= addedEventInfos[i].type == "mouseout";
            existExtractedMousemove |= addedEventInfos[i].type == "mousemove";
        }

        if (existMouseover && !existMouseout &&     // mouseoverに対するmouseoutが追加される場合
            (existExtractedMouseout || existExtractedMousemove) && !existExtractedMouseover) {
            eventInfos.unshift(new HuTime.EventInfo("mouseout", addedEventInfos[0].target,
                addedEventInfos[0].t, addedEventInfos[0].y));
            return;
        }

        if (!existMouseover && existMouseout &&     // mouseout対するmouseoverが追加される場合
            (existExtractedMouseover || existExtractedMousemove) && !existExtractedMouseout) {
            eventInfos.push(new HuTime.EventInfo("mouseover", addedEventInfos[0].target,
                addedEventInfos[0].t, addedEventInfos[0].y));
            eventInfos.push(new HuTime.EventInfo("mousemove", addedEventInfos[0].target,
                addedEventInfos[0].t, addedEventInfos[0].y));
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        id: "id",
        name: "name",
        _contents: function (objForJSON) {
            if (this._contents.length > 0)
                objForJSON["contents"] = HuTime.JSON.stringify(this._contents);
        },
        style: function (objForJSON) {
            objForJSON["style"] = this._element.style.cssText;
        },

        _tRotation: "tRotation",
        _tDirection: "tDirection",
        _tLength: "tLength",
        _vBreadth: "vBreadth",
        _vMarginTop: "vMarginTop",
        _vMarginBottom: "vMarginBottom",
        _vMarginForX: "vMarginForX",
        _visible: "visible",
        processBeforeRedraw: "processBeforeRedraw",
        processAfterRedraw: "processAfterRedraw",

        /*
        _userEvents: function (obj) {
            if (this._userEvents.length > 0)
                obj["userEvents"] = HuTime.JSON.stringify(this._userEvents);
        },
        // */
        _mouseEventCapture: "mouseEventCapture"
    },
    _parseJSONProperties: {
        contents: function (objRaw) {
            var content;
            for (var i = 0; i < objRaw.contents.length; ++i) {
                content = HuTime.JSON.parse(objRaw.contents[i]);
                if (content)
                    this.appendContent(content);
            }
        },
        style: function (objRaw) {
            this._element.style.cssText = objRaw.style;
        },

        tRotation: "_tRotation",
        tDirection: "_tDirection",
        tLength: "_tLength",

        vBreadth: "_vBreadth",
        vMarginTop:"_vMarginTop",
        vMarginBottom:"_vMarginBottom",
        vMarginForX:"_vMarginForX",

        visible:"_visible",
        userEvents: null,
        mouseEventCapture:"_mouseEventCapture"
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// ******** パネルコレクション ********
HuTime.PanelCollection = function PanelCollection (vBreadth, tLength) {
    HuTime.ContainerBase.apply(this, arguments);

    if (vBreadth != null && isFinite(vBreadth)) {
        this.vBreadth = vBreadth;
        this.vBreadthMode = 0;  // 値が指定された場合は固定値モードに変更
    }

    if (tLength != null && isFinite(tLength)) {
        this._tLength = tLength;
        this.tLengthMode = 0;   // 値が指定された場合は固定値モードに変更
    }

    this._element = document.createElement("div");
    this._element.style.overflow = "hidden";
    this._element.style.position = "relative";
    this._element.style.backgroundColor = "#CCCCCC";
    this._element.style.border = "solid 1px #000000";
    this._element.style.marginLeft = "-" + this._element.style.borderWidth;
    this._element.style.marginTop = "-" + this._element.style.borderWidth;
    this._element.style.zIndex = 0;

    this._captureElement = document.createElement("canvas");
    this._captureElement.style.position = "absolute";
    this._captureElement.style.zIndex = "9999";
    this._captureElement.style.border = "none";
    this._captureElement.style.padding = "0";
    this._captureElement.hutimeObject = this;   // イベントハンドラで自身の参照を受け取るためのプロパティ
    this._element.appendChild(this._captureElement);

    this._captureElement.addEventListener("click", this._handleCaptureMouseEvent, false);
    this._captureElement.addEventListener("dblclick", this._handleCaptureMouseEvent, false);
    this._captureElement.addEventListener("mouseup", this._handleCaptureMouseEvent, false);
    this._captureElement.addEventListener("mousedown", this._handleCaptureMouseEvent, false);
    this._captureElement.addEventListener("mousemove", this._handleCaptureMouseEvent, false);
    this._captureElement.addEventListener("mouseover", this._handleCaptureMouseEvent, false);
    this._captureElement.addEventListener("mouseout", this._handleCaptureMouseEvent, false);
    this._captureElement.addEventListener("wheel", this._handleCaptureMouseEvent, false);


    this._captureElement.addEventListener("touchstart", this._handleCaptureMouseEvent, false);
    this._captureElement.addEventListener("touchmove", this._handleCaptureMouseEvent, false);
    this._captureElement.addEventListener("touchend", this._handleCaptureMouseEvent, false);
    this._captureElement.addEventListener("touchcancel", this._handleCaptureMouseEvent, false);

};
HuTime.PanelCollection.prototype = Object.create(HuTime.ContainerBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.PanelCollection
    },
    // **** 書式 ****
    displayMode: {
        get: function () {
            return this._tRotation * 2 + this._tDirection;
        },
        set: function (val) {  // PanelCollectionでのみ設定可能
            if ((typeof val) != "number" || val % 1 != 0 || val < 0 || val > 3)
                return;
            this._tDirection = val % 2;
            this._tRotation = (val - this._tDirection) / 2;
            for (var i = this._contents.length; i--;) {    // 子オブジェクトの値を変更
                this._setDisplayMode(this._tRotation, this._tDirection);
            }
        }
    },
    _tLengthDefault: {  // t軸の幅の規定値
        writable: true,
        value: 600
    },
    tLengthDefault: {
        get: function () {
            return this._tLengthDefault;
        },
        set: function (val) {
            if (isFinite(val) && (typeof val) == "number")
                this._tLengthDefault = val;
        }
    },
    tLength: {
        get: function () {
            return this._tLength;
        },
        set: function (val) {
            this._tLength = val;
            // 異常値は_updateCurrentTLengthで_tLengthDefaultに置き換えられる
        }
    },
    _tLengthMode: {  // tLengthの決定方法（0: 固定値, 1: 親要素に合わせる）
        writable: true,
        value: 1    // 既定値：親要素に合わせる
    },
    tLengthMode: {
        get: function () {
            return this._tLengthMode;
        },
        set: function (val) {
            if ((typeof val ) != "number" || val % 1 != 0 || val < 0 || val > 1)
                return;
            this._tLengthMode = val;
        }
    },

    _updateCurrentTLength: {
        value: function () {
            var isTLengthChanged = false;
            if (this.tLengthMode != 0) {
                if (this._tRotation == 1) {
                    if (this._element.parentNode.style.height) {
                        if (this._currentTLength != this._element.parentNode.clientHeight) {
                            isTLengthChanged = true;
                            this._currentTLength = this._element.parentNode.clientHeight;
                        }
                    }
                    else {
                        if (this._currentTLength != this._tLengthDefault) {
                            isTLengthChanged = true;
                            this._currentTLength = this._tLengthDefault;
                        }
                    }
                }
                else if (this._currentTLength != this._element.parentNode.clientWidth) {
                    isTLengthChanged = true;
                    this._currentTLength = this._element.parentNode.clientWidth;  // 現在の表示幅を使う
                }
            }
            else {  // 固定値（this.tLengthMode == 0）の場合
                if (!isFinite(this._tLength) || this._tLength == null) {
                    if (this._currentTLength != this._tLengthDefault)
                        isTLengthChanged = true;
                    this._currentTLength = this._tLengthDefault;
                }
                else {
                    if (this._currentTLength != this._tLength) {
                        isTLengthChanged = true;
                        this._currentTLength = this._tLength;
                    }
                }
            }

            if (isTLengthChanged) {
                // イベント発火
                var newEv = new HuTime.Event("tlengthchanged", this);
                this._hutimeRoot._handleEvent(newEv)
            }
        }
    },

    _vBreadthMode: {     // vBreadthの決定方法（0: 固定値, 1: 親要素に合わせる, 2: 内包するパネルに合わせる）
        writable: true,
        value: 2    // 既定値：内包するパネルに合わせる
    },
    vBreadthMode: {
        get: function () {
            return this._vBreadthMode;
        },
        set: function (val) {
            if ((typeof val) != "number" || val % 1 != 0 || val < 0 || val > 2)
                return;
            this._vBreadthMode = val;
        }
    },

    _panelsVBreadth: {          // 内包するタイルパネルの幅の合計
        writable: true,
        value: 0
    },
    panelsVBreadth: {
        get: function () {
            return this._panelsVBreadth;
        }
    },
    _vScrolled: {    // v方向のスクロール量（一番上（左）のタイルパネルのXY位置）
        writable: true,
        value: 0
    },
    vScrolled: {
        get: function () {
            return this._vScrolled;
        }
    },
    _updatePanelsVBreadth: {       // 内包するタイルパネルの幅の合計を設定（contentsのソート後に処理のこと）
        value: function () {
            var i;
            var upperPanelIndex = null;  // タイルパネルでの上（左）のパネルの_contents配列内の位置（最上端用に初期値null）

            this._panelsVBreadth = 0;
            // パネルの位置設定と幅の取得
            for (i = this._contents.length; i--;) {   // タイルパネルをｚIndexの大きい順にするため、逆順（配列は小さい順）
                if (!this._contents[i]._visible)    // 非表示のパネルは読み飛ばす
                    continue;

                if (this._contents[i] instanceof HuTime.TilePanel) {   // タイルパネル
                    this._contents[i]._updateCurrentVBreadth();
                    this._contents[i]._tilePanelVXYOrigin = this._panelsVBreadth;
                    this._contents[i]._updateCurrentVXYOrigin();    // 再設定された_tilePanelVXYOriginで更新
                    this._panelsVBreadth += this._contents[i]._currentVBreadth;

                    // パネル内に保持される配列内の位置情報を再設定
                    if (upperPanelIndex != null && isFinite(upperPanelIndex))
                        this._contents[upperPanelIndex]._lowerPanelIndex = i;
                    this._contents[i]._contentsIndex = i;
                    this._contents[i]._upperPanelIndex = upperPanelIndex;     // タイル最上端の_UpperPanelはnullになる
                    upperPanelIndex = i;
                }
            }
            if (upperPanelIndex != null) {  // タイル表示のパネルが1つ以上ある場合の処理
                this._contents[upperPanelIndex]._lowerPanelIndex = null;  // タイル最下端のパネルの_lowerPanelをnullにする
            }
            else {   // タイル表示のパネルが無い場合の処理
                this._panelsVBreadth    // 固定値モードと同じ決め方になる
                    = (this.vBreadth != null && isFinite(this.vBreadth)) ? this.vBreadth : this.vBreadthDefault;
            }
            // タイルパネル以外の処理current値の更新（_panelsVBreadthが決まらないと決定できないため）
            for (i = this._contents.length; i--;) {
                if (!(this._contents[i] instanceof HuTime.TilePanel)) {   // タイルパネル以外（オーバレイパネル）
                    this._contents[i]._updateCurrentVXYOrigin();
                    this._contents[i]._updateCurrentVBreadth();
                }
            }
        }
    },
    _updateCurrentVXYOrigin: {
        value: function () {    // xy座標に変換されたContainerBaseの表示位置 (px)
            this._currentVXYOrigin = 0;   // 常に0
        }
    },
    _updateCurrentVBreadth: {
        value: function () {
            this._updatePanelsVBreadth();      // 各パネルの位置決定と幅の合計値を取得
            switch (this.vBreadthMode) {
                case 0:     // 固定モード
                    if (this.vBreadth != null && isFinite(this.vBreadth))
                        this._currentVBreadth = this.vBreadth;
                    else
                        this._currentVBreadth = this.vBreadthDefault;
                    return;

                case 1:     // 親要素に合わせる場合
                    if (this._tRotation == 1)
                        this._currentVBreadth = this._element.parentNode.clientWidth;
                    else if (this._element.parentNode.style.height)
                        this._currentVBreadth = this._element.parentNode.clientHeight;
                    else
                        this._currentVBreadth = this.vBreadthDefault;
                    return;

                default:    // パネルに合わせる場合
                    this._currentVBreadth = this._panelsVBreadth;     // タイルパネルの幅の合計値（固定パネルは算入されない）
            }
        }
    },

    // **** パネルコレクション内のパネル操作 ****
    panels: {               // contentsのエイリアス
        get: function () {
            return this._contents;
        }
    },
    appendContent: {    // 継承元の処理を差し替えておく
        value: function (content) {
            this.appendPanel(content);
        }
    },
    removeContent: {
        value: function (content) {
            this.removePanel(content);
        }
    },
    appendPanel: {
        value: function (panel) {
            ///*
            if (panel instanceof HuTime.PanelBase) {
                if (panel._parent)
                    panel._parent.removeContent(panel);    // 既に他に属している場合は削除
                panel._setParent(this);
                panel._setHutimeRoot(this._hutimeRoot);
                panel._setCaptureElement(this._captureElement);
                panel._setDisplayMode(this._tRotation, this._tDirection);
                this._contents.unshift(panel);      // Panelは逆順なので先頭に追加
                this._element.appendChild(panel._element);
            }
            //*/
//            if (panel instanceof HuTime.PanelBase)
//                HuTime.ContainerBase.prototype.appendContent.apply(this, arguments);    // 継承元を直接呼び出す
        }
    },
    removePanel: {
        value: function (panel) {
            if (panel instanceof HuTime.PanelBase)
                HuTime.ContainerBase.prototype.removeContent.apply(this, arguments);
        }
    },

    // **** 描画関係 ****
    _redrawBeforeChild: {   // コンテンツの再描画の前処理
        value: function () {
            HuTime.ContainerBase.prototype._redrawBeforeChild.apply(this, arguments);   // 継承元の処理（書式設定）

            // captureElementの書式
            if (this._tRotation == 1) {
                this._captureElement.height = this._currentTLength;
                this._captureElement.style.height = this._currentTLength + "px";
                this._captureElement.width = this._currentVBreadth;
                this._captureElement.style.width = this._currentVBreadth + "px";
            }
            else {
                this._captureElement.width = this._currentTLength;
                this._captureElement.style.width = this._currentTLength + "px";
                this._captureElement.height = this._currentVBreadth;
                this._captureElement.style.height = this._currentVBreadth + "px";
            }

            this._drawHuTimeLogo(this._captureElement.width, this._captureElement.height);
        }
    },
    _setPanelVBreadth: {    // パネルの表示位置や大きさを反映させる
        value: function () {
            this._updateCurrentVXYOrigin();
            this._updateCurrentVBreadth();

            for (var i = this._contents.length; i--;) {
                if (!this._contents[i]._visible)    // 非表示のパネルは読み飛ばす
                    continue;

                if (this._tRotation == 1) {
                    this._contents[i]._element.style.left = this._contents[i]._currentVXYOrigin + "px";
                    this._contents[i]._element.style.width = this._contents[i]._currentVBreadth + "px";
                }
                else {
                    this._contents[i]._element.style.top = this._contents[i]._currentVXYOrigin + "px";
                    this._contents[i]._element.style.height = this._contents[i]._currentVBreadth + "px"
                }
            }
        }
    },
    _drawHuTimeLogo: {   // HuTimeのロゴを表示
        value: function (x, y) {
            var ctx;
            ctx = this._captureElement.getContext('2d');
            ctx.fillStyle = "rgb(51, 51, 51)";
            ctx.font = "10px 'MS UI Gothic'";
            ctx.textAlign = "right";
            ctx.textBaseline = "bottom";
            ctx.fillText("powered by HuTime", x - 2, y - 2);
        }
    },

    // **** イベント関係 ****
    _handleInnerEventBubbling: {
        value: function (ev) {    // 内部イベントの処理（自身を再描画してスライダを初期位置に戻す）
            if (ev.type == "tmoveend") {
                this.redraw();
            }
        }
    },
    _isDragging: {      // ドラッグ中を示すフラグ
        writable: true,
        value: false
    },
    _isWheeling: {      // ホイール操作中を示すフラグ
        writable: true,
        value: false
    },
    _panelBreadthChanging: {    // パネル幅変更中のパネル（兼フラグ）
        writable: true,
        value: null
    },
    _panelOrderChanging: {      // パネル順序変更中のパネル（兼フラグ）
        writable: true,
        value: null
    },
    _dragOriginPanel: { // ドラッグを開始したパネル
        writable: true,
        value: null
    },
    _dragOriginX: {     // ドラッグ開始時のx座標（PanelCollection内の画面座標値）
        writable: true,
        value: 0
    },
    _dragOriginY: {     // ドラッグ開始時のy座標（PanelCollection内の画面座標値）
        writable: true,
        value: 0
    },
    _dragDirection: {  // ドラッグの方向（tまたはv、nullの場合は未設定）
        writable: true,
        value: null
    },
    dragSensitivity: {  // ドラッグの方向を判断する最小移動量
        writable: true,
        value: 5
    },
    _preventClick: {     // クリックイベントの抑止（ドラッグ時のクリック動作を無効化）
        writable: true,
        value: false
    },
    _preventMouseEvent: {   // イベント受け入れの抑止（ユーザイベント処理でのalertなどによる不要なmouseoutを防除）
        writable: true,
        value: false
    },
    _vScrollable: {        // タイルパネルのv軸方向のスクロールの可否。
        writable: true,
        value: true
    },
    vScrollable: {
        get: function () {
            return this._vScrollable;
        },
        set: function (val) {
            if ((typeof val) != "boolean")
                return;
            this._vScrollable = val;
        }
    },

    _handleMouseEventCapture: {
        value: function (ev, eventX, eventY) {
            // ドラッグ時のクリック動作の無効化と抑止の解除
            if (ev._type == "click" && this._preventClick) {
                this._preventClick = false;
                ev._preventEvent = true;
            }
        }
    },
    _handleMouseEventBubbling: {
        value: function (ev, eventX, eventY) {
            var minT, maxT;
            var innerEv;            // 発火させる内部イベント
            var targetPanel;        // イベントにかかわるパネル
            var i;                  // ループカウンタ
            var deltaX, deltaY;     // 座標の変化

            // イベントにかかわるパネルを取得
            targetPanel = ev._target;
            while (targetPanel._parent && !(targetPanel instanceof HuTime.PanelBase)) {
                targetPanel = targetPanel._parent;
            }
            if (targetPanel instanceof HuTime)
                targetPanel = null;     // HuTime.Panelより上流のオブジェクトがtargetの場合

            // whell（ホイール操作）
            if (ev._type == "wheel") {
                if (!targetPanel)
                    return; // 発火元のPanelが特定できない場合
                this._wheelZoom(ev, eventX, eventY, targetPanel);
                return;
            }

            // mousedown
            if (ev._type == "mousedown") {
                // 開始時の状態を書き出す
                this._isDragging = true;
                this._dragOriginPanel = targetPanel;

                if (this._tRotation == 1) {
                    this._dragOriginX = ev.originalEvent.offsetX;
                    this._dragOriginY = ev._offsetY;
                }
                else {
                    this._dragOriginX = ev._offsetX;
                    this._dragOriginY = ev.originalEvent.offsetY;
                }

                // shiftキー操作によるパネル順序変更開始
                if (ev.originalEvent.shiftKey) {
                    this._startPanelOrderChange(ev, eventX, eventY, targetPanel);
                    return;
                }

                // パネルの幅変更開始
                if (ev._target instanceof HuTime.PanelBorder && ev._target._panel.resizable) {
                    this._startPanelBreadthChange(ev, eventX, eventY, targetPanel);
                    return;
                }
                return;
            }

            // mouseup
            if (ev._type == "mouseup" || (ev._originalEvent && ev._originalEvent.type == "mouseout")) {
                // dispatchで実行された場合はev.originalEventがundefinedの場合があるのでチェックする

                // ユーザイベント処理でのalertなどによる不要なmouseoutを防除
                // （ユーザが使えるイベントが発火する操作のみ防除処理をする－mouseupはtmovedなどのイベントが発火する）
                this._preventMouseEvent = true;

                clearTimeout(this._mouseTimer);
                this._isDragging = false;       // ドラッグ状態解除
                if (ev._originalEvent.type == "mouseout")
                    this._preventClick = false;     // mouseoutでドラッグ終了の場合はクリック抑止を解除

                // ホイール操作の確定（mouseupはないので、mouseoutのみ）
                if (this._isWheeling) {
                    this._isWheeling = false;
                    this._handleTimeout("tmovestop", this);
                }

                // t軸移動確定
                else if (this._dragDirection == "t") {
                    this._endTMove(ev, eventX, eventY, targetPanel);
                    this._dragDirection = null;     // ドラッグの方向を未決に戻す
                }

                // パネル順序変更確定
                else if (this._panelOrderChanging) {
                    this._endPanelOrderChange(ev, eventX, eventY, targetPanel);
                }

                // パネル幅変更確定
                else if (this._panelBreadthChanging) {
                    this._dragDirection = null;     // ドラッグの方向を未決に戻す
                    this._endPanelBreadthChange(ev, eventX, eventY, targetPanel);
                }

                // v軸移動確定
                else if (this._dragDirection == "v") {
                    this._dragDirection = null;     // ドラッグの方向を未決に戻す
                    this._endVScroll();
                }
                this._preventMouseEvent = false;    // イベント受け入れ抑止を解除
                return;
            }

            // mouseover（パネル境界でのカーソル制御）
            if (ev._type == "mouseover" && ev._target instanceof HuTime.PanelBorder) {
                if (ev._target._panel.resizable && !this._panelOrderChanging) {
                    if (this._tRotation == 1)   // カーソル変更
                        this._captureElement.style.cursor = "e-resize";
                    else
                        this._captureElement.style.cursor = "n-resize";
                    return;
                }
                return;
            }

            // mouseout
            // captureElementのmouseoutの場合はmouseupと同等操作のため、mouseupの処理後にmouseoutを処理
            if (ev._type == "mouseout") {
                // パネル境界でのカーソル制御
                if (ev._target instanceof HuTime.PanelBorder && !this._panelOrderChanging) {
                    this._captureElement.style.cursor = "default";  // カーソル変更
                    return;
                }
                return;
            }

            // mousemove
            if (ev._type == "mousemove" && this._isDragging) { // 画面ドラッグ中のみ処理
                // マウスボタン押下後にシフトキーを押下した場合
                if (!this._dragDirection && !this._panelOrderChanging && ev.originalEvent.shiftKey) {
                    this._startPanelOrderChange(ev, eventX, eventY, targetPanel);
                    // 引き続き入れ換え操作を行うため、returnしない
                    // 入れ換え禁止パネルだった場合は、v軸操作に移行する
                }

                // パネルの入れ替え
                if (this._panelOrderChanging) {
                    this._progressPanelOrderChange(ev, eventX, eventY, targetPanel);
                    return;
                }

                // ドラッグの方向が未決の場合は判断
                if (!this._dragDirection) {
                    deltaX = Math.abs(ev._offsetX - this._dragOriginX);
                    deltaY = Math.abs(ev._offsetY - this._dragOriginY);
                    if (deltaX < this.dragSensitivity && deltaY < this.dragSensitivity)
                        return;     // ドラッグ方向を判断する移動量が無い場合

                    if (this._tRotation == 1) {
                        if (deltaY > deltaX)
                            this._dragDirection = "t";
                        else
                            this._dragDirection = "v";
                    }
                    else {
                        if (deltaX > deltaY)
                            this._dragDirection = "t";
                        else
                            this._dragDirection = "v";
                    }

                    if (this._dragDirection == "t") {   // t軸方向ドラッグ開始
                        this._startTMove(ev, eventX, eventY, targetPanel);
                        // 引き続きドラッグの処理を行うので、returnしない
                    }
                    this._preventClick = true;
                }

                // t軸方向ドラッグ
                if (this._dragDirection == "t") {
                    if (this._dragOriginPanel instanceof HuTime.SliderPanel)
                        return;     // スライダ操作の場合はレイヤ（HuTime.Slider）で処理するのでここでの処理は中止
                    this._progressTMove(ev, eventX, eventY, targetPanel);
                    return;
                }

                // v軸方向ドラッグ－指定されたパネルの幅の変更
                if (this._panelBreadthChanging) {
                    this._progressPanelBreadthChange(ev, eventX, eventY, targetPanel);
                    return;
                }

                // v軸方向ドラッグ－パネル表示位置の変更
                if (this.vBreadthMode == 2)
                    return;     // 「パネルに合わせる」の場合は表示位置の変更禁止
                if (!this.vScrollable)    // 移動禁止の場合
                    return;
                this._progressVScroll(ev, eventX, eventY, targetPanel);
                return;
            }


            // ** タッチ関係 **
            // touchinit
            if (ev._type == "touchinit") {
                this._pinchDirection = null;    // ピンチの方向を未決に戻す
                this._dragDirection = null;     // ドラッグ（スワイプ）の方向を未決に戻す
                this._dragOriginPanel = null;
                if (this._tSwipeAnimationTimer != null) {   // アニメーション動作中なら止める
                    clearTimeout(this._tSwipeAnimationTimer);
                    this._tSwipeAnimationTimer = null;
                }
                return;
            }

            // touchfinish
            if (ev._type == "touchfinish") {
                // パネル順序変更確定
                if (this._panelOrderChanging) {
                    if (targetPanel)
                        this._endPanelOrderChange(ev, eventX, eventY, targetPanel);
                    else
                        this._endPanelOrderChange(
                            ev, ev._handleObject.touchTwoX, eventX, eventY, this._panelOrderChanging);
                }

                //　t軸移動確定
                else if (this._dragDirection == "t") {
                    clearTimeout(this._tSwipeAnimationTimer);
                    this._tSwipeAnimationX = eventX;
                    this._tSwipeAnimationY = eventY;
                    if (this._tRotation == 1)
                        this._tSwipeAnimationDelta = ev._handleObject.touchOneY - this._tSwipeAnimationOrigin;
                    else
                        this._tSwipeAnimationDelta = ev._handleObject.touchOneX - this._tSwipeAnimationOrigin;
                    if (Math.abs(this._tSwipeAnimationDelta) < 3) {
                        this._endTMove(null, this._tSwipeAnimationX, this._tSwipeAnimationY, null);
                        this._tSwipeAnimationDelta = null;
                        this._tSwipeAnimationX = null;
                        this._tSwipeAnimationY = null;
                        return;
                    }
                    this._tSwipeAnimationTimer = setInterval(function (e) {
                        if (this._tRotation == 1)
                            this._tSwipeAnimationY += this._tSwipeAnimationDelta;
                        else
                            this._tSwipeAnimationX += this._tSwipeAnimationDelta;
                        this._progressTMove(e, this._tSwipeAnimationX, this._tSwipeAnimationY, targetPanel);
                        clearTimeout(this._mouseTimer);     // アニメーション中はタイマによる再描画を抑止
                        this._tSwipeAnimationDelta
                            = (this._tSwipeAnimationDelta < 0 ? -1 : 1) * Math.pow(Math.abs(this._tSwipeAnimationDelta), 0.9);

                        if (Math.abs(this._tSwipeAnimationDelta) < 3) {
                            clearTimeout(this._tSwipeAnimationTimer);
                            this._tSwipeAnimationTimer = null;
                            this._endTMove(null, this._tSwipeAnimationX, this._tSwipeAnimationY, null);
                            this._tSwipeAnimationDelta = null;
                            this._tSwipeAnimationX = null;
                            this._tSwipeAnimationY = null;
                        }
                    }.bind(this, ev), 50);
                }

                // v軸移動確定
                else if (this._dragDirection == "v")
                    this._endVScroll();

                // パネル幅確定
                else if (this._pinchDirection == "v")
                    this._endPanelBreadthChange(ev, eventX, eventY, targetPanel);

                // アニメーション終了だが、確定前の場合
                if (this._tSwipeAnimationTimer == null && this._tSwipeAnimationDelta != null) {
                    this._endTMove(ev, this._tSwipeAnimationX, this._tSwipeAnimationY, targetPanel);
                    this._tSwipeAnimationDelta = null;
                    this._tSwipeAnimationX = null;
                    this._tSwipeAnimationY = null;
                }

                this._preventMouseEvent = false;    // イベント受け入れ抑止を解除
                return;
            }

            // swipestart
            if (ev._type == "swipestart") {
                this._dragOriginPanel = targetPanel;
                if (this._tRotation == 1) {
                    this._dragOriginX = ev._offsetX;
                    this._dragOriginY = ev._offsetY;
                }
                else {
                    this._dragOriginX = ev._offsetX;
                    this._dragOriginY = ev._offsetY;
                }
                return;
            }

            // swipe
            if (ev._type == "swipe" && ev.handleObject.touchCount == 1) {
                // ドラッグの方向が未決の場合は判断
                if (!this._dragDirection) {
                    deltaX = Math.abs(ev._offsetX - this._dragOriginX);
                    deltaY = Math.abs(ev._offsetY - this._dragOriginY);
                    if (deltaX < this.dragSensitivity && deltaY < this.dragSensitivity)
                        return;     // ドラッグ方向を判断する移動量が無い場合

                    if (this._tRotation == 1) {
                        if (deltaY > deltaX) {
                            this._dragDirection = "t";
                            this._tSwipeAnimationOrigin = ev._handleObject.touchOneOriginY;
                            clearTimeout(this._tSwipeAnimationTimer);
                            this._tSwipeAnimationTimer = setInterval(function (e) {
                                this._tSwipeAnimationOrigin = e._handleObject.touchOneY;
                            }.bind(this, ev), 100);
                        }
                        else {
                            this._dragDirection = "v";
                            if (this._tSwipeAnimationDelta != null) {
                                this._endTMove(ev, this._tSwipeAnimationX, this._tSwipeAnimationY, targetPanel);
                                this._tSwipeAnimationDelta = null;
                                this._tSwipeAnimationX = null;
                                this._tSwipeAnimationY = null;
                            }
                        }
                    }
                    else {
                        if (deltaX > deltaY) {
                            this._dragDirection = "t";
                            this._tSwipeAnimationOrigin = ev._handleObject.touchOneOriginX;
                            clearTimeout(this._tSwipeAnimationTimer);
                            this._tSwipeAnimationTimer = setInterval(function (e) {   // 移動量履歴の保存
                                this._tSwipeAnimationOrigin = e._handleObject.touchOneX;
                            }.bind(this, ev), 100);
                        }
                        else {
                            this._dragDirection = "v";
                            if (this._tSwipeAnimationDelta != null) {
                                this._endTMove(ev, this._tSwipeAnimationX, this._tSwipeAnimationY, targetPanel);
                                this._tSwipeAnimationDelta = null;
                                this._tSwipeAnimationX = null;
                                this._tSwipeAnimationY = null;
                            }
                        }
                    }

                    if (this._dragDirection == "t") {   // t軸方向ドラッグ開始
                        this._startTMove(ev, eventX, eventY, targetPanel);
                        // 引き続きドラッグの処理を行うので、returnしない
                    }
                    this._preventClick = true;
                }

                // t軸方向ドラッグ
                if (this._dragDirection == "t") {
                    if (this._dragOriginPanel instanceof HuTime.SliderPanel)
                        return;     // スライダ操作の場合はレイヤ（HuTime.Slider）で処理するのでここでの処理は中止
                    this._progressTMove(ev, eventX, eventY, targetPanel);
                    return;
                }

                // v軸方向ドラッグ－パネル表示位置の変更
                if (this.vBreadthMode == 2)
                    return;     // 「パネルに合わせる」の場合は表示位置の変更禁止
                if (!this.vScrollable)    // 移動禁止の場合
                    return;
                this._progressVScroll(ev, eventX, eventY, targetPanel);
                return;
            }

            if (ev.type == "swipeend") {
                return;
            }

            // アニメーション後、未確定状態でスワイプ以外の操作があれば、確定処理
            if (this._tSwipeAnimationDelta != null) {
                this._endTMove(ev, this._tSwipeAnimationX, this._tSwipeAnimationY, targetPanel);
                this._tSwipeAnimationDelta = null;
                this._tSwipeAnimationX = null;
                this._tSwipeAnimationY = null;
            }

            // パネルの入れ替え（２指でのスワイプまたはピンチ操作－移動の基準は２つ目のタッチ）
            if (this._panelOrderChanging && (ev._type == "pinch" || ev._type == "swipe")) {
                this._progressPanelOrderChange(ev, eventX, eventY, targetPanel);
                return;
            }

            // tapholdtwo（パネル順序変更の開始）
            if (ev.type == "tapholdtwo" && targetPanel) {
                this._dragOriginPanel = targetPanel;
                this._dragOriginX = eventX;
                this._dragOriginY = eventY;
                this._startPanelOrderChange(ev, eventX, eventY, targetPanel);
                return;
            }

            // pinch
            if (ev.type == "pinch" && !this._panelOrderChanging) {
                if (!targetPanel)
                    return; // 発火元のPanelが特定できない場合

                if (!this._pinchDirection) {
                    deltaX = Math.abs((ev._handleObject.touchOneX - ev._handleObject.touchTwoX) -
                        (ev._handleObject.touchOneOriginX - ev._handleObject.touchTwoOriginX));
                    deltaY = Math.abs((ev._handleObject.touchOneY - ev._handleObject.touchTwoY) -
                        (ev._handleObject.touchOneOriginY - ev._handleObject.touchTwoOriginY));
                    if (deltaX < this.dragSensitivity && deltaY < this.dragSensitivity)
                        return;     // ドラッグ方向を判断する変化量が無い場合

                    if (this._tRotation == 1) {
                        if (deltaY > deltaX)
                            this._pinchDirection = "t";
                        else {
                            this._pinchDirection = "v";
                            if (targetPanel instanceof HuTime.PanelBorder)
                                this._startPanelBreadthChange(ev, eventX, eventY, targetPanel.panel);
                            else
                                this._startPanelBreadthChange(ev, eventX, eventY, targetPanel);
                        }
                    }
                    else {
                        if (deltaX > deltaY)
                            this._pinchDirection = "t";
                        else {
                            this._pinchDirection = "v";
                            if (targetPanel instanceof HuTime.PanelBorder)
                                this._startPanelBreadthChange(ev, eventX, eventY, targetPanel.panel);
                            else
                                this._startPanelBreadthChange(ev, eventX, eventY, targetPanel);
                        }
                    }
                }

                if (this._pinchDirection == "t")
                    this._pinchZoom(ev, eventX, eventY, targetPanel);
                else if (this._pinchDirection == "v")
                    this._progressPanelBreadthChange(ev, eventX, eventY, targetPanel);
                return;
            }
        }
    },

    _pinchDirection: {
        writable: true,
        value: null
    },
    pinchSensitivity: {
        writable: true,
        value: 8
    },
    isInsideXY: {   // パネル幅変更時に_captureElementを変える場合があるため、_captureElementで領域を判断
        value: function (x, y) {
            if (this._tRotation == 1)
                return (x < this._captureElement.width && x >= 0);  // _currentVXYOriginは0で固定されているので参照省略
            else
                return (y < this._captureElement.height && y >= 0);
        }
    },

    _extractInnerTouchEvent: {  // 内部タッチイベントの抽出（パネルコレクションは域外でも有効）
        value: function (ev, eventX, eventY) {
            if (this.mouseEventCapture == 0)    // HuTime.EventCapture.None = 0
                return;

            // 自域内でない場合はtargetをパネルコレクションとして終了
            if (!this.isInsideXY(eventX, eventY)) {
                ev._target = this;
                return;
            }

            // 子オブジェクトのイベント情報を抽出
            ev._target = this;
            if ((this.mouseEventCapture & 2) != 0) {    // HuTime.EventCapture.Child = 2
                for (var i = 0; i < this._contents.length; ++i) {
                    if (this._contents[i]._visible) {
                        if (this._tRotation == 1)
                            this._contents[i]._extractInnerTouchEvent(ev, eventX - this._currentVXYOrigin, eventY);
                        else
                            this._contents[i]._extractInnerTouchEvent(ev, eventX, eventY - this._currentVXYOrigin);
                    }
                }
            }
            if (ev._target !== this)
                return;     // 自分以外（子オブジェクトがtarget）
            ev._target = this;
        }
    },

    // ** t軸 zoom **
    _pinchZoom: {
        value: function _pinchZoom(ev, eventX, eventY, targetPanel) {

            var currentTOne, currentTTwo;
            var newTPerXY, newMinT, newMaxT;
            switch (this.displayMode) {
                case 0:
                    currentTOne = targetPanel.minPnlT + ev._handleObject.touchOneOriginX / this._currentTLength *
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) * targetPanel.tRatio;
                    currentTTwo = targetPanel.minPnlT + ev._handleObject.touchTwoOriginX / this._currentTLength *
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) * targetPanel.tRatio;
                    newTPerXY = (currentTOne - currentTTwo) / (ev._handleObject.touchOneX - ev._handleObject.touchTwoX);
                    newMinT = currentTOne - ev.handleObject.touchOneX * newTPerXY;
                    newMaxT = newMinT + newTPerXY * this._currentTLength;
                    break;

                case 1:
                    currentTOne = targetPanel.maxPnlT - ev._handleObject.touchOneOriginX / this._currentTLength *
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) * targetPanel.tRatio;
                    currentTTwo = targetPanel.maxPnlT - ev._handleObject.touchTwoOriginX / this._currentTLength *
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) * targetPanel.tRatio;
                    newTPerXY = (currentTOne - currentTTwo) / (ev._handleObject.touchOneX - ev._handleObject.touchTwoX);
                    newMaxT = currentTOne - ev.handleObject.touchOneX * newTPerXY;
                    newMinT = newTPerXY * this._currentTLength + newMaxT;
                    break;

                case 2:
                    currentTOne = targetPanel.minPnlT + ev._handleObject.touchOneOriginY / this._currentTLength *
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) * targetPanel.tRatio;
                    currentTTwo = targetPanel.minPnlT + ev._handleObject.touchTwoOriginY / this._currentTLength *
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) * targetPanel.tRatio;
                    newTPerXY = (currentTOne - currentTTwo) / (ev._handleObject.touchOneY - ev._handleObject.touchTwoY);
                    newMinT = currentTOne - ev.handleObject.touchOneY * newTPerXY;
                    newMaxT = newMinT + newTPerXY * this._currentTLength;
                    break;

                case 3:
                    currentTOne = targetPanel.maxPnlT - ev._handleObject.touchOneOriginY / this._currentTLength *
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) * targetPanel.tRatio;
                    currentTTwo = targetPanel.maxPnlT - ev._handleObject.touchTwoOriginY / this._currentTLength *
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) * targetPanel.tRatio;
                    newTPerXY = (currentTOne - currentTTwo) / (ev._handleObject.touchOneY - ev._handleObject.touchTwoY);
                    newMaxT = currentTOne - ev.handleObject.touchOneY * newTPerXY;
                    newMinT = newTPerXY * this._currentTLength + newMaxT;
                    break;
            }
            if (newMinT < this._hutimeRoot.minTLimit)
                newMinT = this._hutimeRoot.minTLimit;
            if (newMaxT > this._hutimeRoot.maxTLimit)
                newMaxT = this._hutimeRoot.maxTLimit;

            this._hutimeRoot._handleInnerEvent( // tMoveEndイベントを発火
                HuTime.InnerEvent.createWithT("tmove", targetPanel, newMinT, newMaxT));

            // タイマ処理
            clearTimeout(this._mouseTimer);
            this._mouseTimer = function (obj) {
                return setTimeout(
                    function () {
                        obj._handleTimeout("tmovestop", obj);
                        // tmovedイベント発火
                        var newEv = new HuTime.Event("tmoved", obj._hutimeRoot);
                        newEv._relatedTarget = this;
                        obj._hutimeRoot._handleEvent(newEv)
                    },
                    obj._hutimeRoot.mouseTimeOut);
            }(this);
            this._isWheeling = true;    // タイムアウト前に、mouseoutした場合（確定処理をする）の識別用
        }
    },
    wheelZoomRatio: {   // ホイール操作による拡大/縮小率
        writable: true,
        value: 0.02
    },
    _wheelZoom: {    // ホイールによるzoom操作
        value: function (ev, eventX, eventY, targetPanel) {
            var zoomDelta = this.wheelZoomRatio;
            zoomDelta *= ev.deltaY > 0 ? 1 : -1;

            // マウスポインタのt座標値
            var currentT;
            switch (this.displayMode) {
                case 0:
                    currentT = targetPanel.minPnlT + eventX / this._currentTLength *
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) * targetPanel.tRatio;
                    break;

                case 1:
                    currentT = targetPanel.maxPnlT - eventX / this._currentTLength *
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) * targetPanel.tRatio;
                    break;

                case 2:
                    currentT = targetPanel.minPnlT + eventY / this._currentTLength *
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) * targetPanel.tRatio;
                    break;

                case 3:
                    currentT = targetPanel.maxPnlT - eventY / this._currentTLength *
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) * targetPanel.tRatio;
                    break;
            }

            // マウスポインタの位置（currentT）を基準にZoomする（hutimeRootのx座標値を書き換える）
            var newMinT = zoomDelta * (this._hutimeRoot.minT - currentT) + this._hutimeRoot.minT;
            var newMaxT = zoomDelta * (this._hutimeRoot.maxT - currentT) + this._hutimeRoot.maxT;
            if (newMinT < this._hutimeRoot.minTLimit)
                newMinT = this._hutimeRoot.minTLimit;
            if (newMaxT > this._hutimeRoot.maxTLimit)
                newMaxT = this._hutimeRoot.maxTLimit;

            this._hutimeRoot._handleInnerEvent( // tMoveEndイベントを発火
                HuTime.InnerEvent.createWithT("tmove", targetPanel, newMinT, newMaxT));

            // タイマ処理
            clearTimeout(this._mouseTimer);
            this._mouseTimer = function (obj) {
                return setTimeout(
                    function () {
                        obj._handleTimeout("tmovestop", obj);
                        // tmovedイベント発火
                        var newEv = new HuTime.Event("tmoved", obj._hutimeRoot);
                        newEv._relatedTarget = this;
                        obj._hutimeRoot._handleEvent(newEv)
                    },
                    obj._hutimeRoot.mouseTimeOut);
            }(this);
            this._isWheeling = true;    // タイムアウト前に、mouseoutした場合（確定処理をする）の識別用
        }
    },

    // ** t軸移動 **
    _startTMove: {
        value: function (ev, eventX, eventY, targetPanel) {
            this._hutimeRoot._handleInnerEvent(     // 内部イベント（tMoveStartイベント）を発火
                HuTime.InnerEvent.createWithT("tmovestart", this, this._hutimeRoot.minT, this._hutimeRoot.maxT));
        }
    },
    _progressTMove: {
        value: function (ev, eventX, eventY, targetPanel) {
            var deltaT;
            switch (this.displayMode) {
                case 0:
                    deltaT = (this._dragOriginPanel.maxPnlT - this._dragOriginPanel.minPnlT) /
                        //this._currentTLength * (ev._offsetX - this._dragOriginX);  // t軸換算での移動量
                        this._currentTLength * (eventX - this._dragOriginX);  // t軸換算での移動量
                    this._dragOriginX = eventX;
                    break;

                case 1:
                    deltaT = (this._dragOriginPanel.minPnlT - this._dragOriginPanel.maxPnlT) /
                        this._currentTLength * (eventX - this._dragOriginX);  // t軸換算での移動量
                    this._dragOriginX = eventX;
                    break;

                case 2:
                    deltaT = (this._dragOriginPanel.maxPnlT - this._dragOriginPanel.minPnlT) /
                        this._currentTLength * (eventY - this._dragOriginY);  // t軸換算での移動量
                    this._dragOriginY = eventY;
                    break;

                case 3:
                    deltaT = (this._dragOriginPanel.minPnlT - this._dragOriginPanel.maxPnlT) /
                        this._currentTLength * (eventY - this._dragOriginY);  // t軸換算での移動量
                    this._dragOriginY = eventY;
                    break;
            }

            var newMinT = this._hutimeRoot.minT - deltaT;
            var newMaxT = this._hutimeRoot.maxT - deltaT;
            if (newMinT < this._hutimeRoot.minTLimit && newMaxT > this._hutimeRoot.maxTLimit) {
                newMinT = this._hutimeRoot.minTLimit;
                newMaxT = this._hutimeRoot.maxTLimit;
            }
            else if (newMinT < this._hutimeRoot.minTLimit) {
                newMinT = this._hutimeRoot.minTLimit;
                newMaxT = this._hutimeRoot.maxT;
            }
            else if (newMaxT > this._hutimeRoot.maxTLimit) {
                newMinT = this._hutimeRoot.minT;
                newMaxT = this._hutimeRoot.maxTLimit;
            }

            this._hutimeRoot._handleInnerEvent(     // 内部イベント（tMoveイベント）を発火
                HuTime.InnerEvent.createWithT("tmove", this, newMinT, newMaxT));

            clearTimeout(this._mouseTimer);
            this._mouseTimer = function (obj) {
                return setTimeout(
                    function () {
                        obj._handleTimeout("tmovestop", obj);
                    },
                    obj._hutimeRoot.mouseTimeOut);
            }(this);
        }
    },
    _endTMove: {     // t軸移動確定
        value: function (ev, eventX, eventY, targetPanel) {
            this._hutimeRoot._handleInnerEvent(     // 内部イベント（tMoveEndイベント）を発火
                HuTime.InnerEvent.createWithT("tmoveend", this, this._hutimeRoot.minT, this._hutimeRoot.maxT));
            this._dragDirection = null;     // ドラッグの方向を未決に戻す

            // tmovedイベント発火
            var newEv = new HuTime.Event("tmoved", this._hutimeRoot);
            newEv._relatedTarget = this;
            this._hutimeRoot._handleEvent(newEv)
        }
    },
    _tSwipeAnimationTimer: {    // スワイプ後の慣性アニメーション用のタイマ
        writable: true,         // （スワイプ時の移動量の検出とスワイプ後のアニメーション処理）
        value: null
    },
    _tSwipeAnimationX: {        // アニメーション用のx座標
        writable: true,
        value: null
    },
    _tSwipeAnimationY: {        // アニメーション用のy座標
        writable: true,
        value: null
    },
    _tSwipeAnimationDelta: {    // アニメーション時の座標の変化量
        writable: true,
        value: null
    },
    _tSwipeAnimationOrigin: {   // 変化量を計算するための一定時間前の座標値
        writable: true,
        value: 0
    },

    // ** v軸移動 **
    _progressVScroll: {
        value: function (ev, eventX, eventY, targetPanel) {
            var vScrolledOld = this._vScrolled;     // 移動量を検出するため、前の値を保存
            if (this._tRotation == 1) {
                this._vScrolled += ev._offsetX - this._dragOriginX;
                this._dragOriginX = ev._offsetX;
            }
            else {
                this._vScrolled += ev._offsetY - this._dragOriginY;
                this._dragOriginY = ev._offsetY;
            }

            // 可動範囲の制限（再下端のパネル幅を変更できるようにするため、上（左）方向には限界値まで移動可能）
            var bottomLimit = 30;     // 上（左）方向の限界値（再下端のパネルが隠れないようにするため）
            var moveSensitivity = 5;  // パネルが端で接した位置で止まるマウスの移動速度
            if (this._currentVBreadth > this._panelsVBreadth) {    // PanelCollection内に余白がある場合
                // 上端（左端）が接した位置で一旦止める
                if (this._vScrolled * vScrolledOld <= 0 &&
                    Math.abs(this._vScrolled - vScrolledOld) < moveSensitivity)
                    this._vScrolled = 0;

                if (this._vScrolled < bottomLimit - this._panelsVBreadth) // 上（左）方向限界
                    this._vScrolled = bottomLimit - this._panelsVBreadth;
                if (this._vScrolled > this._currentVBreadth - this._panelsVBreadth) // 下（右）方向限界
                    this._vScrolled = this._currentVBreadth - this._panelsVBreadth;
            }
            else {                                          // PanelCollectionからPanelがはみ出す場合
                // 下端（右端）が接した位置で一旦止める
                if ((this._vScrolled - this._currentVBreadth + this._panelsVBreadth) *
                    (vScrolledOld - this._currentVBreadth + this._panelsVBreadth) <= 0 &&
                    Math.abs(this._vScrolled - vScrolledOld) < moveSensitivity)
                    this._vScrolled = this._currentVBreadth - this._panelsVBreadth;

                if (this._vScrolled < bottomLimit - this._panelsVBreadth) // 上（左）方向限界
                    this._vScrolled = bottomLimit - this._panelsVBreadth;
                if (this._vScrolled > 0)     // 下（右）方向限界
                    this._vScrolled = 0;
            }
            this._updatePanelsVBreadth();  // 得られたtopの値を内包するパネルに反映させる
            this._setPanelVBreadth();
        }
    },
    _endVScroll: {
        value: function () {
            this.scrollTilePanels();
        }
    },
    scrollTilePanels: {
        value: function (deltaV) {
            if (!deltaV || !isFinite(deltaV))
                return;     // deltaV = 0 の場合（!deltaV）も該当

            this._vScrolled += deltaV;

            // 可動範囲の制限
            if (this._currentVBreadth > this._panelsVBreadth) {    // PanelCollection内に余白がある場合
                if (this._vScrolled < 0) // 上（左）方向限界
                    this._vScrolled = 0;
                if (this._vScrolled > this._currentVBreadth - this._panelsVBreadth) // 下（右）方向限界
                    this._vScrolled = this._currentVBreadth - this._panelsVBreadth;
            }
            else {                                          // PanelCollectionからPanelがはみ出す場合
                if (this._vScrolled < this._currentVBreadth - this._panelsVBreadth) // 上（左）方向限界
                    this._vScrolled = this._currentVBreadth - this._panelsVBreadth;
                if (this._vScrolled > 0)     // 下（右）方向限界
                    this._vScrolled = 0;

                this._updatePanelsVBreadth();  // 得られたtopの値を内包するパネルに反映させる
                this._setPanelVBreadth();
            }

            // vscrolledイベント発火
            this._hutimeRoot._handleEvent(new HuTime.Event("vscrolled", this));
        }
    },

    // ** タイルパネルの順序変更 **
    _panelOrderChangingZIndex: {    // 順序を変更するパネルのzIndexを保管（マウスでの変更操作中に変更されるため）
        writable: true,
        value: 0
    },
    _panelOrderChangingOpacity: {    // 順序を変更するパネルのopacityを保管（マウスでの変更操作中に変更されるため）
        writable: true,
        value: 1.0
    },
    _startPanelOrderChange: {    // 変更開始（対象のパネルの書式変更）（shift+mousedown）
        value: function (ev, eventX, eventY, targetPanel) {
            if (targetPanel.repositionable) {
                if (ev instanceof HuTime.MouseEvent)
                    this._captureElement.style.cursor = "pointer";  // カーソル変更
                this._panelOrderChanging = targetPanel;
                this._panelOrderChangingZIndex = targetPanel._element.style.zIndex;
                this._panelOrderChangingOpacity = targetPanel._element.style.opacity;
                targetPanel._element.style.zIndex = 9900;
                targetPanel._element.style.opacity = 0.7;
            }
        }
    },
    _progressPanelOrderChange: { // 変更中（shift+mousemove）
        value: function (ev, eventX, eventY, targetPanel) {
            var left = parseFloat(this._panelOrderChanging._element.style.left);
            var top = parseFloat(this._panelOrderChanging._element.style.top);

            if (ev instanceof HuTime.TouchEvent) {
                left += eventX - this._dragOriginX;
                this._panelOrderChanging._element.style.left = left + "px";
                top += eventY - this._dragOriginY;
                this._panelOrderChanging._element.style.top = top + "px";
                this._dragOriginX = eventX;
                this._dragOriginY = eventY;
            }
            else {
                left += ev.originalEvent.offsetX - this._dragOriginX;
                this._panelOrderChanging._element.style.left = left + "px";
                top += ev.originalEvent.offsetY - this._dragOriginY;
                this._panelOrderChanging._element.style.top = top + "px";
                this._dragOriginX = ev.originalEvent.offsetX;
                this._dragOriginY = ev.originalEvent.offsetY;
            }
            clearTimeout(this._mouseTimer);

            this._mouseTimer = setTimeout(function () {
                this._endPanelOrderChange(ev, eventX, eventY, this._panelOrderChanging);
            }.bind(this), this._hutimeRoot.mouseTimeOut * 4)
        }
    },
    _endPanelOrderChange: {      // 変更確定（入れ換えと対象のパネルの書式を戻す）（mouseup）
        value: function (ev, eventX, eventY, targetPanel) {
            clearTimeout(this._mouseTimer);

            // カーソルと移動元の書式を元に戻す
            this._captureElement.style.cursor = "default";  // カーソル変更
            this._panelOrderChanging._element.style.opacity = this._panelOrderChangingOpacity;
            this._panelOrderChanging._element.style.zIndex = this._panelOrderChangingZIndex;
            if (this._tRotation == 1)
                this._panelOrderChanging._element.style.top = 0;
            else
                this._panelOrderChanging._element.style.left = 0;

            var targetIndex = -1;   // 移動先のパネルのインデックス（移動先が無い場合は-1）
            if (targetPanel)
                targetIndex = targetPanel._contentsIndex;
            if (targetIndex >= 0 && !this._contents[targetIndex].repositionable)    // 移動先が移動禁止パネルの場合
                targetIndex = -1;   // 移動先が見つからなかったことにする

            // 入れ換え操作
            if (targetIndex >= 0 &&
                this._panelOrderChanging._contentsIndex != targetIndex)   // 移動先が見つかった場合、入れ換え操作
                this.changePanelOrder(this._panelOrderChanging, this._contents[targetIndex]);
            else    // 移動先が見つからない場合、ドラッグされたパネルの位置を戻すだけ
            if (this._tRotation == 1)
                this._panelOrderChanging._element.style.left = this._panelOrderChanging._currentVXYOrigin + "px";
            else
                this._panelOrderChanging._element.style.top = this._panelOrderChanging._currentVXYOrigin + "px";
            this._panelOrderChanging = null;
        }
    },
    changePanelOrder: {             // パネルの順序変更
        value: function (source, target) {
            if (!source.repositionable || source === target)
                return;

            var changingZIndex = source._element.style.zIndex;  // sourceパネルの元のzIndex
            var changingContentsIndex = source._contentsIndex;  // sourceパネルの元の配列内位置
            var movingIndex = source._contentsIndex;            // 順序変更操作（ループ）での移動中パネルの位置
            var destinationIndex = target._contentsIndex;       // 順序変更操作（ループ）での移動先パネルの位置

            if (target._contentsIndex < source._contentsIndex) {   // 上から下へ移動
                while (destinationIndex != null) { // 下にある移動先から順に上に向かって入れ換えを進める
                    if (this._contents[destinationIndex].repositionable) {
                        this._contents[movingIndex]._element.style.zIndex =
                            this._contents[destinationIndex]._element.style.zIndex;
                        this._contents[movingIndex]._contentsIndex = this._contents[destinationIndex]._contentsIndex;
                        movingIndex = destinationIndex;
                    }
                    if (this._contents[destinationIndex]._upperPanelIndex == changingContentsIndex)
                        break;
                    destinationIndex = this._contents[destinationIndex]._upperPanelIndex;
                }
            }
            else if (target._contentsIndex > source._contentsIndex) {   // 下から上へ移動
                while (destinationIndex != null) {
                    if (this._contents[destinationIndex].repositionable) {
                        this._contents[movingIndex]._element.style.zIndex =
                            this._contents[destinationIndex]._element.style.zIndex;
                        this._contents[movingIndex]._contentsIndex = this._contents[destinationIndex]._contentsIndex;
                        movingIndex = destinationIndex;
                    }
                    if (this._contents[destinationIndex]._lowerPanelIndex == changingContentsIndex)
                        break;
                    destinationIndex = this._contents[destinationIndex]._lowerPanelIndex;
                }
            }
            this._contents[movingIndex]._element.style.zIndex = changingZIndex;
            this._contents[movingIndex]._contentsIndex = changingContentsIndex;

            // 入れ換えを反映
            this._contents.sort(this.compZIndex);
            this._updatePanelsVBreadth();  // 得られたtopの値を内包するパネルに反映させる
            this._setPanelVBreadth();

            // porderchangedイベント発火
            let ev = new HuTime.Event("porderchanged", this);
            ev.sourcePanel = source;
            ev.destinationPanel = target;
            this._hutimeRoot._handleEvent(ev);
        }
    },

    // ** タイルパネルの幅変更 **
    _captureElementExtension: { // 再下端のパネル幅の変更を検知するため、一時的にcaptureElementを伸ばす量
        value: 50
    },
    _startPanelBreadthChange: {  // 変更開始（mousedown）
        value: function (ev, eventX, eventY, targetPanel) {
            if (!targetPanel._panelBorder)
                return;
            this._panelBreadthChanging = targetPanel._panelBorder;    // パル幅変更中を設定

            // 「パネルの幅に合わせる」の場合は、再下端のパネル幅の変更（マウスイベント）を検知するため、
            // 一時的にcaptureElementの幅を_captureElementExtensionだけ伸ばす
            if (this.vBreadthMode == 2) {
                this._element.style.overflow = "visible";   // 伸ばした分を有効にするため、hiddenからvisibleに
                if (this._tRotation == 1) {
                    this._captureElement.width = this._currentVBreadth + this._captureElementExtension;
                    this._captureElement.style.width =
                        (this._currentVBreadth + this._captureElementExtension) + "px";
                    this._drawHuTimeLogo(
                        this._captureElement.width - this._captureElementExtension, this._captureElement.height);
                }
                else {
                    this._captureElement.height = this._currentVBreadth + this._captureElementExtension;
                    this._captureElement.style.height =
                        (this._currentVBreadth + this._captureElementExtension) + "px";
                    this._drawHuTimeLogo(
                        this._captureElement.width, this._captureElement.height - this._captureElementExtension);
                }
            }
        }
    },
    _progressPanelBreadthChange: {   // 変更中（パネル境界をmousemove）
        value: function (ev, eventX, eventY, targetPanel) {
            var i;  // カウンタ
            var panel = this._panelBreadthChanging._panel;   // 幅を変更するパネル
            var layer;
            panel._updateCurrentVXYOrigin();
            panel._updateCurrentVBreadth();

            // 幅を変更するパネル内のレイヤ
            if (this._tRotation == 1) {
                if (ev instanceof HuTime.TouchEvent)
                    panel.vBreadth += Math.abs(ev.handleObject.touchOneX - ev.handleObject.touchTwoX)
                        - Math.abs(ev.handleObject.touchOneOriginX - ev.handleObject.touchTwoOriginX);
                else
                    panel.vBreadth += ev._offsetX - this._dragOriginX;

                if (panel.vBreadth < panel.panelBorderWidth)   // パネル幅の最小値制限
                    panel.vBreadth = panel.panelBorderWidth;
                if (ev instanceof HuTime.TouchEvent && panel.vBreadth < panel.vBreadthTouchLoweLimit)
                    panel.vBreadth = panel.vBreadthTouchLoweLimit;   // タッチイベントの場合の最小値制限
                if (panel.vBreadth > panel.vBreadthUpperLimit)
                    panel.vBreadth = panel.vBreadthUpperLimit;    // パネル幅の上限値制限
                this._dragOriginX = ev._offsetX;
                panel._element.style.width = panel._currentVBreadth + "px";
                for (i = panel._contents.length; i--;) {
                    layer = panel._contents[i];
                    layer._updateCurrentVXYOrigin();
                    layer._updateCurrentVBreadth();
                    layer._element.style.left = layer._currentVXYOrigin + "px";
                    layer._element.style.width = layer._currentVBreadth + "px";
                    if (layer instanceof HuTime.Layer)  // Layerの派生でないパネル境界（_setVが無い）を除く
                        layer._setV();
                    if (layer instanceof HuTime.Slider) {   // スライダの場合はスライダ本体を伸長
                        layer._sliderElement.style.width = this._currentVBreadth + "px";
                        layer._zoomKnobLElement.style.width = this._currentVBreadth + "px";
                        layer._zoomKnobRElement.style.width = this._currentVBreadth + "px";
                    }
                }
            }
            else {
                if (ev instanceof HuTime.TouchEvent)
                    panel.vBreadth += Math.abs(ev.handleObject.touchOneY - ev.handleObject.touchTwoY)
                        - Math.abs(ev.handleObject.touchOneOriginY - ev.handleObject.touchTwoOriginY);
                else
                    panel.vBreadth += ev._offsetY - this._dragOriginY;

                if (panel.vBreadth < panel.panelBorderWidth)
                    panel.vBreadth = panel.panelBorderWidth;
                if (panel.vBreadth < panel.panelBorderWidth)   // パネル幅の最小値制限
                    panel.vBreadth = panel.panelBorderWidth;
                if (ev instanceof HuTime.TouchEvent && panel.vBreadth < panel.vBreadthTouchLoweLimit)
                    panel.vBreadth = panel.vBreadthTouchLoweLimit;   // タッチイベントの場合の最小値制限
                if (panel.vBreadth > panel.vBreadthUpperLimit)
                    panel.vBreadth = panel.vBreadthUpperLimit;    // パネル幅の上限値制限
                this._dragOriginY = ev._offsetY;
                panel._element.style.height = panel._currentVBreadth + "px";
                for (i = panel._contents.length; i--;) {
                    layer = panel._contents[i];
                    layer._updateCurrentVXYOrigin();
                    layer._updateCurrentVBreadth();
                    layer._element.style.top = layer._currentVXYOrigin + "px";
                    layer._element.style.height = layer._currentVBreadth + "px";
                    if (layer instanceof HuTime.Layer)
                        layer._setV();
                    if (layer instanceof HuTime.Slider) {
                        layer._sliderElement.style.height = layer._currentVBreadth + "px";
                        layer._zoomKnobLElement.style.height = layer._currentVBreadth + "px";
                        layer._zoomKnobRElement.style.height = layer._currentVBreadth + "px";
                    }
                }
            }
            this._updatePanelsVBreadth();  // 得られたtopの値を内包するパネルに反映させる
            this._setPanelVBreadth();

            // パネルコレクションの幅が「パネルに合わせる」の場合の処理（PanelCollection自身の幅を修正）
            if (this.vBreadthMode == 2) {
                if (this._tRotation == 1) {
                    this._element.style.width = this._currentVBreadth + "px";
                    this._captureElement.width = this._currentVBreadth + this._captureElementExtension;
                    this._captureElement.style.width =
                        (this._currentVBreadth + this._captureElementExtension) + "px";
                    this._drawHuTimeLogo(
                        this._captureElement.width - this._captureElementExtension, this._captureElement.height);
                }
                else {
                    this._element.style.height = this._currentVBreadth + "px";
                    this._captureElement.height = this._currentVBreadth + this._captureElementExtension;
                    this._captureElement.style.height =
                        (this._currentVBreadth + this._captureElementExtension) + "px";
                    this._drawHuTimeLogo(
                        this._captureElement.width, this._captureElement.height - this._captureElementExtension);
                }
            }

        }
    },
    _endPanelBreadthChange: {
        value: function (ev, eventX, eventY, targetPanel) {
            this._panelBreadthChanging._panel.changeVBreadth();   // パネル幅変更を確定、再描画

            // 「パネルの幅に合わせる」の場合に変更したcaptureElementの設定を基に戻す
            this._element.style.overflow = "hidden";    // visibleからhiddenに戻す
            if (this._tRotation == 1) {
                this._captureElement.width = this._currentVBreadth;
                this._captureElement.style.width = this._currentVBreadth + "px";
            }
            else {
                this._captureElement.height = this._currentVBreadth;
                this._captureElement.style.height = this._currentVBreadth + "px";
            }
            this._drawHuTimeLogo(this._captureElement.width, this._captureElement.height);
            this._panelBreadthChanging = null;   // パネル幅変更中を解除
            this._dragDirection = null;     // ドラッグの方向を未決に戻す
        }
    },
    _mouseTimer: {
        writable: true,
        value: null
    },
    _handleTimeout: {
        value: function (type, obj) {
            obj._hutimeRoot._handleInnerEvent(   // 内部イベントを発火
                HuTime.InnerEvent.createWithT(type, obj, obj._hutimeRoot.minT, obj._hutimeRoot.maxT));
        }
    },
    _handleCaptureMouseEvent: {  // captureElementからのマウスイベントを受け取る
        value: function (domEv) {
            if ("touches" in domEv) {   // いったんタッチイベント処理に渡し、tap, swip, pinchなどのイベントに変換する
                domEv.target.hutimeObject._hutimeRoot._handleTouchEvent(domEv, domEv.target.hutimeObject._captureElement);
                domEv.returnValue = false;
                domEv.preventDefault();
                return false;
            }

            // 処理をオブジェクトツリーのRoot（HuTimeオブジェト）に渡す
            // thisが書き換わっているので、canvasに加えておいたhutimeObjectから参照する
            if (!domEv.target.hutimeObject._preventMouseEvent)
                domEv.target.hutimeObject._hutimeRoot._handleMouseEvent(domEv);

            // ブラウザの既定の処理を抑止
            domEv.returnValue = false;
            domEv.preventDefault();
            return false;
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.ContainerBase.prototype._toJSONProperties, {
            _tLengthDefault: { value: "tLengthDefault" },
            tLength: { value: "tLength" },
            _tLengthMode: { value: "tLengthMode" },

            _vBreadthMode: { value: "vBreadthMode" },

            _panelsVBreadth: { value: "panelsVBreadth" },
            dragSensitivity: { value: "dragSensitivity" },
            _vScrollable: { value: "vScrollable" },

            _pinchDirection: { value: "pinchSensitivity" },
            wheelZoomRatio: { value: "wheelZoomRatio"}
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.ContainerBase.prototype._parseJSONProperties, {
            tLengthDefault: { value: "_tLengthDefault" },
            tLengthMode: { value: "_tLengthMode" },
            vBreadthMode: { value: "_vBreadthMode" },
            panelsVBreadth: { value: "_panelsVBreadth" },
            vScrollable: { value: "_vScrollable" },
            pinchSensitivity: { value: "_pinchDirection" }
        })
    }
});

// ******** パネル（基底クラス）********
HuTime.PanelBase = function () {
    HuTime.ContainerBase.apply(this);
};
HuTime.PanelBase.prototype = Object.create(HuTime.ContainerBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.PanelBase
    },

    // **** 座標関係 ****
    tRatio: {       // t軸の表示幅の拡大率（_hutimeRoot.minT, maxXに対して何倍の範囲を表示するか）
        writable: true,
        value: 1.0
    },
    minPnlT: {      // 表示幅の拡大率を反映させたPanelのt軸の表示範囲（最小値）
        get: function() {
            if (!this._hutimeRoot)
                return 0;   // 暫定措置（PanelCollectionのJSONを読み込むとここにはまることがある）
            return this._hutimeRoot.minT -
                (this._hutimeRoot.maxT - this._hutimeRoot.minT) * (this.tRatio - 1) / 2 ;
        }
    },
    maxPnlT: {      // 表示幅の拡大率を反映させたPanelのt軸の表示範囲（最大値）
        get: function() {
            if (!this._hutimeRoot)
                return 0;   // 暫定措置（PanelCollectionのJSONを読み込むとここにはまることがある）
            return this._hutimeRoot.maxT +
                (this._hutimeRoot.maxT - this._hutimeRoot.minT) * (this.tRatio - 1) / 2 ;
        }
    },

    // **** パネル内のレイヤ操作 ****
    layers: {           // contentsのエイリアス
        get: function() {
            return this._contents;
        }
    },
    appendContent: {    // 継承元の処理を差し替えておく
        value: function (content) {
            this.appendLayer(content);
        }
    },
    removeContent: {
        value: function (content) {
            this.removeLayer(content);
        }
    },
    appendLayer: {
        value: function (layer) {
            if (layer instanceof HuTime.Layer)  // スライダは不可（マウスイベント処理が異なるため、あらかじめ排除）
                HuTime.ContainerBase.prototype.appendContent.apply(this, arguments);
        }
    },
    removeLayer: {
        value: function (layer) {
            if (layer instanceof HuTime.Layer)
                HuTime.ContainerBase.prototype.removeContent.apply(this, arguments);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.ContainerBase.prototype._toJSONProperties, {
            tRatio: { value: "tRatio" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.ContainerBase.prototype._parseJSONProperties, {
        })
    }
});

// ******** タイルパネル ********
HuTime.TilePanel = function TilePanel (vBreadth) {
    if (!isFinite(vBreadth) || vBreadth == null)
        this._vBreadth = this.vBreadthDefault;
    else
        this.vBreadth = vBreadth;
    HuTime.PanelBase.apply(this);

    this._element = document.createElement("div");
    this._element.style.overflow = "hidden";
    this._element.style.position = "absolute";
    this._element.style.backgroundColor = "#FFFFFF";
    this._element.style.border = "solid 1px #000000";
    this._element.style.marginLeft = "-" + this._element.style.borderWidth;
    this._element.style.marginTop = "-" + this._element.style.borderWidth;
    this._element.style.zIndex = 0;

    this._panelBorder = new HuTime.PanelBorder(this);   // パネル境界オブジェクトを設定
    HuTime.ContainerBase.prototype.appendContent.apply(this, [this._panelBorder]);  // パネル境界をレイヤとして追加
};
HuTime.TilePanel.prototype = Object.create(HuTime.PanelBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.TilePanel
    },
    _panelBorder: {         // パネル境界オブジェクトを収容するプロパティ
        writable: true,
        value: null
    },
    panelBorderWidth: {    // パネル境界の幅
        writable: true,
        value: 8
    },

    // **** 書式 ****
    _vBreadth: {
        writable: true,
        value: null
    },
    vBreadth: {
        get: function() {
            return this._vBreadth;
        },
        set: function(val) {
            if (!isFinite(val) || val == null)
                return;
            this._vBreadth = val;
            if (this._vBreadth < this.panelBorderWidth)
                this._vBreadth = this.panelBorderWidth;  // パネルの幅の最小値制限（パネル境界の幅以下にはできない）
            if (this._vBreadth > this.vBreadthUpperLimit)
                this._vBreadth = this.vBreadthUpperLimit;    // パネル幅の上限値制限
        }
    },

    vBreadthTouchLoweLimit: {   // タッチ操作の場合のパネル高さ（幅）の下限（指の太さを考慮）
        writable: true,
        value: 50
    },
    vBreadthUpperLimit: {    // パネル高さ（幅）の上限
        writable: true,
        value: 2000
    },
    changeVBreadth: {    // パネル高さ（幅）の変更
        value: function(vBreadth) {
            if (!this.resizable)
                return;

            if (isFinite(vBreadth) && vBreadth != null) {
                if (this._vBreadth == vBreadth)
                    return;     // 値が変わらない場合も何もしない
                this.vBreadth = vBreadth;   // 数値のチェックのため、setterを用いる
                this._parent._updatePanelsVBreadth();  // 得られたtopの値を内包するパネルに反映させる
                this._parent._setPanelVBreadth();
            }
            this.redraw();
            for (var i = 0; i < this._parent._contents.length; ++i) {
                if (!(this._parent._contents[i] instanceof HuTime.TilePanel) &&
                    this._parent._contents[i].vBreadth == null)
                    this._parent._contents[i].redraw(); // サイズをタイルパネルに合わせている固定レイヤの再描画
            }

            // イベント発火
            var newEv = new HuTime.Event("pvbreadthchanged", this);
            this._hutimeRoot._handleEvent(newEv);
        }
    },

    _tilePanelVXYOrigin: {   // 表示位置（タイル表示位置を反映させた値をPanelCollectionで設定）
        writable: true,
        value: 0
    },
    _updateCurrentVBreadth: {
        value: function () {
            this._currentVBreadth = this.vBreadth;
        }
    },
    _updateCurrentVXYOrigin: {
        value: function () {    // PanelCollectionで設定された値にスクロール分を追加する
            this._currentVXYOrigin = this._parent._vScrolled + this._tilePanelVXYOrigin;
        }
    },
    zIndex: {
        get: function() {  // Z-Index（タイルパネルの表示位置変更を追加）
            if (this._element.style.zIndex)
                return parseFloat(this._element.style.zIndex);
            else
                return 0;
        },
        set: function(val) {
            if ((typeof val) != "number" || val < 0 || val > 2147483647)
                return;

            var i;  // カウンタ
            this._element.style.zIndex = val;

            // 入れ換えを反映
            if (!this._parent)
                return;

            // 親オブジェクトのcontentsはOverlayPanelも含むので、TilePanelのみを数えて順番を把握する
            var tileCount, tileOrder, tileOrderOld;     // タイルパネルの数、入れ替え前の位置、入れ替え後の位置
            tileCount = 0;
            for (i = 0; i < this._parent._contents.length; ++i) {
                if (this._parent._contents[i] instanceof HuTime.TilePanel)
                    ++tileCount;    // タイルパネルの数をカウントアップ
                if (this._parent._contents[i] === this)
                    tileOrderOld = tileCount;   // 自分の場合、現在の数を位置として記録
            }
            this._parent._contents.sort(this._parent.compZIndex);
            tileCount = 0;
            for (i = 0; i < this._parent._contents.length; ++i) {
                this._parent._contents[i]._contentsIndex = i;
                if (this._parent._contents[i] instanceof HuTime.TilePanel)
                    ++tileCount;
                if (this._parent._contents[i] === this)
                    tileOrder = tileCount;
            }
            if (tileOrder != tileOrderOld) {
                this._parent._updatePanelsVBreadth();  // 得られたtopの値を内包するパネルに反映させる
                this._parent._setPanelVBreadth();

                // porderchangedイベント発火
                var newEv = new HuTime.Event("porderchanged", this._parent);
                this._hutimeRoot._handleEvent(newEv);
            }
        }
    },
    visible: {      // 表示・非表示
        get: function() {
            return this._visible;
        },
        set: function(val) {
            if ((typeof val) != "boolean")
                return;
            var visibleOld = this._visible;
            if (val) {
                this._visible = true;
                this._element.style.visibility = "visible";
            }
            else {
                this._visible = false;
                this._element.style.visibility = "hidden";
            }

            // 変更を反映
            if (visibleOld == this._visible || !this._parent)
                return;
            if (this._visible)
                this.redraw();  // 非表示中は再描画されていないので、「表示」に変更した場合は再描画する
            this._parent._contents.sort(this._parent.compZIndex);
            this._parent._updatePanelsVBreadth();
            this._parent._setPanelVBreadth();
            for (var i = 0; i < this._parent._contents.length; ++i) {
                if (!(this._parent._contents[i] instanceof HuTime.TilePanel) &&
                    this._parent._contents[i].vBreadth == null)
                    this._parent._contents[i].redraw(); // サイズをタイルパネルに合わせている固定レイヤの再描画
            }
        }
    },

    _repositionable: {     // タイルパネルの順番変更の可否
        writable: true,
        value: true
    },
    repositionable: {
        get: function() {
            return this._repositionable;
        },
        set: function(val) {
            if ((typeof val) == "boolean")
                this._repositionable = val;
        }
    },
    _resizable: {            // 高さ（幅）の変更の可否
        writable: true,
        value: true
    },
    resizable: {
        get: function() {
            return this._resizable;
        },
        set: function(val) {
            if ((typeof val) == "boolean")
                this._resizable = val;
        }
    },

    _upperPanelIndex: {       // タイル表示の際の上（左）のパネルのPanelCollection._contentsのindex
        writable: true,
        value: null
    },
    upperPanel: {           // タイル表示の際の上（左）のパネル
        get: function() {
            if (this._parent._contents[this._upperPanelIndex])
                return this._parent._contents[this._upperPanelIndex];
            else
                return null;
        }
    },
    _lowerPanelIndex: {       // タイル表示の際の下（右）のパネルのPanelCollection._contentsのindex
        writable: true,
        value: null
    },
    lowerPanel: {
        get: function() {   // タイル表示の際の下（右）のパネル
            if (this._parent._contents[this._lowerPanelIndex])
                return this._parent._contents[this._lowerPanelIndex];
            else
                return null;
        }
    },

    // **** マウスイベント関係 ****
    isInsideXY: {
        value: function(x, y) {        // 自域内の座標であるかの判断（パネル下端の境界分を追加）
            if (this._tRotation == 1)
                return (x < this._currentVBreadth + this.panelBorderWidth / 2 + this._currentVXYOrigin &&
                x >= this._currentVXYOrigin);
            else
                return (y < this._currentVBreadth + this.panelBorderWidth / 2 + this._currentVXYOrigin &&
                y >= this._currentVXYOrigin);
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.PanelBase.prototype._toJSONProperties, {
            _contents: {
                value: function (objForJSON) {
                    objForJSON["contents"] = [];
                    for (var i = 0; i < this._contents.length; ++i) {
                        if (this._contents[i].constructor.name != "PanelBorder")
                            objForJSON["contents"][i] = this._contents[i];
                    }
                }
            },
            panelBorderWidth: { value: "panelBorderWidth" },
            _vBreadth: { value: "vBreadth" },

            vBreadthTouchLoweLimit: { value: "vBreadthTouchLoweLimit" },
            vBreadthUpperLimit: { value: "vBreadthUpperLimit" },

            _repositionable: { value: "repositionable" },
            _resizable: { value: "resizable" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.PanelBase.prototype._parseJSONProperties, {
            vBreadth: { value: "_vBreadth" },
            repositionable: { value: "_repositionable" },
            resizable: { value: "_resizable" }
        })
    }
});

// ******** スライダ表示用パネル ********
// マウス操作によるスライダの動作が他と異なるため、スライダを含むパネルであることをinstanceofで区別できるようにする
HuTime.SliderPanel = function (vBreadth) {
    HuTime.TilePanel.apply(this, arguments);
};
HuTime.SliderPanel.prototype = Object.create(HuTime.TilePanel.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.SliderPanel
    },

    // **** 座標関係 ****
    tRatio: {       // t軸の表示幅の拡張率（_hutimeRoot.minT, maxTに対して何倍の範囲を表示するか）
        writable: true,
        value: 3.0  // 既定値がTilePanelと異なる
    },

    // **** パネル内のレイヤ操作 ****
    appendLayer: {  // スライダの追加を可能にする（継承元の排除部分を削除）
        value: function (layer) {
            if (layer instanceof HuTime.Layer || layer instanceof HuTime.Slider)
                HuTime.ContainerBase.prototype.appendContent.apply(this, arguments);
        }
    }
});

// ******** オーバレイパネル ********
HuTime.OverlayPanel = function (vBreadth, vMarginTop, vMarginBottom) {
    if (isFinite(vBreadth))
        this.vBreadth = vBreadth;
    if (isFinite(vMarginTop))
        this.vMarginTop = vMarginTop;
    if (isFinite(vMarginBottom))
        this.vMarginBottom = vMarginBottom;
    HuTime.PanelBase.apply(this);

    this._element = document.createElement("div");
    this._element.style.overflow = "hidden";
    this._element.style.position = "absolute";
    this._element.style.background = "none";    // overlayなので背景なし
    this._element.style.border = "none";
    this._element.style.zIndex = 0;
};
HuTime.OverlayPanel.prototype = Object.create(HuTime.PanelBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.OverlayPanel
    },

    // **** 書式 ****
    _updateCurrentVXYOrigin: {    // 親の幅でなく、タイルパネルの幅の合計が基準になるため、オーバーライド
        value: function() {
            if (!this._parent) {
                this._currentVXYOrigin = 0;
                return;
            }

            if (this._tRotation == 1 && this.vMarginForX == 1) {
                if (this.vMarginBottom != null && isFinite(this.vMarginBottom)) {
                    this._currentVXYOrigin =  this._parent._vScrolled + this.vMarginBottom;
                    return;
                }
                if (this.vMarginTop != null && isFinite(this.vMarginTop) &&
                    this.vBreadth != null && isFinite(this.vBreadth)) {
                    this._currentVXYOrigin = this._parent._vScrolled +
                        this._parent._panelsVBreadth - this.vBreadth - this.vMarginTop;
                    return;
                }
                this._currentVXYOrigin = 0;
                return;
            }
            else {
                if (this.vMarginTop != null && isFinite(this.vMarginTop)) {
                    this._currentVXYOrigin = this._parent._vScrolled + this.vMarginTop;
                    return;
                }
                if (this.vMarginBottom != null && isFinite(this.vMarginBottom) &&
                    this.vBreadth != null && isFinite(this.vBreadth)) {
                    this._currentVXYOrigin = this._parent._vScrolled +
                        this._parent._panelsVBreadth - this.vBreadth - this.vMarginBottom;
                    return;
                }
                this._currentVXYOrigin = this._parent._vScrolled;
            }
        }
    },
    _updateCurrentVBreadth: {    // 親の幅でなく、タイルパネルの幅の合計が基準になるため、オーバーライド
        value: function() {
            if (this.vBreadth != null && isFinite(this.vBreadth) &&
                !(this.vMarginTop != null && isFinite(this.vMarginTop) &&   // 3つとも値が入った場合はvBreadthは無視
                this.vMarginBottom != null && isFinite(this.vMarginBottom))) {
                this._currentVBreadth = this.vBreadth;
                return;
            }

            var top = (this.vMarginTop != null && isFinite(this.vMarginTop)) ? this.vMarginTop : 0;
            var bottom = (this.vMarginBottom != null && isFinite(this.vMarginBottom)) ? this.vMarginBottom : 0;
            if (!this._parent) {// 親オブジェクトが設定されていないと、計算に必要なthis._parent._panelsVBreadthを取得できない
                this._currentVBreadth = 0;   // 親オブジェクトが設定されていない場合は0
                return;
            }
            var height = this._parent._panelsVBreadth - top - bottom;
            this._currentVBreadth = height < 0 ? 0 : height;     // 0未満の場合は0を返す
        }
    },

    // **** マウスイベント関係 ****
    _mouseEventCapture: {    // マウスイベントをキャプチャする範囲（0:なし, 1:子を除く, 2:子のみ, 3:全て）
        writable: true,
        value: 2    // オーバレイ用なので、既定値は子以外は透過させる設定にする
    }
});

// ******** パネル境界 ********
HuTime.PanelBorder = function PanelBorder (panel) {
    HuTime.ContainerBase.apply(this);
    if (panel instanceof HuTime.TilePanel)
        this._panel = panel;

    this._element = document.createElement("div");
    this._element.style.overflow = "hidden";
    this._element.style.position = "absolute";
    this._element.style.backgroundColor = "cyan";
    this._element.style.border = "none";
    this._element.style.visibility = "hidden";  // 通常は不可視
    this._element.style.zIndex = 9000;
};
HuTime.PanelBorder.prototype = Object.create(HuTime.ContainerBase.prototype, {
    constructor: {
        value: HuTime.PanelBorder
    },
    _panel: {    // 所属するパネル
        writable: true,
        value: null
    },
    panel: {    // 所属するパネル
        get: function() {
            return this._panel;
        }
    },
    vBreadthDefault: {
        value: HuTime.TilePanel.prototype.panelBorderWidth
    },
    vBreadth: {
        get: function() {
            return this._panel.panelBorderWidth;
        }
    },
    vMarginTop: {
        value: null
    },
    vMarginBottom: {    // 下端から1/2はみ出す値を返す
        get: function() {
            return - this._panel.panelBorderWidth / 2
        }
    },
    vMarginForX: {
        value: 0
    },

    zIndex: {
        get: function() {
            if (!this._element.style.zIndex)
                this._element.style.zIndex = 9000;
            return parseFloat(this._element.style.zIndex);
        }
    },

    // **** オブジェクトツリー ****
    appendContent: {
        value: function(content) {
            // 子オブジェクトがないので、無効化する
        }
    },
    removeContent: {
        value: function(content) {
            // 子オブジェクトがないので、無効化する
        }
    },

    // **** 描画関係 ****
    clear: {
        value: function() {
        }
    },

    // **** マウスイベント関係 ****
    mouseEventCapture: {    // マウスイベントをキャプチャする範囲（1:子を除くで固定）
        value: 1    // 既定値－子オブジェクト以外をキャプチャ
    }
});

// ******** レイヤ ********
HuTime.Layer = function Layer (vBreadth, vMarginTop, vMarginBottom, vTop, vBottom) {
    // vBreadth, vMarginTop, vMarginBottom: レイヤの表示位置関係（幅、上マージン、下マージン）
    // vTop, vBottom: レイヤのv軸関係（v軸->y軸の場合の上端、下端の値）
    HuTime.ContainerBase.apply(this, arguments);

    if (isFinite(vBreadth))
        this.vBreadth = vBreadth;
    if (isFinite(vMarginTop))
        this.vMarginTop = vMarginTop;
    if (isFinite(vMarginBottom))
        this.vMarginBottom = vMarginBottom;

    if (isFinite(vTop))
        this._vTop = vTop;
    if (isFinite(vBottom))
        this._vBottom = vBottom;

    this._element = document.createElement("div");
    this._element.style.overflow = "hidden";
    this._element.style.position = "absolute";
    this._element.style.background = "none";    // 初期値は背景なし
    this._element.style.borderStyle = "none";
    this._element.style.zIndex = 0;

    this._canvas = document.createElement("canvas");
    this._canvas.style.overflow = "hidden";
    this._canvas.style.position = "absolute";
    this._canvas.style.background = "none";    // 背景なし
    this._canvas.style.borderStyle = "none";
    this._canvas.style.padding = "0";
    this._canvas.style.zIndex = 2000;
    this._element.appendChild(this._canvas);
};
HuTime.Layer.prototype = Object.create(HuTime.ContainerBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.Layer
    },

    _fixedLayer: {   // 固定レイヤとして扱う場合true
        writable: true,
        value: false
    },
    fixedLayer: {
        get: function() {
            return this._fixedLayer
        },
        set: function(val) {
            if ((typeof val) != "boolean")
                return;
            this._fixedLayer = val;
        }
    },

    _canvas: {
        writable: true,
        value: null
    },
    canvas: {
        get: function() {
            return this._canvas;
        }
    },

    // **** 座標関係 ****
    // t軸: アクセス頻度が高いので、値を内部にコピーしておく
    _minLyrT: {         // t軸の表示範囲（最小値）
        writable: true,
        value: 0.0
    },
    minLyrT: {
        get: function() {
            return this._minLyrT;
        }
    },
    _maxLyrT: {         // t軸の表示範囲（最大値）
        writable: true,
        value: 200.0
    },
    maxLyrT: {
        get: function () {
            return this._maxLyrT;
        }
    },
    _lyrTResolution: {  // t軸の解像度（px/lyrT）
        writable: true,
        value: HuTime.PanelCollection.prototype._tLengthDefault / 200
    },
    lyrTResolution: {
        get: function() {
            return this._lyrTResolution;
        }
    },
    _setT: {
        value: function() {     // t軸関係の設定
            if (this._parent)
                this._minLyrT = this._parent.minPnlT;
            if (this._parent)
                this._maxLyrT = this._parent.maxPnlT;
            this._lyrTResolution = this._currentTLength / (this._maxLyrT - this._minLyrT);
        }
    },
    getXYFromT: {
        value: function(t) {       // t値からxy座標値を得る
            if (this._tDirection == 1)
                return (this._maxLyrT - t) * this._lyrTResolution;
            else
                return (t - this._minLyrT) * this._lyrTResolution;
        }
    },
    getTFromXY: {
        value: function(xy) {      // xy座標値からt値を得る
            if (this._tDirection == 1)
                return this._maxLyrT - xy / this._lyrTResolution;
            else
                return this._minLyrT + xy / this._lyrTResolution;
        }
    },

    // v軸
    _vTop: {        // v軸の範囲（y軸の場合の上端）
        writable: true,
        value: 0
    },
    vTop: {          // v軸の範囲（y軸の場合の上端）
        get: function() {
            return this._vTop;
        },
        set: function(val) {
            if (isFinite(val))
                this._vTop = val;
        }
    },
    _vBottom: {      // v軸の範囲（y軸の場合の下端）
        writable: true,
        value: 100
    },
    vBottom: {       // v軸の範囲（y軸の場合の下端）
        get: function() {
            return this._vBottom;
        },
        set: function(val) {
            if (isFinite(val))
                this._vBottom = val;
        }
    },
    _lyrVResolution: {  // v軸の解像度（px/lyrV）
        writable: true,
        value: HuTime.ContainerBase.prototype.vBreadthDefault / 100
    },
    lyrVResolution: {   // v軸の解像度（px/lyrV）
        get: function() {
            return this._lyrVResolution;
        }
    },
    _setV: {    // v軸関係の設定
        value: function() {
            this._lyrVResolution = this._currentVBreadth / (this._vBottom - this._vTop);
        }
    },
    _vForX: {   // v軸がヨコの時の値の適用（0: vTopが左の値, 1: vBottomが左の値）
        writable: true,
        value: 0
    },
    vForX: {   // v軸がヨコの時の値の適用（0: vTopが左の値, 1: vBottomが左の値）
        get: function() {
            return this._vForX;
        },
        set: function(val) {
            if ((typeof val) != "number" || val % 1 != 0 || val < 0 || val > 1)
                return;
            this._vForX = val;
        }
    },

    getXYFromV: {
        value: function(v) {
            if (this._tRotation == 1 && this.vForX == 1)
                return (this._vBottom - v) * this._lyrVResolution;
            else
                return (v - this._vTop) * this._lyrVResolution;
        }
    },
    getVFromXY: {
        value: function(xy) {
            if (this._tRotation == 1 && this.vForX == 1)
                return this._vBottom - xy / this._lyrVResolution;
            else
                return this._vTop + xy / this._lyrVResolution;
        }
    },

    // **** レイヤ上のオブジェクト関係 ****
    objects: {
        get: function() {
            return this._contents;
        }
    },
    appendContent: {    // 継承元の処理を差し替えておく
        value: function (content, canvas) {
            this.appendObject(content, canvas);
        }
    },
    removeContent: {
        value: function (content) {
            this.removeObject(content);
        }
    },
    appendObject: {
        value: function(obj, canvas) {     // レイヤ上に図形などを追加
            if (!(obj instanceof HuTime.OnLayerObjectBase))
                return;
            if (obj.layer instanceof HuTime.Layer)
                obj.layer.removeObject();
            obj.layer = this;
            this._contents.push(obj);
            if (canvas instanceof HTMLCanvasElement)
                obj.canvas = canvas;
            else
                obj.canvas = this._canvas;
        }
    },
    removeObject: {
        value: function(obj) {  // レイヤ上から図形などを削除
            if (!(obj instanceof HuTime.OnLayerObjectBase))
                return;
            obj.layer = null;
            for (var i = this.contents.length; i--; ) {
                if (this._contents[i] === obj) {
                    this._contents.splice(i, 1);
                    break;
                }
            }
        }
    },

    // **** 描画関係 ****
    clear: {
        value: function () {    // レイヤ画面のクリア
            var ctx = this._canvas.getContext('2d');
            ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        }
    },
    _redrawBeforeChild: {
        value: function() {
            this._setT();
            this._setV();
            HuTime.ContainerBase.prototype._redrawBeforeChild.apply(this, arguments);

            if (this._tRotation == 1) {     // canvas要素の幅と高さの設定
                this._canvas.style.top = 0;
                this._canvas.height = this._currentTLength;
                this._canvas.style.height = this._currentTLength + "px";
                this._canvas.width = this._currentVBreadth;
                this._canvas.style.width = this._currentVBreadth + "px";

            }
            else {
                this._canvas.style.left = 0;
                this._canvas.width = this._currentTLength;
                this._canvas.style.width = this._currentTLength + "px";
                this._canvas.height = this._currentVBreadth;
                this._canvas.style.height = this._currentVBreadth + "px";
            }
        }
    },

    // **** イベント関係 ****
    _handleInnerEventBubbling: {
        value: function (ev) {    // 内部イベントの処理
            if (this._fixedLayer)
                return;     // 固定レイヤは何もしない

            if (ev.type == "tmove") {
                switch (this.displayMode) {
                    case 0:
                        this._canvas.style.left = ((this._minLyrT - this._parent.minPnlT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._canvas.style.width = ((this._maxLyrT - this._minLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        break;

                    case 1:
                        this._canvas.style.left = ((this._parent.maxPnlT - this._maxLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._canvas.style.width = ((this._maxLyrT - this._minLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        break;

                    case 2:
                        this._canvas.style.top = ((this._minLyrT - this._parent.minPnlT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._canvas.style.height = ((this._maxLyrT - this._minLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        break;

                    case 3:
                        this._canvas.style.top = ((this._parent.maxPnlT - this._maxLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        this._canvas.style.height = ((this._maxLyrT - this._minLyrT) *
                            this._currentTLength / (this._parent.maxPnlT - this._parent.minPnlT)) + "px";
                        break;
                }
                return;
            }
            if (ev.type == "tmovestop") {   // tmoveendでは全体が再描画されるので、Layerではtmovestopのみ対応
                this.redraw();
                return;
            }
        }
    },

    // **** マウスイベント関係 ****
    _mouseEventCapture: {    // マウスイベントをキャプチャする範囲（0:なし, 1:子を除く, 2:子のみ, 3:全て）
        writable: true,
        value: 2    // オーバレイ用なので、既定値は子以外は透過させる設定にする
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.ContainerBase.prototype._toJSONProperties, {
            _fixedLayer: { value: "fixedLayer" },
            _vTop: { value: "vTop" },
            _vBottom: { value: "vBottom" },
            _vForX: { value: "vForX"}
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.ContainerBase.prototype._parseJSONProperties, {
            fixedLayer: { value: "_fixedLayer" },
            vTop: { value: "_vTop" },
            vBottom: { value: "_vBottom" },
            vForX: { value: "_vForX" }
        })
    }
});

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

// ******** レイヤ上の図形オブジェクト ********
// レイヤ上の図形オブジェクトの基底クラス
HuTime.OnLayerObjectBase = function OnLayerObjectBase (position) {
    this.position = position;
    this._userEvents = [];
};
HuTime.OnLayerObjectBase.prototype = {
    // **** 基本構造 ****
    constructor: HuTime.OnLayerObjectBase,
    id: "",             // レイヤオブジェクトのID
    name: "",           // 名称
    layer: null,        // 所属するレイヤ
    canvas: null,
    position: null,     // 描画位置
    rotate: 0,          // 回転（deg）
    style: null,
    zIndex: 0,
    _visible: true,
    get visible() {
        return this._visible;
    },
    set visible(val) {
        this._visible = val == true;    // 論理式の結果を代入することで、trueかfalseのどちらかが入る
    },

    get _parent() {         // ContainerBaseの動作との互換のため、getter/setterで属するLayerを扱う
        return this.layer;
    },
    set _parent(val) {
        this.layer = val;
    },
    get parent() {
        return this.layer;
    },
    _setParent: function(val) {
        this.layer = val;
    },
    _contentsIndex: -1,     // 親オブジェクトのcontents配列内での位置
    get contentIndex() {
        return _contentsIndex;
    },

    // **** 描画関係 ****
    redraw: function () {      // 描画
        if (this.processBeforeRedraw instanceof Function)
            this.processBeforeRedraw(this);
        this._redrawObject();
        if (this.processAfterRedraw instanceof Function)
            this.processAfterRedraw(this);
    },
    _redrawObject: function () {     // オブジェクトの本体の描画（継承先で内容を記述）
    },
    processBeforeRedraw: null,      // ユーザによる描画処理など（オブジェクトの描画前）
    processAfterRedraw: null,       // ユーザによる描画処理など（オブジェクトの描画後）

    // **** イベント関係 ****
    _userEvents: null,  // ユーザイベントの情報を収容する配列
    addEventListener: function (type, handler, useCapture) {    // ユーザ定義イベントの追加
        if (type && handler)
            this._userEvents.push(new HuTime.UserEvent(type, handler, useCapture));
    },
    dispatchEvent: function(ev) {
        if (!(ev instanceof HuTime.Event))
            return;
        ev.target = this;
        this.layer._hutimeRoot._handleEvent(ev);
    },

    _isMouseIn: false,
    _getExtractionArea: function(){},    // 抽出領域を取得するためのCallBack関数
    _extractInnerTouchEvent: function (ev, eventX, eventY) {
        var ctx = this._getExtractionArea(this.layer);
        if (ctx.isPointInPath(eventX, eventY))
            ev._target = this;
    },
    _extractMouseEvent: function(domEv, eventX, eventY) {
        var ctx = this._getExtractionArea(this.layer);
        var eventInfos = [];

        if (!ctx.isPointInPath(eventX, eventY)) {
            if (this._isMouseIn && (domEv.type == "mousemove" || domEv.type == "mouseout")) {
                this._isMouseIn = false;
                eventInfos.push(new HuTime.EventInfo("mouseout", this, eventX, eventY));
            }
            return eventInfos;
        }

        if(!this._isMouseIn && (domEv.type == "mousemove" || domEv.type == "mouseover")) {
            this._isMouseIn = true;
            eventInfos.push(new HuTime.EventInfo("mouseover", this, eventX, eventY));
            eventInfos.push(new HuTime.EventInfo("mousemove", this, eventX, eventY));
            return eventInfos;
        }

        eventInfos.push(new HuTime.EventInfo(domEv.type, this, eventX, eventY));
        return eventInfos;
    },

    _handleMouseEvent: function (ev, eventX, eventY) {   // マウスイベントの処理
        var eventResult;
        if (!ev._preventUserEvent) {
            for (var i = this._userEvents.length; i--; ) {  // ユーザイベント（Capture/Bubbling Phase）
                if (this._userEvents[i].type == ev._type) {
                    eventResult = this._userEvents[i].handler.apply(ev.target, [ev]);
                    if (eventResult != undefined && !eventResult) {
                        ev._preventUserEvent = true;
                        return;
                    }
                    if (ev._preventEvent)
                        return;
                }
            }
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        id: "id",
        name: "name",
        position: "position",
        rotate: "rotate",
        style: "style",
        _visible: "visible",
        processBeforeRedraw: "processBeforeRedraw",
        processAfterRedraw: "processAfterRedraw",
        _userEvents: function (objForJSON) {
            if (this._userEvents.length > 0)
                objForJSON["userEvents"] = HuTime.JSON.stringify(this._userEvents);
        }
    },
    _parseJSONProperties: {
        visible: "_visible",
        userEvents: null
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// **** 線オブジェクト ****
HuTime.Line = function Line (style, positions) {
    this.position = positions;
    this.style = style;
    this._userEvents = [];
};
HuTime.Line.prototype = Object.create(HuTime.OnLayerObjectBase.prototype, {
    constructor: {
        value: HuTime.Line
    },

    _redrawObject: {   // 描画
        value: function () {
            HuTime.Drawing.drawLine(this.style, this.layer, this.position, this.canvas);
        }
    },
    _getExtractionArea: {   // イベント検出用の領域（パス）を取得
        value: function() {
            return HuTime.Drawing.pathLine(this.layer, this.position, this.canvas);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._toJSONProperties, {
            position: { value: "position" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._parseJSONProperties, {
        })
    }
});

// **** ポリゴンオブジェクト ****
HuTime.Polygon = function Polygon (style, position) {
    this.position = position;
    this.style = style;
    this._userEvents = [];
};
HuTime.Polygon.prototype = Object.create(HuTime.OnLayerObjectBase.prototype, {
    constructor: {
        value: HuTime.Polygon
    },

    _redrawObject: {   // 描画
        value: function () {
            HuTime.Drawing.drawPolygon(this.style, this.layer, this.position, this.canvas);
        }
    },
    _getExtractionArea: {   // イベント検出用の領域（パス）を取得
        value: function() {
            return HuTime.Drawing.pathPolygon(this.layer, this.position, this.canvas);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._toJSONProperties, {
            position: { value: "position" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._parseJSONProperties, {
        })
    }
});

// **** 正方形オブジェクト ****
HuTime.Square = function Square (style, position, width, rotate) {
    this.position = position;
    this.width = width;
    this.rotate = rotate;
    this.style = style;
    this._userEvents = [];
};
HuTime.Square.prototype = Object.create(HuTime.OnLayerObjectBase.prototype, {
    constructor: {
        value: HuTime.Square
    },
    width: {            // 大きさ（正方形の辺の長さ）
        writable: true,
        value: 0
    },

    _redrawObject: {   // 描画
        value: function () {
            HuTime.Drawing.drawSquare(this.style, this.layer, this.position, this.width, this.rotate, this.canvas);
        }
    },
    _getExtractionArea: {   // イベント検出用の領域（パス）を取得
        value: function() {
            return HuTime.Drawing.pathSquare(this.layer, this.position, this.width, this.rotate, this.canvas);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._toJSONProperties, {
            width: { value: "width" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._parseJSONProperties, {
        })
    }
});

// **** 矩形オブジェクト ****
HuTime.Rect = function Rect (style, position1, position2, rotate) {
    this.position = position1;
    this.position2 = position2;
    this.style = style;
    this.rotate = rotate;
    this._userEvents = [];
};
HuTime.Rect.prototype = Object.create(HuTime.OnLayerObjectBase.prototype, {
    constructor: {
        value: HuTime.Rect
    },
    position2: {            // 矩形において、positionの対角線に位置する2つ目のPosition
        writable: true,
        value: null
    },

    _redrawObject: {   // 描画
        value: function () {
            HuTime.Drawing.drawRect(this.style, this.layer, this.position, this.position2, this.rotate, this.canvas);
        }
    },
    _getExtractionArea: {   // イベント検出用の領域（パス）を取得
        value: function() {
            return HuTime.Drawing.pathRect(this.layer, this.position, this.position2, this.rotate, this.canvas);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._toJSONProperties, {
            position2: { value: "position2" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._parseJSONProperties, {
        })
    }
});

// **** 円オブジェクト ****
HuTime.Circle = function Circle (style, positions, width) {
    this.position = positions;
    this.width = width;
    this.style = style;
    this._userEvents = [];
};
HuTime.Circle.prototype = Object.create(HuTime.OnLayerObjectBase.prototype, {
    constructor: {
        value: HuTime.Circle
    },
    width: {            // 幅（直径）
        writable: true,
        value: 0
    },

    _redrawObject: {   // 描画
        value: function () {
            HuTime.Drawing.drawCircle(this.style, this.layer, this.position, this.width, this.canvas);
        }
    },
    _getExtractionArea: {   // イベント検出用の領域（パス）を取得
        value: function() {
            return HuTime.Drawing.pathCircle(this.layer, this.position, this.width, this.canvas);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._toJSONProperties, {
            width: { value: "width" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._parseJSONProperties, {
        })
    }
});

// **** 円弧オブジェクト ****
HuTime.Arc = function Arc (style, position, radius, startAngle, endAngle) {
    this.position = position;
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
    this.style = style;
    this._userEvents = [];
};
HuTime.Arc.prototype = Object.create(HuTime.OnLayerObjectBase.prototype, {
    constructor: {
        value: HuTime.Arc
    },
    radius: {            // 半径
        writable: true,
        value: 0
    },
    startAngle: {           // 円弧開始位置（deg）
        writable: true,
        value: 0
    },
    endAngle: {             // 円弧開始位置（deg）
        writable: true,
        value: 0
    },
    _redrawObject: {   // 描画
        value: function () {
            HuTime.Drawing.drawArc(this.style, this.layer, this.position, this.radius,
                this.startAngle, this.endAngle, this.canvas);
        }
    },
    _getExtractionArea: {   // イベント検出用の領域（パス）を取得
        value: function() {
            return HuTime.Drawing.pathArc(this.layer, this.position, this.radius,
                this.startAngle, this.endAngle, this.canvas);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._toJSONProperties, {
            radius: { value: "radius" },
            startAngle: { value: "startAngle" },
            endAngle: { value: "endAngle" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._parseJSONProperties, {
        })
    }
});

// **** 扇形オブジェクト ****
HuTime.Pie = function Pie (style, position, radius, startAngle, endAngle) {
    this.position = position;
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
    this.style = style;
    this._userEvents = [];
};
HuTime.Pie.prototype = Object.create(HuTime.OnLayerObjectBase.prototype, {
    constructor: {
        value: HuTime.Pie
    },
    radius: {            // 半径
        writable: true,
        value: 0
    },
    startAngle: {           // 円弧開始位置（deg）
        writable: true,
        value: 0
    },
    endAngle: {             // 円弧開始位置（deg）
        writable: true,
        value: 0
    },
    _redrawObject: {   // 描画
        value: function () {
            HuTime.Drawing.drawPie(this.style, this.layer, this.position, this.radius,
                this.startAngle, this.endAngle, this.canvas);
        }
    },
    _getExtractionArea: {   // イベント検出用の領域（パス）を取得
        value: function() {
            return HuTime.Drawing.pathPie(this.layer, this.position, this.radius,
                this.startAngle, this.endAngle, this.canvas);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._toJSONProperties, {
            radius: { value: "radius" },
            startAngle: { value: "startAngle" },
            endAngle: { value: "endAngle" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._parseJSONProperties, {
        })
    }
});

// **** 三角形オブジェクト ****
HuTime.Triangle = function Triangle (style, position, width, rotate) {
    this.position = position;
    this.width = width;
    this.style = style;
    this.rotate = rotate;
    this._userEvents = [];
};
HuTime.Triangle.prototype = Object.create(HuTime.OnLayerObjectBase.prototype, {
    constructor: {
        value: HuTime.Triangle
    },
    width: {            // 大きさ（三角形の底辺の幅）
        writable: true,
        value: 0
    },

    _redrawObject: {   // 描画
        value: function () {
            HuTime.Drawing.drawTriangle(this.style, this.layer, this.position, this.width, this.rotate, this.canvas);
        }
    },
    _getExtractionArea: {   // イベント検出用の領域（パス）を取得
        value: function() {
            return HuTime.Drawing.pathTriangle(this.layer, this.position, this.width, this.rotate, this.canvas);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._toJSONProperties, {
            width: { value: "width" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._parseJSONProperties, {
        })
    }
});

// **** 画像オブジェクト ****
HuTime.Image = function Image (style, position, src, width, height, rotate) {
    this.position = position;
    this.src = src;
    this.width = width;
    this.height = height;
    this.rotate = rotate;
    this.style = style;
    this._userEvents = [];

    if (!width && !height) {    // 表示サイズが指定されていない場合は、画像読み込み後に画像サイズを設定する
        var img = document.createElement("img");
        img.src = src;
        var setSize  = function(obj) {
            img.onload = function() {
                obj.width = img.width;
                obj.height = img.height;
            };
        }(this);
    }
};
HuTime.Image.prototype = Object.create(HuTime.OnLayerObjectBase.prototype, {
    constructor: {
        value: HuTime.Image
    },
    src: {              // 画像ソース
        writable: true,
        value: 0
    },
    width: {            // 幅
        writable: true,
        value: 0
    },
    height: {            // 高さ
        writable: true,
        value: 0
    },

    _redrawObject: {   // 描画
        value: function () {
            HuTime.Drawing.drawImage(
                this.style, this.layer, this.position, this.src, this.width, this.height, this.rotate, this.canvas);
        }
    },
    _getExtractionArea: {   // イベント検出用の領域（パス）を取得
        value: function() {
            return HuTime.Drawing.pathImage(
                this.layer, this.position, this.src, this.width, this.height, this.rotate, this.canvas);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._toJSONProperties, {
            src: {
                value: function (objForJSON) {
                    // 絶対パスを出力
                    var elem = document.createElement("img");
                    elem.src = this.src;
                    objForJSON.src = elem.src;
                }
            },
            width: { value: "width" },
            height: { value: "height" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._parseJSONProperties, {
        })
    }
});

// **** 文字列オブジェクト ****
HuTime.String = function String (style, position, text, rotate) {
    this.position = position;
    this.text = text;
    this.style = style;
    this.rotate = rotate;
    this._userEvents = [];
};
HuTime.String.prototype = Object.create(HuTime.OnLayerObjectBase.prototype,{
    constructor: {
        value: HuTime.String
    },
    text: {            // 文字列のテキスト
        writable: true,
        value: ""
    },

    _redrawObject: {
        value: function () {
            HuTime.Drawing.drawString(this.style, this.layer, this.position, this.text, this.rotate, this.canvas);
        }
    },
    _getExtractionArea: {
        value: function() {
            return HuTime.Drawing.pathString(this.style, this.layer, this.position, this.text, this.rotate, this.canvas);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._toJSONProperties, {
            text: { value: "text" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.OnLayerObjectBase.prototype._parseJSONProperties, {
        })
    }
});

// ******** 図形描画 ********
HuTime.Drawing = {
    _constDegToRad: Math.PI / 180,

    // 線（Positionオブジェクトの配列によるpoly line）
    pathLine: function(layer, positions, canvas) {
        if (!(positions instanceof Array))
            return;
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');
        var i = 0; // カウンタ

        // 線を囲む矩形をパスとする（線の領域判定用）
        ctx.beginPath();
        while(!(positions[i] instanceof HuTime.PositionBase)) {
            ++i;
            if (i >= positions.length)
                return;
        }
        var beginX = positions[i].cnvX(layer);    // 線の始点(t)
        var beginY = positions[i].cnvY(layer);    // 線の始点(y)
        ++i;
        while(i < positions.length) {
            if (!(positions[i] instanceof HuTime.PositionBase)) {
                ++i;
                continue;
            }
            var endX = positions[i].cnvX(layer);     // 線の終点(t)
            var endY = positions[i].cnvY(layer);     // 線の終点(t)
            var length = Math.pow(Math.pow(endX - beginX, 2) + Math.pow(endY - beginY, 2), 0.5);    // 線分の長さ
            var sin = (endY - beginY) / length;     // 線とx軸との正弦
            var cos = (endX - beginX) / length;     // 線とx軸との余弦
            var d = 2;      // 矩形の半分の幅

            ctx.moveTo(beginX + d * sin, beginY - d * cos);
            ctx.lineTo(endX + d * sin, endY - d * cos);
            ctx.lineTo(endX - d * sin, endY + d * cos);
            ctx.lineTo(beginX - d * sin, beginY + d * cos);
            ctx.lineTo(beginX + d * sin, beginY - d * cos);

            beginX = endX;
            beginY = endY;
            ++i;
        }
        return ctx;
    },
    drawLine: function(style, layer, positions, canvas) {
        if (!style)
            style = new HuTime.FigureStyle();
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');
        var i = 0; // カウンタ

        while(!(positions[i] instanceof HuTime.PositionBase)) {
            ++i;
            if (i >= positions.length)
                return;
        }
        ctx.beginPath();
        ctx.moveTo(positions[i].cnvX(layer), positions[i].cnvY(layer));
        ++i;
        while(i < positions.length) {
            if (!(positions[i] instanceof HuTime.PositionBase)) {
                ++i;
                continue;
            }
            ctx.lineTo(positions[i].cnvX(layer), positions[i].cnvY(layer));
            ++i;
        }
        style.applyLineStyle(ctx);
    },

    // ポリゴン（Positionオブジェクトの配列によるpoly line）
    pathPolygon: function(layer, positions, canvas) {
        if (!(positions instanceof Array))
            return;
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');
        var i = 0; // カウンタ

        while(!(positions[i] instanceof HuTime.PositionBase)) {
            ++i;
            if (i >= positions.length)
                return;
        }
        ctx.beginPath();
        ctx.moveTo(positions[i].cnvX(layer), positions[i].cnvY(layer));
        ++i;
        while(i < positions.length) {
            if (!(positions[i] instanceof HuTime.PositionBase)) {
                ++i;
                continue;
            }
            ctx.lineTo(positions[i].cnvX(layer), positions[i].cnvY(layer));
            ++i;
        }
        ctx.closePath();
        return ctx;
    },
    drawPolygon: function(style, layer, positions, canvas) {
        if (!style)
            style = new HuTime.FigureStyle();
        style.applyStyle(
            HuTime.Drawing.pathPolygon(layer, positions, canvas));
    },

    // 正方形（positionは中心）
    pathSquare: function(layer, position, width, rotate, canvas) {
        var cnvX = position.cnvX(layer);
        var cnvY = position.cnvY(layer);
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');

        ctx.translate(cnvX, cnvY);
        ctx.rotate(rotate * HuTime.Drawing._constDegToRad);
        ctx.beginPath();
        ctx.rect(-width / 2, -width / 2, width, width);
        ctx.rotate(-rotate * HuTime.Drawing._constDegToRad);
        ctx.translate(-cnvX, -cnvY);
        return ctx;
    },
    drawSquare: function(style, layer, position, width, rotate, canvas) {
        if (!style)
            style = new HuTime.FigureStyle();
        style.applyStyle(
            HuTime.Drawing.pathSquare(layer, position, width, rotate, canvas));
    },

    // 矩形（2つのPositionで位置と大きさを指定）
    pathRect: function(layer, position1, position2, rotate, canvas) {
        var cnvX1 = position1.cnvX(layer);
        var cnvY1 = position1.cnvY(layer);
        var cnvX2 = position2.cnvX(layer);
        var cnvY2 = position2.cnvY(layer);
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');

        ctx.translate((cnvX1 + cnvX2) / 2, (cnvY1 + cnvY2) / 2);
        ctx.rotate(rotate * HuTime.Drawing._constDegToRad);
        ctx.beginPath();
        ctx.rect((cnvX1 - cnvX2) / 2, (cnvY1 - cnvY2) / 2, cnvX2 - cnvX1, cnvY2 - cnvY1);
        ctx.rotate(-rotate * HuTime.Drawing._constDegToRad);
        ctx.translate((cnvX1 + cnvX2) / -2, (cnvY1 + cnvY2) / -2);
        return ctx;
    },
    drawRect: function(style, layer, position1, position2, rotate, canvas) {
        if (!style)
            style = new HuTime.FigureStyle();
        style.applyStyle(
            HuTime.Drawing.pathRect(layer, position1, position2, rotate, canvas));
    },

    // 円（positionは中心）
    pathCircle: function(layer, position, width, canvas) {
        var cnvX = position.cnvX(layer);
        var cnvY = position.cnvY(layer);
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');

        ctx.beginPath();
        ctx.arc(cnvX, cnvY, width / 2, 0, Math.PI * 2);
        return ctx;
    },
    drawCircle: function(style, layer, position, width, canvas) {
        if (!style)
            style = new HuTime.FigureStyle();
        style.applyStyle(
            HuTime.Drawing.pathCircle(layer, position, width, canvas));
    },

    // 円弧（positionは中心）
    pathArc: function(layer, position, radius, startAngle, endAngle, canvas) {
        var cnvX = position.cnvX(layer);
        var cnvY = position.cnvY(layer);
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');

        // 円弧を囲む領域をパスとする（円弧の領域判定用）
        var d = 2;      // 領域の幅の半分
        ctx.beginPath();
        ctx.arc(cnvX, cnvY, radius - 2,
            startAngle * HuTime.Drawing._constDegToRad, endAngle * HuTime.Drawing._constDegToRad);
        ctx.arc(cnvX, cnvY, radius + 2,
            endAngle * HuTime.Drawing._constDegToRad, startAngle * HuTime.Drawing._constDegToRad, true);
        ctx.closePath();
        return ctx;
    },
    drawArc: function(style, layer, position, radius, startAngle, endAngle, canvas) {
        if (!style)
            style = new HuTime.FigureStyle();
        style.applyStyle(
            HuTime.Drawing.pathArc(layer, position, radius, startAngle, endAngle, canvas));
    },

    // 扇形（positionは中心）
    pathPie: function(layer, position, radius, startAngle, endAngle, canvas) {
        var cnvX = position.cnvX(layer);
        var cnvY = position.cnvY(layer);
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');

        ctx.beginPath();
        ctx.moveTo(cnvX, cnvY);
        ctx.arc(cnvX, cnvY, radius,
            startAngle * HuTime.Drawing._constDegToRad, endAngle * HuTime.Drawing._constDegToRad);
        ctx.closePath();
        return ctx;
    },
    drawPie: function(style, layer, position, radius, startAngle, endAngle, canvas) {
        if (!style)
            style = new HuTime.FigureStyle();
        style.applyStyle(
            HuTime.Drawing.pathPie(layer, position, radius, startAngle, endAngle, canvas));
    },

    // 三角形（positionは三角形の重心）
    pathTriangle: function(layer, position, width, rotate, canvas) {
        var cnvX = position.cnvX(layer);
        var cnvY = position.cnvY(layer);
        var ctx;

        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');

        ctx.translate(cnvX, cnvY);
        ctx.rotate(rotate * HuTime.Drawing._constDegToRad);
        ctx.beginPath();
        ctx.moveTo(0, -0.57735 * width);   // 0.57735 = 3^0.5 / 3
        ctx.lineTo(width / 2, 0.28868 * width);    // 0.28868 = 3^0.5 / 3 / 2
        ctx.lineTo(-width / 2, 0.28868 * width);
        ctx.closePath();
        ctx.rotate(-rotate * HuTime.Drawing._constDegToRad);
        ctx.translate(-cnvX, -cnvY);
        return ctx;
    },
    drawTriangle: function(style, layer, position, width, rotate, canvas) {
        if (!style)
            style = new HuTime.FigureStyle();
        style.applyStyle(
            HuTime.Drawing.pathTriangle(layer, position, width, rotate, canvas));
    },

    // プラス記号（positionは中心）
    pathPlusMark: function(layer, position, width, rotate, canvas) {
        // 領域は正方形と同じ
        return HuTime.Drawing.pathSquare(layer, position, width, rotate, canvas);
    },
    drawPlusMark: function(style, layer, position, width, rotate, canvas) {
        if (!style)
            style = new HuTime.FigureStyle();
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');
        var cnvX = position.cnvX(layer);
        var cnvY = position.cnvY(layer);

        ctx.translate(cnvX, cnvY);
        ctx.rotate(rotate * HuTime.Drawing._constDegToRad);
        ctx.beginPath();
        ctx.moveTo(0, width / -2);
        ctx.lineTo(0, width / 2);
        ctx.moveTo(width / -2, 0);
        ctx.lineTo(width / 2, 0);
        ctx.rotate(-rotate * HuTime.Drawing._constDegToRad);
        ctx.translate(-cnvX, -cnvY);

        var alphaOld = ctx.globalAlpha;
        ctx.globalAlpha = this.alpha;
        style._applyLineStyle(ctx);
        ctx.globalAlpha = alphaOld;
    },


    // 画像（positionは画像中心）
    pathImage: function(layer, position, src, width, height, rotate, canvas) {
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');
        var cnvX = position.cnvX(layer);
        var cnvY = position.cnvY(layer);

        var img = new Image();
        img.src = src;
        if (width && height) {
            ctx.beginPath();
            ctx.translate(cnvX, cnvY);
            ctx.rotate(rotate * HuTime.Drawing._constDegToRad);
            ctx.rect(width / -2, height / -2, width, height);
            ctx.rotate(-rotate * HuTime.Drawing._constDegToRad);
            ctx.translate(-cnvX, -cnvY);
            return ctx;
        }
        else {
            img.onload = function () {
                var width = img.width;
                var height = img.height;
                cnvX = position.cnvX(layer);    // 遅れてloadされる場合があるので再計算する
                cnvY = position.cnvY(layer);
                ctx.beginPath();    // 画像の輪郭となるパス
                ctx.translate(cnvX, cnvY);
                ctx.rotate(rotate * HuTime.Drawing._constDegToRad);
                ctx.rect(width / -2, height / -2, width, height);
                ctx.rotate(-rotate * HuTime.Drawing._constDegToRad);
                ctx.translate(-cnvX, -cnvY);
            };
        }
        return ctx;
    },
    drawImage: function(style, layer, position, src, width, height, rotate, canvas) {
        if (!style)
            style = new HuTime.FigureStyle(0);  // デフォルトは縁なし
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');

        var img = new Image();
        img.src = src;
        img.onload = function() {
            var cnvX = position.cnvX(layer);    // 遅れてloadされる場合があるのでここで計算する
            var cnvY = position.cnvY(layer);
            var alphaOld = style.alpha;

            if (!isFinite(width) || width <= 0) {
                if (!isFinite(height) || height <= 0) {     // 両方未指定
                    width = img.width;
                    height = img.height;
                }
                else                                        // widthのみ未指定
                    width = img.width * height / img.height;
            }
            else {
                if (!isFinite(height) || height <= 0)       // heightのみ未指定
                    height = img.height * width / img.width;
            }

            ctx.globalAlpha = style.alpha;  // 画像にもalphaを適用するため（applyStyleの処理と重複）
            ctx.beginPath();    // プリロードが必要なので、pathImageは使わない
            ctx.translate(cnvX, cnvY);
            ctx.rotate(rotate * HuTime.Drawing._constDegToRad);
            ctx.rect(width / -2, height / -2, width, height);
            style.applyStyle(ctx);
            ctx.drawImage(img, width / -2, height / -2, width, height);
            ctx.rotate(-rotate * HuTime.Drawing._constDegToRad);
            ctx.translate(-cnvX, -cnvY);
            ctx.globalAlpha = alphaOld;
        };
    },

    // 文字列（positionはstyleの設定（上下、左右の揃え）による）
    pathString: function(style, layer, position, text, rotate, canvas) {
        if (typeof text != "string")
            if (typeof text == "number" || typeof  text == "boolean")
                text = text.toString();
            else
                text = "";
        if (!style)
            style = new HuTime.StringStyle();
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');
        var cnvX = position.cnvX(layer);
        var cnvY = position.cnvY(layer);

        ctx.font = style.font;
        var texts = text.split("\n");   // 改行で分割
        var fontSize = parseFloat(style._fontSize);
        var lineHeight;     // 実際の改行幅（px単位）
        if (isFinite(style._lineHeight))
            lineHeight = fontSize * style._lineHeight;  // 倍率指定
        else
            lineHeight = parseFloat(style._lineHeight); // px単位指定

        var width = 0;  // 文字列の幅
        var height = 0; // 文字列の高さ
        for (var i = 0; i < texts.length; ++i) {
            var currentWidth = ctx.measureText(texts[i]).width;
            if (currentWidth > width)
                width = currentWidth;
            height += lineHeight;
        }
        if (lineHeight < 0)     // 行の高さと文字の高さの違いの補正
            height -= fontSize + lineHeight;
        else
            height += fontSize - lineHeight;

        var x, y;   // 矩形の基準位置
        switch (style.textAlign) {
            case "center":
                x =  width / -2;
                break;

            case "right":
            case "end":
                x = -width;
                break;

            default:
                x = 0;
                break;
        }
        switch(style.textBaseline) {
            case "bottom":
                y =  lineHeight < 0 ? 0 : -fontSize;
                break;

            case "middle":
                y =  lineHeight < 0 ? fontSize * 0.5 : -fontSize * 0.5;
                break;

            case "top":
                y =  lineHeight < 0 ? fontSize : 0;
                break;

            default: // alphabetic
                y =  lineHeight < 0 ? fontSize * 0.13 : -fontSize * 0.87;
                break;
        }

        // 文字列を囲む矩形
        ctx.translate(cnvX, cnvY);
        ctx.rotate(rotate * HuTime.Drawing._constDegToRad);
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.rotate(-rotate * HuTime.Drawing._constDegToRad);
        ctx.translate(-cnvX, -cnvY);
        return ctx;
    },
    drawString: function(style, layer, position, text, rotate, canvas) {
        if (typeof text != "string")
            if (typeof text == "number" || typeof  text == "boolean")
                text = text.toString();
            else
                text = "";
        if (!style)
            style = new HuTime.StringStyle();
        var ctx;
        if (canvas)
            ctx = canvas.getContext('2d');
        else
            ctx = layer._canvas.getContext('2d');
        var cnvX = position.cnvX(layer);
        var cnvY = position.cnvY(layer);

        ctx.translate(cnvX, cnvY);
        ctx.rotate(rotate * HuTime.Drawing._constDegToRad);
        style.applyStyle(ctx, text);
        ctx.rotate(-rotate * HuTime.Drawing._constDegToRad);
        ctx.translate(-cnvX, -cnvY);
    }
};

// ******** 図形の書式 ********
HuTime.FigureStyle = function FigureStyle (fillColor, lineColor, lineWidth) {
    if (fillColor != undefined)
        this.fillColor = fillColor;
    if (lineColor != undefined)         // 省略された場合は、既定値（null）になる
        this.lineColor = lineColor;
    if (lineWidth != undefined)         // 0またはnullの場合は境界は描画されない
        this.lineWidth = lineWidth;
    this._applyStyle = this.defaultApplyStyle;
    this._applyFillStyle = this.defaultApplyFillStyle;
    this._applyLineStyle = this.defaultApplyLineStyle;
};
HuTime.FigureStyle.prototype = {
    constructor: HuTime.FigureStyle,
    _lineWidth: 1,       // 境界幅
    get lineWidth() {
        return this._lineWidth;
    },
    set lineWidth(val) {
        if (typeof(val) == "number" && val >= 0 && val < 1000)
            this._lineWidth = val;
    },
    lineColor: null,    // 境界色
    _lineDash: [],     // 点線の指定
    get lineDash() {
        return this._lineDash;
    },
    set lineDash(val) {
        if (val instanceof Array) {
            for (var i = 0; i < val.length; ++i) {
                if (typeof val[i] != "number" || val[i] < 0 || val [i] > 1000)
                    return;
            }
        }
        this._lineDash = val;
    },
    fillColor: null,    // 背景色
    _alpha: 1.0,    // 透明度
    get alpha() {
        return this._alpha;
    },
    set alpha(val) {
        if (typeof(val) == "number" && val >= 0 && val <= 1)
            this._alpha = val;
    },

    _applyStyle: null,  // 書式（塗りと線）の適用
    get applyStyle() {
        return this._applyStyle;
    },
    set applyStyle(val) {
        if (val instanceof Function)
            this._applyStyle = val;     // ユーザ定義の書式適用処理を設定
        else if (val == null)
            this._applyFillStyle = this.defaultApplyStyle;
    },
    defaultApplyStyle: function(ctx) {      // 書式適用（既定の処理）
        var alphaOld = ctx.globalAlpha;
        ctx.globalAlpha = this._alpha;
        this._applyFillStyle(ctx);
        this._applyLineStyle(ctx);
        ctx.globalAlpha = alphaOld;
    },

    _applyFillStyle: null,  // 書式（塗りのみ）の適用
    get applyFillStyle() {
        return this._applyFillStyle;
    },
    set applyFillStyle(val) {
        if (val instanceof Function)
            this._applyFillStyle = val;
        else if (val == null)
            this._applyFillStyle = this.defaultApplyFillStyle;
    },
    defaultApplyFillStyle: function defaultApplyFillStyle(ctx) {
        if (this.fillColor) {
            ctx.fillStyle = this.fillColor;
            ctx.fill();
        }
    },

    _applyLineStyle: null,  // 書式（線のみ）の適用
    get applyLineStyle() {
        return this._applyLineStyle;
    },
    set applyLineStyle(val) {
        if (val instanceof Function)
            this._applyLineStyle = val;
        else if (val == null)
            this._applyFillStyle = this.defaultApplyLineStyle;
    },
    defaultApplyLineStyle: function(ctx) {
        if (this._lineWidth > 0 && this.lineColor) {
            ctx.strokeStyle = this.lineColor;
            ctx.setLineDash(this._lineDash);
            ctx.lineWidth = this._lineWidth;
            ctx.stroke();
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        _lineWidth: "lineWidth",
        lineColor: "lineColor",
        _lineDash: "lineDash",
        fillColor: "fillColor",
        _alpha: "alpha"
    },
    _parseJSONProperties: {
        lineWidth: "_lineWidth",
        lineDash: "_lineDash",
        alpha: "_alpha"
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// ******** 文字列の書式 ********
HuTime.StringStyle = function StringStyle (fontSize, fillColor, fontWeight, fontStyle, fontFamily) {
    if (fontSize != undefined)
        this.fontSize = fontSize;
    if (fillColor != undefined)
        this.fillColor = fillColor;
    if (fontWeight != undefined)
        this.fontWeight = fontWeight;
    if (fontStyle != undefined)
        this.fontStyle = fontStyle;
    if (fontFamily != undefined)
        this.fontFamily = fontFamily;
    this._applyStyle = HuTime.StringStyle.prototype.defaultApplyStyle;
};
HuTime.StringStyle.prototype = {
    constructor: HuTime.StringStyle,

    _fontSize: "10px",       // フォントサイズ
    get fontSize() {
        return this._fontSize;
    },
    set fontSize(val) {
        if (val == null) {  // nullの場合、既定値に戻す
            this._fontSize = HuTime.StringStyle.prototype._fontSize;
            return;
        }
        if (isFinite(val)) { // 数値のみの場合（nullは前段でチェック済み）
            this._fontSize = val.toString() + "px";
            return;
        }
        var fontSizeVal = parseFloat(val);
        if (isFinite(fontSizeVal) && fontSizeVal >= 0)
            this._fontSize = fontSizeVal.toString() + "px";
    },
    _fontStyle: "normal",    // フォントスタイル
    get fontStyle() {
        return this._fontStyle;
    },
    set fontStyle(val) {
        if (val == null) {
            this._fontStyle = HuTime.StringStyle.prototype._fontStyle;
            return;
        }
        switch (val.trim().toLowerCase()) {
            case "italic":
                this._fontStyle = "italic";
                return;
            case "oblique":
                this._fontStyle = "oblique";
                return;
            default:
                this._fontStyle = "normal";
                return;
        }
    },
    _fontWeight: 400,   // フォントウェイト
    get fontWeight() {
        return this._fontWeight;
    },
    set fontWeight(val) {
        if (val == null) {
            this._fontWeight = HuTime.StringStyle.prototype._fontWeight;
            return;
        }
        if (typeof val == "string" && val.trim().toLowerCase() == "bold") {
            this._fontWeight = 700;
            return;
        }
        if (isFinite(val) && val != null) {
            if (val < 100)
                val = 100;
            if (val > 900)
                val = 900;
            this._fontWeight = Math.floor(val / 100) * 100;
        }
    },
    _fontFamily: "sans-serif",   // フォントファミリー
    get fontFamily() {
        return this._fontFamily;
    },
    set fontFamily(val) {
        if (val == null) {
            this._fontFamily = HuTime.StringStyle.prototype._fontFamily;
            return;
        }
        val = val.trim();
        if (typeof(val) != "string" || val == "")
            return;
        this._fontFamily = val;
    },
    _fontVariant: "normal",    // スモールキャップの指定（"normal"（既定値）または"small-caps"）
    get fontVariant() {
        return this._fontVariant;
    },
    set fontVariant(val) {
        if (val == null)
            this._fontVariant = HuTime.StringStyle.prototype._fontVariant;
        val = val.trim().toLowerCase();
        if (val == "normal" || val == "small-caps")
            this._fontVariant = val;
    },
    _lineHeight: "1",      // 行の高さ
    get lineHeight() {
        return this._lineHeight;
    },
    set lineHeight(val) {
        if (val == null) {   // nullの場合、既定値に戻す
            this._lineHeight = HuTime.StringStyle.prototype._lineHeight;
            return;
        }
        if (isFinite(val)) {        // 数値のみの場合（nullは前段でチェック済み）
            this._lineHeight = val;
            return;
        }
        var lineHeightVal = parseFloat(val);  // 単位をpxに固定するため、いったん数値化
        if (isFinite(lineHeightVal))
            this._lineHeight = lineHeightVal.toString() + "px";
    },
    get font() {
        var result = "";
        if (this._fontStyle != "normal")
            result += this._fontStyle + " ";
        if (this._fontVariant != "normal")
            result += this._fontVariant + " ";
        if (this._fontVariant != "normal")
            result += this._fontVariant + " ";
        result += this._fontWeight + " ";
        result += this._fontSize;
        // CSSの仕様外である負のlineHeightは表示しない
        if (this._lineHeight != "normal" && parseFloat(this._lineHeight) > 0)
            result += "/" + this._lineHeight.toString();
        result += " " + this._fontFamily;
        return result;
    },

    _textAlign: "start",        // テキスト横方向の整列位置（nullの場合は設定しない、規定値は"start"）
    get textAlign() {
        return this._textAlign;
    },
    set textAlign(val) {
        if (val == null) {
            this._textAlign = HuTime.StringStyle.prototype._textAlign;
            return;
        }
        val = val.trim().toLowerCase();
        if (val == "start" || val == "end" || val == "left" || val == "right" || val == "center")
            this._textAlign = val;
    },
    _textBaseline: "alphabetic",     // テキスト縦方向の整列位置（nullの場合は設定しない、規定値は"alphabetic"）
    get textBaseline() {
        return this._textBaseline;
    },
    set textBaseline(val) {
        if (val == null) {
            this._textBaseline = HuTime.StringStyle.prototype._textBaseline;
            return;
        }
        val = val.trim().toLowerCase();
        if (val == "top" || val == "hanging" || val == "middle" ||
            val == "alphabetic" || val == "ideographic" || val == "bottom")
            this._textBaseline = val;
    },

    _fillColor: "black",
    get fillColor() {
        return this._fillColor;
    },
    set fillColor(val) {
        if (val == null || (typeof val == "string" && val != ""))
            this._fillColor = val;
    },
    _lineWidth: 0,
    get lineWidth() {
        return this._lineWidth;
    },
    set lineWidth(val) {
        if (typeof val == "number" && val >= 0)
            this._lineWidth = val;
    },
    _lineColor: null,
    get lineColor() {
        return this._lineColor;
    },
    set lineColor(val) {
        if (val == null || (typeof val == "string" && val != ""))
            this._lineColor = val;
    },
    _alpha: 1.0,
    get alpha() {
        return this._alpha;
    },
    set alpha(val) {
        if (isFinite(val) && val >= 0 && val <= 1)
            this._alpha = val;
    },

    _applyStyle: null,  // 書式
    get applyStyle() {
        return this._applyStyle
    },
    set applyStyle(val) {
        if (val == null)
            this._applyStyle = this.StringStyle.prototype.defaultApplyStyle;
        else if (val instanceof Function)
            this._applyStyle = val;
    },
    defaultApplyStyle: function(ctx, text) {
        var alphaOld = ctx.globalAlpha;
        ctx.globalAlpha = this._alpha;

        ctx.font = this.font;
        if (this._textAlign)
            ctx.textAlign = this._textAlign;
        else
            ctx.textAlign = null;

        if (this.textBaseline)
            ctx.textBaseline = this._textBaseline;
        else
            ctx.textBaseline = null;

        if (this._fillColor)
            ctx.fillStyle = this._fillColor;
        if (isFinite(this._lineWidth) && this._lineWidth > 0 && this._lineColor) {
            ctx.strokeStyle = this._lineColor;
            ctx.lineWidth = this._lineWidth;
        }

        var texts = text.split("\n");   // 改行で分割
        var lineHeight;
        if (isFinite(this._lineHeight))
            lineHeight = parseFloat(this._fontSize) * this._lineHeight;
        else
            lineHeight = parseFloat(this._lineHeight);
        for (var i = 0; i < texts.length; ++i) {
            if (isFinite(this._lineWidth) && this._lineWidth > 0 && this._lineColor)
                ctx.strokeText(texts[i], 0, lineHeight * i);
            if (this._fillColor)
                ctx.fillText(texts[i], 0, lineHeight * i);
        }

        ctx.globalAlpha = alphaOld;
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        _fontSize: "fontSize",
        _fontStyle: "fontStyle",
        _fontWeight: "fontWeight",
        _fontFamily: "fontFamily",
        _fontVariant: "fontVariant",
        _lineHeight: "lineHeight",

        _textAlign: "textAlign",
        _textBaseline: "textBaseline",

        _fillColor: "fillColor",
        _lineWidth: "lineWidth",
        _lineColor: "lineColor",
        _alpha: "alpha"
    },
    _parseJSONProperties: {
        fontSize: "_fontSize",
        fontStyle: "_fontStyle",
        fontWeight: "_fontWeight",
        fontFamily: "_fontFamily",
        fontVariant: "_fontVariant",
        lineHeight: "_lineHeight",

        textAlign: "_textAlign",
        textBaseline: "_textBaseline",

        fillColor: "_fillColor",
        lineWidth: "_lineWidth",
        lineColor: "_lineColor",
        alpha: "_alpha"
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

HuTime.Slider = function (vBreadth, vMarginTop, vMarginBottom) {
    HuTime.ContainerBase.apply(this, arguments);
    if (!isNaN(vBreadth))
        this.vBreadth = vBreadth;
    if (!isNaN(vMarginTop))
        this.vMarginTop = vMarginTop;
    if (!isNaN(vMarginBottom))
        this.vMarginBottom = vMarginBottom;

    // スライダの背景
    this._element = document.createElement("div");
    this._element.style.position = "absolute";
    this._element.style.backgroundColor = "#CCCCCC";
    this._element.style.borderStyle = "none";
    this._element.style.zIndex = 0;

    // スライダの表示範囲を示す稼働部分
    this._sliderElement = document.createElement("div");
    this._sliderElement.style.position = "absolute";
    this._sliderElement.style.backgroundColor = "#FFFFFF";
    this._element.appendChild(this._sliderElement);

    //  拡大縮小用のノブ（左）
    this._zoomKnobLElement = document.createElement("div");
    this._zoomKnobLElement.style.position = "absolute";
    this._zoomKnobLElement.style.backgroundColor = "#FF0000";
    this._zoomKnobLElement.style.borderStyle = "none";
    this._zoomKnobLElement.style.visibility = "hidden";
    this._sliderElement.appendChild(this._zoomKnobLElement);

    //  拡大縮小用のノブ（右）
    this._zoomKnobRElement = document.createElement("div");
    this._zoomKnobRElement.style.position = "absolute";
    this._zoomKnobRElement.style.backgroundColor = "#009900";
    this._zoomKnobRElement.style.borderStyle = "none";
    this._zoomKnobRElement.style.visibility = "hidden";
    this._sliderElement.appendChild(this._zoomKnobRElement);
};
HuTime.Slider.prototype = Object.create(HuTime.ContainerBase.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.Slider
    },

    _sliderElement: {        // スライダの表示範囲を示す稼働部分
        writable: true,
        value: null
    },
    sliderElement: {
        get: function() {
            return this._sliderElement;
        }
    },
    _zoomKnobLElement: {     // 拡大縮小用のノブ（左）
        writable: true,
        value: null
    },
    zoomKnobLElement: {
        get: function() {
            return this._zoomKnobLElement;
        }
    },
    _zoomKnobRElement: {     // 拡大縮小用のノブ（右）
        writable: true,
        value: null
    },
    zoomKnobRElement: {
        get: function() {
            return this._zoomKnobRElement;
        }
    },
    zoomKnobWidth: {        // 拡大縮小用のノブの幅
        writable: true,
        value: 20
    },
    _zoomKnobVisibility: {   // 拡大縮小用のノブの可視性（auto, hidden, visible）
        writable: true,
        value: "auto"       // auto: マウスが乗った時のみ可視
    },
    zoomKnobVisibility: {
        get: function() {
            return this._zoomKnobVisibility;
        },
        set: function(val) {
            if ((typeof val) != "string")
                return;
            val = val.toLowerCase();
            if (val != "auto" && val != "hidden" && val != "visible")
                return;
            this._zoomKnobVisibility = val;
            this._zoomKnobLElement.style.visibility = val == "visible" ? "visible" : "hidden";
            this._zoomKnobRElement.style.visibility = val == "visible" ? "visible" : "hidden";
        }
    },
    sliderStyle: {          // タイムスライダの書式
        get: function() {
            return this._sliderElement.style;
        }
    },
    zoomKnobLStyle: {       // 拡大縮小用のノブ（左）の書式
        get: function() {
            return this._zoomKnobLElement.style;
        }
    },
    zoomKnobRStyle: {       // 拡大縮小用のノブ（右）の書式
        get: function() {
            return this._zoomKnobRElement.style;
        }
    },

    _sliderLeft: {           // スライダの表示範囲を示す稼働部分の左端座標
        writable: true,
        value: 200
    },
    _sliderWidth: {          // スライダの表示範囲を示す稼働部分の幅
        writable: true,
        value: 200
    },

    // **** オブジェクトツリー ****
    appendContent: {
        value: function(content) {
            // 子オブジェクトがないので、無効化する
        }
    },
    removeContent: {
        value: function(content) {
            // 子オブジェクトがないので、無効化する
        }
    },

    // **** 描画関係 ****
    redraw: {
        value: function () {   // 子の処理を削除し、スライダの処理を追加
            if (this._sliderState != 0) // 0 = sliderNone
                return;     // スライダ操作中は実行しない（tmovestopイベントなどの場合）

            HuTime.Layer.prototype.redraw.apply(this, arguments);

            // スライダの描画
            var newLeft;
            var newWidth;
            if (this._tRotation == 1) {
                newLeft = this._currentTLength * (this._parent.tRatio - 1) / 2 / this._parent.tRatio;
                newWidth = this._currentTLength / this._parent.tRatio;
                this._sliderLeft = newLeft;
                this._sliderWidth = newWidth;
                this._sliderElement.style.left = this._currentVXYOrigin + "px";
                this._sliderElement.style.width = this._currentVBreadth + "px";
                this._sliderElement.style.top = newLeft + "px";
                this._sliderElement.style.height = newWidth + "px";

                this._zoomKnobLElement.style.left = this._currentVXYOrigin + "px";
                this._zoomKnobLElement.style.width = this._currentVBreadth + "px";
                this._zoomKnobLElement.style.top = "0";
                this._zoomKnobLElement.style.height = this.zoomKnobWidth + "px";

                this._zoomKnobRElement.style.left = this._currentVXYOrigin + "px";
                this._zoomKnobRElement.style.width = this._currentVBreadth + "px";
                this._zoomKnobRElement.style.top = (newWidth - this.zoomKnobWidth) + "px";
                this._zoomKnobRElement.style.height = this.zoomKnobWidth + "px";
            }
            else {
                newLeft = this._currentTLength * (this._parent.tRatio - 1) / 2 / this._parent.tRatio;
                newWidth = this._currentTLength / this._parent.tRatio;
                this._sliderLeft = newLeft;
                this._sliderWidth = newWidth;
                this._sliderElement.style.left = newLeft + "px";
                this._sliderElement.style.width = newWidth + "px";
                this._sliderElement.style.top = this._currentVXYOrigin + "px";
                this._sliderElement.style.height = this._currentVBreadth + "px";

                this._zoomKnobLElement.style.left = "0";
                this._zoomKnobLElement.style.width = this.zoomKnobWidth + "px";
                this._zoomKnobLElement.style.top = this._currentVXYOrigin + "px";
                this._zoomKnobLElement.style.height = this._currentVBreadth + "px";

                this._zoomKnobRElement.style.left = (newWidth - this.zoomKnobWidth) + "px";
                this._zoomKnobRElement.style.width = this.zoomKnobWidth + "px";
                this._zoomKnobRElement.style.top = this._currentVXYOrigin + "px";
                this._zoomKnobRElement.style.height = this._currentVBreadth + "px";
            }
        }
    },
    clear: {
        value: function () {
            // 継承元（Layer）の処理はcanvas要素上の処理
            // Sliderはcanvasを持たないので（element=div要素）、何もしないよう上書き
        }
    },

    // **** イベント関係 ****
    _sliderState: {     // タイムスライダの状態（0:なし, 1:時間範囲移動, 2:左Zoom, 3:右Zoom）
        writable: true,
        value: 0
    },
    _dragOriginX: {    // ドラッグ開始時のx座標
        writable: true,
        value: 0
    },
    _dragOriginY: {    // ドラッグ開始時のy座標
        writable: true,
        value: 0
    },

    // **** マウスイベント関係 ****
    mouseEventCapture: {    // マウスイベントをキャプチャする範囲（1:子を除くで固定）
        value: 1    // 既定値－子オブジェクト以外をキャプチャ
    },
    _handleMouseEventBubbling: {
        value: function (ev, eventX, eventY) {
            // 継承元の処理の後、独自処理を実施
            // ホイール操作によるZoomはPanelで処理する

            // スライダの状態
            const sliderNone = 0;       // 何も起きていない状態
            const sliderMove = 1;       // スライダを移動中
            const sliderZoomLeft = 2;   // スライダの左側を移動中
            const sliderZoomRight = 3;  // スライダの右側を移動中

            if (this._parent._parent._panelOrderChanging)
                return;     // PanelCollectionでパネル順序変更中の場合はなにもしない

            // mouseover：カーソル形状とスライダの状態の変更のみ
            if (ev._type == "mouseover") {
                if (this._tRotation == 1)   // カーソルの形状を変更
                    this._changeCursor(eventY);
                else
                    this._changeCursor(eventX);
                this._sliderState = sliderNone;     // スライダの状態を設定
                return;
            }

            // mouseout：実施中の操作を終了して確定し、カーソル形状とスライダの状態を戻す
            if (ev._type == "mouseout") {
                clearTimeout(this._mouseTimer);
                if (this._sliderState == sliderMove) {
                    this._sliderState = sliderNone;
                    this._hutimeRoot._handleInnerEvent(     // 内部イベント（tMoveEndイベント）を発火
                        new HuTime.InnerEvent.createWithT("tmoveend", this,
                            this._hutimeRoot.minT, this._hutimeRoot.maxT));
                }
                else if (this._sliderState == sliderZoomLeft || this._sliderState == sliderZoomRight) {
                    this._sliderState = sliderNone;
                    this._hutimeRoot._handleInnerEvent(     // 内部イベント（tMoveEndイベント）を発火
                        new HuTime.InnerEvent.createWithT("tmoveend", this,
                            this._hutimeRoot.minT, this._hutimeRoot.maxT));
                }
                // スライダとカーソルの形状を戻す
                this._captureElement.style.cursor = "default";
                this._zoomKnobLElement.style.visibility =
                    this.zoomKnobVisibility == "visible" ? "visible" : "hidden";
                this._zoomKnobRElement.style.visibility =
                    this.zoomKnobVisibility == "visible" ? "visible" : "hidden";

                return;
            }

            // mousedown：操作の開始
            if (ev._type == "mousedown") {
                clearTimeout(this._mouseTimer);
                if (this._tRotation == 1) {
                    if (eventY > this._sliderLeft + this.zoomKnobWidth &&
                        eventY < this._sliderLeft + this._sliderWidth - this.zoomKnobWidth) {   // 移動
                        this._sliderState = sliderMove;
                        this._hutimeRoot._handleInnerEvent(     // 内部イベント（tMoveStartイベント）を発火
                            new HuTime.InnerEvent.createWithT("tmovestart", this,
                                this._hutimeRoot.minT, this._hutimeRoot.maxT));
                    }
                    else if (eventY > this._sliderLeft &&
                        eventY < this._sliderLeft + this.zoomKnobWidth) {     // zoom左側
                        this._sliderState = sliderZoomLeft;
                        this._hutimeRoot._handleInnerEvent(     // 内部イベント（tMoveStartイベント）を発火
                            new HuTime.InnerEvent.createWithT("tmovestart", this,
                                this._hutimeRoot.minT, this._hutimeRoot.maxT));
                    }
                    else if (eventY > this._sliderLeft + this._sliderWidth - this.zoomKnobWidth &&
                        eventY < this._sliderLeft + this._sliderWidth) {      // zoom右側
                        this._sliderState = sliderZoomRight;
                        this._hutimeRoot._handleInnerEvent(     // 内部イベント（tMoveStartイベント）を発火
                            new HuTime.InnerEvent.createWithT("tmovestart", this,
                                this._hutimeRoot.minT, this._hutimeRoot.maxT));
                    }
                    else {
                        this._sliderState = sliderNone;
                        return;
                    }
                    this._dragOriginY = eventY;
                }
                else {
                    if (eventX > this._sliderLeft + this.zoomKnobWidth &&
                        eventX < this._sliderLeft + this._sliderWidth - this.zoomKnobWidth) {   // 移動
                        this._sliderState = sliderMove;
                        this._hutimeRoot._handleInnerEvent(     // 内部イベント（tMoveStartイベント）を発火
                            new HuTime.InnerEvent.createWithT("tmovestart", this,
                                this._hutimeRoot.minT, this._hutimeRoot.maxT));
                    }
                    else if (eventX > this._sliderLeft &&
                        eventX < this._sliderLeft + this.zoomKnobWidth) {     // zoom左側
                        this._sliderState = sliderZoomLeft;
                        this._hutimeRoot._handleInnerEvent(     // 内部イベント（tMoveStartイベント）を発火
                            new HuTime.InnerEvent.createWithT("tmovestart", this,
                                this._hutimeRoot.minT, this._hutimeRoot.maxT));
                    }
                    else if (eventX > this._sliderLeft + this._sliderWidth - this.zoomKnobWidth &&
                        eventX < this._sliderLeft + this._sliderWidth) {      // zoom右側
                        this._sliderState = sliderZoomRight;
                        this._hutimeRoot._handleInnerEvent(     // 内部イベント（tMoveStartイベント）を発火
                            new HuTime.InnerEvent.createWithT("tmovestart", this,
                                this._hutimeRoot.minT, this._hutimeRoot.maxT));
                    }
                    else {
                        this._sliderState = sliderNone;
                        return;
                    }
                    this._dragOriginX = eventX;
                }
                return;
            }

            // mouseup：実施中の操作を終了して確定する
            if (ev._type == "mouseup") {
                clearTimeout(this._mouseTimer);
                if (this._sliderState == sliderMove) {
                    this._sliderState = sliderNone;
                    this._hutimeRoot._handleInnerEvent(     // 内部イベント（tmoveendイベント）を発火
                        new HuTime.InnerEvent.createWithT("tmoveend", this,
                            this._hutimeRoot.minT, this._hutimeRoot.maxT));
                }
                else if (this._sliderState == sliderZoomLeft || this._sliderState == sliderZoomRight) {
                    this._sliderState = sliderNone;
                    this._hutimeRoot._handleInnerEvent(     // 内部イベント（tmoveendイベント）を発火
                        new HuTime.InnerEvent.createWithT("tmoveend", this,
                            this._hutimeRoot.minT, this._hutimeRoot.maxT));
                }
                this._changeCursor(eventX);
                return;
            }

            // mousemove：移動量に合わせてminT, maxTを設定する
            if (ev._type == "mousemove") {   // レイヤ内でスライダ外から中、外だけで移動した場合
                if (this._parent._parent._dragDirection == "v")     // PanelCollectionの移動方向を参照
                    return;     // v軸方向にドラッグ中はスライダ操作はできない

                if (this._sliderState == sliderNone) {
                    if (this._tRotation == 1)
                        this._changeCursor(eventY);
                    else
                        this._changeCursor(eventX);
                    return;
                }

                var newLeft, newWidth;    // 新しいスライドの位置と幅
                var deltaT;     // t軸の移動量(px)

                if (this._tRotation == 1)
                    deltaT = eventY - this._dragOriginY;
                else
                    deltaT = eventX - this._dragOriginX;

                if (this._sliderState == sliderMove) {
                    newLeft = this._sliderLeft + deltaT;
                    newWidth = this._sliderWidth;
                }
                else if (this._sliderState == sliderZoomLeft) {
                    newLeft = this._sliderLeft + deltaT;
                    newWidth = this._sliderWidth - deltaT;

                    if (newWidth < 2 * this.zoomKnobWidth) {    // Zoomノブ同士が接するところまで動かせる
                        newLeft = (this._sliderLeft + this._sliderWidth) - 2 * this.zoomKnobWidth;
                        newWidth = 2 * this.zoomKnobWidth;
                    }
                }
                else if (this._sliderState == sliderZoomRight) {
                    newLeft = this._sliderLeft;
                    newWidth = this._sliderWidth + deltaT;

                    if (newWidth < 2 * this.zoomKnobWidth) {    // Zoomノブ同士が接するところまで動かせる
                        newWidth = 2 * this.zoomKnobWidth;
                    }
                }
                else {  // スライダの状態に異常値が設定されていた場合
                    return;
                }

                // スライダの操作に応じたminT, maxTを計算
                var newMinT, newMaxT;
                if (this._tDirection == 1) {
                    newMaxT = this._hutimeRoot.maxT -
                        (newLeft - this._sliderLeft) * (this._hutimeRoot.maxT - this._hutimeRoot.minT) / this._sliderWidth;
                    newMinT = newMaxT -
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) / this._sliderWidth * newWidth;
                }
                else {
                    newMinT = this._hutimeRoot.minT +
                        (newLeft - this._sliderLeft) * (this._hutimeRoot.maxT - this._hutimeRoot.minT) / this._sliderWidth;
                    newMaxT = newMinT +
                        (this._hutimeRoot.maxT - this._hutimeRoot.minT) / this._sliderWidth * newWidth;
                }

                // t値上限・下限のチェック
                if (newMinT < this._hutimeRoot.minTLimit && newMaxT > this._hutimeRoot.maxTLimit) {
                    newMinT = this._hutimeRoot.minTLimit;
                    newMaxT = this._hutimeRoot.maxTLimit;
                }
                else if(newMinT < this._hutimeRoot.minTLimit) {
                    newMinT = this._hutimeRoot.minTLimit;
                    newMaxT = this._hutimeRoot.maxT;
                }
                else if(newMaxT > this._hutimeRoot.maxTLimit) {
                    newMinT = this._hutimeRoot.minT;
                    newMaxT = this._hutimeRoot.maxTLimit;
                }

                // チェック後の値でスライダ位置を再計算
                if (this._tDirection == 1)
                    newLeft = this._sliderLeft - this._sliderWidth *
                        (newMaxT - this._hutimeRoot.maxT) / (this._hutimeRoot.maxT - this._hutimeRoot.minT);
                else
                    newLeft = this._sliderLeft + this._sliderWidth *
                        (newMinT - this._hutimeRoot.minT) / (this._hutimeRoot.maxT - this._hutimeRoot.minT);
                newWidth =  (newMaxT - newMinT) / (this._hutimeRoot.maxT - this._hutimeRoot.minT) * this._sliderWidth;

                // スライダ位置の設定
                this._sliderLeft = newLeft;
                this._sliderWidth = newWidth;
                if (this._tRotation == 1) {
                    this._sliderElement.style.top = this._sliderLeft + "px";
                    this._sliderElement.style.height = this._sliderWidth + "px";
                    this._zoomKnobRElement.style.top = (this._sliderWidth - this.zoomKnobWidth) + "px";
                }
                else {
                    this._sliderElement.style.left = this._sliderLeft + "px";
                    this._sliderElement.style.width = this._sliderWidth + "px";
                    this._zoomKnobRElement.style.left = (this._sliderWidth - this.zoomKnobWidth) + "px";
                }

                this._hutimeRoot._handleInnerEvent(     // tMoveイベントを発火
                    new HuTime.InnerEvent.createWithT("tmove", this, newMinT, newMaxT));

                clearTimeout(this._mouseTimer);
                this._mouseTimer = function(obj) {
                    return setTimeout(
                        function () {
                            obj._handleTimeout("tmovestop", obj);
                        },
                        obj._hutimeRoot.mouseTimeOut);
                }(this);
                this._dragOriginX = eventX;
                this._dragOriginY = eventY;
            }
        }
    },
    _mouseTimer : {
        writable: true,
        value : null
    },
    _handleTimeout : {
        value: function(type, obj) {
            obj._hutimeRoot._handleInnerEvent(     // tMoveイベントを発火
                new HuTime.InnerEvent.createWithT(type, obj, obj._hutimeRoot.minT, obj._hutimeRoot.maxT));
        }
    },

    _changeCursor : {           // カーソル制御
        value: function(tXYPos) {
            if (tXYPos > this._sliderLeft + this.zoomKnobWidth &&
              tXYPos < this._sliderLeft + this._sliderWidth - this.zoomKnobWidth) {   // 移動
                this._zoomKnobLElement.style.visibility
                    = this.zoomKnobVisibility == "hidden" ? "hidden" : "visible";
                this._zoomKnobRElement.style.visibility
                    = this.zoomKnobVisibility == "hidden" ? "hidden" : "visible";
                if (this._tRotation == 1)
                    this._captureElement.style.cursor = "n-resize";
                else
                    this._captureElement.style.cursor = "e-resize";
            }
            else if (tXYPos > this._sliderLeft &&
              tXYPos < this._sliderLeft + this.zoomKnobWidth) {     // zoom左側
                this._zoomKnobLElement.style.visibility
                    = this.zoomKnobVisibility == "hidden" ? "hidden" : "visible";
                this._zoomKnobRElement.style.visibility
                    = this.zoomKnobVisibility == "hidden" ? "hidden" : "visible";
                this._captureElement.style.cursor = "pointer";
            }
            else if (tXYPos > this._sliderLeft + this._sliderWidth - this.zoomKnobWidth &&
              tXYPos < this._sliderLeft + this._sliderWidth) { // zoom右側
                this._zoomKnobLElement.style.visibility
                    = this.zoomKnobVisibility == "hidden" ? "hidden" : "visible";
                this._zoomKnobRElement.style.visibility
                    = this.zoomKnobVisibility == "hidden" ? "hidden" : "visible";
                this._captureElement.style.cursor = "pointer";
            }
            else {
                this._zoomKnobLElement.style.visibility
                    = this.zoomKnobVisibility == "visible" ? "visible" : "hidden";
                this._zoomKnobRElement.style.visibility
                    = this.zoomKnobVisibility == "visible" ? "visible" : "hidden";
                this._captureElement.style.cursor = "default";
            }
        }
    },
    _handleInnerEventBubbling: {
        value: function (ev) {    // 内部イベントの処理
            // 継承元（Layer）ので定義されている処理はSliderでは行わない
            // tmove: tの値に合わせて描画位置を変更 -> スライダの位置は固定
            // tmovestop: 再描画 -> もともと動いていないので不要
        }
    }
});


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

// 目盛用カレンダーデータ
HuTime.CalendarScaleDataset = function CalendarScaleDataset (calendarId) {
    this.getScaleData = this.defaultGetScaleData;
    if (calendarId)
        this.calendarId = calendarId;
    this._request = new XMLHttpRequest();
    this._calendarData = [];    // 空の配列で初期化しておく
    this._labelFormat = new HuTime.CalendarLabelFormat(this);
};
HuTime.CalendarScaleDataset.prototype = Object.create(HuTime.ScaleDatasetBase.prototype, {
    constructor: {
        value: HuTime.CalendarScaleDataset
    },

    minCnvTickInterval: {       // canvas上の目盛の最小間隔（px）（初期値）
        writable: true,
        value:7
    },
    getScaleData: {             // 目盛データの取得
        writable: true,
        value: null
    },
    _calendarId: {               // 暦ID（指定すると、Webからデータを取得する）
        writable: true,
        value: null
    },
    calendarId: {
        get: function() {
                return this._calendarId;
        },
        set: function(val) {
                this._calendarData = null;
                this._calendarId = val;
        }
    },
    _labelFormat: {              // ラベルの書式
        writable: true,
        value: null
    },
    labelFormat: {
        get: function() {
            return this._labelFormat;
        }
    },
    _request: {                 // httpリクエスト用のオブジェクト
        writable: true,
        value: null
    },
    _calendarData: {            // 暦のデータ
        writable: true,
        value: null
    },
    _min: {                     // 現在取得しているt値の最小値
        writable: true,
        value: null
    },
    _max: {                     // 現在取得しているt値の最大値
        writable: true,
        value: null
    },
    _interval: {                // 現在取得している目盛の間隔
        writable: true,
        value: null
    },
    _minTickInterval: {         // 現在取得している目盛間隔の最小値（canvas上の目盛の最小間隔で詰め込んだ場合）
        writable: true,
        value: null
    },

    defaultGetScaleData: {      // 既定の目盛データの取得処理
        value: function defaultGetScaleData (min, max, scalePos) {
            // 暦データのload時にパラメータ（min, max, scalePos）の処理は済んでいるのでここでは使わない（互換性のため、残置）
            var data = [];          // 結果を収容する配列
            var pushData = function pushData (value, level, label) {    // 目盛データ追加
                data.push({
                    value: value,
                    level: level,
                    label: label
                });
            };
            var calendarData = this._calendarData;          // 元になる目盛の暦データ（頻出するので、参照をコピーしておく）
            var minTickInterval = this._minTickInterval;    // 目盛間隔の最小値（頻出するので、コピーしておく）
            var order;      // 桁数の計算用
            var i;          // カウンタ

            if (minTickInterval > 50) {     // 最小目盛：1年以上（1ケタずつ増やす）
                order = Math.pow(10, Math.floor(Math.log(minTickInterval / 50) * Math.LOG10E));
                for (i = 0; i < calendarData.length; ++i) {
                    if (calendarData[i].tickValue == null)
                        pushData(calendarData[i].value, 3, calendarData[i].labelLower);     // 年号
                    else if ((calendarData[i].tickValue) % (10 * order) == 0)
                        pushData(calendarData[i].value, 2, calendarData[i].labelLower + "\n" + calendarData[i].labelUpper);
                    else if ((calendarData[i].tickValue) % (5 * order) == 0) {
                        if (minTickInterval < 200 * order)
                            pushData(calendarData[i].value, 2, calendarData[i].labelLower);
                        else
                            pushData(calendarData[i].value, 1, "");
                    }
                    else
                        pushData(calendarData[i].value, 0, "");
                }
            }
            else if (minTickInterval > 4) {     // 最小目盛：1か月
                for (i = 0; i < calendarData.length; ++i) {      // 1年ごとの目盛
                    if (calendarData[i].tickValue == null)
                        pushData(calendarData[i].value, 3, calendarData[i].labelLower);     // 年号
                    else if (calendarData[i].tickValue == 1) {
                        if (minTickInterval < 10)
                            pushData(calendarData[i].value, 2, calendarData[i].labelLower + "\n" + calendarData[i].labelUpper);
                        else
                            pushData(calendarData[i].value, 2, calendarData[i].labelUpper.toString());
                    }
                    else if ((calendarData[i].tickValue - 1) % 4 == 0) {     // 4か月ごとの目盛
                        if (minTickInterval < 10)
                            pushData(calendarData[i].value, 2, calendarData[i].labelLower.toString());
                        else
                            pushData(calendarData[i].value, 1, "");
                    }
                    else                         // 1か月ごとの目盛
                        pushData(calendarData[i].value, 0, "");
                }
            }
            else if (minTickInterval > 1.5) {     // 最小目盛：5日（月初めから）
                for (i = 0; i < calendarData.length; ++i) {
                    if (calendarData[i].tickValue == null)
                        pushData(calendarData[i].value, 3, calendarData[i].labelLower);     // 年号
                    else if (calendarData[i].tickValue == 1) {
                        if (calendarData[i].labelValueLower == 1)
                            pushData(calendarData[i].value, 2, calendarData[i].labelLower + "\n" + calendarData[i].labelUpper);
                        else
                            pushData(calendarData[i].value, 2, calendarData[i].labelLower.toString());
                    }
                    else if (calendarData[i].tickValue == 11 || calendarData[i].tickValue == 21)
                        pushData(calendarData[i].value, 1, "");
                    else
                        pushData(calendarData[i].value, 0, "");
                }
            }
            else if (minTickInterval > 0.15) {     // 最小目盛：1日
                for (i = 0; i < calendarData.length; ++i) {
                    if (calendarData[i].tickValue == null)
                        pushData(calendarData[i].value, 3, calendarData[i].labelLower);     // 年号
                    else if (calendarData[i].tickValue == 1)
                        pushData(calendarData[i].value, 2, calendarData[i].labelLower + "\n" + calendarData[i].labelUpper);
                    else if (calendarData[i].tickValue == 11 || calendarData[i].tickValue == 21)
                        pushData(calendarData[i].value, 2, calendarData[i].labelLower);
                    else if ((calendarData[i].tickValue - 1) % 5 == 0) {
                        if (minTickInterval < 0.7 && calendarData[i].tickValue != 31)
                            pushData(calendarData[i].value, 2, calendarData[i].labelLower);
                        else
                            pushData(calendarData[i].value, 1, "");
                    }
                    else
                        pushData(calendarData[i].value, 0, "");
                }
            }
            else if (minTickInterval > 0.04) {      // 最小目盛：1/8日（3時間）－ラベルが日単位なので、時間でなく日を使う
                for (i = 0; i < calendarData.length; ++i) {
                    if (calendarData[i].tickValue == null)
                        pushData(calendarData[i].value, 3, calendarData[i].labelLower);     // 年号
                    else if ((calendarData[i].tickValue - 1) % 5 == 0 && (calendarData[i].value + 0.5) % 1 == 0)
                        pushData(calendarData[i].value, 2, calendarData[i].labelLower + "\n" + calendarData[i].labelUpper);
                    else if (Math.round((calendarData[i].value + 0.5) * 8) % 8.0 == 0)
                        pushData(calendarData[i].value, 2, calendarData[i].labelLower);
                    else if (Math.round((calendarData[i].value + 0.5) * 8) % 2.0 == 0)
                        pushData(calendarData[i].value, 1, "");
                    else
                        pushData(calendarData[i].value, 0, "");
                }
            }
            else if (minTickInterval > 0.007) {      // 最小目盛：1時間
                for (i = 0; i < calendarData.length; ++i) {
                    if (calendarData[i].tickValue == null)
                        pushData(calendarData[i].value, 3, calendarData[i].labelLower);     // 年号
                    else if (calendarData[i].tickValue == 0)
                        pushData(calendarData[i].value, 2, calendarData[i].labelLower + "\n" + calendarData[i].labelUpper);
                    else if ((calendarData[i].tickValue) % 6 == 0)
                        pushData(calendarData[i].value, 2, calendarData[i].labelLower);
                    else
                        pushData(calendarData[i].value, 0, "");
                }
            }
            else if (minTickInterval > 0.00015) {    // 最小目盛：10分または1分
                order = minTickInterval > 0.0007 ? 10 : 1;
                for (i = 0; i < calendarData.length; ++i) {
                    if (calendarData[i].tickValue == null)
                        pushData(calendarData[i].value, 3, calendarData[i].labelLower);     // 年号
                    else if ((order == 10 && calendarData[i].labelValueLower % 6 == 0 && calendarData[i].tickValue == 0) ||
                        order == 1 && calendarData[i].tickValue % 30 == 0)
                        pushData(calendarData[i].value, 2, calendarData[i].labelLower + "\n" + calendarData[i].labelUpper);
                    else if (order == 10 && calendarData[i].tickValue == 0 || order == 1 && calendarData[i].tickValue % 10 == 0)
                        pushData(calendarData[i].value, 2, calendarData[i].labelLower);
                    else if (order == 10 && calendarData[i].tickValue % 30 == 0 || order == 1 && calendarData[i].tickValue % 5 == 0) {
                        if (order == 10 && minTickInterval < 0.002 || order == 1 && minTickInterval < 0.0004)
                            pushData(calendarData[i].value, 2, calendarData[i].labelLower);
                        else
                            pushData(calendarData[i].value, 1, "");
                    }
                    else
                        pushData(calendarData[i].value, 0, "");
                }
            }
            else {      // // 最小目盛：秒以下
                order = Math.pow(10, Math.floor(Math.log(minTickInterval / 0.00015) * Math.LOG10E) + 2);
                for (i = 0; i < calendarData.length; ++i) {
                    if (calendarData[i].tickValue == null)
                        pushData(calendarData[i].value, 3, calendarData[i].labelLower);     // 年号
                    else if (order == 10 && calendarData[i].tickValue == 0 && calendarData[i].labelValueLower % 5 == 0 ||
                        order == 1 && calendarData[i].tickValue == 0 ||
                        order < 1 && Math.round(calendarData[i].tickValue / order) % 50 == 0) {
                        pushData(calendarData[i].value, 2, calendarData[i].labelLower + "\n" + calendarData[i].labelUpper);
                    }
                    else if (order == 10 && calendarData[i].tickValue == 0) {
                        if (minTickInterval < 0.00007)
                            pushData(calendarData[i].value, 2, calendarData[i].labelLower);
                        else
                            pushData(calendarData[i].value, 1, "");
                    }
                    else if (order < 10 && Math.round(calendarData[i].tickValue / order) % 10 == 0) {
                        if (minTickInterval < 0.000004 * order)
                            pushData(calendarData[i].value, 2, calendarData[i].labelLower + "\n" + calendarData[i].labelUpper);
                        else
                            pushData(calendarData[i].value, 2, calendarData[i].labelLower);
                    }
                    else if (order < 10 && Math.round(calendarData[i].tickValue / order) % 5 == 0) {
                        if (minTickInterval < 0.000004 * order)
                            pushData(calendarData[i].value, 2, calendarData[i].labelLower);
                        else
                            pushData(calendarData[i].value, 1, "");
                    }
                    else
                        pushData(calendarData[i].value, 0, "");
                }
            }
            return data;
        }
    },

    loadScaleData: {      // 目盛データ（年月日時分秒）のロード開始（ロードが始まった場合はtrueを返す）
        value: function(min, max, scalePos) {
            if (min > max) {    // 大小が逆の場合は入れ替える
                var exMinMax = min;
                min = max;
                max = exMinMax;
            }
            var minTickInterval     // 目盛間隔の最小値（canvas上の目盛の最小間隔で詰め込んだ場合）
                = (max - min) / (scalePos._scaleLength / this.minCnvTickInterval);
            var interval;   // 目盛間隔

            // 値を大きくするほど、目盛が詰まってから上位の目盛間隔に切り替わる
            if (minTickInterval > 50)               // 最小目盛：1年以上（1ケタずつ増やす）
                interval = Math.pow(10, Math.floor(Math.log(minTickInterval / 50) * Math.LOG10E)) + "y";
            else if (minTickInterval > 4)           // 最小目盛：1か月
                interval = "1M";
            else if (minTickInterval > 1.5)         // 最小目盛：5日（月初めから）
                interval = "5D";
            else if (minTickInterval > 0.15)        // 最小目盛：1日
                interval = "1d";
            else if (minTickInterval > 0.04)        // 最小目盛：1/8日（6時間）－ラベルが日単位なので、時間でなく日を使う
                interval = "0.125d";
            else if (minTickInterval > 0.007)       // 最小目盛：1時間
                interval = "1h";
            else if (minTickInterval > 0.00015)     // 最小目盛：10分または1分
                interval = (minTickInterval > 0.0007 ? 10 : 1) + "m";
            else                                    // 最小目盛：秒以下
                interval = Math.pow(10, Math.floor(Math.log(minTickInterval / 0.00015) * Math.LOG10E) + 2) + "s";

            if (min == this._min && max == this._max && interval == this._interval && this._calendarData)
                return false;     // 既にデータがloadされている場合
            this._min = min;
            this._max = max;
            this._interval = interval;
            this._minTickInterval = minTickInterval;

            if (!this.calendarId) {     // calendarIdが指定されていない場合は、ISO形式（先発グレゴリオ暦）を出力
                this._calendarData = this.getDefaultCalendarData(min, max, interval);
                this.onload();  // 手動で外部指定のonloadイベントを実行
                return true;
            }

            // httpリクエスト（年月日時分秒のみ、年号はロード終了後に引き続いて取得する）
            this._request.abort();          // 現在の処理を中止
            this._request = new XMLHttpRequest();
            var onload = function(obj) {    // onloadイベントの処理を年月日用に切り替える
                obj._request.onload = function() {
                    obj.ymdOnload.apply(obj);
                }
            }(this);

            var queryString = "calId=" + this.calendarId +
                "&min=" + min.toString() + "&max=" + max.toString() + "&interval=" + interval;
            if (this.labelFormat.era != null)
                queryString += "&fEra=" + this.labelFormat.era;
            if (this.labelFormat.year != null)
                queryString += "&fYear=" + this.labelFormat.year;
            if (this.labelFormat.month != null)
                queryString += "&fMonth=" + this.labelFormat.month;
            if (this.labelFormat.day != null)
                queryString += "&fDay=" + this.labelFormat.day;
            if (this.labelFormat.toYear != null)
                queryString += "&fToYear=" + this.labelFormat.toYear;
            if (this.labelFormat.toMonth != null)
                queryString += "&fToMonth=" + this.labelFormat.toMonth;
            if (this.labelFormat.toDay != null)
                queryString += "&fToDay=" + this.labelFormat.toDay;

            this._request.open("GET", "http://ap.hutime.org/CalendarScale/?" + queryString, true);
            try {
                this._request.send(null);
            }
            catch (e) {
                return false;
            }
            return true;
        }
    },
    loadEraScaleData: {     // 目盛データ（年号）のロード開始（ロードが始まった場合はtrueを返す）
        value: function () {
            this._request.abort();          // 現在の処理を中止
            this._request = new XMLHttpRequest();
            var onload = function(obj) {    // onloadイベントの処理を年号用に切り替える
                obj._request.onload = function() {
                    obj.eraOnload.apply(obj);
                }
            }(this);
            this._request.open("GET", "http://ap.hutime.org/CalendarScale/?calId=" + this.calendarId +
                "&min=" + this._min.toString() + "&max=" + this._max.toString() + "&interval=1g", true);
            try {
                this._request.send(null);
            }
            catch (e) {
                return false;
            }
            return true;
        }
    },

    onload: {       // 読み込み終了後の処理（外部から指定される分）
        writable: true,
        value: function() {}
    },
    ymdOnload: {    // 読み込み終了後の処理（自分自身の年月日時分秒処理）
        value: function() {
            if (this._request.readyState == 4 && this._request.status == 200)
                this._calendarData = JSON.parse(this._request.responseText);
            else
                this._calendarData = [];
            this.loadEraScaleData();    // 引き続いて年号データを取得する
        }
    },
    eraOnload: {    // 読み込み終了後の処理（自分自身の年号処理）
        value: function() {
            if (this._request.readyState == 4 && this._request.status == 200) {
                var eraData = JSON.parse(this._request.responseText);
                for (var i = 0; i < eraData.length; ++i) {
                    eraData[i].tickValue = null;  // 年号にはnullを設定しておき、scaleData生成の際の目印にする
                }
                this._calendarData = this._calendarData.concat(eraData);
            }
            this.onload();
        }
    },

    // **** 既定（ローカル生成）の暦（ユリウス・グレゴリオ暦）****
    getDefaultCalendarData: {   // 既定の暦データ（ユリウス／グレゴリオ暦）
        value: function(min, max, interval) {
            var data = [];
            var time = HuTime.jdToTime(min, this._calendarType);
            var endTime = HuTime.jdToTime(max, this._calendarType);
            var jd;
            var intervalValue = parseFloat(interval);
            var getYearLabel = function getYearLabel (year) { // 年の表記をISOに合わせる（4ケタまでは0詰め）
                var absYear = Math.abs(year);    // 年の絶対値
                return (year < 0 ? "-" : "") + (absYear < 10000 ? ("0000" + absYear).slice(-4) : absYear);
            };

            switch (interval.substring(interval.length -1)) {
                case "y" :      // 年ごと
                    time.year = Math.floor(time.year / intervalValue) * intervalValue;
                    for (; time.year <= endTime.year; time.year += intervalValue) {
                        data.push({
                            value: HuTime.timeToJd(time.year, 1, 1, 0, 0, 0, this._calendarType),
                            tickValue: time.year,
                            labelUpper: "",
                            labelLower: getYearLabel(time.year),
                            labelValueLower: time.year
                        });
                    }
                    break;

                case "M" :      // 月ごと
                    while (time.year <= endTime.year) {
                        for (; time.month <= 12; time.month += intervalValue) {
                            data.push({
                                value: HuTime.timeToJd(time.year, time.month, 1, 0, 0, 0, this._calendarType),
                                tickValue: time.month,
                                labelUpper: getYearLabel(time.year),
                                labelLower: ("00" + time.month).slice(-2),
                                labelValueLower: time.year
                            });
                        }
                        ++time.year;
                        time.month = 1;
                    }
                    break;

                case "D" :      // 月始め基準の日ごと
                    while (time.year <= endTime.year) {
                        for (; time.month <= 12; ++time.month) {
                            for (time.day = 1; time.day < 31; time.day += intervalValue) {
                                data.push({
                                    value: HuTime.timeToJd(time.year, time.month, time.day, 0, 0, 0, this._calendarType),
                                    tickValue: time.day,
                                    labelUpper: getYearLabel(time.year),
                                    labelLower: ("00" + time.month).slice(-2),
                                    labelValueLower: time.month
                                });
                            }
                        }
                        ++time.year;
                        time.month = 1;
                    }
                    break;

                case "d" :      // 日ごと
                    jd = Math.floor(min - 0.5) + 0.5;
                    for (; jd < max; jd += intervalValue) {
                        time = HuTime.jdToTime(jd, this._calendarType);
                        data.push({
                            value: jd,
                            tickValue: time.day,
                            labelUpper: getYearLabel(time.year) + "-" + ("00" + time.month).slice(-2),
                            labelLower: ("00" + time.day).slice(-2),
                            labelValueLower: time.month
                        });
                    }
                    break;

                case "h" :      // 時ごと
                    jd = min;
                    time.hour = Math.floor(time.hour / intervalValue) * intervalValue;
                    while (jd <= max) {
                        for (; time.hour < 24; time.hour += intervalValue) {
                            jd = HuTime.timeToJd(time.year, time.month, time.day, time.hour, 0, 0, this._calendarType);
                            if (jd > max)
                                break;
                            data.push({
                                value: jd,
                                tickValue: time.hour,
                                labelUpper: getYearLabel(time.year) + "-" + ("00" + time.month).slice(-2) +
                                "-" + ("00" + time.day).slice(-2),
                                labelLower: ("00" + time.hour).slice(-2) + ":" + ("00" + time.minute).slice(-2),
                                labelValueLower: time.day
                            });
                        }
                        jd = HuTime.timeToJd(time.year, time.month, time.day, 0, 0, 0, this._calendarType) + 1;
                        time = HuTime.jdToTime(jd, this._calendarType);
                    }
                    break;

                case "m" :      // 分ごと
                    jd = min;
                    time.minute = Math.floor(time.minute / intervalValue) * intervalValue;
                    while (jd <= max) {
                        for (; time.minute < 60; time.minute += intervalValue) {
                            jd = HuTime.timeToJd(time.year, time.month, time.day,
                                time.hour, time.minute, 0, this._calendarType);
                            if (jd > max)
                                break;
                            data.push({
                                value: jd,
                                tickValue: time.minute,
                                labelUpper: getYearLabel(time.year) + "-" + ("00" + time.month).slice(-2) +
                                "-" + ("00" + time.day).slice(-2),
                                labelLower: ("00" + time.hour).slice(-2) + ":" + ("00" + time.minute).slice(-2),
                                labelValueLower: time.hour
                            });
                        }
                        jd = HuTime.timeToJd(time.year, time.month, time.day, time.hour + 1, 0, 0, this._calendarType);
                        time = HuTime.jdToTime(jd, this._calendarType);
                    }
                    break;

                case "s" :      // 秒ごと
                    jd = min;
                    time.second = Math.floor(time.second / intervalValue) * intervalValue;
                    var fixed = Math.floor(Math.log(intervalValue) * Math.LOG10E);
                    fixed = fixed < 0 ? -fixed : 0;
                    while (jd <= max) {
                        while (time.second < 60) {
                            jd = HuTime.timeToJd(time.year, time.month, time.day,
                                time.hour, time.minute, time.second, this._calendarType);
                            if (jd > max)
                                break;
                            data.push({
                                value: jd,
                                tickValue: time.second,
                                labelUpper: getYearLabel(time.year) + "-" + ("00" + time.month).slice(-2) +
                                "-" + ("00" + time.day).slice(-2),
                                labelLower: ("00" + time.hour).slice(-2) + ":" + ("00" + time.minute).slice(-2) +
                                ":" + (time.second < 10 ? "0" : "") + time.second.toFixed(fixed),
                                labelValueLower: time.minute
                            });
                            time.second = (Math.round(time.second / intervalValue) + 1) * intervalValue;
                        }
                        jd = HuTime.timeToJd(time.year, time.month, time.day,
                            time.hour, time.minute + 1, 0, this._calendarType);
                        time = HuTime.jdToTime(jd, this._calendarType);
                        time.second = 0;    // jdToTimeの処理での計算誤差を修正
                    }
                    break;
            }
            return data;
        }
    },
    _calendarType: {     // JGカレンダーの改暦時期（0:先発グレゴリオ暦（改暦なし）、1:ROMA、2:LONDON）
        writable: true,
        value: 0
    },
    calendarType: {
        get: function() {
            return this._calendarType;
        },
        set: function(val) {
            this._calendarType = val;
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.ScaleDatasetBase.prototype._toJSONProperties, {
            minCnvTickInterval: { value: "minCnvTickInterval" },
            _calendarId: { value: "calendarId" },
            //onload: { value: "onload" },
            _calendarType: { value: "calendarType" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.ScaleDatasetBase.prototype._parseJSONProperties, {
            calendarType: { value: "_calendarType" }
        })
    }
});

// 暦目盛の書式
HuTime.CalendarLabelFormat = function (dataset) {
    this.dataset = dataset;
};
HuTime.CalendarLabelFormat.prototype = {
    constructor: HuTime.LabelFormat,

    dataset: null,  // データセット
    _era:null,      // 年号
    get era() {
        return this._era;
    },
    set era(val) {
        this._era = val;
        this.dataset._calendarData = null;
    },
    _year: null,     // 年
    get year() {
        return this._year;
    },
    set year(val) {
        this._year = val;
        this.dataset._calendarData = null;
    },
    _month: null,    // 月
    get month() {
        return this._month;
    },
    set month(val) {
        this._month = val;
        this.dataset._calendarData = null;
    },
    _day: null,      // 日（月の日）
    get day() {
        return this._day;
    },
    set day(val) {
        this._day = val;
        this.dataset._calendarData = null;
    },
    _toYear: null,   // 年号～年
    get toYear() {
        return this._toYear;
    },
    set toYear(val) {
        this._toYear = val;
        this.dataset._calendarData = null;
    },
    _toMonth: null,  // 年号～月
    get toMonth() {
        return this._toMonth;
    },
    set toMonth(val) {
        this._toMonth = val;
        this.dataset._calendarData = null;
    },
    _toDay: null,     // 年号～日
    get toDay() {
        return this._toDay;
    },
    set toDay(val) {
        this._toDay = val;
        this.dataset._calendarData = null;
    }
};

// **** 暦スケールレイヤ ****
HuTime.CalendarScaleLayer = function CalendarScaleLayer (vBreadth, vMarginTop, vMarginBottom, calendarId) {
    // 目盛の書式
    var scaleStyle = new HuTime.TickScaleStyle();
    scaleStyle.labelOnTick = true;
    scaleStyle.labelOffset = 2;
    scaleStyle.tickSize = [5, 8, 10, 37];
    scaleStyle.tickStyle = [
        new HuTime.FigureStyle(null, "black", 1),
        new HuTime.FigureStyle(null, "black", 1),
        new HuTime.FigureStyle(null, "black", 1),
        new HuTime.FigureStyle(null, "black", 1)];
    scaleStyle.labelStyle = [
        new HuTime.StringStyle(12, "black"),
        new HuTime.StringStyle(12, "black"),
        new HuTime.StringStyle(12, "black"),
        new HuTime.StringStyle(12, "black", 700)];    // 年号ラベル
    scaleStyle.labelStyle[0].textBaseline = "bottom";
    scaleStyle.labelStyle[1].textBaseline = "bottom";
    scaleStyle.labelStyle[2].textBaseline = "bottom";
    scaleStyle.labelStyle[3].textBaseline = "bottom";
    scaleStyle.labelAlignOffset = [-4, -4, -4, -8];
    scaleStyle.labelStyle[0]._lineHeight = "-14px";
    scaleStyle.labelStyle[1]._lineHeight = "-14px";
    scaleStyle.labelStyle[2]._lineHeight = "-14px";
    scaleStyle.labelStyle[3]._lineHeight = "-18px";

    HuTime.TickScaleLayer.apply(this, [vBreadth, vMarginTop, vMarginBottom, scaleStyle, new HuTime.CalendarScaleDataset(calendarId)]);
};
HuTime.CalendarScaleLayer.prototype = Object.create(HuTime.TickScaleLayer.prototype, {
    // **** 基本構造 ****
    constructor: {
        value: HuTime.CalendarScaleLayer
    },

    _scaleDataset: {
        writable: true,
        value: null
    },
    scaleDataset: {
        get: function() {
            return this._scaleDataset;
        },
        set: function(val) {
            if (!(val instanceof HuTime.CalendarScaleDataset))
                return;
            this._scaleDataset = val;
            var onload = function(obj) {
                obj._scaleDataset.onload = function() {
                    HuTime.Drawing.drawScale(obj.scaleStyle, obj, obj._scalePosition,
                        obj._scaleDataset.getScaleData(obj._minLyrT, obj._maxLyrT, obj._scalePosition), obj._canvas);
                }
            }(this);
        }
    },
    calendarId: {   // 暦ID（データセットのプロパティを操作）
        get: function() {
            return this.scaleDataset.calendarId;
        },
        set: function(val) {
            this.scaleDataset.calendarId = val;
        }
    },
    calendarType: {   // 既定の暦（JG）の改暦時期（データセットのプロパティを操作）（0:改暦なし、1:ROMA、2:LONDON）
        get: function() {
            return this.scaleDataset.calendarType;
        },
        set: function(val) {
            this.scaleDataset.calendarType = val;
        }
    },
    labelFormat: {      // ラベルの書式（labelFormatに設定されたオブジェクトのプロパティを操作するのでgetのみ）
        get: function() {
            return this.scaleDataset.labelFormat;
        }
    },

    processAfterRedraw: {   // 再描画後の処理（目盛データのロードを追加）
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

            if (!this.scaleDataset.loadScaleData(this._minLyrT, this._maxLyrT, this._scalePosition))    // 目盛データのロード
                HuTime.Drawing.drawScale(this.scaleStyle, this, this._scalePosition,    // 既にロードされている場合は描画処理
                    this.scaleDataset.getScaleData(this._minLyrT, this._maxLyrT, this._scalePosition), this._canvas);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.TickScaleLayer.prototype._toJSONProperties, {
            _scaleDataset: { value: "scaleDataset" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.TickScaleLayer.prototype._parseJSONProperties, {
        })
    }
});
// **** t値で示された範囲 ****
HuTime.TRange = function TRange (pBegin, rBegin, rEnd, pEnd) {  // コンストラクタ（数値以外は初期値を設定）
    pBegin = Number.parseFloat(pBegin);
    if (!isNaN(pBegin))
        this._pBegin = pBegin;
    rBegin = Number.parseFloat(rBegin);
    if (!isNaN(rBegin))
        this._rBegin = rBegin;
    rEnd = Number.parseFloat(rEnd);
    if (!isNaN(rEnd))
        this._rEnd = rEnd;
    pEnd = Number.parseFloat(pEnd);
    if (!isNaN(pEnd))
        this._pEnd = pEnd;

    if (this._pBegin > this._pEnd) {    // 可能期間の始点と終点が逆の場合は初期値に戻す
        this._pBegin = Number.NEGATIVE_INFINITY;
        this._rBegin = Number.POSITIVE_INFINITY;
        this._rEnd = Number.NEGATIVE_INFINITY;
        this._pEnd = Number.POSITIVE_INFINITY;
    }
    else {  // 可能期間の始点と終点の関係が正しい場合、確実期間の調整に進む
        // 確実期間の端点が可能期間をはみ出した場合は、可能期間に合わせる
        if (this._rBegin < this._pBegin)
            this._rBegin = this._pBegin;
        if (this._rBegin > this._pEnd)
            this._rBegin = this._pEnd;
        if (this._rEnd > this._pEnd)
            this._rEnd = this._pEnd;
        if (this._rEnd < this._pBegin)
            this._rEnd = this._pBegin;
    }

    this.updateCentralValue();
};
HuTime.TRange.prototype = {
    constructor: HuTime.TRange,

    // 基本となる4値（初期値は無限小～無限大）
    _pBegin: Number.NEGATIVE_INFINITY,  // 可能期間始点
    _rBegin: Number.POSITIVE_INFINITY,  // 確実期間始点
    _rEnd: Number.NEGATIVE_INFINITY,    // 確実期間終点
    _pEnd: Number.POSITIVE_INFINITY,    // 可能期間終点
    get pBegin() {
        return this._pBegin;
    },
    get rBegin() {
        return this._rBegin;
    },
    get rEnd() {
        return this._rEnd;
    },
    get pEnd() {
        return this._pEnd;
    },

    // 代表値
    _centralValue: Number.NaN,
    get centralValue() {
        return this._centralValue;
    },
    updateCentralValue: function() {      // 代表値の設定
        // 確実期間があり、かつ、両端とも無限大でない
        if (isFinite(this._rBegin) && isFinite(this._rEnd) && this._rBegin <= this._rEnd)
            this._centralValue = (this._rBegin + this._rEnd) / 2;

        // 可能期間の両端とも無限大でない（確実期間なし）
        else if (isFinite(this._pBegin) && isFinite(this._pEnd))
            this._centralValue = (this._pBegin + this._pEnd) / 2;

        // 始点範囲の始点（Pb）が無限小ではない場合（始点を優先）
        else if (isFinite(this._pBegin)) {
            if (isFinite(this._rBegin))     // 確実期間の始点（始点範囲の終点）が無限大ではない
                this._centralValue = this._rBegin;
            else
                this._centralValue = this._pBegin;
        }

        // 終点範囲の終点（Pe）が無限大ではない場合
        else if (isFinite(this._pBegin)) {
            if (isFinite(this._rEnd))       // 確実期間の終点（始点範囲の始点）が無限大ではない
                this._centralValue = this._rEnd;
            else
                this._centralValue = this._pEnd;
        }

        // 4値とも無限小または無限大
        else
            this._centralValue = Number.NaN;
    },

    // 状態表示（今後要修正）
    get isDetermined() {
        return this._pBegin === this._rBegin && this._pEnd === this._pEnd;
    },
    get isTotalPRangeOnly() {       // 全可能期間のみの場合 true
        return this._rBegin == null && this._rEnd == null;
    },
    get isNonRRange() {             // 確実期間がない場合 true
        return this._rBegin == null || this._rEnd == null || this._rBegin > this._rEnd;
    },

    // クローンの生成
    clone: function clone () {
        return new HuTime.TRange(this._pBegin, this._rBegin, this._rEnd, this._pEnd);
    },

    // 関係の検証
    examineRelation: function examineRelation (relation, tRange) {      // relationで指定した関係について検証
        return HuTime.TRange.examineRelation(relation, this, tRange);
    },
    _examineRelations: function _examineRelations(tRange) {         // すべての関係を検証（数値を返す）
        return HuTime.TRange._examineRelations(this, tRange);
    },
    examineRelations: function examineRelations(tRange) {           // すべての関係を検証（RelationSetオブジェクトを返す）
        return HuTime.TRange.examineRelations(this, tRange);
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        _pBegin: "pBegin",
        _rBegin: "rBegin",
        _rEnd: "rEnd",
        _pEnd: "pEnd",
        _centralValue: "centralValue",
    },
    _parseJSONProperties: {
        pBegin: "_pBegin",
        rBegin: "_rBegin",
        rEnd: "_rEnd",
        pEnd: "_pEnd",
        centralValue: "_centralValue",
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// 基本4値以外からのTRangeの生成
// 始点と終点を指定してTRangeを生成（t値またはTRangeを指定）
HuTime.TRange.createFromBeginEnd  = function createFromBeginEnd (begin, end) {
    let pBegin, rBegin, rEnd, pEnd;

    if (begin instanceof HuTime.TRange) {   // TRangeで指定された場合
        pBegin = begin._pBegin;
        rBegin = begin._pEnd;
    }
    else {
        pBegin = begin;
        rBegin = begin;
    }

    if (end instanceof HuTime.TRange) {
        rEnd = end._pBegin;
        pEnd = end._pEnd;
    }
    else {
        rEnd = end;
        pEnd = end;
    }

    return new HuTime.TRange(pBegin, rBegin, rEnd, pEnd);
};
// １つの点（または期間）を指定してTRangeを生成（t値またはTRangeを指定）
HuTime.TRange.createFromRange = function createFromRange (range) {
    if (range instanceof HuTime.TRange)    // TRangeで指定された場合
        return range.clone();
    return new HuTime.TRange(range, range, range, range);
};

// **** Allenの関係 ****
HuTime.TRange.Relation = {
    // 逆の関係が隣のビットに割り当てられている
    Equals: 1,
    Before: 2,
    After: 4,
    During: 8,
    Contains: 16,
    Overlaps: 32,
    OverlappedBy: 64,
    Meets: 128,
    MetBy: 256,
    Starts: 512,
    StartedBy: 1024,
    Finishes: 2048,
    FinishedBy: 4096
};
Object.freeze(HuTime.TRange.Relation);

// **** あいまいさの状態 ****
// 将来的に、空間等にも活用する可能性があるので、TRangeの下にしない
HuTime.UncertainState = {
    Impossible: 0,  // falseで評価される
    Possible: 1,
    Reliable: 2
};
Object.freeze(HuTime.UncertainState);

// 確実関係の検証（型のチェックは省略（一括処理の際に実施・以下同））
HuTime.TRange.isReliableEquals = function isReliableEquals (a, b) {
    return a._pBegin === a._rBegin && a._rBegin === b._pBegin && b._pBegin === b._rBegin
        && a._rEnd === a._pEnd && a._pEnd === b._rEnd && b._rEnd === b._pEnd;
};
HuTime.TRange.isReliableBefore = function isPossibleBefore (a, b) {
    return a._pEnd < b._pBegin;
};
HuTime.TRange.isReliableAfter = function isReliableAfter (a, b) {
    return b._pEnd < a._pBegin;
};
HuTime.TRange.isReliableDuring = function isPossibleDuring (a, b) {
    return a._pBegin > b._rBegin && a._pEnd < b._rEnd;
};
HuTime.TRange.isReliableContains = function isReliableContains (a, b) {
    return b._pBegin > a._rBegin && b._pEnd < a._rEnd;
};
HuTime.TRange.isReliableOverlaps = function isReliableOverlaps (a, b) {
    return a._rBegin < b._pBegin && a._rEnd > b._rBegin && a._pEnd < b._rEnd;
};
HuTime.TRange.isReliableOverlappedBy = function isReliableOverlappedBy (a, b) {
    return b._rBegin < a._pBegin && b._rEnd > a._rBegin && b._pEnd < a._rEnd;
};
HuTime.TRange.isReliableMeets = function isReliableMeets (a, b) {
    return a._rEnd === a._pEnd && a._pEnd === b._pBegin && b._pBegin === b._rBegin
        && a._rBegin < b._pBegin && a._pEnd < b._rEnd;
};
HuTime.TRange.isReliableMetBy = function isReliableMetBy (a, b) {
    return b._rEnd === b._pEnd && b._pEnd === a._pBegin && a._pBegin === a._rBegin
        && b._rBegin < a._pBegin && b._pEnd < a._rEnd;
};
HuTime.TRange.isReliableStarts = function isReliableStarts (a, b) {
    return a._pBegin === a._rBegin && a._rBegin === b._pBegin && b._pBegin === b._rBegin && a._pEnd < b._rEnd;
};
HuTime.TRange.isReliableStartedBy = function isReliableStartedBy (a, b) {
    return b._pBegin === b._rBegin && b._rBegin === a._pBegin && a._pBegin === a._rBegin && b._pEnd < a._rEnd;
};
HuTime.TRange.isReliableFinishes = function isReliableFinishes (a, b) {
    return a._pBegin > b._rBegin && a._rEnd === a._pEnd && a._pEnd === b._rEnd && b._rEnd === b._pEnd;
};
HuTime.TRange.isReliableFinishedBy = function isReliableFinishedBy (a, b) {
    return b._pBegin > a._rBegin && b._rEnd === b._pEnd && b._pEnd === a._rEnd && a._rEnd === a._pEnd;
};
HuTime.TRange.isReliableIn = function isReliableIn (a, b) {
    return a._pBegin >= b._rBegin && a._pEnd <= b._rEnd;
};

// 可能関係の検証
HuTime.TRange.isPossibleEquals = function isPossibleEquals (a, b) {
    return a._pBegin <= b._rBegin && a._rBegin >= b._pBegin && a._rEnd <= b._pEnd && a._pEnd >= b._rEnd;
};
HuTime.TRange.isPossibleBefore = function isPossibleBefore (a, b) {
    return a._rEnd < b._rBegin;
};
HuTime.TRange.isPossibleAfter = function isPossibleAfter (a, b) {
    return b._rEnd < a._rBegin;
};
HuTime.TRange.isPossibleDuring = function isPossibleDuring (a, b) {
    return a._rBegin > b._pBegin && a._rEnd < b._pEnd && b._pBegin < b._pEnd;
};
HuTime.TRange.isPossibleContains = function isPossibleDuring (a, b) {
    return b._rBegin > a._pBegin && b._rEnd < a._pEnd && a._pBegin < a._pEnd;
};
HuTime.TRange.isPossibleOverlaps = function isPossibleOverlaps (a, b) {
    return a._pBegin < b._rBegin && a._pEnd > b._pBegin && a._rEnd < b._pEnd
        && a._pBegin < a._pEnd && b._pBegin < b._pEnd;
};
HuTime.TRange.isPossibleOverlappedBy = function isPossibleOverlappedBy (a, b) {
    return b._pBegin < a._rBegin && b._pEnd > a._pBegin && b._rEnd < a._pEnd
        && b._pBegin < b._pEnd && a._pBegin < a._pEnd;
};
HuTime.TRange.isPossibleMeets = function isPossibleMeets (a, b) {
    return a._pBegin < b._rBegin && a._rEnd < b._pEnd && a._rEnd <= b._rBegin && a._pEnd >= b._pBegin
        && a._pBegin < a._pEnd && b._pBegin < b._pEnd;
};
HuTime.TRange.isPossibleMetBy = function isPossibleMetBy (a, b) {
    return b._pBegin < a._rBegin && b._rEnd < a._pEnd && b._rEnd <= a._rBegin && b._pEnd >= a._pBegin
        && b._pBegin < b._pEnd && a._pBegin < a._pEnd;
};
HuTime.TRange.isPossibleStarts = function isPossibleStarts (a, b) {
    return a._pBegin <= b._rBegin && a._rBegin >= b._pBegin && a._rEnd < b._pEnd && b._pBegin < b._pEnd;
};
HuTime.TRange.isPossibleStartedBy = function isPossibleStartedBy (a, b) {
    return b._pBegin <= a._rBegin && b._rBegin >= a._pBegin && b._rEnd < a._pEnd && a._pBegin < a._pEnd;
};
HuTime.TRange.isPossibleFinishes = function isPossibleFinishes (a, b) {
    return a._rBegin > b._pBegin && a._rEnd <= b._pEnd && a._pEnd >= b._rEnd && b._pBegin < b._pEnd;
};
HuTime.TRange.isPossibleFinishedBy = function isPossibleFinishedBy (a, b) {
    return b._rBegin > a._pBegin && b._rEnd <= a._pEnd && b._pEnd >= a._rEnd && a._pBegin < a._pEnd;
};
HuTime.TRange.isPossibleIn = function isPossibleIn (a, b) {
    return a._rBegin >= b._pBegin && a._rEnd <= b._pEnd;
};

// 関係検証関数の配列（連続処理用）
HuTime.TRange._isReliables = [ HuTime.TRange.isReliableEquals,
    HuTime.TRange.isReliableBefore, HuTime.TRange.isReliableAfter,
    HuTime.TRange.isReliableDuring, HuTime.TRange.isReliableContains,
    HuTime.TRange.isReliableOverlaps, HuTime.TRange.isReliableOverlappedBy,
    HuTime.TRange.isReliableMeets, HuTime.TRange.isReliableMetBy,
    HuTime.TRange.isReliableStarts, HuTime.TRange.isReliableStartedBy,
    HuTime.TRange.isReliableFinishes, HuTime.TRange.isReliableFinishedBy
];
HuTime.TRange._isPossibles = [ HuTime.TRange.isPossibleEquals,
    HuTime.TRange.isPossibleBefore, HuTime.TRange.isPossibleAfter,
    HuTime.TRange.isPossibleDuring, HuTime.TRange.isPossibleContains,
    HuTime.TRange.isPossibleOverlaps, HuTime.TRange.isPossibleOverlappedBy,
    HuTime.TRange.isPossibleMeets, HuTime.TRange.isPossibleMetBy,
    HuTime.TRange.isPossibleStarts, HuTime.TRange.isPossibleStartedBy,
    HuTime.TRange.isPossibleFinishes, HuTime.TRange.isPossibleFinishedBy
];

// 関係の検証
HuTime.TRange.examineRelation = function examineRelation (relation, a, b) {     // relationで指定した関係について検証
    if (HuTime.TRange.RelationSet._countPossible(relation) > 1)
        return null;    // 2つ以上の関係を指定
    let relIndex = Math.log2(relation);
    if (HuTime.TRange._isReliables[relIndex](a, b))
        return HuTime.UncertainState.Reliable;
    if (HuTime.TRange._isPossibles[relIndex](a, b))
        return HuTime.UncertainState.Possible;
    else
        return HuTime.UncertainState.Impossible;
};
HuTime.TRange._examineRelations = function _examineRelations (a, b) {     // すべての関係を検証（数値を返す）
    if (!(a instanceof HuTime.TRange) || !(b instanceof HuTime.TRange))
        return null;

    let relations = 0;  // 検証結果（取り得る関係を示す数値）
    let relValue = 1;
    for (let i = 0; i < 13; ++i) {
        if (HuTime.TRange._isPossibles[i](a, b))
            relations += relValue;
        relValue *= 2;
    }
    return relations;
};
HuTime.TRange.examineRelations = function examineRelations (a, b) {     // すべての関係を検証（RelationSetオブジェクトを返す）
    return new HuTime.TRange.RelationSet(HuTime.TRange._examineRelations(a, b));
};

// 条件として示された関係に基づく検証（recTRangeがrefTRangeとrefRelationであるかを検証）
HuTime.TRange.examineRelationMatch = function examineRelationMatch (recTRange, refTRange, refRelationSet) {
    if (refRelationSet instanceof HuTime.TRange.RelationSet)
        return HuTime.TRange.RelationSet._isPossible(
            refRelationSet.relationSet, HuTime.TRange._examineRelations(recTRange, refTRange));
    else
        return HuTime.TRange.RelationSet._isPossible(
            refRelationSet, HuTime.TRange._examineRelations(recTRange, refTRange));
};

// **** 関係の集合 ****
HuTime.TRange.RelationSet = function RelationSet (relationSet) {
    this.relationSet = relationSet;
};
HuTime.TRange.RelationSet.prototype = {
    constructor: HuTime.TRange.RelationSet,

    relationSet: 8191,  // 初期値はすべてPossible

    // 関係の集合から関係を抽出
    findReliable: function findReliable () {
        return HuTime.TRange.RelationSet._findReliable(this.relationSet);
    },
    findPossible: function findPossible () {
        return HuTime.TRange.RelationSet._findPossible(this.relationSet);
    },
    findImpossible: function findImpossible () {
        return HuTime.TRange.RelationSet._findImpossible(this.relationSet);
    },

    // 関係の集合に特定の関係が含まれるかを検証
    isReliable: function isReliable (relation) {
        return HuTime.TRange.RelationSet._isReliable(this.relationSet, relation);
    },
    isPossible: function isPossible (relation) {
        return HuTime.TRange.RelationSet._isPossible(this.relationSet, relation);
    },
    isImpossible: function isImpossible (relation) {
        return HuTime.TRange.RelationSet._isImpossible(this.relationSet, relation);
    }
};

// 関係の集合から取りうる関係の数をカウント
HuTime.TRange.RelationSet._countPossible = function relationCount (relationSet) {
    relationSet &= 8191;  // 不使用ビットをクリア
    relationSet = (relationSet & 0x5555) + (relationSet >>> 1 & 0x5555);
    relationSet = (relationSet & 0x3333) + (relationSet >>> 2 & 0x3333);
    relationSet = (relationSet & 0x0f0f) + (relationSet >>> 4 & 0x0f0f);
    relationSet = (relationSet & 0x00ff) + (relationSet >>> 8 & 0x00ff);
    return relationSet;
};

// 関係の集合から関係（関係名を示す文字列）を抽出
HuTime.TRange.RelationSet._findReliable = function _findReliable (relationSet) {    // 確実な関係を出力（確実でない場合はnull）
    if (HuTime.TRange.RelationSet._countPossible(relationSet) !== 1)
        return null;
    Object.keys(HuTime.TRange.Relation).forEach(function (key) {
          if ((relationSet & HuTime.TRange.Relation[key]) === HuTime.TRange.Relation[key])
            return key;
    });
};
HuTime.TRange.RelationSet._findPossible = function _findPossible (relationSet) {    // 可能な関係を配列として列挙
    let result = [];
    Object.keys(HuTime.TRange.Relation).forEach(function (key) {
          if ((relationSet & HuTime.TRange.Relation[key]) === HuTime.TRange.Relation[key])
            result.push(key);
    });
    return result;
};
HuTime.TRange.RelationSet._findImpossible = function _findImpossible (relationSet) {    // 不可能な関係を配列として列挙
    let result = [];
    Object.keys(HuTime.TRange.Relation).forEach(function (key) {
          if ((relationSet & HuTime.TRange.Relation[key]) === 0)
            result.push(key);
    });
    return result;
};

// 関係の集合に特定の関係が含まれるかを検証
// relationについて確実関係を検証（true | false を返す）
HuTime.TRange.RelationSet._isReliable =  function _isReliable (relationSet, relation) {
    if (HuTime.TRange.RelationSet._countPossible(relation) > 1)
        return false;   // 1つ以上の関係を指定
    if (HuTime.TRange.RelationSet._countPossible(relationSet) > 1)
        return false;   // 1つ以上の関係でPossible
    return (relationSet & relation) !== 0;
};
// relationについて可能関係を検証（reliable | possible | impossible を返す）
HuTime.TRange.RelationSet._isPossible = function _isPossible (relationSet, relation) {
    relationSet &= 8191;  // 不使用ビットをクリア
    if ((relationSet & relation) === 0)
        return HuTime.UncertainState.Impossible;
    if ((relationSet & relation) === relation)
        return HuTime.UncertainState.Reliable;
    else
        return HuTime.UncertainState.Possible;
};
// relationについて不可能関係を検証（reliable | possible | impossible を返す）
HuTime.TRange.RelationSet._isImpossible = function _isImpossible (relationSet, relation) {
    relationSet &= 8191;  // 不使用ビットをクリア
    if ((relationSet & relation) === 0)
        return HuTime.UncertainState.Reliable;
    if ((relationSet & relation) === relation)
        return HuTime.UncertainState.Impossible;
    else
        return HuTime.UncertainState.Possible;
};
// **** レコード関係の基底クラス ****
// レコードセットの基底クラス － 書式などの情報をレコードセットに埋め込む
HuTime.RecordsetBase = function RecordsetBase(source, rangeStyle) {
    this.records = [];  // レコード配列の初期化
    //Object.defineProperty(this, "records", {writable: false});

    // t値範囲関係の初期設定
    this._itemShowReliableTRanges = {};
    //Object.defineProperty(this, "_itemShowReliableTRanges", {writable: false});
    this.showReliableTRange = this._showReliableTRange;   // 初期値を設定

    this._itemShowPossibleTRanges = {};
    //Object.defineProperty(this, "_itemShowPossibleTRanges", {writable: false});
    this.showPossibleTRange = this._showPossibleTRange;   // 初期値を設定

    this._itemRangeStyles = {};
    //Object.defineProperty(this, "_itemRangeStyles", {writable: false});
    this.rangeStyle = this._rangeStyle;   // いったん初期値を設定する

    if (typeof source == "string" && source != "") {    // URLとしての入力
        var ext;    // 拡張子
        var file = source.split("?", 2)[0].split("#", 2)[0].split("/").reverse()[0];
        if (file.lastIndexOf(".") < 0)
            ext = "";
        else
            ext = file.substr(file.lastIndexOf(".")).replace(".", "").toLowerCase();

        switch (ext) {
            case "csv":
                this.reader = new HuTime.CsvReader(source);
                break;

            case "txt":
            case "tsv":
                this.reader = new HuTime.TsvReader(source);
                break;

            default:
                this.reader = new HuTime.CsvReader(source);
                break;
        }
        this.loadRecordset();
    }
    else if (source instanceof HuTime.StreamReaderBase) {   // HuTime.StreamReaderBaseとしての入力
        this.reader = source;
        this.loadRecordset();
    }
    this._recordSettings = new HuTime.RecordSettings();
};
HuTime.RecordsetBase.prototype = {
    // 基本構造
    constructor: HuTime.RecordsetBase,
    id: "",
    name: "",
    visible: true,              // レコードセット全体の表示・非表示切り替え

    // **** レコードセット内のレコード ****
    records: null,
    appendRecord: function appendRecord(record) {        // 新しくレコードを追加し、そのレコードを返す
        this.records.push(record);
        return record;
    },
    appendNewRecord: function (tRange) {     // 新しくレコードを生成して追加し、そのレコードを返す
        return null;
    },
    removeRecord: function (record) {
        var i;
        var removeCount = 0;
        if (record instanceof HuTime.RecordBase) {
            i = 0;
            while (i < this.records.length) {           // レコード本体を参照として指定
                if (this.records[i] === record) {
                    this.records.splice(i, 1);
                    ++removeCount;
                    continue;
                }
                ++i;
            }
        }
        else if (typeof record == "number" &&        // レコードのインデックスを指定
            record >= 0 && record < this.records.length) {
            this.records.splice(record, 1);
            ++removeCount;
        }
        else if (record instanceof Function) {   // 判定関数
            i = 0;
            while (i < this.records.length) {
                if (record(this.records[i])) {
                    this.records.splice(i, 1);
                    ++removeCount;
                    continue;
                }
                ++i;
            }
        }
        return removeCount;
    },

    // **** 読み込み関係 ****
    loadRecordset: function () {
        if (!this._reader || !(this._reader instanceof HuTime.StreamReaderBase))
            return;
        this.records.length = 0;
        this._reader.load();
    },
    _reader: null,
    get reader() {
        return this._reader;
    },
    set reader(val) {
        if (!(val instanceof HuTime.StreamReaderBase))
            return;
        this._reader = val;
        var onloadend = function (obj) {
            obj._reader.onloadend = function () {
                obj._getRecords.apply(obj);
                obj.onloadend.apply(obj);
            }
        }(this);
    },
    get source() {     // レコードセットの読み込み元（FileオブジェクトやURLなど）
        return this._reader._stream._source;
    },
    set source(val) {
        this._reader._stream.source = val;
    },
    _recordSettings: null,       // 読み込んだデータをレコードに変換するための設定
    get recordSettings() {
        return this._recordSettings;
    },
    set recordSettings(val) {
        if (val instanceof HuTime.RecordSettings)
            this._recordSettings = val;
    },
    onloadend: function () {
    },   // 読み込み後の処理
    _getRecords: function _getRecords() {   // StreamReaderのデータをDataItemSettingに基づいてRecordsetに変換
        var record;
        var recordData;
        var itemData;
        for (var i = 0; i < this.reader.recordData.length; ++i) {
            record = this.appendNewRecord(this.recordSettings._tSetting.getValue(this.reader.recordData[i]));
            for (var j = 0; j < this.recordSettings._dataSettings.length; ++j) {
                itemData = this.recordSettings._dataSettings[j].getValue(this.reader.recordData[i]);
                if (itemData != null)
                    record.appendData(this.recordSettings._dataSettings[j].recordDataName, itemData);
            }
        }
    },

    disableSortRecords: false,      // レコードソートの抑止

    // リテラル、または、関数（Recordとデータ名を引数とする）として指定されたプロパティを取得
    _getPropertyValue: function _getPropertyValue(property, name, record, record2) {
        if ((typeof name != "string" || name.trim().length == 0) &&
            (typeof name != "number" || !isFinite(name)))
            name = "default";
        name = name.toString().trim();
        if (name in property) {      // 値（列）ごとの設定がある場合は、優先する
            if (typeof property[name] == "function")
                return property[name](name, record, record2);
            else
                return property[name];
        }
        else if ("default" in property) {    // タグ名defaultで指定された値または関数
            if (typeof property["default"] == "function")
                return property["default"](name, record, record2);
            else
                return property["default"];
        }
        else {
            return undefined;
        }
    },

    // データ項目名として評価し、正当であれば正規化（文字列化およびtrim）された値、不当であればnullを返す。
    _validateItemName: function _validateItemName(itemName) {
        if (typeof itemName == "string") {
            itemName = itemName.trim();
            return itemName.length > 0 ? itemName : null;
        }
        if (typeof itemName == "number" && isFinite(itemName))
            return itemName.toString();
        return null;
    },

    // レコードセット全体の表示の制御
    showRecordset: true,            // レコードセット全体の表示

    // **** t値の範囲 ****
    // 確実範囲の表示
    _itemShowReliableTRanges: null,
    getItemShowReliableTRange: function getIitemShowReliableTRange(itemName) {
        if (itemName in this._itemShowReliableTRanges)
            return this._itemShowReliableTRanges[itemName];
        else
            return this.__proto__._showReliableTRange;
    },
    setItemShowReliableTRange: function setItemShowReliableTRange(itemName, show) {
        itemName = this._validateItemName(itemName);
        if (!itemName)
            return;
        if (typeof show == "boolean" || typeof show == "function")
            this._itemShowReliableTRanges[itemName] = show;
        else if (show == null && typeof show == "object")
            delete this._itemShowReliableTRanges[itemName];
    },
    _appliedItemShowReliableTRange: function _appliedItemShowReliableTRange(itemName, record) {
        var show = this._getPropertyValue(this._itemShowReliableTRanges, itemName, record);
        if (typeof show == "undefined")
            return this.__proto__._showReliableTRange;
        else
            return show;
    },
    _showReliableTRange: true,
    get showReliableTRange() {
        return this.getItemShowReliableTRange("default");
    },
    set showReliableTRange(val) {
        if (val == null && typeof val == "object")
            this.setItemShowReliableTRange("default", this.__proto__._showReliableTRange);
        else
            this.setItemShowReliableTRange("default", val);
    },
    _appliedShowReliableTRange: function _appliedShowReliableTRange(itemName, record) {
        if ("default" in this._itemShowReliableTRanges) {
            if(typeof this._itemShowReliableTRanges["default"] == "function")
                return this._itemShowReliableTRanges["default"](itemName, record);
            else
                return this._itemShowReliableTRanges["default"];
        }
        return this.__proto__._showReliableTRange;
    },
    
    // 可能範囲の表示
    _itemShowPossibleTRanges: null,
    getItemShowPossibleTRange: function getIitemShowPossibleTRange(itemName) {
        if (itemName in this._itemShowPossibleTRanges)
            return this._itemShowPossibleTRanges[itemName];
        else
            return this.__proto__._showPossibleTRange;
    },
    setItemShowPossibleTRange: function setItemShowPossibleTRange(itemName, show) {
        itemName = this._validateItemName(itemName);
        if (!itemName)
            return;
        if (typeof show == "boolean" || typeof show == "function")
            this._itemShowPossibleTRanges[itemName] = show;
        else if (show == null && typeof show == "object")
            delete this._itemShowPossibleTRanges[itemName];
    },
    _appliedItemShowPossibleTRange: function _appliedItemShowPossibleTRange(itemName, record) {
        var show = this._getPropertyValue(this._itemShowPossibleTRanges, itemName, record);
        if (typeof show == "undefined")
            return this.__proto__._showPossibleTRange;
        else
            return show;
    },
    _showPossibleTRange: true,
    get showPossibleTRange() {
        return this.getItemShowPossibleTRange("default");
    },
    set showPossibleTRange(val) {
        if (val == null && typeof val == "object")
            this.setItemShowPossibleTRange("default", this.__proto__._showPossibleTRange);
        else
            this.setItemShowPossibleTRange("default", val);
    },
    _appliedShowPossibleTRange: function _appliedShowPossibleTRange(itemName, record) {
        if ("default" in this._itemShowPossibleTRanges) {
            if(typeof this._itemShowPossibleTRanges["default"] == "function")
                return this._itemShowPossibleTRanges["default"](itemName, record);
            else
                return this._itemShowPossibleTRanges["default"];
        }
        return this.__proto__._showPossibleTRange;
    },

    // 不確実な情報の非表示・表示
    hideTRangeNonRRange: false,         // 確実期間のないレコードの範囲を表示しない
    hideTRangeTotalPRangeOnly: false,   // 全可能期間のみのレコードの範囲を表示しない
    hideTRangeNonCentralValue: true,    // 代表値のないレコード（無限大を含むなど）の範囲を表示しない
    drawPRangeAsRRange: true,           // 可能範囲を確実範囲として表示

    // 範囲の書式
    _itemRangeStyles: null,                 // データ名（列名）ごとの範囲の書式を収容する連想配列
    getItemRangeStyle: function getItemRangeStyle(itemName){
        if (itemName in this._itemRangeStyles)
            return this._itemRangeStyles[itemName];
        else
            return this.__proto__._rangeStyle;
    },
    setItemRangeStyle: function setItemRangeStyle(itemName, style){
        itemName = this._validateItemName(itemName);
        if (!itemName)
            return;
        if (style instanceof HuTime.FigureStyle || typeof style == "function")
            this._itemRangeStyles[itemName] = style;
        else if (style == null && typeof style == "object")
            delete this._itemRangeStyles[itemName];
    },
    _appliedItemRangeStyle: function _appliedItemRangeStyle(itemName, record) {     // 実際に適用される範囲の書式
        var style = this._getPropertyValue(this._itemRangeStyles, itemName, record);
        if (typeof style == "undefined")
            return this.__proto__._rangeStyle;
        else
            return style;
    },
    _rangeStyle: new HuTime.FigureStyle(null, "black" , 2),   // 範囲の既定の書式
    get rangeStyle() {
        return this.getItemRangeStyle("default");
    },
    set rangeStyle(val) {
        if (val == null && typeof val == "object")
            this.setItemRangeStyle("default", this.__proto__._rangeStyle);
        else
            this.setItemRangeStyle("default", val);
    },
    _appliedRangeStyle: function _appliedRangeStyle(itemName, record) {
        if ("default" in this._itemRangeStyles) {
            if(typeof this._itemRangeStyles["default"] == "function")
                return this._itemRangeStyles["default"](itemName, record);
            else
                return this._itemRangeStyles["default"];
        }
        return this.__proto__._rangeStyle;
    },

    // 確実範囲両端の区切りの高さ
    _rangeTickHeight: 10,
    get rangeTickHeight() {
        return this._rangeTickHeight;
    },
    set rangeTickHeight(val) {
        if (typeof val == "number" && val >= 0 && val <= 100)
            this._rangeTickHeight = val;
    },

    // 描画処理（レコードセットごとのカスタム設定）
    drawRange: function (){},

    // **** JSON出力 ****
    useRemoteDataForJSON: null,     // JSONでリモートソースの情報を保存、ロード
    useLoadedDataForJSON: null,     // 既にロードしたデータを保存、展開
    // 両方指定された場合、リモートが優先。ロードに失敗した場合、保存データを利用。

    _toJSONProperties: {
        id: "id",
        name: "name",
        visible: "visible",
        records: function (objForJSON) {
            if (this.useLoadedDataForJSON ||
                this.useLoadedDataForJSON == null && !(this.reader.stream instanceof HuTime.HttpStream))
                    objForJSON["records"] = HuTime.JSON.stringify(this.records);
        },
        _reader: function (objForJSON) {
            if (this.useRemoteDataForJSON ||
                this.useRemoteDataForJSON == null &&
                    this.reader &&
                    this.reader.stream instanceof HuTime.HttpStream)
                    objForJSON["reader"] = HuTime.JSON.stringify(this._reader);
        },
        _recordSettings: "recordSettings",
        disableSortRecords: "disableSortRecords",
        showRecordset: "showRecordset",
        _itemShowReliableTRanges: "itemShowReliableTRanges",
        _showReliableTRange: "showReliableTRange",
        _itemShowPossibleTRanges: "itemShowPossibleTRanges",
        _showPossibleTRange: "showPossibleTRange",
        hideTRangeNonRRange: "hideTRangeNonRRange",
        hideTRangeTotalPRangeOnly: "hideTRangeTotalPRangeOnly",
        hideTRangeNonCentralValue: "hideTRangeNonCentralValue",
        drawPRangeAsRRange: "drawPRangeAsRRange",
        _itemRangeStyles: "itemRangeStyles",
        _rangeStyle: "rangeStyle",
        _rangeTickHeight: "rangeTickHeight"
    },
    _parseJSONProperties: {
        recordSettings: "_recordSettings",
        itemShowReliableTRanges: "_itemShowReliableTRanges",
        itemShowPossibleTRanges: "_itemShowPossibleTRanges",
        itemRangeStyles: "_itemRangeStyles"
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// レコードクラス
HuTime.RecordBase = function RecordBase(tRange) {
    this.data = {};        // 初期化（連想配列として初期化）
    //Object.defineProperty(this, "data", {writable: false});
    this.tRange = tRange;
};
HuTime.RecordBase.prototype = {
    constructor: HuTime.RecordBase,
    _tRange: null,   // t値の範囲
    get tRange() {
        return this._tRange;
    },
    set tRange(val) {
        if (val instanceof HuTime.TRange || (val == null && typeof val != "undefined"))
            this._tRange = val;
    },

    data: null,    // 汎用データ（連想配列）
    appendData: function appendData(itemName, content, type) {
        if ((typeof itemName != "string" || itemName.trim().length == 0) &&
            (typeof itemName != "number" || !isFinite(itemName)))
            return;
        itemName = itemName.toString().trim();

        if (content instanceof HuTime.RecordData) {
            this.data[itemName] = content;
            return;
        }
        this.data[itemName] = new HuTime.RecordData(content);  // 生のテキストなどは、RecordDataに変換
        if (type)
            this.data[itemName].type = type;
    },
    removeData: function removeData(itemName) {
        if ((typeof itemName != "string" || itemName.trim().length == 0) &&
            (typeof itemName != "number" || !isFinite(itemName)))
            return;
        if (itemName in this.data)
            delete this.data[itemName];
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        _tRange: "tRange",
        data: "data"
    },
    _parseJSONProperties: {
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// レコード内のデータ
HuTime.RecordData = function RecordData(content, type) {
    this.content = content;
    this.type = type;
};
HuTime.RecordData.prototype = {
    constructor: HuTime.RecordData,
    _content: "",  // データ本体
    get content() {
        return this._content;
    },
    set content(val) {
        if (typeof val == "number" || typeof val == "string")
            this._content = val;
    },

    _type: "",       // データの型（出力方法などに反映される）
    // 型の指定: htmlタグ名（img, a）; MIME; 型名（html, text, image, link）
    get type() {
        return this._type;
    },
    set type(val) {
        if (typeof val == "string")
            this._type = val.trim();
    },

    //_getHtml: function (){},  // HTML化してデータを出力
    _getHtml: function _getHtml() {   // HTML化してデータを出力（既定の処理）
        switch (this._type) {
            case "html":    // innerHtml
            case "text/html":    // innerHtml
                return this._content.toString();

            case "text":    // テキスト
            case "text/plain":
                return this._htmlEscapeChar(this._content.toString());

            case "image":   // 画像
            case "img":
            case "image/jpeg":
            case "image/png":
            case "image/gif":
                return "<img src=\"" + this._htmlEscapeChar(this._content) + "\" alt=\"\" />";

            case "link":    // リンク
            case "a":
                return "<a href=\"" + this._htmlEscapeChar(this._content) + "\">" +
                    this._htmlEscapeChar(this._content) + "</a>";

            default:        // その他－テキストとして返す
                return this._htmlEscapeChar(this._content.toString());
        }
    },
    get getHtml() {
        return this._getHtml;
    },
    set getHtml(val) {
        if (typeof val == "function")
            this._getHtml = val;    // 独自のhtml出力や独自のtypeに対応するための処理を設定
        else if (val == null && typeof val == "object")  // nullを代入すると初期値に戻る
            this._getHtml = this.__proto__._getHtml;
    },
    get html() {
        return this._getHtml();
    },
    _htmlEscapeChar: function _htmlEscapeChar(s) {      // 文字のエスケープ処理
        s = s.replace(/&/g, "&amp;");
        s = s.replace(/\x27/g, "&#39;");
        s = s.replace(/"/g, "&quot;");
        s = s.replace(/</g, "&lt;");
        s = s.replace(/>/g, "&gt;");
        return s;
    },

    _getText: function _getText() {     // テキスト化してデータを出力
        return this._content.toString();
    },
    get getText() {
        return this._getText;
    },
    set getText(val) {
        if (val instanceof Function)
            this._getText = val;
        else if (val == null && typeof val != "undefined")
            this._getText = HuTime.RecordData.prototype._getText;
    },
    get text() {
        return this._getText();
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        _content: "content",
        _type: "type"
    },
    _parseJSONProperties: {
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// **** レイヤごとに特化したレコード関係のクラス ****
// ++++ 各種グラフ用 ++++
HuTime.ChartRecordset = function ChartRecordset(source, tBeginItem, tEndItem, valueItem, plotStyle, lineStyle) {    // グラフ用のレコードセット
    HuTime.RecordsetBase.apply(this, [source]);    // 派生元の処理（レコード配列とt値範囲関係の初期化）

    // グラフ用の値関係の初期設定
    this._valueItems = [];
    //Object.defineProperty(this, "_valueItems", {writable: false});

    tBeginItem = this._validateItemName(tBeginItem);
    if (tBeginItem) {
        tEndItem = this._validateItemName(tEndItem);
        if (!tEndItem)
            tEndItem = tBeginItem;
        this._recordSettings.tSetting = new HuTime.RecordTSetting(tBeginItem, tEndItem);
    }

    valueItem = this._validateItemName(valueItem);
    if (valueItem) {
        this._recordSettings.appendDataSetting(new HuTime.RecordDataSetting(valueItem));
        this.selectValueItem(valueItem);
    }

    // プロット関係の初期設定
    this._itemShowPlots = {};       // プロットの表示・非表示
    //Object.defineProperty(this, "_itemShowPlots", {writable: false});
    this.showPlot = this.__proto__._showPlot;     // 初期値を設定

    this._itemPlotStyles = {};      // プロットの書式
    //Object.defineProperty(this, "_itemPlotStyles", {writable: false});
    this.plotStyle = this.__proto__._plotStyle;     // いったん初期値を設定
    this.plotStyle = plotStyle;

    this._itemPlotSymbols = {};     // プロットのシンボル
    //Object.defineProperty(this, "_itemPlotSymbols", {writable: false});
    this.plotSymbol = this.__proto__._plotSymbol;     // 初期値を設定

    this._itemPlotWidths = {};      // プロットの大きさ
    //Object.defineProperty(this, "_itemPlotWidths", {writable: false});
    this.plotWidth = this.__proto__._plotWidth;

    this._itemPlotRotates = {};     // プロットの回転角
    //Object.defineProperty(this, "_itemPlotRotates", {writable: false});
    this.plotRotate = this.__proto__._plotRotate;

    // 線（プロット間の）関係の初期設定
    this._itemShowLines = {};       // 線の表示・非表示
    //Object.defineProperty(this, "_itemShowLines", {writable: false});
    this.showLine = this.__proto__._showLine;     // 初期値を設定

    this._itemLineStyles = {};      // 線の書式
    //Object.defineProperty(this, "_itemLineStyles", {writable: false});
    this.lineStyle = this.__proto__._lineStyle;     // いったん初期値を設定
    this.lineStyle = lineStyle;
};
HuTime.ChartRecordset.prototype = Object.create(HuTime.RecordsetBase.prototype, {
    // 基本構造
    constructor: {          // コンストラクタ
        value: HuTime.ChartRecordset
    },

    // レコードセット内のレコード
    appendRecord: {
        value: function appendRecord(record){
            if (record instanceof HuTime.ChartRecord)
                return HuTime.RecordsetBase.prototype.appendRecord.call(this, record);
            else
                return null;
        }
    },
    appendNewRecord: {
        value: function appendNewRecord(tRange) {
            return this.appendRecord(new HuTime.ChartRecord(tRange));
        }
    },

    // 表示時の動作
    selectRecord: {         // レコード単位での選択
        writable: true,
        value: false
    },

    // グラフで用いるデータの選択
    _valueItems: {       // グラフで用いるデータの項目名と表示順
        writable: true,
        value: null
    },
    selectValueItem: {          // 表示する値（列）の選択
        value: function (itemName, plotStyle, lineStyle, order) {
            itemName = this._validateItemName(itemName);
            if (!itemName)
                return false;
            this.setItemPlotStyle(itemName, plotStyle);
            this.setItemLineStyle(itemName, lineStyle);
            if (typeof order != "number" || !isFinite(order))
                order = Number.NaN;
            for (var i = 0; i < this._valueItems.length; ++i) {
                if (this._valueItems[i].name == itemName) {
                    this._valueItems[i].order = order;
                    return;     // 既存の場合は、各種値の変更のみ
                }
            }
            this._valueItems.push({
                name: itemName,
                order: order
            });
            return true;
        }
    },
    deselectValueItem: {        // 表示する値（列）の削除
        value: function (itemName) {
            itemName = this._validateItemName(itemName);
            if (!itemName)
                return false;
            itemName = itemName.toString().trim();
            var result = false;
            for (var i = 0; i < this._valueItems.length; ++i) {
                if (this._valueItems[i].name == itemName) {
                    this._valueItems.splice(i, 1);
                    delete this._itemRangeStyles[itemName];
                    delete this._itemPlotStyles[itemName];
                    delete this._itemPlotSymbols[itemName];
                    delete this._itemPlotWidths[itemName];
                    delete this._itemPlotRotates[itemName];
                    delete this._itemLineStyles[itemName];
                    result = true;
                }
            }
            return true;
        }
    },

    // レコードセット全体の表示の制御
    showRecordsetPlot: {    // レコードセット全体のプロットの表示・非表示
        writable: true,
        value: true
    },
    showRecordsetLine: {    // レコードセット全体のプロット間の線の表示・非表示
        writable: true,
        value: true
    },

    // **** プロット ****
    // プロットの表示
    _itemShowPlots: {
        writable: true,
        value: null
    },
    getItemShowPlot: {
        value: function getItemShowPlot(itemName){
            if (itemName in this._itemShowPlots)
                return this._itemShowPlots[itemName];
            else
                return this.__proto__._showPlot;
        }
    },
    setItemShowPlot: {
        value: function setItemShowPlot(itemName, show){
            itemName = this._validateItemName(itemName);
            if (!itemName)
                return;
            if (typeof show == "boolean" || typeof show == "function")
                this._itemShowPlots[itemName] = show;
            else if (show == null && typeof show == "object")
                delete this._itemShowPlots[itemName];
        }
    },
    _appliedItemShowPlot: {
        value: function _appliedItemShowPlot(itemName, record){
            var style = this._getPropertyValue(this._itemShowPlots, itemName, record);
            if (typeof style == "undefined")
                return this.__proto__._showPlot;
            else
                return style;
        }
    },
    _showPlot: {
        writable: true,
        value: true
    },
    showPlot: {                // プロットの書式（列指定しない場合）
        get: function () {
            return this.getItemShowPlot("default");
        },
        set: function (val) {
            if (val == null && typeof val == "object")
                this.setItemShowPlot("default", this.__proto__._showPlot);
            else
                this.setItemShowPlot("default", val);
        }
    },
    _appliedShowPlot: {
        value: function _appliedShowPlot(itemName, record) {
            if ("default" in this._itemShowPlots) {
                if(typeof this._itemShowPlots["default"] == "function")
                    return this._itemShowPlots["default"](itemName, record);
                else
                    return this._itemShowPlots["default"];
            }
            return this.__proto__._showPlot;
        }
    },

    hidePlotNonRRange: {        // 確実期間のないレコードのプロットを表示しない
        writable: true,
        value: false
    },
    hidePlotTotalPRangeOnly: {  // 全可能期間のみのレコードのプロットを表示しない
        writable: true,
        value: false
    },

    // プロットの書式
    _itemPlotStyles: {
        writable: true,
        value: null
    },
    getItemPlotStyle: {
        value: function getItemPlotStyle(itemName){
            if (itemName in this._itemPlotStyles)
                return this._itemPlotStyles[itemName];
            else
                return this.__proto__._plotStyle;
        }
    },
    setItemPlotStyle: {
        value: function setItemPlotStyle(itemName, style){
            itemName = this._validateItemName(itemName);
            if (!itemName)
                return;
            if (style instanceof HuTime.FigureStyle || typeof style == "function")
                this._itemPlotStyles[itemName] = style;
            else if (style == null && typeof style == "object")
                delete this._itemPlotStyles[itemName];
        }
    },
    _appliedItemPlotStyle: {
        value: function _appliedItemPlotStyle(itemName, record){
            var style = this._getPropertyValue(this._itemPlotStyles, itemName, record);
            if (typeof style == "undefined")
                return this.__proto__._plotStyle;
            else
                return style;
        }
    },
    _plotStyle: {
        writable: true,
        value: new HuTime.FigureStyle("#FF7F50")    // プロットの色 Colral
    },
    plotStyle: {                // プロットの書式（列指定しない場合）
        get: function () {
            return this.getItemPlotStyle("default");
        },
        set: function (val) {
            if (val == null && typeof val == "object")
                this.setItemPlotStyle("default", this.__proto__._plotStyle);
            else
                this.setItemPlotStyle("default", val);
        }
    },
    _appliedPlotStyle: {
        value: function _appliedPlotStyle(itemName, record) {
            if ("default" in this._itemPlotStyles) {
                if(typeof this._itemPlotStyles["default"] == "function")
                    return this._itemPlotStyles["default"](itemName, record);
                else
                    return this._itemPlotStyles["default"];
            }
            return this.__proto__._plotStyle;
        }
    },

    // プロットのシンボル（0:丸, 1:四角, 2:三角, 3:十字）
    _itemPlotSymbols: {
        writable: true,
        value: null
    },
    getItemPlotSymbol: {
        value: function getItemPlotStyle(itemName){
            if (itemName in this._itemPlotSymbols)
                return this._itemPlotSymbols[itemName];
            else
                return this.__proto__._plotSymbol;
        }
    },
    setItemPlotSymbol: {
        value: function setItemPlotSymbol(itemName, symbol){
            itemName = this._validateItemName(itemName);
            if (!itemName)
                return;
            if ((typeof symbol == "number" && symbol >= 0 && symbol <= 3) || typeof symbol == "function")
                this._itemPlotSymbols[itemName] = symbol;
            else if (symbol == null && typeof symbol == "object")
                delete this._itemPlotSymbols[itemName];
        }
    },
    _appliedItemPlotSymbol: {
        value: function _appliedItemPlotSymbol(itemName, record){
            var style = this._getPropertyValue(this._itemPlotSymbols, itemName, record);
            if (typeof style == "undefined")
                return this.__proto__._plotSymbol;
            else
                return style;
        }
    },
    _plotSymbol: {
        writable: true,
        value: 0
    },
    plotSymbol: {           // プロットのシンボル（列指定しない場合）
        get: function () {
            return this.getItemPlotSymbol("default");
        },
        set: function (val) {
            if (val == null && typeof val == "object") {
                this.setItemPlotSymbol("default", this.__proto__._plotSymbol);
                return;
            }
            this.setItemPlotSymbol("default", val);
        }
    },
    _appliedPlotSymbol: {
        value: function _appliedPlotSymbol(itemName, symbol) {
            if ("default" in this._itemPlotSymbols) {
                if(typeof this._itemPlotSymbols["default"] == "function")
                    return this._itemPlotSymbols["default"](itemName, symbol);
                else
                    return this._itemPlotSymbols["default"];
            }
            return this.__proto__._plotSymbol;
        }
    },

    // プロットの大きさ（幅）
    _itemPlotWidths: {
        writable: true,
        value: null
    },
    getItemPlotWidth: {
        value: function getItemPlotStyle(itemName){
            if (itemName in this._itemPlotWidths)
                return this._itemPlotWidths[itemName];
            else
                return this.__proto__._plotWidth;
        }
    },
    setItemPlotWidth: {
        value: function setItemPlotWidth(itemName, width){
            itemName = this._validateItemName(itemName);
            if (!itemName)
                return;
            if ((typeof width == "number" && isFinite(width) && width >= 0) || typeof width == "function")
                this._itemPlotWidths[itemName] = width;
            else if (width == null && typeof width == "object")
                delete this._itemPlotWidths[itemName];
        }
    },
    _appliedItemPlotWidth: {
        value: function getItemPlotWidth(itemName, record){
            var style = this._getPropertyValue(this._itemPlotWidths, itemName, record);
            if (typeof style == "undefined")
                return this.__proto__._plotWidth;
            else
                return style;
        }
    },
    _plotWidth: {
        writable: true,
        value: 10
    },
    plotWidth: {            // プロットの大きさ（列指定しない場合）
        get: function () {
            return this.getItemPlotWidth("default");
        },
        set: function (val) {
            if (val == null && typeof val == "object")
                this.setItemPlotWidth("default", this.__proto__._plotWidth);
            else
                this.setItemPlotWidth("default", val);
        }
    },
    _appliedPlotWidth: {
        value: function _appliedPlotWidth(itemName, record) {
            if ("default" in this._itemPlotWidths) {
                if(typeof this._itemPlotWidths["default"] == "function")
                    return this._itemPlotWidths["default"](itemName, record);
                else
                    return this._itemPlotWidths["default"];
            }
            return this.__proto__._plotWidth;
        }
    },

    // プロットの回転角（deg）
    _itemPlotRotates: {
        writable: true,
        value: null
    },
    getItemPlotRotate: {
        value: function getItemPlotStyle(itemName){
            if (itemName in this._itemPlotRotates)
                return this._itemPlotRotates[itemName];
            else
                return this.__proto__._plotRotate;
        }
    },
    setItemPlotRotate: {
        value: function setItemPlotRotate(itemName, rotate){
            itemName = this._validateItemName(itemName);
            if (!itemName)
                return;
            if ((typeof rotate == "number" && isFinite(rotate)) || typeof rotate == "function")
                this._itemPlotRotates[itemName] = rotate;
            else if (rotate == null && typeof rotate == "object")
                delete this._itemPlotRotates[itemName];
        }
    },
    _appliedItemPlotRotate: {
        value: function _appliedItemPlotRotate(itemName, record){
            var style = this._getPropertyValue(this._itemPlotRotates, itemName, record);
            if (typeof style == "undefined")
                return this.__proto__._plotRotate;
            else
                return style;
        }
    },
    _plotRotate: {
        writable: true,
        value: 0
    },
    plotRotate: {            // プロットの回転角（deg）（列指定しない場合）
        get: function () {
            return this.getItemPlotRotate("default");
        },
        set: function (val) {
            if (val == null && typeof val == "object")
                this.setItemPlotRotate("default", this.__proto__._plotRotate);
            else
                this.setItemPlotRotate("default", val);
        }
    },
    _appliedPlotRotate: {
        value: function _appliedPlotRotate(itemName, record) {
            if ("default" in this._itemPlotRotates) {
                if(typeof this._itemPlotRotates["default"] == "function")
                    return this._itemPlotRotates["default"](itemName, record);
                else
                    return this._itemPlotRotates["default"];
            }
            return this.__proto__._plotRotate;
        }
    },

    _plotWidthType: {        // barの幅のタイプ（根拠）－主に棒グラフ用
        writable: true,
        value: 0            // 0:確実範囲, 1:可能範囲, 2:t値固定, 3: xy値固定
    },
    plotWidthType: {
        get: function () {
            return this._plotWidthType;
        },
        set: function (val){
            if (typeof val == "number" && val >= 0 && val <= 3 )
                this._plotWidthType = val;
        }
    },
    drawPlot: {             // プロットの描画処理
        writable: true,
        value: function (){}
    },

    // **** 線（プロット間の） ****
    // 線の表示
    _itemShowLines: {
        writable: true,
        value: null
    },
    getItemShowLine: {
        value: function getItemShowLine(itemName){
            if (itemName in this._itemShowLines)
                return this._itemShowLines[itemName];
            else
                return this.__proto__._showLine;
        }
    },
    setItemShowLine: {
        value: function setItemShowLine(itemName, style){
            itemName = this._validateItemName(itemName);
            if (!itemName)
                return;
            if (typeof style == "boolean" || typeof style == "function")
                this._itemShowLines[itemName] = style;
            else if (style == null && typeof style == "object")
                delete this._itemShowLines[itemName];
        }
    },
    _appliedItemShowLine: {
        value: function _appliedItemShowLine(itemName, record, record2){
            var style = this._getPropertyValue(this._itemShowLines, itemName, record, record2);
            if (typeof style == "undefined")
                return this.__proto__._showLine;
            else
                return style;
        }
    },
    _showLine: {
        writable: true,
        value: true
    },
    showLine: {                // プロットの書式（列指定しない場合）
        get: function () {
            return this.getItemShowLine("default");
        },
        set: function (val) {
            if (val == null && typeof val == "object")
                this.setItemShowLine("default", this.__proto__._showLine);
            else
                this.setItemShowLine("default", val);
        }
    },
    _appliedShowLine: {
        value: function _appliedShowLine(itemName, record, record2) {
            if ("default" in this._itemShowLines) {
                if(typeof this._itemShowLines["default"] == "function")
                    return this._itemShowLines["default"](itemName, record, record2);
                else
                    return this._itemShowLines["default"];
            }
            return this.__proto__._showLine;
        }
    },

    hideLineNonRRange: {        // 確実期間のないレコードに線を引かない
        writable: true,
        value: false
    },
    hideLineTotalPRangeOnly: {  // 全可能期間のみのレコードに線を引かない
        writable: true,
        value: false
    },

    // 線の書式
    _itemLineStyles: {               // 線の書式
        writable: true,
        value: null
    },
    getItemLineStyle: {
        value: function getItemPlotStyle(itemName){
            if (itemName in this._itemLineStyles)
                return this._itemLineStyles[itemName];
            else
                return this.__proto__._lineStyle;
        }
    },
    setItemLineStyle: {         // データ名（列名）ごとの線の書式の追加
        value: function setItemLineStyle(itemName, style){
            itemName = this._validateItemName(itemName);
            if (!itemName)
                return;
            if (style instanceof HuTime.FigureStyle || typeof style == "function")
                this._itemLineStyles[itemName] = style;
            else if (style == null && typeof style == "object")
                delete this._itemLineStyles[itemName];
        }
    },
    _appliedItemLineStyle: {         // データ名（列名）ごとの線の書式を取得
        value: function _appliedItemLineStyle(itemName, record, record2){
            var style = this._getPropertyValue(this._itemLineStyles, itemName, record, record2);
            if (typeof style == "undefined")
                return this.__proto__._lineStyle;
            else
                return style;
        }
    },
    _lineStyle: {
        writable: true,
        value: new HuTime.FigureStyle(null, "black", 2)
    },
    lineStyle: {                // 線の書式（列指定しない場合）
        get: function () {
            return this.getItemLineStyle("default");
        },
        set: function (val) {
            if (val == null && typeof val == "object")
                this.setItemLineStyle("default", this.__proto__._lineStyle);
            else
                this.setItemLineStyle("default", val);
        }
    },
    _appliedLineStyle: {
        value: function getLineStyle(itemName, record, record2) {
            if ("default" in this._itemLineStyles) {
                if(typeof this._itemLineStyles["default"] == "function")
                    return this._itemLineStyles["default"](itemName, record, record2);
                else
                    return this._itemLineStyles["default"];
            }
            return this.__proto__._lineStyle;
        }
    },

    drawLine: {                 // 線の描画処理
        writable: true,
        value: function (){}
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.RecordsetBase.prototype._toJSONProperties, {
            selectRecord: { value: "selectRecord" },
            _valueItems: { value: "valueItems" },
            showRecordsetPlot: { value: "showRecordsetPlot" },
            showRecordsetLine: { value: "showRecordsetLine" },
            _itemShowPlots: { value: "itemShowPlots" },
            _showPlot: { value: "showPlot" },
            hidePlotNonRRange: { value: "hidePlotNonRRange" },
            hidePlotTotalPRangeOnly: { value: "hidePlotTotalPRangeOnly" },

            _itemPlotStyles: { value: "itemPlotStyles" },
            _plotStyle: { value: "plotStyle" },
            _itemPlotSymbols: { value: "itemPlotSymbols" },
            _plotSymbol: { value: "plotSymbol" },
            _itemPlotWidths: { value: "itemPlotWidths" },
            _plotWidth: { value: "plotWidth" },
            _itemPlotRotates: { value: "itemPlotRotates" },
            _plotRotate: { value: "plotRotate" },
            _plotWidthType: { value: "plotWidthType" },

            _itemShowLines: { value: "itemShowLines" },
            _showLine: { value: "showLine" },
            hideLineNonRRange: { value: "hideLineNonRRange" },
            hideLineTotalPRangeOnly: { value: "hideLineTotalPRangeOnly" },
            _itemLineStyles: { value: "itemLineStyles" },
            _lineStyle: { value: "lineStyle" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordsetBase.prototype._parseJSONProperties, {
            valueItems: { value: "_valueItems" },
            itemShowPlots: { value: "_itemShowPlots" },
            itemPlotStyles: { value: "_itemPlotStyles" },
            plotStyle: { value: "_plotStyle" },
            itemPlotSymbols: { value: "_itemPlotSymbols" },
            itemPlotWidths: { value: "_itemPlotWidths" },
            itemPlotRotates: { value: "_itemPlotRotates" },

            itemShowLines: { value: "_itemShowLines" },
            itemLineStyles: { value: "_itemLineStyles" },
            lineStyle: { value: "_lineStyle" }
        })
    }
});

HuTime.PlotSymbol = {   // シンボルの種類を表す定数
    Circle: 0,
    Square: 1,
    Triangle: 2,
    PlusMark: 3
};
Object.freeze(HuTime.PlotSymbol);
HuTime.plotWidthType = {     // 棒グラフの棒の幅を指定する定数
    rRange: 0,  // 確実範囲の幅
    pRange: 1,  // 可能範囲の幅
    tValue: 2,  // t値で指定
    xyValue: 3  // xy値で指定
};
Object.freeze(HuTime.plotWidthType);

HuTime.CalendarChartRecordset = function CalendarChartRecordset(source, tBeginItem, tEndItem, valueItem, calendarId, plotStyle, lineStyle) {
    HuTime.ChartRecordset.apply(this, [source, null, null, valueItem, plotStyle, lineStyle]);

    if (typeof tBeginItem == "number" || typeof tBeginItem == "string") {
        if (typeof tEndItem != "number" && typeof tEndItem != "string")
            tEndItem = tBeginItem;
        this._tBeginDataSetting = new HuTime.RecordDataSetting(tBeginItem, "tBegin");
        this._tEndDataSetting = new HuTime.RecordDataSetting(tEndItem, "tEnd");
        this.calendarId = calendarId;
    }
};
HuTime.CalendarChartRecordset.prototype = Object.create(HuTime.ChartRecordset.prototype, {
    constructor: {
        value: HuTime.CalendarChartRecordset
    },

    calendarId: {
        writable: true,
        value: null
    },
    _tBeginDataSetting: {       // t値の始点に関する項目名等
        writable: true,
        value: null
    },
    _tEndDataSetting: {         // t値の終点に関する項目名等
        writable: true,
        value: null
    },
    onloadendCalendar: {
        writable: true,
        value: null
    },

    reader: {                   // readerのオーバライド（暦読み取りの非同期処理を追加）
        get: function () {
            return this._reader;
        },
        set: function (val) {
            if (!(val instanceof HuTime.StreamReaderBase))
                return;
            this._reader = val;
            var onloadend = function (obj) {
                obj._reader.onloadend = function () {
                    this._getRecords();
                    //obj._getRecords.apply(obj);
                }.bind(obj)
            }(this);
            var onloadendCalendar = function (obj) {
                obj.onloadendCalendar = function (obj) {
                    this.onloadend();
                    //obj.onloadend.apply(obj);
                }.bind(obj)
            }(this);
        }
    },

    _getRecords: {
        value: function _getRecords() { // StreamReaderのデータをDataItemSettingに基づいてRecordsetに変換
            var record;
            var itemData;
            var tBegin = [];
            var tEnd = [];
            var i, j;
            for (i = 0; i < this.reader.recordData.length; ++i) {
                record = this.appendRecord(new HuTime.ChartRecord(null));
                tBegin.push(this._tBeginDataSetting.getValue(this.reader.recordData[i]));
                tEnd.push(this._tEndDataSetting.getValue(this.reader.recordData[i]));

                for (j = 0; j < this.recordSettings._dataSettings.length; ++j) {
                    itemData = this.recordSettings._dataSettings[j].getValue(this.reader.recordData[i]);
                    if (itemData != null)
                        record.appendData(this.recordSettings._dataSettings[j].recordDataName, itemData);
                }
            }

            // 始点、終点のt値の範囲を取得
            var beginRanges = [];
            var endRanges = [];

            if (this.calendarId) {
                var data = this.calendarId;
                for (i = 0; i < this.reader.recordData.length; ++i) {
                    data += "\n\"" + tBegin[i] + "\",\"" + tEnd[i] + "\"";
                }
                var request = new XMLHttpRequest();
                var onload = function (obj) {
                    request.onreadystatechange = function () {
                        if (this.readyState != 4 || this.status != 200)
                            return;
                        var ranges = JSON.parse(request.responseText);
                        for (i = 0; i < obj.reader.recordData.length; ++i) {
                            if (isNaN(ranges[i].beginBegin) || isNaN(ranges[i].endEnd))
                                continue;
                            obj.records[i].tRange = new HuTime.TRange.createFromBeginEnd(
                                new HuTime.TRange.createFromBeginEnd(ranges[i].beginBegin, ranges[i].beginEnd),
                                new HuTime.TRange.createFromBeginEnd(ranges[i].endBegin, ranges[i].endEnd));
                        }
                        obj.onloadendCalendar(obj);
                    };
                }(this);

                request.open("POST", "http://ap.hutime.org/CalendarRecord", true);
                request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                request.send(data);
            }
            else {
                for (i = 0; i < this.reader.recordData.length; ++i) {
                    beginRanges.push(HuTime.isoToJdRange(tBegin[i]));
                    endRanges.push(HuTime.isoToJdRange(tEnd[i]));
                }
                // レコードへのtRangeの設定
                for (i = 0; i < this.reader.recordData.length; ++i) {
                    if (isNaN(beginRanges[i][0]) || isNaN(endRanges[i][1]))
                        continue;   // ここ、処理注意（要再検討）
                    this.records[i].tRange = new HuTime.TRange.createFromBeginEnd(beginRanges[i][0], endRanges[i][1]);
                }
                this.onloadendCalendar();
            }
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.ChartRecordset.prototype._toJSONProperties, {
            calendarId: { value: "calendarId" },
            _tBeginDataSetting: { value: "tBeginDataSetting" },
            _tEndDataSetting: { value: "tEndDataSetting" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.ChartRecordset.prototype._parseJSONProperties, {
            tBeginDataSetting: { value: "_tBeginDataSetting" },
            tEndDataSetting: { value: "_tEndDataSetting" }
        })
    }
});

HuTime.ChartRecord = function ChartRecord(tRange) {
    HuTime.RecordBase.apply(this, arguments);
};
HuTime.ChartRecord.prototype = Object.create(HuTime.RecordBase.prototype, {
    constructor: {
        value: HuTime.ChartRecord
    },

    _toJSONProperties: {
        value: Object.create(HuTime.RecordBase.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordBase.prototype._parseJSONProperties, {
        })
    }
});

// ++++ TLine（年表等）用 ++++
// タイムライン（年表）用のレコードセット
HuTime.TLineRecordset = function TLineRecordset(source, tBeginItem, tEndItem, labelItem, rangeStyle, labelStyle) {
    HuTime.RecordsetBase.call(this, source);

    this.labelItem = labelItem;
    if (this._labelItem)
        this._recordSettings.appendDataSetting(new HuTime.RecordDataSetting(this._labelItem));

    if (typeof tBeginItem === "number" || typeof tBeginItem === "string") {
        if (typeof tEndItem !== "number" && typeof tEndItem !== "string")
            tEndItem = tBeginItem;
        this._recordSettings.tSetting = new HuTime.RecordTSetting(tBeginItem, tEndItem);
    }

    this.rangeStyle = rangeStyle;   // 初期化は基底クラス
    this.labelStyle = labelStyle;   // レコードセット単位のみなので、初期化不要
};
HuTime.TLineRecordset.prototype = Object.create(HuTime.RecordsetBase.prototype, {
    // 基本構造
    constructor: {
        value: HuTime.TLineRecordset
    },

    // レコードセット内のレコード
    appendRecord: {
        value: function appendRecord(record){
            if (record instanceof HuTime.TLineRecord)
                return HuTime.RecordsetBase.prototype.appendRecord.call(this, record);
            else
                return null;
        }
    },
    appendNewRecord: {
        value: function appendNewRecord(tRange) {
            return this.appendRecord(new HuTime.TLineRecord(tRange));
        }
    },
    disableSortRecords: {   // ソートの抑止（falseで固定）
        get: function () {
            return false;   // 既定値変更
        }
    },

    // **** t値範囲 ****
    // 代表値のないレコード（無限大を含むなど）の範囲を表示しない（既定値変更）
    hideTRangeNonCentralValue: {
        writable: true,
        value: false
    },

    // 解像度に応じたレコードの表示・非表示
    _showRecordAtTResolution: {
        writable: true,
        value: true
    },
    showRecordAtTResolution: {
        get: function (){
            return this._showRecordAtTResolution;
        },
        set: function (val){
            if (typeof val === "boolean" || typeof val === "function")
                this._showRecordAtTResolution = val;
            else if (val == null && typeof val === "object")
                this._showRecordAtTResolution = this.__proto__._showRecordAtTResolution;
        }
    },
    _appliedShowRecordAtTResolution: {
        value: function getBandBreadth(tResolution, record){
            if (typeof this._showRecordAtTResolution === "function")
                return this._showRecordAtTResolution(tResolution, record);
            else
                return this._showRecordAtTResolution;
        }
    },

    _rangeStyle: {    // 範囲の書式（既定値変更）
        value: new HuTime.FigureStyle("#FF7F50")     // 帯の色 Colral
    },

    // 範囲を示す帯の幅（px）
    _bandBreadth: {
        writable: true,
        value: 20
    },
    bandBreadth: {
        get: function (){
            return this._bandBreadth;
        },
        set: function (val){
            if ((typeof val === "number" && val >= 0 && val <= 100) ||
                typeof val === "function")
                this._bandBreadth = val;
            else if (val == null && typeof val === "object")
                this._bandBreadth = HuTime.TLineRecordset.prototype._bandBreadth;
        }
    },
    _appliedBandBreadth: {
        value: function getBandBreadth(record){
            if (typeof this._bandBreadth === "function")
                return this._bandBreadth(record);
            else
                return this._bandBreadth;
        }
    },

    // ラベル関係
    _labelItem: {
        writable: true,
        value: null
    },
    labelItem: {
        get: function (){
            return this._labelItem;
        },
        set: function (val){
            if ((typeof val !== "string" || val.trim().length === 0) &&
                (typeof val !== "number" || !isFinite(val)))
                return;
            this._labelItem = val.toString().trim();
        }
    },

    // ラベルの表示
    _showLabel: {       // ラベルの書式
        writable: true,
        value: true
    },
    showLabel: {
        get: function () {
            return this._showLabel;
        },
        set: function (val) {
            if (typeof val === "boolean" || typeof val === "function")
                this._showLabel = val;
            else if (val == null && typeof val === "object")
                this._showLabel = this.__proto__._showLabel;
        }
    },
    _appliedShowLabel: {
        value: function _appliedShowLabel(record){
            if (typeof this._showLabel === "function")
                return this._showLabel(record);
            else
                return this._showLabel;
        }
    },

    _labelOffsetT: {     // ラベルの表示位置（t軸方向のオフセット）
        writable: true,
        value: 2
    },
    labelOffsetT: {
        get: function (){
            return this._labelOffsetT;
        },
        set: function (val){
            if (typeof val === "number" && val >= -1000 && val <= 1000)
                this._labelOffsetT = val;
        }
    },
    _labelOffsetV: {     // ラベルの表示位置（v軸方向のオフセット）
        writable: true,
        value: 0
    },
    labelOffsetV: {
        get: function (){
            return this._labelOffsetV;
        },
        set: function (val){
            if (typeof val === "number" && isFinite(val) && val >= -100 && val <= 100)
                this._labelOffsetV = val;
        }
    },
    _labelRotate: {      // ラベルの表示角度
        writable: true,
        value: 0
    },
    labelRotate: {
        get: function (){
            return this._labelRotate;
        },
        set: function (val){
            if (typeof val === "number" && isFinite(val))
                this._labelRotate = val;
        }
    },

    _labelStyle: {       // ラベルの書式
        writable: true,
        value: function () {
            var style = new HuTime.StringStyle(14, "black");
            style.textBaseline = "middle";
            return style;
        }()
    },
    labelStyle: {
        get: function () {
            return this._labelStyle;
        },
        set: function (val) {
            if (val instanceof HuTime.StringStyle) {
                this._labelStyle = val;
                this._labelStyle.textBaseline = "middle";
            }
            else if (typeof val === "function")
                this._labelStyle = val;
            else if (val == null && typeof val === "object")
                this._labelStyle = this.__proto__._labelStyle;
        }
    },
    _appliedLabelStyle: {
        value: function getLabelStyle(record){
            if (typeof this._labelStyle === "function")
                return this._labelStyle(record);
            else
                return this._labelStyle;
        }
    },

    drawLabel: {        // ラベルの描画
        writable: true,
        value: null
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.RecordsetBase.prototype._toJSONProperties, {
            hideTRangeNonCentralValue: { value: "hideTRangeNonCentralValue" },
            _showRecordAtTResolution: { value: "showRecordAtTResolution" },
            _rangeStyle: { value: "rangeStyle" },
            _bandBreadth: { value: "bandBreadth" },
            _labelItem: { value: "labelItem" },
            _showLabel: { value: "showLabel" },
            _labelOffsetT: { value: "labelOffsetT" },
            _labelOffsetV: { value: "labelOffsetV" },
            _labelRotate: { value: "labelRotate" },
            _labelStyle: { value: "labelStyle" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordsetBase.prototype._parseJSONProperties, {
            rangeStyle: { value: "_rangeStyle" },
            labelStyle: { value: "_labelStyle" }
        })
    }
});

// タイムライン（年表）用のレコードセットをあまいな時間（JD指定）で生成
HuTime.TLineRecordset.createFromBeginEndRange =
    function createFromBeginEndRange(source, tBBeginItem, tBEndItem, tEBeginItem, tEEndItem, labelItem, rangeStyle, labelStyle) {

    let recordset = new HuTime.TLineRecordset(source, tBBeginItem, tEEndItem, labelItem, rangeStyle, labelStyle);
    recordset._recordSettings.tSetting = new HuTime.RecordUTSetting(tBBeginItem, tBEndItem, tEBeginItem, tEEndItem);
    return recordset;
};

// 暦変換を含むレコードセット
HuTime.CalendarTLineRecordset = function CalendarTLineRecordset(source, tBeginItem, tEndItem, label, calendarId, rangeStyle, labelStyle) {
    HuTime.TLineRecordset.apply(this, [source, null, null, label, rangeStyle, labelStyle]);

    if (typeof tBeginItem === "number" || typeof tBeginItem === "string") {
        if (typeof tEndItem !== "number" && typeof tEndItem !== "string")
            tEndItem = tBeginItem;
        this._tBeginDataSetting = new HuTime.RecordDataSetting(tBeginItem, "tBegin");
        this._tEndDataSetting = new HuTime.RecordDataSetting(tEndItem, "tEnd");
        this.calendarId = calendarId;
    }
};
HuTime.CalendarTLineRecordset.prototype = Object.create(HuTime.TLineRecordset.prototype, {
    constructor: {
        value: HuTime.CalendarTLineRecordset
    },
    calendarId: {
        writable: true,
        value: null
    },

    // 確定時間用
    _tBeginDataSetting: {       // t値の始点に関する項目名等
        writable: true,
        value: null
    },
    _tEndDataSetting: {         // t値の終点に関する項目名等
        writable: true,
        value: null
    },

    // あいまい時間用
    _tBBeginDataSetting: {       // t値の始点範囲の始点に関する項目名等
        writable: true,
        value: null
    },
    _tBEndDataSetting: {         // t値の始点範囲の終点に関する項目名等
        writable: true,
        value: null
    },
    _tEBeginDataSetting: {       // t値の終点範囲の始点に関する項目名等
        writable: true,
        value: null
    },
    _tEEndDataSetting: {         // t値の終点範囲の終点に関する項目名等
        writable: true,
        value: null
    },


    onloadendCalendar: {
        writable: true,
        value: null
    },

    reader: {                   // readerのオーバライド（暦読み取りの非同期処理を追加）
        get: function () {
            return this._reader;
        },
        set: function (val) {
            if (!(val instanceof HuTime.StreamReaderBase))
                return;
            this._reader = val;
            let onloadend = function (obj) {
                obj._reader.onloadend = function () {
                    obj._getRecords.apply(obj);
                }
            }(this);
            let onloadendCalendar = function (obj) {
                obj.onloadendCalendar = function (obj) {
                    this.onloadend();
                }.bind(obj)
            }(this);
        }
    },

    _getRecords: {
        value: function _getRecords() { // StreamReaderのデータをDataItemSettingに基づいてRecordsetに変換
            let record;
            let itemData;

            // 各定時間用
            let tBegin = [];
            let tEnd = [];

            // あいまい時間用
            let tBBegin = [];
            let tBEnd = [];
            let tEBegin = [];
            let tEEnd = [];

            let i, j;

            for (i = 0; i < this.reader.recordData.length; ++i) {
                record = this.appendRecord(new HuTime.TLineRecord(null));
                if (this._recordSettings.tSetting instanceof HuTime.RecordUTSetting) {
                    tBBegin.push(this._tBBeginDataSetting.getValue(this.reader.recordData[i]));
                    tBEnd.push(this._tBEndDataSetting.getValue(this.reader.recordData[i]));
                    tEBegin.push(this._tEBeginDataSetting.getValue(this.reader.recordData[i]));
                    tEEnd.push(this._tEEndDataSetting.getValue(this.reader.recordData[i]));
                }
                else {
                    tBegin.push(this._tBeginDataSetting.getValue(this.reader.recordData[i]));
                    tEnd.push(this._tEndDataSetting.getValue(this.reader.recordData[i]));
                }
                for (j = 0; j < this.recordSettings._dataSettings.length; ++j) {
                    itemData = this.recordSettings._dataSettings[j].getValue(this.reader.recordData[i]);
                    if (itemData != null)
                        record.appendData(this.recordSettings._dataSettings[j].recordDataName, itemData);
                }
            }

            // 始点、終点のt値の範囲を取得
            let beginRanges = [];
            let endRanges = [];

            if (this.calendarId) {
                let data = this.calendarId;
                let request = new XMLHttpRequest();
                if (this._recordSettings.tSetting instanceof HuTime.RecordUTSetting) {
                    // createFromBeginEndRangeで生成した場合（あいまい時間で指定）
                    for (i = 0; i < this.reader.recordData.length; ++i) {
                        data += "\n\"" + tBBegin[i] + "\",\"" + tBEnd[i] + "\"";
                        data += "\n\"" + tEBegin[i] + "\",\"" + tEEnd[i] + "\"";
                    }
                    let onload = function (obj) {
                        request.onreadystatechange = function () {
                            if (this.readyState !== 4 || this.status !== 200)
                                return;
                            let a = request.responseText;
                            let ranges = JSON.parse(request.responseText);
                            for (i = 0; i < obj.reader.recordData.length; ++i) {
                                if (isNaN(ranges[i].beginBegin) || isNaN(ranges[i].endEnd))
                                    continue; // 無限大の場合の処理要検討
                                obj.records[i].tRange = HuTime.TRange.createFromBeginEnd(
                                    HuTime.TRange.createFromBeginEnd(ranges[2 * i].beginBegin, ranges[2*i].endEnd),
                                    HuTime.TRange.createFromBeginEnd(ranges[2 * i + 1].beginBegin, ranges[2 * i + 1].endEnd));
                            }
                            obj.onloadendCalendar(obj);
                        };
                    }(this);
                }
                else {
                    // あいまいな時間の指定でない場合
                    for (i = 0; i < this.reader.recordData.length; ++i) {
                        data += "\n\"" + tBegin[i] + "\",\"" + tEnd[i] + "\"";
                    }
                    let onload = function (obj) {
                        request.onreadystatechange = function () {
                            if (this.readyState !== 4 || this.status !== 200)
                                return;
                            let ranges = JSON.parse(request.responseText);
                            for (i = 0; i < obj.reader.recordData.length; ++i) {
                                if (isNaN(ranges[i].beginBegin) || isNaN(ranges[i].endEnd))
                                    continue;
                                obj.records[i].tRange = HuTime.TRange.createFromBeginEnd(
                                    HuTime.TRange.createFromBeginEnd(ranges[i].beginBegin, ranges[i].beginEnd),
                                    HuTime.TRange.createFromBeginEnd(ranges[i].endBegin, ranges[i].endEnd));
                            }
                            obj.onloadendCalendar(obj);
                        };
                    }(this);
                }
                request.open("POST", "http://ap.hutime.org/CalendarRecord", true);
                request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                request.send(data);
            }
            else {
                // あいまいな時間未対応
                for (i = 0; i < this.reader.recordData.length; ++i) {
                    beginRanges.push(HuTime.isoToJdRange(tBegin[i]));
                    endRanges.push(HuTime.isoToJdRange(tEnd[i]));
                }
                // レコードへのtRangeの設定
                for (i = 0; i < this.reader.recordData.length; ++i) {
                    if (isNaN(beginRanges[i][0]) || isNaN(endRanges[i][1]))
                        continue;   // ここ、処理注意（要再検討）
                    this.records[i].tRange = new HuTime.TRange.createFromBeginEnd(beginRanges[i][0], endRanges[i][1]);
                }
                this.onloadendCalendar();
            }
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.TLineRecordset.prototype._toJSONProperties, {
            calendarId: { value: "calendarId" },
            _tBeginDataSetting: { value: "tBeginDataSetting" },
            _tEndDataSetting: { value: "tEndDataSetting" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.TLineRecordset.prototype._parseJSONProperties, {
            tBeginDataSetting: { value: "_tBeginDataSetting" },
            tEndDataSetting: { value: "_tEndDataSetting" }
        })
    }
});

// 暦変換を含むレコードセットをあまいな時間で生成
HuTime.CalendarTLineRecordset.createFromBeginEndRange = function createFromBeginEndRange(
    source, tBBeginItem, tBEndItem, tEBeginItem, tEEndItem, labelItem, calendarId, rangeStyle, labelStyle) {

    let recordset = new HuTime.CalendarTLineRecordset(source, tBBeginItem, tEEndItem, labelItem, calendarId, rangeStyle, labelStyle);
    recordset._recordSettings.tSetting = new HuTime.RecordUTSetting(tBBeginItem, tBEndItem, tEBeginItem, tEEndItem);
    recordset._tBBeginDataSetting = new HuTime.RecordDataSetting(tBBeginItem, "tBBegin");
    recordset._tBEndDataSetting = new HuTime.RecordDataSetting(tBEndItem, "tBEnd");
    recordset._tEBeginDataSetting = new HuTime.RecordDataSetting(tEBeginItem, "tEBegin");
    recordset._tEEndDataSetting = new HuTime.RecordDataSetting(tEEndItem, "tEEnd");
    return recordset;
};




HuTime.PlotDirection = {    // TLineLayerでプロットを描画する方向
    topToBottom: 0,     // 上から下の順でプロットが描画する
    bottomToTop: 1      // 下から上の順でプロットが描画する
};
Object.freeze(HuTime.PlotDirection);

HuTime.TLineRecord = function TLineRecord (tRange) {
    HuTime.RecordBase.call(this, tRange);
};
HuTime.TLineRecord.prototype = Object.create(HuTime.RecordBase.prototype, {
    constructor: {
        value: HuTime.TLineRecord
    },

    _toJSONProperties: {
        value: Object.create(HuTime.RecordBase.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordBase.prototype._parseJSONProperties, {
        })
    }
});
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
                        if (!record1.tRange || !record2.tRange)
                            return 0;   // 読み込み完了前に処理した場合など
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
                    if (!this.recordsets[i].records[j].tRange)
                        continue;
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
                        if (
                            (this.recordsets[i].hideTRangeTotalPRangeOnly &&    // 全可能期間のみのレコード
                            this.recordsets[i].records[j].tRange.isTotalPRangeOnly) ||
                            (this.recordsets[i].hideTRangeNonRRange &&          // 確実期間の無いレコード
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
                            (this.recordsets[i].records[j].tRange.isNonRRange ||
                            this.recordsets[i].records[j - 1].tRange.isNonRRange))
                            continue;
                        if (this.recordsets[i].hideLineTotalPRangeOnly &&    // 全可能期間のみのレコード
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
                            this.recordsets[i].records[j].tRange.isTotalPRangeOnly) ||
                            (this.recordsets[i].hidePlotNonRRange &&            // 確実期間の無いレコード
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

            // rBegin, rEnd の位置（区切り線）表示
            if (tRange._rBegin > layer._minLyrT) {
                bPos = new HuTime.TVPosition(tRange._rBegin, v);      // rBeginのPositionオブジェクト
                HuTime.Drawing.drawLine(style, layer,                 // rBeginのtick（区切り線）
                    [new HuTime.RelativeXYPosition(bPos, 0, -tickHeight),
                         new HuTime.RelativeXYPosition(bPos, 0, tickHeight)], canvas);
            }
            if (tRange._rEnd < layer._maxLyrT) {
                ePos = new HuTime.TVPosition(tRange._rEnd, v);        // rEndのPositionオブジェクト
                HuTime.Drawing.drawLine(style, layer,                 // rEndのtick（区切り線）
                    [new HuTime.RelativeXYPosition(ePos, 0, -tickHeight),
                        new HuTime.RelativeXYPosition(ePos, 0, tickHeight)], canvas);
            }

            // 確実期間の表示
            if (layer.showReliableTRange && recordset._appliedItemShowReliableTRange(itemName, record)) {
                if (!tRange.isNonRRange || tRange._rBegin <= tRange._rEnd) {     // 確実期間がある場合は、実線で表示
                    style.lineDash = [];        // 実線を指定（点線を解除）
                    begin =     // 無限大は表示範囲に合わせて表示
                        tRange._rBegin === Number.NEGATIVE_INFINITY ? layer._minLyrT : tRange._rBegin;
                    end =
                        tRange._rEnd === Number.POSITIVE_INFINITY ? layer._maxLyrT : tRange._rEnd;

                    bPos = new HuTime.TVPosition(begin, v);      // 始点のPositionオブジェクト
                    ePos = new HuTime.TVPosition(end, v);        // 終点のPositionオブジェクト

                    HuTime.Drawing.drawLine(style, layer, [bPos, ePos], canvas);     // 範囲本体
                }
            }

            // 可能期間の表示
            if (layer.showPossibleTRange && recordset._appliedItemShowPossibleTRange(itemName, record)) {
                if (!isNaN(tRange._pEnd) && !isNaN(tRange._pBegin) && ( // 全可能範囲の描画
                    (isNaN(tRange._rEnd) || isNaN(tRange._rBegin) || tRange._rBegin > tRange._rEnd) ||  // 全可能期間のみの場合
                    ((!layer.showReliableTRange || !recordset._appliedItemShowReliableTRange(itemName, record)) &&
                    (!isNaN(tRange._rEnd) && !isNaN(tRange._rBegin)))   // 確実期間が非表示の場合、全体を可能期間として描画
                )) {
                    begin = tRange._pBegin === Number.NEGATIVE_INFINITY ? layer._minLyrT : tRange._pBegin;
                    end = tRange._pEnd === Number.POSITIVE_INFINITY ? layer._maxLyrT : tRange._pEnd;
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
                    if (!isNaN(tRange._rBegin) && !isNaN(tRange._pBegin)) {   // 前期可能範囲
                        begin = tRange._pBegin === Number.NEGATIVE_INFINITY ?
                            layer._minLyrT : tRange._pBegin;
                        end = tRange._rBegin === Number.POSITIVE_INFINITY ?
                            layer._maxLyrT : tRange._rBegin;

                        HuTime.Drawing.drawLine(style, layer,
                            [new HuTime.TVPosition(begin, v), new HuTime.TVPosition(end, v)], canvas);
                    }
                    if (!isNaN(tRange._pEnd) || !isNaN(tRange._rEnd)) {   // 後期可能範囲
                        begin = tRange._rEnd === Number.NEGATIVE_INFINITY ?
                            layer._minLyrT : tRange._rEnd;
                        end = tRange._pEnd === Number.POSITIVE_INFINITY ?
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
            },
            vScales: {
                value: function (objRaw) {
                    while (this.vScales.length > 0) {
                        this.removeVScale(0);
                    }
                    let vScales =HuTime.JSON.parse(objRaw.vScales);
                    for (let i = 0; i < vScales.length; ++i) {
                        this.appendVScale(vScales[i].side, vScales[i].offset, vScales[i].legend,
                            vScales[i].vBottom, vScales[i].vTop, vScales[i].style, vScales[i].dataset);
                    }
                }
            }
        })
    }
});


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
                    if (this.recordsets[i].records[j]._tRange == null)
                        continue;   // 日付が取得できなかったなどでnullの場合
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
                if (!this._sortedRecords[i].recordset.showRecordset)
                    continue;
                if (!this._sortedRecords[i].recordset.showReliableTRange &&   // 可能・確実範囲とも非表示の場合
                    !this._sortedRecords[i].recordset.showPossibleTRange)
                    continue;

                // 描画しないレコード（全可能期間のみや、確実期間の無いレコード）
                if ((this._sortedRecords[i].recordset.hideTRangeTotalPRangeOnly &&    // 全可能期間のみのレコード
                    this._sortedRecords[i].record.tRange.isTotalPRangeOnly) ||
                    (this._sortedRecords[i].recordset.hideTRangeNonRRange &&          // 確実期間の無いレコード
                    this._sortedRecords[i].record.tRange.isNonRRange) ||
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
                if ((tRange._pEnd - tRange._pBegin) * layer.lyrTResolution < 5) {
                    // 表示幅が5px以下の場合は、丸で表示
                    HuTime.Drawing.drawCircle(style, layer,
                        new HuTime.TVPosition(tRange._centralValue, v - bandBreadth / 2),
                        bandBreadth * 0.75, canvas);
                }
                else {
                    begin = tRange._pBegin < layer._minLyrT ? layer._minLyrT : tRange._pBegin;
                    end = tRange._pEnd > layer._maxLyrT ? layer._maxLyrT : tRange._pEnd;
                    HuTime.Drawing.drawRect(style, layer,
                        new HuTime.PositionFloor(new HuTime.TVPosition(begin, v)),
                        new HuTime.PositionFloor(new HuTime.TVPosition(end, v - bandBreadth)),
                        0, canvas);
                }
                return;
            }

            // 確実範囲の描画
            if (layer.showReliableTRange && recordset.showReliableTRange &&
                (!isNaN(tRange._rEnd) && !isNaN(tRange._rBegin) && tRange._rBegin <= tRange._rEnd)) {
                if ((tRange._pEnd - tRange._pBegin) * layer.lyrTResolution < 5) {
                    // 表示幅が5px以下の場合は、丸で表示
                    HuTime.Drawing.drawCircle(style, layer,
                        new HuTime.TVPosition(tRange._centralValue, v - bandBreadth / 2),
                        bandBreadth * 0.75, canvas);
                }
                else {
                    begin = tRange._rBegin < layer._minLyrT ? layer._minLyrT : tRange._rBegin;
                    end = tRange._rEnd > layer._maxLyrT ? layer._maxLyrT : tRange._rEnd;
                    HuTime.Drawing.drawRect(style, layer,
                        new HuTime.PositionFloor(new HuTime.TVPosition(begin, v)),
                        new HuTime.PositionFloor(new HuTime.TVPosition(end, v - bandBreadth)),
                        0, canvas);
                }
            }

            // 可能期間の表示
            if (layer.showPossibleTRange && recordset.showPossibleTRange) {
                if (!isNaN(tRange._pEnd) && !isNaN(tRange._pBegin) && (    // 全可能範囲の描画
                    (isNaN(tRange._rEnd) || isNaN(tRange._rBegin) || tRange._rBegin > tRange._rEnd) ||  // 全可能期間のみの場合
                    ((!layer.showReliableTRange || !recordset.showReliableTRange) &&    // 確実期間が非表示の場合
                        (!isNaN(tRange._rEnd) && !isNaN(tRange._rBegin)))  // 全体を可能期間として描画
                )) {
                    if (tRange._pEnd - tRange._pBegin == 0) {
                        // 確実範囲の長さが0で可能範囲が無いの場合は、丸で表示
                        var lineWidthOriginal = style.lineWidth;
                        var fillColorOriginal = style.fillColor;
                        style.lineWidth = 2;
                        style.fillColor = null;
                        HuTime.Drawing.drawCircle(style, layer,
                            new HuTime.TVPosition(tRange._pBegin, v - bandBreadth / 2),
                                bandBreadth * 0.75, canvas);
                        style.lineWidth = lineWidthOriginal;
                        style.fillColor = fillColorOriginal;
                    }
                    else {
                        // 表示範囲に合わせる
                        begin = tRange._pBegin < layer._minLyrT ? layer._minLyrT : tRange._pBegin;
                        end = tRange._pEnd > layer._maxLyrT ? layer._maxLyrT : tRange._pEnd;
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
                    if (!isNaN(tRange._rBegin) && !isNaN(tRange._pBegin)) {
                        begin = tRange._pBegin < layer._minLyrT ? layer._minLyrT : tRange._pBegin;
                        end = tRange._rBegin > layer._maxLyrT ? layer._maxLyrT : tRange._rBegin;
                        layer._setGradation(layer, style, end, begin);
                        HuTime.Drawing.drawRect(style, layer,
                            // 範囲（帯）の間に隙間ができることがあるので、座標を整数化する
                            new HuTime.PositionFloor(new HuTime.TVPosition(begin, v)),
                            new HuTime.PositionFloor(new HuTime.TVPosition(end, v - bandBreadth)),
                            0, canvas);
                    }

                    // 後期可能範囲の描画
                    if (!isNaN(tRange._pEnd) && !isNaN(tRange._rEnd)) {
                        begin = tRange._rEnd < layer._minLyrT ? layer._minLyrT : tRange._rEnd;
                        end = tRange._pEnd > layer._maxLyrT ? layer._maxLyrT : tRange._pEnd;
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

            if (!isNaN(tRange._rBegin)) {   // 確実範囲がある場合（始点）
                begin = tRange._rBegin < layer._minLyrT ? layer._minLyrT : tRange._rBegin;
                labelPos = new HuTime.RelativeTVPosition(
                    new HuTime.TVPosition(begin, v - bandBreadth / 2), labelOffsetT, labelOffsetV);
            }
            else if (!isNaN(tRange._pEnd) && !isNaN(tRange._rEnd)
                && tRange._pEnd - tRange._rEnd > 0) {   // 後期可能期間がある場合（始点）
                begin = tRange._centralValue < layer._minLyrT ? layer._minLyrT : tRange._centralValue;
                labelPos = new HuTime.RelativeTVPosition(
                    new HuTime.TVPosition(begin, v - bandBreadth / 2), labelOffsetT, labelOffsetV);
            }
            else if (!isNaN(tRange._rBegin) && !isNaN(tRange._pBegin)
                && tRange._rBegin - tRange._pBegin > 0) {   // 前期可能期間がある場合（終点）
                begin = tRange._centralValue > layer._maxLyrT ? layer._maxLyrT : tRange._centralValue;
                var ctx = canvas.getContext('2d');
                ctx.font = style.font;
                labelPos = new HuTime.RelativeTVPosition(
                    new HuTime.TVPosition(begin, v - bandBreadth / 2),
                    - ctx.measureText(label).width - labelOffsetT, labelOffsetV);
                // （ラベルを回転させた場合に左端を基準にするため「擬似的」な右寄せ）
            }
            else if (!isNaN(tRange._pEnd) && !isNaN(tRange._pBegin)) {   // 全可能期間がある場合（表示範囲の中心）
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

            if ((record.tRange._pEnd - record.tRange._pBegin) * this._lyrTResolution >= 5)
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
                    this._sortedRecords[i].record.tRange.isTotalPRangeOnly) ||
                    (this._sortedRecords[i].recordset.hideTRangeNonRRange &&          // 確実期間の無いレコード
                    this._sortedRecords[i].record.tRange.isNonRRange) ||
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
                    this._sortedRecords[i].record.tRange.isTotalPRangeOnly) ||
                    (this._sortedRecords[i].recordset.hideTRangeNonRRange &&          // 確実期間の無いレコード
                    this._sortedRecords[i].record.tRange.isNonRRange) ||
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
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.RecordLayerBase.prototype._toJSONProperties, {
            useBandStyle: { value: "useBandStyle" },
            plotInterval: { value: "plotInterval" },
            padding: { value: "padding" },
            showLabel: { value: "showLabel" },
            plotDirection: { value: "plotDirection" },

            showReliableTRange: { value: "showReliableTRange" },
            showPossibleTRange: { value: "showPossibleTRange" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordLayerBase.prototype._parseJSONProperties, {
        })
    }
});

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
                var onloadend = function (obj) {      // データ読み込み後に再描画させる
                    recordset.onloadend = function () {
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
    _toJSONProperties: {
        value: Object.create(HuTime.RecordLayerBase.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordLayerBase.prototype._parseJSONProperties, {
        })
    }
});

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
    _toJSONProperties: {
        value: Object.create(HuTime.RecordLayerBase.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordLayerBase.prototype._parseJSONProperties, {
        })
    }
});

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
                    //begin = tRangePrev._rRangeEnd;
                    //end = tRange._rRangeBegin;
                    begin = tRangePrev._rEnd;
                    end = tRange._rBegin;
                    break;

                case 1:     // 可能範囲に基づく
                    //begin = tRangePrev._pRangeEnd;
                    //end = tRange._pRangeBegin;
                    begin = tRangePrev._pEnd;
                    end = tRange._pBegin;
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
                    //begin = tRange._rRangeBegin;
                    //end = tRange._rRangeEnd;
                    begin = tRange._rBegin;
                    end = tRange._rEnd;
                    break;

                case 1:     // 可能範囲に基づく
                    //begin = tRange._pRangeBegin;
                    //end = tRange._pRangeEnd;
                    begin = tRange._pBegin;
                    end = tRange._pEnd;
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
                    //begin = record.tRange._rRangeBegin;
                    //end = record.tRange._rRangeEnd;
                    begin = record.tRange._rBegin;
                    end = record.tRange._rEnd;
                    break;

                case 1:     // 可能範囲に基づく
                    //begin = record.tRange._pRangeBegin;
                    //end = record.tRange._pRangeEnd;
                    begin = record.tRange._pBegin;
                    end = record.tRange._pEnd;
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
    _toJSONProperties: {
        value: Object.create(HuTime.RecordLayerBase.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordLayerBase.prototype._parseJSONProperties, {
        })
    }
});

// **** ファイルの取得方法に応じた読み込み処理を提供 ****
HuTime.StreamBase = function() {
};
HuTime.StreamBase.prototype = {
    constructor: HuTime.StreamBase,

    _source: null,  // 読み込み元
    get source() {
        return this._source;
    },
    set source(val) {
        this._source = val;
        this.loadState = "ready";
    },

    load: function load() {                 // ストリームの読み込み開始
        this.loadState = "loading"
    },
    onloadend: function onloadend() {},     // 読み込み終了後の処理
    loadState: "init",                      // 読み込み状態（init, ready, loading, loadend, error）

    readAll: function readAll() {           // 全ての読み込みデータを返す（基底クラスなのでnullを返す）
        return null;
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        _source: function (objForJSON) {
            var element = document.createElement("a");
            element.href = this._source;
            objForJSON.source = element.href;     // フルパスを入力
        }
    },
    _parseJSONProperties: {
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// ローカルファイルからの読み込み
HuTime.FileStream = function FileStream (source) {
    this.source = source;
    this._reader = new FileReader();
    this._reader.onloadend = function (e) {  // FileReaderの読み込み終了イベントに処理を設定
        this.loadState = "loadend";
        this.onloadend.apply(this)
    }.bind(this);
};
HuTime.FileStream.prototype = Object.create(HuTime.StreamBase.prototype, {
    constructor: {
        value: HuTime.FileStream
    },

    // FileStream固有のプロパティ等
    _reader: {          // FileReader
        writable: true,
        value: null
    },
    source: {
        get: function() {
            return this._source;
        },
        set: function(val) {
            if (!(val instanceof File) && !(val instanceof Blob)) {
                this._source = null;
                this.loadState = "error";
                return;
            }
            this._source = val;
            this.loadState = "ready";
        }
    },

    // 基底クラスのオーバライド
    load: {
        value: function load() {
            if (!(this._source instanceof File) && !(this._source instanceof Blob)) {
                this.loadState = "error";
                return;
            }
            this.loadState = "loading";
            this._reader.readAsText(this._source);
        }
    },
    readAll: {
        value: function readAll() {
            if (this._reader.result && this.loadState == "loadend")
                return this._reader.result;
            else
                return null;
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.StreamBase.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.StreamBase.prototype._parseJSONProperties, {
        })
    }
});

// Web上からの読み込み
HuTime.HttpStream = function HttpStream (source) {
    this.source = source;
    this._request = new XMLHttpRequest();
    this._request.onreadystatechange = function (e) {       // XMLHttpRequestの読み込み終了イベントに処理を設定
        if (this._request.readyState != 4)
            return;
        if (this._request.status != "200") {
            this.loadState = "error";
            return;
        }
        this.loadState = "loadend";
        this.onloadend.apply(this);
    }.bind(this);
};
HuTime.HttpStream.prototype = Object.create(HuTime.StreamBase.prototype, {
    constructor: {
        value: HuTime.HttpStream
    },
    authorization: {
        writable: true,
        value: false
    },
    id: {
        writable: true,
        value: null
    },
    pass: {
        writable: true,
        value: null
    },
    // HttpStream固有のプロパティ等
    _request: {          // XMLHttpRequest
        writable: true,
        value: null
    },
    source: {
        get: function() {
            return this._source;
        },
        set: function(val) {
            if (!val) {
                this._source = null;
                this.loadState = "error";
                return;
            }
            this._source = val;
            this.loadState = "ready";
        }
    },

    _responseText: {
        writable: true,
        value: null
    },

    // 基底クラスのオーバライド
    load: {
        value: function load() {
            if (!this._source) {
                this.loadState = "error";
                return;
            }
            this._request.abort();
            this._responseText = null;
            this.loadState = "loading";
            this._request.open("get", this._source, true);
            if (this.authorization && this.id.length > 0 && this.pass.length > 0) {
                let auth = window.btoa(this.id + ":" + this.pass);
                this._request.setRequestHeader("Authorization", "Basic " + auth);
            }
            this._request.send(null);
        }
    },
    readAll: {
        value: function readAll() {
            if (this._request.readyState != 4 || this.loadState != "loadend")   // readyState: 4 = DONE
                return null;
            return this._request.responseText;
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.StreamBase.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.StreamBase.prototype._parseJSONProperties, {
        })
    }
});

// **** ファイルのタイプに応じた読み取り処理により、読み込んだデータを配列に展開 ****
HuTime.StreamReaderBase = function StreamReaderBase (source) {
    this.source = source;
};
HuTime.StreamReaderBase.prototype = {
    constructor: HuTime.StreamReaderBase,

    _stream: null,              // レコードセットを取得するストリーム
    get stream() {
        return this._stream;
    },
    set stream(val) {
        if (!(val instanceof HuTime.StreamBase))
            return;
        this._stream = val;
        this._stream.onloadend = function () {
            this._readRecordData.apply(this);
            this.onloadend.apply(this);   // 自身に設定された読み取り終了後の処理を、ストリーム読み取り後の処理として設定
        }.bind(this);
    },

    _source: null,              // レコードセットの取得元
    get source() {
        return this._source;
    },
    set source(val) {       // 取得元に応じて、適切なstreamオブジェクトを設定
        if (typeof val == "string" && val != "")  // URLとして入力された場合
            this.stream = new HuTime.HttpStream(val);
        else if (val instanceof File || val instanceof Blob)                // Fileオブジェクトが入力された場合
            this.stream = new HuTime.FileStream(val);
        else if (val instanceof HuTime.StreamBase)   // streamオブジェクトが直接入力された場合
            this.stream = val;
        else
            return;
        this._source = val;
    },

    _recordData: null,          // ストリームから読み込んだデータ
    get recordData() {
        return this._recordData;
    },
    _itemNames: null,           // 項目名（列名）の配列
    get itemNames() {
        return this._itemNames;
    },
    load: function load () {     // 読み込み
        this._stream.load();
    },
    get loadState () {
        return this._stream.loadState;
    },

    onloadend: function onloadend(){},  // レコードセット読み取り終了後の処理
    _readRecordData: function() {},     // レコードセットの読み取り

    // **** JSON出力 ****
    _toJSONProperties: {
        _stream: "stream",
        _source: function (objForJSON) {
            var element = document.createElement("a");
            element.href = this._source;
            objForJSON.source = element.href;     // フルパスを入力
        }
    },
    _parseJSONProperties: {
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// テキストファイル
HuTime.TextReader = function TextReader (source, isTitleRow, delimiter) {
    // isTitleRow: trueならば1行目はタイトル行, delimiter: 区切り文字
    HuTime.StreamReaderBase.apply(this, arguments);
    this.isTitleRow = isTitleRow;
    this.delimiter = delimiter;
};
HuTime.TextReader.prototype = Object.create(HuTime.StreamReaderBase.prototype, {
    constructor: {
        value: HuTime.TextReader
    },

    _isTitleRow: {            // タイトル行の設定（trueならば1行目はタイトル行）
        writable: true,
        value: true
    },
    isTitleRow: {
        get: function() {
            return this._isTitleRow;
        },
        set: function(val) {
            if ((typeof val) == "boolean")
                this._isTitleRow = val;
        }
    },
    _delimiter: {           // 区切り記号
        writable: true,
        value: ","
    },
    delimiter: {
        get: function() {
            return this._delimiter;
        },
        set: function(val) {
            if ((typeof val) == "string")
                this._delimiter = val;
        }
    },

    _readRecordData: {
        value: function _readRecordData() {
            var isTitleRow = this._isTitleRow;  // 現在処理中の行がタイトル行かどうか
            var pos = 0;        // 現在の読み込み位置
            var posNext;        // 次の読み込み位置（読み込むデータの終端の次）
            var posIndexOf;     // IndexOfの結果を収容

            this._recordData = [];
            this._itemNames = [];
            var recordId = 0;
            var item = "";
            var maxItemCount = 0;
            var itemCount = 0;

            var value;
            var loadedData = this.stream.readAll();
            var length = loadedData.length;
            var isEnclosed = false;
            var NLCode = HuTime.checkNewLineCode(loadedData);   // 改行コード

            recordId = 0;
            while (pos < length) {
                if (!isTitleRow)     // データ行の処理
                    this._recordData.push({
                        name: this._itemNames,  // 表形式なので、参照を渡すだけ（全てのレコードで共通になる）
                        value: []
                    });
                itemCount = 0;
                while (pos < length) {
                    // 冒頭の空白の処理（引用符が用いられない場合は、データに含まれる）
                    while (loadedData[pos] == " " && pos < length) {
                        item += loadedData[pos];
                        ++pos;
                    }
                    // 引用符の中の処理
                    if (loadedData[pos] == "\"") {
                        item = "";      // 空白が入っている場合もあるので一度クリア
                        isEnclosed = true;
                        ++pos;
                        while (pos < length) {
                            posNext = loadedData.indexOf("\"", pos);
                            if (posNext < 0) {
                                item += loadedData.slice(pos, length);     // 終端の引用符が見つからない場合
                                break;
                            }
                            item += loadedData.slice(pos, posNext);
                            pos = posNext + 1;
                            if (pos >= length || loadedData[pos] != "\"")
                                break;
                            item += "\"";   // 引用符内の引用符（""）
                            ++pos;
                        }
                    }

                    //　データ項目末端の探索
                    posNext = loadedData.indexOf(this._delimiter, pos);        // データ項目区切り
                    if (posNext < 0)
                        posNext = length;   // 区切りが見つからない場合は最後ファイル末尾を設定

                    posIndexOf = loadedData.indexOf(NLCode, pos);      // レコード区切り
                    if (posIndexOf >= 0 && posIndexOf < posNext)
                        posNext = posIndexOf;

                    // 引用符に囲まれていない値の取得
                    if (!isEnclosed) {
                        item += loadedData.slice(pos, posNext);
                        if (!isNaN(item))       // 数値として認識できる場合
                            item = parseFloat(item);
                    }

                    // 値を結果に出力し、各種編集を初期値に戻す
                    if (isTitleRow)
                        this._itemNames.push(item);     // タイトル行の処理
                    else
                        this._recordData[recordId].value.push(item);    // データ行の処理
                    isEnclosed = false;
                    item = "";

                    if (loadedData[posNext] != this._delimiter)
                        break;      // データ項目区切りでない場合は、レコード末端（次のレコードへ）
                    pos = posNext + this._delimiter.length;
                }

                if (isTitleRow)
                    isTitleRow = false;  // falseに設定し、以降の処理をデータ行として処理
                else {      // データ項目数をチェックして、レコードIDをインクリメント
                    if (maxItemCount < this._recordData[recordId].value.length)
                        maxItemCount = this._recordData[recordId].value.length;
                    ++recordId;
                }

                pos = loadedData.indexOf(NLCode, pos);    // レコード区切り
                pos += NLCode.length;
            }

            // 項目名の不足分を列番号で補完
            for (var i = this._itemNames.length; i < maxItemCount; ++i) {
                this._itemNames.push(i);
            }
            return this._recordData;
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.StreamReaderBase.prototype._toJSONProperties, {
            _isTitleRow: { value: "isTitleRow" },
            _delimiter: { value: "delimiter" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.StreamReaderBase.prototype._parseJSONProperties, {
        })
    }
});

// csvファイル（TextReaderの区切り記号を','に固定）
HuTime.CsvReader = function CsvReader (source, isTitleRow) {
    HuTime.TextReader.apply(this, arguments);
};
HuTime.CsvReader.prototype = Object.create(HuTime.TextReader.prototype, {
    constructor: {
        value: HuTime.CsvReader
    },

    _delimiter: {
        writable: true,
        value: ","
    },
    delimiter: {
        get: function() {
            return this._delimiter;
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.TextReader.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.TextReader.prototype._parseJSONProperties, {
        })
    }
});

// tsvファイル（TextReaderの区切り記号を'\t'に固定）
HuTime.TsvReader = function TsvReader (source, isTitleRow) {
    HuTime.TextReader.apply(this, arguments);
};
HuTime.TsvReader.prototype = Object.create(HuTime.TextReader.prototype, {
    constructor: {
        value: HuTime.TsvReader
    },

    _delimiter: {
        writable: true,
        value: "\t"
    },
    delimiter: {
        get: function() {
            return this._delimiter;
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.TextReader.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.TextReader.prototype._parseJSONProperties, {
        })
    }
});

// **** Recordオブジェクト内のデータと読み込みデータの項目（列）との対応や生成方法を指定 ****
HuTime.RecordSettingBase = function RecordSettingBase (itemName, getValue) {
    if (getValue instanceof Function)
        this.getValue = getValue;
    else
        this.getValue = this.getValueDefault;
};
HuTime.RecordSettingBase.prototype = {
    constructor: HuTime.RecordSettingBase,

    itemName: null,                     // 入力側の列名、または列番号
    getValue: function getValue() {},   // 値の取得
    getValueDefault: function(streamRecord) {},
    getValueBase: function(streamRecord, itemName) {
        if (!streamRecord || !itemName)
            return null;
        var itemIndex;  // 項目番号
        if (isFinite(itemName))        // 該当する配列要素の特定
            itemIndex = itemName;      // 直接項目番号が指定された場合（0からの列番号）
        else
            itemIndex = streamRecord.name.indexOf(itemName);       // 項目名が指定された場合

        if (itemIndex < 0 || itemIndex >= streamRecord.value.length)
            return null;    // 不正な項目名指定

        return streamRecord.value[itemIndex];
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        itemName: "itemName"
    },
    _parseJSONProperties: {
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// RecordDataの取得設定
HuTime.RecordDataSetting = function RecordDataSetting (itemName, recordDataName, getValue) {
    HuTime.RecordSettingBase.apply(this, [itemName, getValue]);
    this.itemName = itemName;
    if (recordDataName)
        this.recordDataName = recordDataName;
    else
        this.recordDataName = this.itemName;
};
HuTime.RecordDataSetting.prototype = Object.create(HuTime.RecordSettingBase.prototype, {
    constructor: {
        value: HuTime.RecordDataSetting
    },
    itemName: {             // 入力側の列名、または列番号
        writable: true,
        value: null
    },
    recordDataName: {       // 出力されるデータ項目名
        writable: true,
        value: null
    },
    getValueDefault: {
        value: function (streamRecord) {
            return HuTime.RecordSettingBase.prototype.getValueBase.apply(
                this, [streamRecord, this.itemName]);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.RecordSettingBase.prototype._toJSONProperties, {
            recordDataName: { value: "recordDataName" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordSettingBase.prototype._parseJSONProperties, {
        })
    }
});

// t値の取得設定
HuTime.RecordTSetting = function RecordTSetting (itemNameBegin, itemNameEnd, getValue) {
    HuTime.RecordSettingBase.apply(this, [itemNameBegin, getValue]);
    this.itemNameBegin = itemNameBegin;
    if (itemNameEnd)
        this.itemNameEnd = itemNameEnd;
    else
        this.itemNameEnd = this.itemNameBegin;  // 1つしか指定されていない場合
};
HuTime.RecordTSetting.prototype = Object.create(HuTime.RecordSettingBase.prototype, {
    constructor: {
        value: HuTime.RecordTSetting
    },
    itemNameBegin: {
        writable: true,
        value: null
    },
    itemNameEnd: {
        writable: true,
        value: null
    },
    getValueDefault: {     // TRangeとして出力
        value: function getValue(streamRecord) {
            var begin = HuTime.RecordSettingBase.prototype.getValueBase.apply(
                this, [streamRecord, this.itemNameBegin]);
            var end = HuTime.RecordSettingBase.prototype.getValueBase.apply(
                this, [streamRecord, this.itemNameEnd]);
            if (begin == null || end == null)
                return null;
            return new HuTime.TRange.createFromBeginEnd(begin, end);
        }
    },

    _toJSONProperties: {
        value: {
            itemNameBegin: "itemNameBegin",
            itemNameEnd: "itemNameEnd"
        }
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordSettingBase.prototype._parseJSONProperties, {
        })
    }
});

// t値の取得設定（あいまいな時間）
HuTime.RecordUTSetting = function RecordUTSetting (
    itemNamePBegin, itemNameRBegin, itemNameREnd, itemNamePEnd, getValue) {
    HuTime.RecordSettingBase.apply(this, [itemNamePBegin, getValue]);
    this.itemNamePBegin = itemNamePBegin;
    this.itemNameRBegin = itemNameRBegin;
    this.itemNameREnd = itemNameREnd;
    this.itemNamePEnd = itemNamePEnd;
};
HuTime.RecordUTSetting.prototype = Object.create(HuTime.RecordTSetting.prototype, {
    constructor: {
        value: HuTime.RecordUTSetting
    },
    itemNamePBegin: {
        writable: true,
        value: null
    },
    itemNameRBegin: {
        writable: true,
        value: null
    },
    itemNameREnd: {
        writable: true,
        value: null
    },
    itemNamePEnd: {
        writable: true,
        value: null
    },
    getValueDefault: {     // TRangeとして出力
        value: function getValue(streamRecord) {
            var pBegin = HuTime.RecordSettingBase.prototype.getValueBase.apply(
                this, [streamRecord, this.itemNamePBegin]);
            var rBegin = HuTime.RecordSettingBase.prototype.getValueBase.apply(
                this, [streamRecord, this.itemNameRBegin]);
            var rEnd = HuTime.RecordSettingBase.prototype.getValueBase.apply(
                this, [streamRecord, this.itemNameREnd]);
            var pEnd = HuTime.RecordSettingBase.prototype.getValueBase.apply(
                this, [streamRecord, this.itemNamePEnd]);

            if (pBegin == null || rBegin == null || rEnd == null || pEnd == null)
                return null;
            return new HuTime.TRange(pBegin, rBegin, rEnd, pEnd);
        }
    },

    _toJSONProperties: {
        value: {
            itemNamePBegin: "itemNamePBegin",
            itemNameRBegin: "itemNameRBegin",
            itemNameREnd: "itemNameREnd",
            itemNamePEnd: "itemNamePEnd"
        }
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordTSetting.prototype._parseJSONProperties, {
        })
    }
});

// t値の取得設定（暦データ）
HuTime.RecordTCalendarSetting = function RecordTCalendarSetting (itemNameBegin, itemNameEnd, getValue) {
    HuTime.RecordTSetting.apply(this, arguments);
};
HuTime.RecordTCalendarSetting.prototype = Object.create(HuTime.RecordTSetting.prototype, {
    constructor: {
        value: HuTime.RecordTCalendarSetting
    },
    getValueDefault: {     // TRangeとして出力
        value: function getValue(streamRecord) {
            var beginRange = HuTime.isoToJdRange(
                HuTime.RecordSettingBase.prototype.getValueBase.apply(
                    this, [streamRecord, this.itemNameBegin]));
            var endRange = HuTime.isoToJdRange(
                HuTime.RecordSettingBase.prototype.getValueBase.apply(
                    this, [streamRecord, this.itemNameEnd]));

            if (isNaN(beginRange[0]) || isNaN(endRange[1]))
                return null;
            return new HuTime.TRange.createFromBeginEnd(beginRange[0], endRange[1]);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.RecordTSetting.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordTSetting.prototype._parseJSONProperties, {
        })
    }
});

// t値の取得設定（暦データ・あいまいな時間）
HuTime.RecordUTCalendarSetting = function RecordUTCalendarSetting (
    itemNamePBegin, itemNameRBegin, itemNameREnd, itemNamePEnd, getValue) {
    HuTime.RecordUTSetting.apply(this, arguments);
};
HuTime.RecordUTCalendarSetting.prototype = Object.create(HuTime.RecordUTSetting.prototype, {
    constructor: {
        value: HuTime.RecordUTCalendarSetting
    },
    getValueDefault: {     // TRangeとして出力
        value: function getValue(streamRecord) {
            var bBegin = HuTime.isoToJdRange(
                HuTime.RecordSettingBase.prototype.getValueBase.apply(
                    this, [streamRecord, this.itemNamePBegin]));
            var bEnd = HuTime.isoToJdRange(
                HuTime.RecordSettingBase.prototype.getValueBase.apply(
                    this, [streamRecord, this.itemNameRBegin]));
            var eBegin = HuTime.isoToJdRange(
                HuTime.RecordSettingBase.prototype.getValueBase.apply(
                    this, [streamRecord, this.itemNameREnd]));
            var eEnd = HuTime.isoToJdRange(
                HuTime.RecordSettingBase.prototype.getValueBase.apply(
                    this, [streamRecord, this.itemNamePEnd]));

            if (bBegin[0] == null || bEnd[1] == null || eBegin[0] == null || eEnd[1] == null)
                return null;
            return new HuTime.TRange(bBegin[0], bEnd[1], eBegin[0], eEnd[1]);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.RecordUTSetting.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordUTSetting.prototype._parseJSONProperties, {
        })
    }
});


// 設定を収容するコンテナ
HuTime.RecordSettings = function RecordSettings () {
    this._dataSettings = [];
};
HuTime.RecordSettings.prototype = {
    constructor: HuTime.RecordSettings,

    _tSetting: null,            // t値に関する設定
    get tSetting() {
        return this._tSetting;
    },
    set tSetting(val) {
        if (!(val instanceof HuTime.RecordTSetting))
            return;
        this._tSetting = val;
    },
    _dataSettings: null,        // RecordDataに関する設定の配列
    get dataSettings() {
        return this._dataSettings;
    },
    appendDataSetting: function appendSetting(setting) {
        this._dataSettings.push(setting);
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        _tSetting: "tSetting",
        _dataSettings: "dataSettings"
    },
    _parseJSONProperties: {
        dataSettings: "_dataSettings"
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};
