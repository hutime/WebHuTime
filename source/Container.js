
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

        if (!(this instanceof HuTime.PanelCollection)) {    // 互換性のため暫定的にPanelCollectionをはずす
            for (let i = 0; i < this._contents.length; ++i) {
                this._contents[i]._contentsIndex = i;
            }
        }
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
            if (panel instanceof HuTime.PanelBase)
                HuTime.ContainerBase.prototype.appendContent.apply(this, arguments);    // 継承元を直接呼び出す
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
            return this._hutimeRoot.minT -
                (this._hutimeRoot.maxT - this._hutimeRoot.minT) * (this.tRatio - 1) / 2 ;
        }
    },
    maxPnlT: {      // 表示幅の拡大率を反映させたPanelのt軸の表示範囲（最大値）
        get: function() {
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
