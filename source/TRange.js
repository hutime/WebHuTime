// Time Interval Algebra
HuTime.TRangeAlgebra = {
    // 期間間の関係
    Relation: {
        // 上位・下位8ビットが逆の関係になるように対応付け（equalsを除く）
        Before: 2,
        After: 512,
        During: 4,
        Contains: 2048,
        Overlaps: 8,
        OverlappedBy: 4096,
        Meets: 16,
        MetBy: 8192,
        Starts: 32,
        StartedBy: 16384,
        Finishes: 64,
        FinishedBy: 32768,
        Equals: 1
    },

    // 期間長の大小関係
    Comp: {
        Shorter: 2,
        Longer: 512,
        Same: 1
    },

    // 端点の指定
    Edge: {
        Begin: 1,
        End: 2
    },

    // ** 期間間の関係 **
    // 期間間の確実関係の検証（relationは単独の関係のみ）
    isReliableRelation: function isReliableRelation (s, t, relation) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange))
            return false;

        // 複数の関係を指定してないかをチェック
        var r = relation;
        while (r > 1) {
            r /= 2;
        }
        if (r < 1)
            return false;

        // a, bのセット（逆関係の場合は入れ替え）
        var a, b;
        if (relation <= 256) {
            a = s;
            b = t;
        }
        else {
            relation >>>= 8;
            a = t;
            b = s;
        }

        // 評価
        switch (relation) {
            case HuTime.TRangeAlgebra.Relation.Before:
                return a._pEnd < b._pBegin;
            case HuTime.TRangeAlgebra.Relation.During:
                return a._pBegin > b._rBegin && a._pEnd < b._rEnd;
            case HuTime.TRangeAlgebra.Relation.Overlaps:
                return a._rBegin < b._pBegin && a._rEnd > b._rBegin && a._pEnd < b._rEnd;
            case HuTime.TRangeAlgebra.Relation.Meets:
                return a._rEnd == a._pEnd && a._pEnd == b._pBegin && b._pBegin == b._rBegin &&
                    a._rBegin < b._pBegin && a._pEnd < b._rEnd;
            case HuTime.TRangeAlgebra.Relation.Starts:
                return a._pBegin == a._rBegin && a._rBegin == b._pBegin && b._pBegin == b._rBegin && a._pEnd < b._rEnd;
            case HuTime.TRangeAlgebra.Relation.Finishes:
                return a._pBegin > b._rBegin && a._rEnd == a._pEnd && a._pEnd == b._rEnd && b._rEnd == b._pEnd;
            case HuTime.TRangeAlgebra.Relation.Equals:
                return a._pBegin == a._rBegin && a._rBegin == b._pBegin && b._pBegin == b._rBegin &&
                    a._rEnd == a._pEnd && a._pEnd == b._rEnd && b._rEnd == b._pEnd;
            default:
                return false;
        }
    },

    // 期間間の可能関係の検証（relationは複数の関係を設定可）
    isPossibleRelation: function isPossibleRelation (s, t, relation) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange) || !isFinite(relation))
            return false;

        if ((relation & HuTime.TRangeAlgebra.Relation.Before) != 0
            && (s._rEnd >= t._rBegin))
                return false;
        if ((relation & HuTime.TRangeAlgebra.Relation.After) != 0
            && (t._rEnd >= s._rBegin))
            return false;
        if ((relation & HuTime.TRangeAlgebra.Relation.During) != 0
            && (s._rBegin <= t._pBegin || s._rEnd >= t._pEnd))
            return false;
        if ((relation & HuTime.TRangeAlgebra.Relation.Contains) != 0
            && (t._rBegin <= s._pBegin || t._rEnd >= s._pEnd))
            return false;
        if ((relation & HuTime.TRangeAlgebra.Relation.Overlaps) != 0
            && (s._pBegin >= t._rBegin || s._pEnd <= t._pBegin || s._rEnd >= t._pEnd))
            return false;
        if ((relation & HuTime.TRangeAlgebra.Relation.OverlappedBy) != 0
            && (t._pBegin >= s._rBegin || t._pEnd <= s._pBegin || t._rEnd >= s._pEnd))
            return false;
        if ((relation & HuTime.TRangeAlgebra.Relation.Meets) != 0
            && (s._rEnd > t._rBegin || s._pEnd < t._pBegin || s._rEnd >= t._pEnd))
            return false;
        if ((relation & HuTime.TRangeAlgebra.Relation.MetBy) != 0
            && (t._rEnd > s._rBegin || t._pEnd < s._pBegin || t._rEnd >= s._pEnd))
            return false;
        if ((relation & HuTime.TRangeAlgebra.Relation.Starts) != 0
            && (s._pBegin > t._rBegin || s._rBegin < t._pBegin || s._rEnd >= t._pEnd))
            return false;
        if ((relation & HuTime.TRangeAlgebra.Relation.StartedBy) != 0
            && (t._pBegin > s._rBegin || t._rBegin < s._pBegin || t._rEnd >= s._pEnd))
            return false;
        if ((relation & HuTime.TRangeAlgebra.Relation.Finishes) != 0
            && (s._rBegin <= t._pBegin || s._rEnd > t._pEnd || s._pEnd < t._rEnd))
            return false;
        if ((relation & HuTime.TRangeAlgebra.Relation.FinishedBy) != 0
            && (t._rBegin <= s._pBegin || t._rEnd > s._pEnd || t._pEnd < s._rEnd))
            return false;
        if ((relation & HuTime.TRangeAlgebra.Relation.Equals) != 0
            && (s._pBegin > t._rBegin || s._rBegin < t._pBegin || s._rEnd > t._pEnd || s._pEnd < t._rEnd))
            return false;
        return true;
    },

    // 期間間の関係の取得（１つならreliable, 2つ以上ならpossible）
    getRelation: function getRelation (s, t) {
        var relation = 0;

        if ((s._rEnd < t._rBegin))
            relation |= HuTime.TRangeAlgebra.Relation.Before;
        if ((t._rEnd < s._rBegin))
            relation |= HuTime.TRangeAlgebra.Relation.After;
        if ((s._rBegin > t._pBegin && s._rEnd < t._pEnd))
            relation |= HuTime.TRangeAlgebra.Relation.During;
        if ((t._rBegin > s._pBegin && t._rEnd < s._pEnd))
            relation |= HuTime.TRangeAlgebra.Relation.Contains;
        if ((s._pBegin < t._rBegin && s._pEnd > t._pBegin && s._rEnd < t._pEnd))
            relation |= HuTime.TRangeAlgebra.Relation.Overlaps;
        if ((t._pBegin < s._rBegin && t._pEnd > s._pBegin && t._rEnd < s._pEnd))
            relation |= HuTime.TRangeAlgebra.Relation.OverlappedBy;
        if ((s._rEnd <= t._rBegin && s._pEnd >= t._pBegin && s._rEnd < t._pEnd))
            relation |= HuTime.TRangeAlgebra.Relation.Meets;
        if ((t._rEnd <= s._rBegin && t._pEnd >= s._pBegin && t._rEnd < s._pEnd))
            relation |= HuTime.TRangeAlgebra.Relation.MetBy;
        if ((s._pBegin <= t._rBegin && s._rBegin >= t._pBegin && s._rEnd < t._pEnd))
            relation |= HuTime.TRangeAlgebra.Relation.Starts;
        if ((t._pBegin <= s._rBegin && t._rBegin >= s._pBegin && t._rEnd < s._pEnd))
            relation |= HuTime.TRangeAlgebra.Relation.StartedBy;
        if ((s._rBegin > t._pBegin && s._rEnd <= t._pEnd && s._pEnd >= t._rEnd))
            relation |= HuTime.TRangeAlgebra.Relation.Finishes;
        if ((t._rBegin > s._pBegin && t._rEnd <= s._pEnd && t._pEnd >= s._rEnd))
            relation |= HuTime.TRangeAlgebra.Relation.FinishedBy;
        if ((s._pBegin <= t._rBegin && s._rBegin >= t._pBegin && s._rEnd <= t._pEnd && s._pEnd >= t._rEnd))
            relation |= HuTime.TRangeAlgebra.Relation.Equals;

        return relation;
    },

    // 期間間の関係に基づく更新（tとrelationに基づいて更新されたs）
    getTRangeRefinedByRelation: function getTRangeRefinedByRelation (s, t, relation) {
        if (!HuTime.TRangeAlgebra.isPossibleRelation(s, t, relation))
            return s;   // 基になる関係が可能でなければ、更新なし

        var a = null;   // 結果
        if ((relation & HuTime.TRangeAlgebra.Relation.Before) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = s._pBegin;
                a._rBegin = s._rBegin;
                a._rEnd = s._rEnd;
                a._pEnd = Math.min(s._pEnd, t._rBegin);
            }
            else {
                a._pEnd = Math.max(a._pEnd, Math.min(s._pEnd, t._rBegin));
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.After) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = Math.max(s._pBegin, t._rEnd);
                a._rBegin = s._rBegin;
                a._rEnd = s._rEnd;
                a._pEnd = s._pEnd;
            }
            else {
                a._pBegin = Math.min(a._pBegin, Math.max(s._pBegin, t._rEnd));
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.During) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = Math.max(s._pBegin, t._pBegin);
                a._rBegin = s._rBegin;
                a._rEnd = s._rEnd;
                a._pEnd = Math.min(s._pEnd, t._pEnd);
            }
            else {
                a._pBegin = Math.min(a._pBegin, Math.max(s._pBegin, t._pBegin));
                a._pEnd = Math.max(a._pEnd, Math.min(s._pEnd, t._pEnd));
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Contains) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = s._pBegin;
                a._rBegin = Math.min(s._rBegin, t._rBegin);
                a._rEnd = Math.max(s._rEnd, t._rEnd);
                a._pEnd = s._pEnd;
            }
            else {
                a._rBegin = Math.max(a._rBegin, Math.min(s._rBegin, t._rBegin));
                a._rEnd = Math.min(a._rEnd, Math.max(s._rEnd, t._rEnd));
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Overlaps) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = s._pBegin;
                a._rBegin = Math.min(s._rBegin, t._rBegin);
                a._rEnd = Math.max(s._rEnd, t._pBegin);
                a._pEnd = Math.min(s._pEnd, t._pEnd);
            }
            else {
                a._rBegin = Math.max(a._rBegin, Math.min(s._rBegin, t._rBegin));
                a._rEnd = Math.min(a._rEnd, Math.max(s._rEnd, t._pBegin));
                a._pEnd = Math.max(a._pEnd, Math.min(s._pEnd, t._pEnd));
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.OverlappedBy) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = Math.max(s._pBegin, t._pBegin);
                a._rBegin = Math.min(s._rBegin, t._pEnd);
                a._rEnd = Math.max(s._rEnd, t._rEnd);
                a._pEnd = s._pEnd;
            }
            else {
                a._pBegin = Math.min(a._pBegin, Math.max(s._pBegin, t._pBegin));
                a._rBegin = Math.max(a._rBegin, Math.min(s._rBegin, t._pEnd));
                a._rEnd = Math.min(a._rEnd, Math.max(s._rEnd, t._rEnd));
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Meets) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = s._pBegin;
                a._rBegin = Math.min(s._rBegin, t._rBegin);
                a._rEnd = Math.max(s._rEnd, t._pBegin);
                a._pEnd = Math.min(s._pEnd, t._rBegin);
            }
            else {
                a._rBegin = Math.max(a._rBegin, Math.min(s._rBegin, t._rBegin));
                a._rEnd = Math.min(a._rEnd, Math.max(s._rEnd, t._pBegin));
                a._pEnd = Math.max(a._pEnd, Math.min(s._pEnd, t._rBegin));
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.MetBy) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = Math.max(s._pBegin, t._rEnd);
                a._rBegin = Math.min(s._rBegin, t._pEnd);
                a._rEnd = s._rEnd;
                a._pEnd = Math.max(s._pEnd, t._pEnd);
            }
            else {
                a._pBegin = Math.min(a._pBegin, Math.max(s._pBegin, t._rEnd));
                a._rBegin = Math.max(a._rBegin, Math.min(s._rBegin, t._pEnd));
                a._pEnd = Math.min(a._pEnd, Math.max(s._pEnd, t._pEnd));
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Starts) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = Math.max(s._pBegin, t._pBegin);
                a._rBegin = Math.min(s._rBegin, t._rBegin);
                a._rEnd = s._rEnd;
                a._pEnd = Math.min(s._pEnd, t._pEnd);
            }
            else {
                a._pBegin = Math.min(a._pBegin, Math.max(s._pBegin, t._pBegin));
                a._rBegin = Math.max(a._rBegin, Math.min(s._rBegin, t._rBegin));
                a._pEnd = Math.max(a._pEnd, Math.min(s._pEnd, t._pEnd));
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.StartedBy) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = Math.max(s._pBegin, t._pBegin);
                a._rBegin = Math.min(s._rBegin, t._rBegin);
                a._rEnd = Math.max(s._rEnd, t._rEnd);
                a._pEnd = s._pEnd;
            }
            else {
                a._pBegin = Math.min(a._pBegin, Math.max(s._pBegin, t._pBegin));
                a._rBegin = Math.max(a._rBegin, Math.min(s._rBegin, t._rBegin));
                a._rEnd = Math.min(a._rEnd, Math.max(s._rEnd, t._rEnd));
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Finishes) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = Math.max(s._pBegin, t._pBegin);
                a._rBegin = s._rBegin;
                a._rEnd = Math.max(s._rEnd, t._rEnd);
                a._pEnd = Math.min(s._pEnd, t._pEnd);
            }
            else {
                a._pBegin = Math.min(a._pBegin, Math.max(s._pBegin, t._pBegin));
                a._rEnd = Math.min(a._rEnd, Math.max(s._rEnd, t._rEnd));
                a._pEnd = Math.max(a._pEnd, Math.min(s._pEnd, t._pEnd));
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.FinishedBy) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = s._pBegin;
                a._rBegin = Math.min(s._rBegin, t._rBegin);
                a._rEnd = Math.max(s._rEnd, t._rEnd);
                a._pEnd = Math.min(s._pEnd, t._pEnd);
            }
            else {
                a._rBegin = Math.max(a._rBegin, Math.min(s._rBegin, t._rBegin));
                a._rEnd = Math.min(a._rEnd, Math.max(s._rEnd, t._rEnd));
                a._pEnd = Math.max(a._pEnd, Math.min(s._pEnd, t._pEnd));
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Equals) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = Math.max(s._pBegin, t._pBegin);
                a._rBegin = Math.min(s._rBegin, t._rBegin);
                a._rEnd = Math.max(s._rEnd, t._rEnd);
                a._pEnd = Math.min(s._pEnd, t._pEnd);
            }
            else {
                a._pBegin = Math.min(a._pBegin, Math.max(s._pBegin, t._pBegin));
                a._rBegin = Math.max(a._rBegin, Math.min(s._rBegin, t._rBegin));
                a._rEnd = Math.min(a._rEnd, Math.max(s._rEnd, t._rEnd));
                a._pEnd = Math.max(a._pEnd, Math.min(s._pEnd, t._pEnd));
            }
        }
        return a;
    },

    // ** 期間長 **
    // 期間長の確実関係の検証
    isReliableDuration: function isReliableDuration (s, duration, comp) {
        if (!(s instanceof HuTime.TRange) || !(duration instanceof HuTime.TDuration))
            return false;

        switch (comp) {
            case HuTime.TRangeAlgebra.Comp.Shorter:
                return s._pEnd - s._pBegin < duration._lower;
            case HuTime.TRangeAlgebra.Comp.Same:
                return Math.max(s._rEnd - s._rBegin, 0) == s._pEnd - s._pBegin &&
                    s._pEnd - s._pBegin == duration._lower && duration._lower == duration._upper;
            case HuTime.TRangeAlgebra.Comp.Longer:
                return Math.max(s._rEnd - s._rBegin, 0) > duration._upper;
            default:
                return false;
        }
    },

    // 期間長の可能関係の検証
    isPossibleDuration: function isPossibleDuration (s, duration, comp) {
        if (!(s instanceof HuTime.TRange) || !(duration instanceof HuTime.TDuration))
            return false;
        var min = Math.max(s._rEnd - s._rBegin, 0);
        var max = s._pEnd - s._pBegin;

        if ((comp & HuTime.TRangeAlgebra.Comp.Shorter) != 0
            && (min >= duration._upper))
            return false;
        if ((comp & HuTime.TRangeAlgebra.Comp.Same) != 0
            && (max < duration._lower || min > duration._lower))
            return false;
        if ((comp & HuTime.TRangeAlgebra.Comp.Longer) != 0
            && (max <= duration._lower))
            return false;
        return true;
    },

    // 期間長の関係の取得（１つならreliable, 2つ以上ならpossible）
    getDurationComp: function getDurationComp (s, duration) {
        if (!(s instanceof HuTime.TRange) || !(duration instanceof HuTime.TDuration))
            return false;
        var min = Math.max(s._rEnd - s._rBegin, 0);
        var max = s._pEnd - s._pBegin;
        var comp = 0;

        if ((min < duration._upper))
            comp |= HuTime.TRangeAlgebra.Comp.Shorter;
        if ((min <= duration._upper && max >= duration._lower))
            comp |= HuTime.TRangeAlgebra.Comp.Same;
        if ((max > duration._lower))
            comp |= HuTime.TRangeAlgebra.Comp.Longer;
        return comp;
    },

    // 期間長の関係に基づく更新（durationとcompに基づいて更新されたs）
    getTRangeRefinedByDuration: function getTRangeRefinedByDuration (s, duration, comp) {
        if (!HuTime.TRangeAlgebra.isPossibleDuration(s, duration, comp))
            return s;   // 基になる関係が可能でなければ、更新なし

        var a = null;
        if ((comp & HuTime.TRangeAlgebra.Comp.Shorter) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = Math.max(s._pBegin, s._rEnd - duration._upper);
                a._rBegin = s._rBegin;
                a._rEnd = s._rEnd;
                a._pEnd = Math.min(s._pEnd, s._rBegin + duration._upper);
            }
            else {
                a._pBegin = Math.min(a._pBegin, Math.max(s._pBegin, s._rEnd - duration._upper));
                a._pEnd = Math.max(a._pEnd, Math.min(s._pEnd, s._rBegin + duration._upper));
            }
        }
        if ((comp & HuTime.TRangeAlgebra.Comp.Same) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = Math.max(s._pBegin, s._rEnd - duration._upper);
                a._rBegin = Math.min(s._rBegin, s._pEnd - duration._lower);
                a._rEnd = Math.max(s._rEnd, s._pBegin + duration._lower);
                a._pEnd = Math.min(s._pEnd, s._rBegin + duration._upper);
            }
            else {
                a._pBegin = Math.min(a._pBegin, Math.max(s._pBegin, s._rEnd - duration._upper));
                a._rBegin = Math.max(a._rBegin, Math.min(s._rBegin, s._pEnd - duration._lower));
                a._rEnd = Math.min(a._rEnd, Math.max(s._rEnd, s._pBegin + duration._lower));
                a._pEnd = Math.max(a._pEnd, Math.min(s._pEnd, s._rBegin + duration._upper));
            }
        }
        if ((comp & HuTime.TRangeAlgebra.Comp.Longer) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                a._pBegin = s._pBegin;
                a._rBegin = Math.min(s._rBegin, s._pEnd - duration._lower);
                a._rEnd = Math.max(s._rEnd, s._pBegin + duration._lower);
                a._pEnd = s._pEnd;
            }
            else {
                a._rBegin = Math.max(a._rBegin, Math.min(s._rBegin, s._pEnd - duration._lower));
                a._rEnd = Math.min(a._rEnd, Math.max(s._rEnd, s._pBegin + duration._lower));
            }
        }
        return a;
    },

    // ** 端点間隔 **
    // 端点間隔の確実関係の検証
    isReliableInterval: function isReliableInterval (s, t, sEdge, tEdge, interval, comp) {
        var ab, ae, bb, be;
        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            ab = s._pBegin;
            ae = s._rBegin;
        }
        else if (sEdge == HuTime.TRangeAlgebra.Edge.End) {
            ab = s._rEnd;
            ae = s._pEnd;
        }
        else
            return false;

        if (tEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            bb = t._pBegin;
            be = t._rBegin;
        }
        else if (tEdge == HuTime.TRangeAlgebra.Edge.End) {
            bb = t._rEnd;
            be = t._pEnd;
        }
        else
            return false;

        switch (comp) {
            case HuTime.TRangeAlgebra.Comp.Shorter:
                return Math.max(ae - bb, be - ab) < interval._lower;
            case HuTime.TRangeAlgebra.Comp.Same:
                return Math.max(ae - bb, be - ab, 0) == Math.max(ae - bb, be - ab) &&
                    Math.max(ae - bb, be - ab) == interval._lower && interval._lower == interval._upper;
            case HuTime.TRangeAlgebra.Comp.Longer:
                return Math.max(ab - be, bb - ae, 0) > interval._upper;
            default:
                return false;
        }
    },

    // 端点間隔の可能関係の検証
    isPossibleInterval: function isPossibleInterval (s, t, sEdge, tEdge, interval, comp) {
        var ab, ae, bb, be;
        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            ab = s._pBegin;
            ae = s._rBegin;
        }
        else if (sEdge == HuTime.TRangeAlgebra.Edge.End) {
            ab = s._rEnd;
            ae = s._pEnd;
        }
        else
            return false;

        if (tEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            bb = t._pBegin;
            be = t._rBegin;
        }
        else if (tEdge == HuTime.TRangeAlgebra.Edge.End) {
            bb = t._rEnd;
            be = t._pEnd;
        }
        else
            return false;

        var min = Math.max(ab - be, bb - ae, 0);
        var max = Math.max(ae - bb, be - ab);

        if (comp & HuTime.TRangeAlgebra.Comp.Shorter != 0
            && min >= interval._upper)
            return false;
        if (comp & HuTime.TRangeAlgebra.Comp.Same != 0
            && min > interval._upper || max < interval._lower)
            return false;
        if (comp & HuTime.TRangeAlgebra.Comp.Longer != 0
            && max >= interval._lower)
            return false;
        return true;
    },

    // 端点間隔の関係の取得（１つならreliable, 2つ以上ならpossible）
    getIntervalComp: function getIntervalComp (s, t, sEdge, tEdge, interval) {
        var ab, ae, bb, be;
        var comp = 0;

        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            ab = s._pBegin;
            ae = s._rBegin;
        }
        else if (sEdge == HuTime.TRangeAlgebra.Edge.End) {
            ab = s._rEnd;
            ae = s._pEnd;
        }
        else
            return false;

        if (tEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            bb = t._pBegin;
            be = t._rBegin;
        }
        else if (tEdge == HuTime.TRangeAlgebra.Edge.End) {
            bb = t._rEnd;
            be = t._pEnd;
        }
        else
            return 0;

        var min = Math.max(ab - be, bb - ae, 0);
        var max = Math.max(ae - bb, be - ab);
        var a = null;

        if ((min < interval._upper))
            comp |= HuTime.TRangeAlgebra.Comp.Shorter;
        if ((min <= interval._upper && max >= interval._lower))
            comp |= HuTime.TRangeAlgebra.Comp.Same;
        if ((max > interval._lower))
            comp |= HuTime.TRangeAlgebra.Comp.Longer;
        return comp;
    },

    // 端点間隔の関係に基づく更新（t, intervalとcompに基づいて更新されたs）
    getTRangeRefinedByInterval: function getTRangeRefinedByInterval (s, t, sEdge, tEdge, interval, comp) {
        var ab, ae, bb, be;
        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            ab = s._pBegin;
            ae = s._rBegin;
        }
        else if (sEdge == HuTime.TRangeAlgebra.Edge.End) {
            ab = s._rEnd;
            ae = s._pEnd;
        }
        else
            return false;

        if (tEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            bb = t._pBegin;
            be = t._rBegin;
        }
        else if (tEdge == HuTime.TRangeAlgebra.Edge.End) {
            bb = t._rEnd;
            be = t._pEnd;
        }
        else
            return 0;

        var a = null;
        var aab, aae;
        if ((comp & HuTime.TRangeAlgebra.Comp.Shorter) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                aab = Math.max(ab, bb - interval._upper);
                aae = Math.min(ae, be + interval._upper);
            }
            else {
                aab = Math.min(aab, Math.max(ab, bb - interval._upper));
                aae = Math.max(aae, Math.min(ae, be + interval._upper));
            }
        }
        if ((comp & HuTime.TRangeAlgebra.Comp.Longer) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                if (ab > be - interval._lower)
                    aab = Math.max(ab, bb + interval._lower);
                else
                    aab = Math.max(ab, bb - interval._upper);
                if (ae < bb + interval._lower)
                    aae = Math.min(ae, be - interval._lower);
                else
                    aae = Math.min(ae, be + interval._upper);
            }
            else {
                if (ab > be - interval._lower)
                    aab = Math.min(aab, Math.max(ab, bb + interval._lower));
                else
                    aab = Math.min(aab, Math.max(ab, bb - interval._upper));
                if (ae < bb + interval._lower)
                    aae = Math.max(aae, Math.min(ae, be - interval._lower));
                else
                    aae = Math.max(aae, Math.min(ae, be + interval._upper));
            }
        }
        if ((comp & HuTime.TRangeAlgebra.Comp.Longer) != 0) {
            if (a == null) {
                a = new HuTime.TRange();
                if (ab > be - interval._lower)
                    aab = Math.max(ab, bb + interval._lower);
                if (ae < bb + interval._lower)
                    aae = Math.min(ae, be - interval._lower);
            }
            else {
                if (ab > be - interval._lower)
                    aab = Math.min(aab, Math.max(ab, bb + interval._lower));
                if (ae < bb + interval._lower)
                    aae = Math.max(aae, Math.min(ae, be - interval._lower));
            }
        }

        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            a._pBegin = aab;
            a._rBegin = aae;
            a._rEnd = s._rEnd;
            a._pEnd = s._pEnd;
        }
        else {
            a._pBegin = s._pBegin;
            a._rBegin = s._rBegin;
            a._rEnd = aab;
            a._pEnd = aae;
        }
        return a;
    }
};

// t値による範囲の長さ
HuTime.TDuration = function(lower, upper) {
    if (!isNaN(lower) && lower >= 0)
        this._lower = lower;
    else
        this._lower = 0;

    if (!isNaN(upper) && upper >= 0)
        this._upper = upper;
    else
        this._upper = Number.POSITIVE_INFINITY;

    if (lower > upper) {
        var d = this._lower;
        this._lower = this._upper;
        this._upper = d;
    }
};
HuTime.TDuration.prototype = {
    constructor: HuTime.TDuration,

    _lower: 0,
    _upper: Number.POSITIVE_INFINITY,
    get lower() {
        return this._lower;
    },
    get upper() {
        return this._upper;
    }
};

// t値で示された範囲
HuTime.TRange = function() {
};
HuTime.TRange.prototype = {
    constructor: HuTime.TRange,

    // 基本となる4値
    _pBegin: Number.NEGATIVE_INFINITY,  // 可能始点
    _rBegin: Number.NaN,                // 確実始点
    _rEnd: Number.NaN,                  // 確実終点
    _pEnd: Number.POSITIVE_INFINITY,    // 可能終点
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

    // 状態表示
    _isTotalPRangeOnly: true,   // 全可能期間のみの場合 true
    get isTotalPRangeOnly() {
        return isNaN(this._rBegin) && isNaN(this._rEnd);
    },
    _isNonRRange: true,         // 確実期間がない場合 true
    get isNonRRange() {
        return isNaN(this._rBegin) || isNaN(this._rEnd) || this._rBegin > this._rEnd;
    },

    setCentralValue: function() {      // 代表値の設定
        // 確定範囲がある場合（両端とも無限大でない）
        if (isFinite(this._rBegin) && isFinite(this._rEnd))
            this._centralValue = (this._rBegin + this._rEnd) / 2;

        // 前期可能範囲がある場合（確定範囲なし）
        else if (isFinite(this._pBegin) && isFinite(this._rBegin))
            this._centralValue = this._rBegin;

        // 後期可能範囲がある場合（確定範囲、前期可能範囲なし）
        else if (isFinite(this._rEnd) && isFinite(this._pEnd))
            this._centralValue = this._rEnd;

        // 全可能範囲のみ、かつ、両端とも無限大でない場合
        else if (isFinite(this._pBegin) && isFinite(this._pEnd))
            this._centralValue = (this._pBegin + this._pEnd) / 2;

        else
            this._centralValue = Number.NaN
    },

    // 自身に関するTime Interval Algebra
    isReliableRelation: function isReliableRelation (t, relation) {     // 期間間の確実関係の検証
        return HuTime.TRangeAlgebra.isReliableRelation(this, t, relation);
    },
    isPossibleRelation: function isPossibleRelation (t, relation) {     // 期間間の可能関係の検証
        return HuTime.TRangeAlgebra.isPossibleRelation(this, t, relation);
    },
    getRelation: function getRelation (t) {                             // 期間間の関係の取得
        return HuTime.TRangeAlgebra.getRelation(this, t);
    },
    refineByRelation: function getTRangeRefinedByRelation (t, relation) {       // 期間間の関係に基づく更新
        var a = HuTime.TRangeAlgebra.getTRangeRefinedByRelation(this, t, relation);
        this._pBegin = a._pBegin;
        this._rBegin = a._rBegin;
        this._rEnd = a._rEnd;
        this._pEnd = a._pEnd;
    },

    isReliableDuration: function isReliableDuration (duration, comp) {  // 期間長の確実関係の検証
        return HuTime.TRangeAlgebra.isReliableDuration(this, duration, comp);
    },
    isPossibleDuration: function isPossibleDuration (duration, comp) {  // 期間長の可能関係の検証
        return HuTime.TRangeAlgebra.isPossibleDuration(this, duration, comp);
    },
    getDurationComp: function getDurationComp (duration) {              // 期間長の関係の取得
        return HuTime.TRangeAlgebra.getDurationComp(this, duration);
    },
    refineByDuration: function getTRangeRefinedByDuration (duration, comp) {    // 期間長の関係に基づく更新
        var a = HuTime.TRangeAlgebra.getTRangeRefinedByDuration(this, duration, comp);
        this._pBegin = a._pBegin;
        this._rBegin = a._rBegin;
        this._rEnd = a._rEnd;
        this._pEnd = a._pEnd;
    },

    isReliableInterval: function isReliableInterval (t, sEdge, tEdge, interval, comp) {  // 端点間隔の確実関係の検証
        return HuTime.TRangeAlgebra.isReliableInterval(this, t, sEdge, tEdge, interval, comp);
    },
    isPossibleInterval: function isPossibleInterval (t, sEdge, tEdge, interval, comp) {  // 端点間隔の可能関係の検証
        return HuTime.TRangeAlgebra.isPossibleInterval(this, t, sEdge, tEdge, interval, comp);
    },
    getIntervalComp: function getIntervalComp (t, sEdge, tEdge, interval) {  // 端点間隔の関係の取得
        return HuTime.TRangeAlgebra.getIntervalComp(this, t, sEdge, tEdge, interval);
    },
    refineByInterval: function refineByInterval (t, sEdge, tEdge, interval, comp) {     // 端点間隔の関係に基づく更新
        var a = HuTime.TRangeAlgebra.getTRangeRefinedByInterval(this, t, sEdge, tEdge, interval, comp);
        this._pBegin = a._pBegin;
        this._rBegin = a._rBegin;
        this._rEnd = a._rEnd;
        this._pEnd = a._pEnd;
    }
};

// 始点と終点を指定してTRangeを生成
HuTime.TRange.createFromBeginEnd = function (begin, end) {
    var tRange = new HuTime.TRange();

    if (begin instanceof HuTime.TRange) {   // TRangeで指定された場合
        tRange._pBegin = Math.max(Number.NEGATIVE_INFINITY, begin._pBegin);
        tRange._rBegin = Math.min(Number.POSITIVE_INFINITY, begin._pEnd);
    }
    else if(!isNaN(begin) && begin != null) {
        tRange._pBegin = begin;
        tRange._rBegin = begin;
    }
    if (end instanceof HuTime.TRange) {
        tRange._rEnd = Math.max(Number.NEGATIVE_INFINITY, end._pBegin);
        tRange._pEnd = Math.min(Number.POSITIVE_INFINITY, end._pEnd);
    }
    else if (!isNaN(end) && end != null) {
        tRange._rEnd = end;
        tRange._pEnd = end;
    }

    tRange.setCentralValue();
    return tRange;
};

// リテラル値のTRange（リテラル値をTRangeと同様に扱うためのもの）
HuTime.TRangeLiteral = function TRangeLiteral(t) {
    HuTime.TRange.apply(this);
    this._pBegin = t;
    this._rBegin = t;
    this._rEnd = t;
    this._pEnd = t;
    tRange.setCentralValue();
};
HuTime.TRangeLiteral.prototype = Object.create(HuTime.TRange.prototype, {
    constructor: {
        value: HuTime.TRangeLiteral
    }
});
