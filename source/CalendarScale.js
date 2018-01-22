
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
