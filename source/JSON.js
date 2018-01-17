
// JSON関係
HuTime.JSON = {
    // シリアライズ
    stringify: function stringify (obj) {
        return JSON.stringify(obj);
    },

    stringifyProperty: function stringifyProperty(prop, obj, ptype, json) {
        if (ptype._toJSONProperties.hasOwnProperty(prop)) {  // 自身のプロパティ変換定義
            if (ptype._toJSONProperties[prop] == null)
                return;
            if (typeof ptype._toJSONProperties[prop] === "string") {
                if (obj[prop] == ptype[prop])
                    return;
                json[ptype._toJSONProperties[prop]] = obj[prop];
            }
            else if (typeof ptype._toJSONProperties[prop] === "function") {
                ptype._toJSONProperties[prop].apply(obj, [json]);
            }
        }
        else {
            if (ptype._toJSONProperties.hasOwnProperty("parentPrototype"))
                return HuTime.JSON.stringifyProperty(prop, obj, ptype._toJSONProperties.parentPrototype, json);

            json[prop] = obj[prop];
        }
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

    parseProperty: function parseProperty (prop, obj, ptype, json) {
        if (prop == "constructor")
            return;
        if (ptype._parseJSONProperties.hasOwnProperty(prop)) {
            if (ptype._parseJSONProperties[prop] == null)
                return;
            if (typeof ptype._parseJSONProperties[prop] === "string") {
                obj[ptype._parseJSONProperties[prop]] = json[prop];
            }
            else if (typeof ptype._parseJSONProperties[prop] === "function") {
                ptype._parseJSONProperties[prop].apply(obj, [json]);
            }
        }
        else {
            if (ptype._parseJSONProperties.hasOwnProperty("parentPrototype"))
                return HuTime.JSON.parseProperty(prop, obj, ptype._parseJSONProperties.parentPrototype, json);
            obj[prop] = json[prop];
        }
    },

    // シリアライズデータの保存
    save: function save (obj) {
        var content =  JSON.stringify(obj);
        var blob = new Blob([ content ], { "type" : "application/json" });
        var elm = document.createElement("a");  // a要素を作って、一時的にbody要素直下に置く
        document.body.appendChild(elm);
        elm.href = window.URL.createObjectURL(blob);
        elm.download="data.json";
        elm.click();
        document.body.removeChild(elm);
    }
};
HuTime.JSON.Reader = function Reader (source) {
    this.source = source;
};
HuTime.JSON.Reader.prototype = {
    _stream: null,
    get stream () {
        return this._stream;
    },
    set stream (val) {
        if (!(val instanceof HuTime.StreamBase))
            return;
        this._stream = val;
        this._stream.onloadend = function () {
            this._loadedObject = HuTime.JSON.parse(this._stream.readAll());
            this.onloadend.apply(this);
        }.bind(this);
    },

    _source: null,
    get source () {
        return this._source;
    },
    set source (val) {
        if (typeof  val === "string" && val != "")
            this.stream = new HuTime.HttpStream(val);
        else if (val instanceof File)
            this.stream = new HuTime.FileStream(val);
        else if (val instanceof HuTime.StreamBase)
            this.stream = val;
        else
            return;
        this._source = val;
    },

    get loadState () {
        return this._stream.loadState;
    },

    _loadedObject: null,
    get loadedObject () {
        if (this._stream.loadState == "loadend")
            return this._loadedObject;
        else
            return null;
    },

    load: function load () {
        this._stream.load();
    },
    onloadend: function onloadend () {}
};
