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
                this.useRemoteDataForJSON == null && this.reader.stream instanceof HuTime.HttpStream)
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
