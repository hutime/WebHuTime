
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
    toJSON: function toJSON () {
        return {
            constructor: this.constructor.name,
            id: this.id,
            name: this.name,
            position: this.position,
            rotate: this.rotate,
            style: this.style,
            zIndex: this.zIndex,
            visible: this._visible
        };
    },
    parseJSON: function parseJSON (json) {
        this.id = json.id;
        this.name = json.name;
        this.position = HuTime.PositionBase.createFromJSON(json.position);
        this.rotate = json.rotate;
        this.style = HuTime.Style.createFromJSON(json.style);
        this.zIndex = json.zIndex;
        this._visible = json.visible;
    }
};
HuTime.OnLayerObjectBase.createFromJSON = function createFromJSON (json ) {
    if (typeof json === "string")
        json = JSON.parse(json);
    switch (json.constructor) {
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

        default:
            return null;
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

    toJSON: {
        value: function toJSON () {
            var json = HuTime.OnLayerObjectBase.prototype.toJSON.apply(this);
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON (json) {
            this.position = [];
            for (var i = 0; i < json.position.length; ++i) {
                this.position.push(HuTime.PositionBase.createFromJSON(json.position[i]));
            }
        }
    }
});
HuTime.Line.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.Line();
    obj.parseJSON(json);
    return obj;
};

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

    toJSON: {
        value: function toJSON () {
            var json = HuTime.OnLayerObjectBase.prototype.toJSON.apply(this);
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON (json) {
            this.position = [];
            for (var i = 0; i < json.position.length; ++i) {
                this.position.push(HuTime.PositionBase.createFromJSON(json.position[i]));
            }
        }
    }
});
HuTime.Polygon.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.Polygon();
    obj.parseJSON(json);
    return obj;
};

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

    toJSON: {
        value: function toJSON () {
            var json = HuTime.OnLayerObjectBase.prototype.toJSON.apply(this);
            json.width = this.width;
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON(json) {
            this.position = HuTime.PositionBase.createFromJSON(json.position);
            this.width = json.width;
        }
    }
});
HuTime.Square.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.Square();
    obj.parseJSON(json);
    return obj;
};

// **** 矩形オブジェクト ****
HuTime.Rect = function Rect (style, position1, position2, width, rotate) {
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

    toJSON: {
        value: function toJSON () {
            var json = HuTime.OnLayerObjectBase.prototype.toJSON.apply(this);
            json.position2 = this.position2;
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON (json) {
            this.position = HuTime.PositionBase.createFromJSON(json.position);
            this.position2 = HuTime.PositionBase.createFromJSON(json.position2);
        }
    }
});
HuTime.Rect.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.Rect();
    obj.parseJSON(json);
    return obj;
};

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

    toJSON: {
        value: function toJSON () {
            var json = HuTime.OnLayerObjectBase.prototype.toJSON.apply(this);
            json.width = this.width;
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON(json) {
            this.position = HuTime.PositionBase.createFromJSON(json.position);
            this.width = json.width;
        }
    }
});
HuTime.Circle.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.Circle();
    obj.parseJSON(json);
    return obj;
};

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

    toJSON: {
        value: function toJSON () {
            var json = HuTime.OnLayerObjectBase.prototype.toJSON.apply(this);
            json.radius = this.radius;
            json.startAngle = this.startAngle;
            json.endAngle = this.endAngle;
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON(json) {
            this.position = HuTime.PositionBase.createFromJSON(json.position);
            this.radius = json.radius;
            this.startAngle = json.startAngle;
            this.endAngle = json.endAngle;
        }
    }
});
HuTime.Arc.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.Arc();
    obj.parseJSON(json);
    return obj;
};

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

    toJSON: {
        value: function toJSON () {
            var json = HuTime.OnLayerObjectBase.prototype.toJSON.apply(this);
            json.radius = this.radius;
            json.startAngle = this.startAngle;
            json.endAngle = this.endAngle;
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON(json) {
            this.position = HuTime.PositionBase.createFromJSON(json.position);
            this.radius = json.radius;
            this.startAngle = json.startAngle;
            this.endAngle = json.endAngle;
        }
    }
});
HuTime.Pie.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.Pie();
    obj.parseJSON(json);
    return obj;
};

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

    toJSON: {
        value: function toJSON () {
            var json = HuTime.OnLayerObjectBase.prototype.toJSON.apply(this);
            json.width = this.width;
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON(json) {
            this.position = HuTime.PositionBase.createFromJSON(json.position);
            this.width = json.width;
        }
    }
});
HuTime.Triangle.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.Triangle();
    obj.parseJSON(json);
    return obj;
};

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

    toJSON: {
        value: function toJSON () {
            var json = HuTime.OnLayerObjectBase.prototype.toJSON.apply(this);

            // 絶対パスのを出力
            var elem = document.createElement("img");
            elem.src = this.src;
            json.src = elem.src;
            json.width = this.width;
            json.height = this.height;
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON(json) {
            this.position = HuTime.PositionBase.createFromJSON(json.position);
            this.src = json.src;
            this.width = json.width;
            this.height = json.height;
        }
    }
});
HuTime.Image.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.Image();
    obj.parseJSON(json);
    return obj;
};

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

    toJSON: {
        value: function toJSON () {
            var json = HuTime.OnLayerObjectBase.prototype.toJSON.apply(this);
            json.text = this.text;
            return json;
        }
    },
    parseJSON: {
        value: function parseJSON(json) {
            this.position = HuTime.PositionBase.createFromJSON(json.position);
            this.text = json.text;
        }
    }
});
HuTime.String.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.String();
    obj.parseJSON(json);
    return obj;
};

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
        style.applyStyle(ctx, text.toString());
        ctx.rotate(-rotate * HuTime.Drawing._constDegToRad);
        ctx.translate(-cnvX, -cnvY);
    }
};

//  ******** 書式（JSON出力用） ********
HuTime.Style = function Style () {
};
HuTime.Style.prototype = {
    constructor: HuTime.Style
};
HuTime.Style.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    switch (json.constructor) {
        case "FigureStyle":
            return HuTime.FigureStyle.createFromJSON(json);

        case "StringStyle":
            return HuTime.StringStyle.createFromJSON(json);

        default:
            return null;
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
        constructor: function (json) {
            json["constructor"] = "FigureStyle";
        },
        _lineWidth: "lineWidth",
        lineWidth: null,
        lineColor: "lineColor",
        _lineDash: "lineDash",
        lineDash: null,
        fillColor: "fillColor",
        _alpha: "alpha",
        alpha: null,

        _applyStyle: null,
        applyStyle: null,
        defaultApplyStyle: null,

        _applyFillStyle: null,
        applyFillStyle: null,
        defaultApplyFillStyle: null,

        _applyLineStyle: null,
        applyLineStyle: null,
        defaultApplyLineStyle: null,

        _toJSONProperties: null,
        _parseJSONProperties: null,
        toJSON: null,
        parseJSON: null
    },
    _parseJSONProperties: {
        lineWidth: "_lineWidth",
        lineDash: "_lineDash",
        alpha: "_alpha"
    },
    toJSON: function toJSON () {
        var json = {
            constructor: "FigureStyle"
        };
        for (var prop in this) {
            HuTime.JSON.stringifyProperty(prop, this, HuTime.FigureStyle.prototype, json);
        }
        return json;
    },
    parseJSON: function parseJSON (json) {
        for (var prop in json) {
            HuTime.JSON.parseProperty(prop, this, HuTime.FigureStyle.prototype, json);
        }
    }
};
HuTime.FigureStyle.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.FigureStyle();
    obj.parseJSON(json);
    return obj;
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
        constructor: function (json) {
            json["constructor"] = "StringStyle";
        },
        _fontSize: "fontSize",
        fontSize: null,
        _fontStyle: "fontStyle",
        fontStyle: null,
        _fontWeight: "fontWeight",
        fontWeight: null,
        _fontFamily: "fontFamily",
        fontFamily: null,
        _fontVariant: "fontVariant",
        fontVariant: null,
        _lineHeight: "lineHeight",
        lineHeight: null,
        font: null,

        _textAlign: "textAlign",
        textAlign: null,
        _textBaseline: "textBaseline",
        textBaseline: null,

        _fillColor: "fillColor",
        fillColor: null,
        _lineWidth: "lineWidth",
        lineWidth: null,
        _lineColor: "lineColor",
        lineColor: null,
        _alpha: "alpha",
        alpha: null,

        _applyStyle: null,
        applyStyle: null,
        defaultApplyStyle: null,

        _toJSONProperties: null,
        _parseJSONProperties: null,
        toJSON: null,
        parseJSON: null
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
        var json = {
            constructor: "StringStyle"
        };
        for (var prop in this) {
            HuTime.JSON.stringifyProperty(prop, this, HuTime.StringStyle.prototype, json);
        }
        return json;
    },
    parseJSON: function parseJSON (json) {
        for (var prop in json) {
            HuTime.JSON.parseProperty(prop, this, HuTime.StringStyle.prototype, json);
        }
    }
};
HuTime.StringStyle.createFromJSON = function createFromJSON (json) {
    if (typeof json === "string")
        json = JSON.parse(json);
    var obj = new HuTime.StringStyle();
    obj.parseJSON(json);
    return obj;
};
