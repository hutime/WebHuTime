// ********************************
// WebHuTime
// Copyright (C) 2016-2017 Tatsuki Sekino.
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

    _handleMouseEvent: function (domEv) {     // マウスイベントの処理
        // イベントの抽出とtypeを特定し、配列に収容
        var eventInfos = domEv.target.hutimeObject._extractMouseEvent(domEv, domEv.offsetX, domEv.offsetY);
        var newEv;          // 新たに発火させるための拡張されたのイベントオブジェクト

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

        // /* !!!!!!!! 開発用（抽出したイベントのモニタ）!!!!!!!!
        if ("___monitorEvent" in window)
            ___monitorEvent(ev);
        // !!!!!!!! 開発用ここまで !!!!!!!! */

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

    mouseTimeOut: 300,  // タイマの設定値（ms）
    _mouseTimer: null   // タイマ
};

