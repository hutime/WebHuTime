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
    var blocks = iso.trim().split(["T"]);
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
                bJd = HuTime.timeToJd(year, month, day, 0, 0, 0, type);
                bJd = HuTime.timeToJd(year + 1, month, day, 0, 0, 0, type);
            }
        }
        else {
            bJd = Number.NaN;
            eJd = Number.NaN;
        }
    }
    return [bJd, eJd];
};

