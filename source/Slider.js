
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

