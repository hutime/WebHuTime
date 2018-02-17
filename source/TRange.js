// Time Interval Algebra
HuTime.TRangeAlgebra = {
    // 期間間の関係
    Relation: {
        // 上位・下位8ビットが逆の関係になるように対応付け（equalsを除く）
        Before: 2,
        After: 512,
        During: 4,
        Contains: 1024,
        Overlaps: 8,
        OverlappedBy: 2048,
        Meets: 16,
        MetBy: 4096,
        Starts: 32,
        StartedBy: 8192,
        Finishes: 64,
        FinishedBy: 16384,
        Equals: 1,

        MASK: 33152     // 1000000110000000 (128 + 256 + 32768)
    },

    // 期間長の大小関係
    Length: {
        Shorter: 2,
        Longer: 512,
        Same: 1,

        MASK: 65020     // 1111110111111100
    },

    // 端点の指定
    Edge: {
        Begin: 1,
        End: 2
    },

    // ** 期間間の関係 **
    // 期間間の確実関係の検証（relationは単独の関係のみ）
    isReliableRelation: function isReliableRelation (s, t, relation) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange) ||
            relation <= 0 || relation >= 65536|| (relation & HuTime.TRangeAlgebra.Relation.MASK) != 0)
            return null;

        var r = relation;
        while (r > 1) {
            r /= 2;
        }
        if (r != 1)
            return null;    // 2つ以上の関係を指定した場合

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

        // 確実範囲の端点（nullの場合は可能範囲に基づいて設定）
        var aRb, aRe, bRb, bRe;

        // 評価
        switch (relation) {
            case HuTime.TRangeAlgebra.Relation.Before:
                if (a._pEnd == null || b._pBegin == null)
                    return null;
                return a._pEnd < b._pBegin;
            case HuTime.TRangeAlgebra.Relation.During:
                if (a._pBegin == null || a._pEnd == null
                    || (bRb = b._rBegin == null ? b._pEnd : b._rBegin) == null
                    || (bRe = b._rEnd == null ? b._pBegin : b._rEnd) == null)
                    return null;
                return a._pBegin > bRb && a._pEnd < bRe;
            case HuTime.TRangeAlgebra.Relation.Overlaps:
                if (b._pBegin == null || a._pEnd == null
                    || (aRe = a._rEnd == null ? a._pBegin : a._rEnd) == null
                    || (bRb = b._rBegin == null ? b._pEnd : b._rBegin) == null)
                    return null;
                aRb = a._rBegin == null ? a._pEnd : a._rBegin;
                bRe = b._rEnd == null ? b._pBegin : b._rEnd;
                return aRb < b._pBegin && aRe > bRb && a._pEnd < bRe;
            case HuTime.TRangeAlgebra.Relation.Meets:
                if (a._pEnd == null || b._pBegin == null
                    || (aRe = a._rEnd == null ? a._pBegin : a._rEnd) == null
                    || (bRb = b._rBegin == null ? b._pEnd : b._rBegin) == null)
                    return null;
                aRb = a._rBegin == null ? a._pEnd : a._rBegin;
                bRe = b._rEnd == null ? b._pBegin : b._rEnd;
                return aRe == a._pEnd && a._pEnd == b._pBegin && b._pBegin == bRb && aRb < b._pBegin && a._pEnd < bRe;
            case HuTime.TRangeAlgebra.Relation.Starts:
                if (a._pBegin == null || a._pEnd == null || b._pBegin == null
                    || (bRb = b._rBegin == null ? b._pEnd : b._rBegin) == null
                    || (bRe = b._rEnd == null ? b._pBegin : b._rEnd) == null)
                    return null;
                aRb = a._rBegin == null ? a._pEnd : a._rBegin;
                return a._pBegin == aRb && aRb == b._pBegin && b._pBegin == bRb && a._pEnd < bRe;
            case HuTime.TRangeAlgebra.Relation.Finishes:
                if (a._pBegin == null || a._pEnd == null || b._pEnd == null
                    || (bRe = b._rEnd == null ? b._pBegin : b._rEnd) == null)
                    return null;
                aRe = a._rEnd == null ? a._pBegin : a._rEnd;
                bRb = b._rBegin == null ? b._pEnd : b._rBegin;
                return a._pBegin > bRb && aRe == a._pEnd && a._pEnd == bRe && bRe == b._pEnd;
            case HuTime.TRangeAlgebra.Relation.Equals:
                if (a._pBegin == null || a._pEnd == null || b._pBegin == null || b._pEnd == null)
                    return null;
                aRb = a._rBegin == null ? a._pEnd : a._rBegin;
                aRe = a._rEnd == null ? a._pBegin : a._rEnd;
                bRb = b._rBegin == null ? b._pEnd : b._rBegin;
                bRe = b._rEnd == null ? b._pBegin : b._rEnd;
                return a._pBegin == aRb && aRb == b._pBegin && b._pBegin == bRb &&
                    aRe == a._pEnd && a._pEnd == bRe && bRe == b._pEnd;
            default:
                return null;   // relationに複数の値や負の値を指定した場合
        }
    },

    // 期間間の可能関係の検証（relationは複数の関係を設定可）
    isPossibleRelation: function isPossibleRelation (s, t, relation) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange) ||
            relation <= 0 || relation >= 65536|| (relation & HuTime.TRangeAlgebra.Relation.MASK) != 0)
            return null;

        // 確実範囲の端点（nullの場合は可能範囲に基づいて設定）
        var sRb = s._rBegin == null ? s._pEnd : s._rBegin;
        var sRe = s._rEnd == null ? s._pBegin : s._rEnd;
        var tRb = t._rBegin == null ? t._pEnd : t._rBegin;
        var tRe = t._rEnd == null ? t._pBegin : t._rEnd;

        if ((relation & HuTime.TRangeAlgebra.Relation.Before) != 0) {
            if (sRe == null || tRb == null)
                return null;
            if (sRe >= tRb)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.After) != 0) {
            if (tRe == null || sRb == null)
                return null;
            if (tRe >= sRb)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.During) != 0) {
            if(t._pBegin == null|| t._pEnd == null || sRb == null || sRe == null)
                return null;
            if(sRb <= t._pBegin || sRe >= t._pEnd)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Contains) != 0) {
            if (s._pBegin == null || s._pEnd == null || tRb == null || tRe == null)
                return null;
            if (tRb <= s._pBegin || tRe >= s._pEnd)
               return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Overlaps) != 0) {
            if (s._pBegin == null || s._pEnd == null || t._pBegin == null || t._pEnd == null)
                return null;
            if (s._pBegin >= tRb || s._pEnd <= t._pBegin || sRe >= t._pEnd)
               return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.OverlappedBy) != 0) {
            if (s._pBegin == null || s._pEnd == null || t._pBegin == null || t._pEnd == null)
                return null;
            if (t._pBegin >= sRb || t._pEnd <= s._pBegin || tRe >= s._pEnd)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Meets) != 0) {
            if (s._pEnd == null || t._pBegin == null || t._pEnd == null || sRe == null)
                return null;
            if (sRe > tRb || s._pEnd < t._pBegin || sRe >= t._pEnd)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.MetBy) != 0) {
            if (s._pBegin == null || s._pEnd == null || t._pEnd == null || tRe == null)
                return null;
            if (tRe > sRb || t._pEnd < s._pBegin || tRe >= s._pEnd)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Starts) != 0) {
            if (s._pBegin == null || t._pBegin == null || t._pEnd == null || sRb == null)
                return null;
            if (s._pBegin > tRb || sRb < t._pBegin || sRe >= t._pEnd)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.StartedBy) != 0) {
            if (s._pBegin == null || s._pEnd == null ||  t._pBegin == null || tRb == null)
                return null;
            if (t._pBegin > sRb || tRb < s._pBegin || tRe >= s._pEnd)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Finishes) != 0) {
            if (s._pEnd == null || t._pBegin == null || t._pEnd == null || sRe == null)
                return null;
            if (sRb <= t._pBegin || sRe > t._pEnd || s._pEnd < tRe)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.FinishedBy) != 0) {
            if (s._pBegin == null || s._pEnd == null || t._pEnd == null || tRe == null)
                return null;
            if (tRb <= s._pBegin || tRe > s._pEnd || t._pEnd < sRe)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Equals) != 0) {
            if (s._pBegin == null || s._pEnd == null|| t._pBegin == null || t._pEnd == null)
                return null;
            if (s._pBegin > tRb || sRb < t._pBegin || sRe > t._pEnd || s._pEnd < tRe)
                return false;
        }
        return true;
    },

    // 期間間の関係の取得（１つならreliable, 2つ以上ならpossible）
    getRelation: function getRelation (s, t) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange))
            return 0;

        var sRb = s._rBegin == null ? s._pEnd : s._rBegin;
        var sRe = s._rEnd == null ? s._pBegin : s._rEnd;
        var tRb = t._rBegin == null ? t._pEnd : t._rBegin;
        var tRe = t._rEnd == null ? t._pBegin : t._rEnd;

        var exitEdge   // 各範囲の値の有無をビットで表現
            = s._pBegin == null ? 0 : 1
            + sRb == null ? 0 : 2
            + sRe == null ? 0 : 4
            + s._pEnd == null ? 0 : 8
            + t._pBegin == null ? 0 : 16
            + tRb == null ? 0 : 32
            + tRe == null ? 0 : 64
            + t._pEnd == null ? 0 : 128;

        var relation = 0;
        if ((exitEdge & 36) == 36 && sRe < tRb)
            relation += HuTime.TRangeAlgebra.Relation.Before;
        if ((exitEdge & 66) == 66 && tRe < sRb)
            relation += HuTime.TRangeAlgebra.Relation.After;
        if ((exitEdge & 150) == 150 && sRb > t._pBegin && sRe < t._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.During;
        if ((exitEdge & 105) == 105 && tRb > s._pBegin && tRe < s._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.Contains;
        if ((exitEdge & 189) == 189 && s._pBegin < tRb && s._pEnd > t._pBegin && sRe < t._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.Overlaps;
        if ((exitEdge & 219) == 219 && t._pBegin < sRb && t._pEnd > s._pBegin && tRe < s._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.OverlappedBy;
        if ((exitEdge & 188) == 188 && sRe <= tRb && s._pEnd >= t._pBegin && sRe < t._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.Meets;
        if ((exitEdge & 203) == 203 && tRe <= sRb && t._pEnd >= s._pBegin && tRe < s._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.MetBy;
        if ((exitEdge & 183) == 183 && s._pBegin <= tRb && sRb >= t._pBegin && sRe < t._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.Starts;
        if ((exitEdge & 121) == 121 && t._pBegin <= sRb && tRb >= s._pBegin && tRe < s._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.StartedBy;
        if ((exitEdge & 222) == 222  && sRb > t._pBegin && sRe <= t._pEnd && s._pEnd >= tRe)
            relation += HuTime.TRangeAlgebra.Relation.Finishes;
        if ((exitEdge & 237) == 237 && tRb > s._pBegin && tRe <= s._pEnd && t._pEnd >= sRe)
            relation += HuTime.TRangeAlgebra.Relation.FinishedBy;
        if ((exitEdge & 255) == 255 && s._pBegin <= tRb && sRb >= t._pBegin && sRe <= t._pEnd && s._pEnd >= tRe)
            relation += HuTime.TRangeAlgebra.Relation.Equals;

        return relation;
    },

    // 期間間の関係に基づく更新（tとrelationに基づいて更新されたs）
    getTRangeRefinedByRelation: function getTRangeRefinedByRelation (s, t, relation) {
        if (!HuTime.TRangeAlgebra.isPossibleRelation(s, t, relation))
            return s.clone();   // 基になる関係が可能でなければ、更新なし

        var a = new HuTime.TRange();    // 結果
        var refine;                     // 各関係での端点の更新結果
        if ((relation & HuTime.TRangeAlgebra.Relation.Before) != 0) {
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.After) != 0) {
            if (t._rEnd != null) {
                refine = s._pBegin == null ? t._rEnd : Math.max(s._pBegin, t._rEnd);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.During) != 0) {
            if (t._pBegin != null) {
                refine = s._pBegin == null ? t._pBegin : Math.max(s._pBegin, t._pBegin);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Contains) != 0) {
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._rEnd != null) {
                refine = s._rEnd == null ? t._rEnd : Math.max(s._rEnd, t._rEnd);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Overlaps) != 0) {
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._pBegin != null) {
                refine = s._rEnd == null ? t._pBegin : Math.max(s._rEnd, t._pBegin);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.OverlappedBy) != 0) {
            if (t._pBegin != null) {
                refine = s._pBegin == null ? t._pBegin : Math.max(s._pBegin, t._pBegin);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._pEnd != null) {
                refine = s._rBegin == null ? t._pEnd : Math.min(s._rBegin, t._pEnd);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._rEnd != null) {
                refine = s._rEnd == null ? t._rEnd : Math.max(s._rEnd, t._rEnd);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Meets) != 0) {
            if (t._rBegin != null) {
                refine = s._pEnd == null ? t._rBegin : Math.min(s._pEnd, t._rBegin);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
            if (t._pBegin != null) {
                refine = s._rEnd == null ? t._pBegin : Math.max(s._rEnd, t._pBegin);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.MetBy) != 0) {
            if (t._rEnd != null) {
                refine = s._pBegin == null ? t._rEnd : Math.max(s._pBegin, t._rEnd);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Starts) != 0) {
            if (t._pBegin != null) {
                refine = s._pBegin == null ? t._pBegin : Math.max(s._pBegin, t._pBegin);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.StartedBy) != 0) {
            if (t._pBegin != null) {
                refine = s._pBegin == null ? t._pBegin : Math.max(s._pBegin, t._pBegin);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._rEnd != null) {
                refine = s._rEnd == null ? t._rEnd : Math.max(s._rEnd, t._rEnd);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Finishes) != 0) {
            if (t._pBegin != null) {
                refine = s._pBegin == null ? t._pBegin : Math.max(s._pBegin, t._pBegin);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
            if (t._rEnd != null) {
                refine = s._rEnd == null ? t._rEnd : Math.max(s._rEnd, t._rEnd);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.FinishedBy) != 0) {
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._rEnd != null) {
                refine = s._rEnd == null ? t._rEnd : Math.max(s._rEnd, t._rEnd);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Equals) != 0) {
            if (t._pBegin != null) {
                refine = s._pBegin == null ? t._pBegin : Math.max(s._pBegin, t._pBegin);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._rEnd != null) {
                refine = s._rEnd == null ? t._rEnd : Math.max(s._rEnd, t._rEnd);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }

        if (a._rBegin == null || a._rBegin > a._pEnd)
            a._rBegin = a._pEnd;
        if (a._rEnd == null || a._rEnd < a._pBegin)
            a._rEnd = a._pBegin;
        a.updateCentralValue();
        return a;
    },

    // ** 期間長 **
    // 期間の確実な長さ（相対）の検証
    isReliableDuration: function isReliableDuration (s, duration, length) {
        if (!(s instanceof HuTime.TRange) || !(duration instanceof HuTime.TDuration))
            return null;
        var sRb, sRe;

        switch (length) {
            case HuTime.TRangeAlgebra.Length.Shorter:
                if (s._pEnd == null || s._pBegin == null)
                    return null;
                return s._pEnd - s._pBegin < duration._lower;
            case HuTime.TRangeAlgebra.Length.Same:
                if (s._pEnd == null || s._pBegin == null
                    || (sRe = s._rEnd == null ? s._pBegin : s._rEnd) == null
                    || (sRb = s._rBegin == null ? s._pEnd : s._rBegin) == null)
                    return null;
                return Math.max(sRe - sRb, 0) == s._pEnd - s._pBegin &&
                    s._pEnd - s._pBegin == duration._lower && duration._lower == duration._upper;
            case HuTime.TRangeAlgebra.Length.Longer:
                if ((sRe = s._rEnd == null ? s._pBegin : s._rEnd) == null
                    || (sRb = s._rBegin == null ? s._pEnd : s._rBegin) == null)
                    return null;
                return Math.max(sRe - sRb, 0) > duration._upper;
            default:
                return null;    // lengthに複数の値や負の値を指定した場合
        }
    },

    // 期間の可能な長さ（相対）の検証
    isPossibleDuration: function isPossibleDuration (s, duration, length) {
        if (!(s instanceof HuTime.TRange) || !(duration instanceof HuTime.TDuration) ||
            length <= 0 || length >= 65536 || (length & HuTime.TRangeAlgebra.Length.MASK) != 0)
            return null;

        var sRe = s._rEnd == null ? s._pBegin : s._rEnd;
        var sRb = s._rBegin == null ? s._pEnd : s._rBegin;
        var min = sRe == null || sRb == null ? null : Math.max(s._rEnd - s._rBegin, 0);
        var max = s._pEnd == null || s._pBegin == null ? null : s._pEnd - s._pBegin;

        if ((length & HuTime.TRangeAlgebra.Length.Shorter) != 0) {
            if (min == null)
                return null;
            if(min >= duration._upper)
                return false;
        }
        if ((length & HuTime.TRangeAlgebra.Length.Same) != 0) {
            if (max == null || min == null)
                return null;
            if (max < duration._lower || min > duration._lower)
                return false;
        }
        if ((length & HuTime.TRangeAlgebra.Length.Longer) != 0) {
            if (max == null)
                return null;
            if (max <= duration._lower)
                return false;
        }
        return true;
    },

    // 期間のとり得る長さ（相対）の取得（１つならreliable, 2つ以上ならpossible）
    getDurationLength: function getDurationLength (s, duration) {
        if (!(s instanceof HuTime.TRange) || !(duration instanceof HuTime.TDuration))
            return null;

        var sRe = s._rEnd == null ? s._pBegin : s._rEnd;
        var sRb = s._rBegin == null ? s._pEnd : s._rBegin;
        var min = sRe == null || sRb == null ? null : Math.max(sRe - sRb, 0);
        var max = s._pEnd == null || s._pBegin == null ? null : s._pEnd - s._pBegin;
        var length = 0;

        if (min != null && min < duration._upper)
            length += HuTime.TRangeAlgebra.Length.Shorter;
        if (min != null && max != null && min <= duration._upper && max >= duration._lower)
            length += HuTime.TRangeAlgebra.Length.Same;
        if (max != null && max > duration._lower)
            length += HuTime.TRangeAlgebra.Length.Longer;
        return length;
    },

    // 期間長に基づく更新（durationとlengthに基づいて更新されたs）
    getTRangeRefinedByDuration: function getTRangeRefinedByDuration (s, duration, length) {
        if (!HuTime.TRangeAlgebra.isPossibleDuration(s, duration, length))
            return s.clone();   // 基になる関係が可能でなければ、更新なし

        var sRe = s._rEnd == null ? s._pBegin : s._rEnd;
        var sRb = s._rBegin == null ? s._pEnd : s._rBegin;
        var a = new HuTime.TRange();
        var refine;

        if ((length & HuTime.TRangeAlgebra.Length.Shorter) != 0) {
            if (sRe != null) {
                refine = s._pBegin == null ? sRe - duration._upper : Math.max(s._pBegin, sRe - duration._upper);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (sRb != null) {
                refine = s._pEnd == null ? sRb + duration._upper : Math.min(s._pEnd, sRb + duration._upper);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((length & HuTime.TRangeAlgebra.Length.Same) != 0) {
            if (sRe != null) {
                refine = s._pBegin == null ? sRe - duration._upper : Math.max(s._pBegin, sRe - duration._upper);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (s._pEnd != null) {
                refine = s._rBegin == null ? s._pEnd - duration._lower : Math.min(s._rBegin, s._pEnd - duration._lower);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, null);
            }
            if (s._pBegin != null) {
                refine = s._rEnd == null ? s._pBegin + duration._lower : Math.max(s._rEnd, s._pBegin + duration._lower);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
            if (sRb != null) {
                refine = s._pEnd == null ? sRb + duration._upper : Math.min(s._pEnd, sRb + duration._upper);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((length & HuTime.TRangeAlgebra.Length.Longer) != 0) {
            if (s._pEnd != null) {
                refine = s._rBegin == null ? s._pEnd - duration._lower : Math.min(s._rBegin, s._pEnd - duration._lower);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, null);
            }
            if (s._pBegin != null) {
                refine = s._rEnd == null ? s._pBegin + duration._lower : Math.max(s._rEnd, s._pBegin + duration._lower);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
        }

        a.updateCentralValue();
        return a;
    },

    // ** 端点間隔 **
    // 端点間隔の確実な長さ（相対）の検証
    isReliableInterval: function isReliableInterval (s, t, sEdge, tEdge, interval, length) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange) || !(interval instanceof HuTime.TDuration))
            return null;

        var ab, ae, bb, be;
        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            ab = s._pBegin;
            ae = s._rBegin == null ? s._pEnd : s._rBegin;
        }
        else if (sEdge == HuTime.TRangeAlgebra.Edge.End) {
            ab = s._rEnd == null ? s._pBegin : s._rEnd;
            ae = s._pEnd;
        }
        else
            return null;

        if (tEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            bb = t._pBegin;
            be = t._rBegin == null ? t._pEnd : t._rBegin;
        }
        else if (tEdge == HuTime.TRangeAlgebra.Edge.End) {
            bb = t._rEnd == null ? t._pBegin : t._rEnd;
            be = t._pEnd;
        }
        else
            return null;

        if (ab == null || ae == null || bb == null || be == null)
            return null;

        switch (length) {
            case HuTime.TRangeAlgebra.Length.Shorter:
                return Math.max(ae - bb, be - ab) < interval._lower;
            case HuTime.TRangeAlgebra.Length.Same:
                return Math.max(ae - bb, be - ab, 0) == Math.max(ae - bb, be - ab) &&
                    Math.max(ae - bb, be - ab) == interval._lower && interval._lower == interval._upper;
            case HuTime.TRangeAlgebra.Length.Longer:
                return Math.max(ab - be, bb - ae, 0) > interval._upper;
            default:
                return null;
        }
    },

    // 端点間隔の可能な長さ（相対）の検証
    isPossibleInterval: function isPossibleInterval (s, t, sEdge, tEdge, interval, length) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange) || !(interval instanceof HuTime.TDuration) ||
            length <= 0 || length >= 65536 || (length & HuTime.TRangeAlgebra.Length.MASK) != 0)
            return null;

        var ab, ae, bb, be;
        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            ab = s._pBegin;
            ae = s._rBegin == null ? s._pEnd : s._rBegin;
        }
        else if (sEdge == HuTime.TRangeAlgebra.Edge.End) {
            ab = s._rEnd == null ? s._pBegin : s._rEnd;
            ae = s._pEnd;
        }
        else
            return null;

        if (tEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            bb = t._pBegin;
            be = t._rBegin == null ? t._pEnd : t._rBegin;
        }
        else if (tEdge == HuTime.TRangeAlgebra.Edge.End) {
            bb = t._rEnd == null ? t._pBegin : t._rEnd;
            be = t._pEnd;
        }
        else
            return null;

        if (ab == null || ae == null || bb == null || be == null)
            return null;

        var min = Math.max(ab - be, bb - ae, 0);
        var max = Math.max(ae - bb, be - ab);

        if (length & HuTime.TRangeAlgebra.Length.Shorter != 0
            && min >= interval._upper)
            return false;
        if (length & HuTime.TRangeAlgebra.Length.Same != 0
            && min > interval._upper || max < interval._lower)
            return false;
        if (length & HuTime.TRangeAlgebra.Length.Longer != 0
            && max >= interval._lower)
            return false;
        return true;
    },

    // 端点間隔のとりうる長さ（相対）の取得（１つならreliable, 2つ以上ならpossible）
    getIntervalLength: function getIntervalLength (s, t, sEdge, tEdge, interval) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange) || !(interval instanceof HuTime.TDuration))
            return null;

        var ab, ae, bb, be;
        var length = 0;

        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            ab = s._pBegin;
            ae = s._rBegin == null ? s._pEnd : s._rBegin;
        }
        else if (sEdge == HuTime.TRangeAlgebra.Edge.End) {
            ab = s._rEnd == null ? s._pBegin : s._rEnd;
            ae = s._pEnd;
        }
        else
            return null;

        if (tEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            bb = t._pBegin;
            be = t._rBegin == null ? t._pEnd : t._rBegin;
        }
        else if (tEdge == HuTime.TRangeAlgebra.Edge.End) {
            bb = t._rEnd == null ? t._pBegin : t._rEnd;
            be = t._pEnd;
        }
        else
            return null;

        if (ab == null || ae == null || bb == null || be == null)
            return null;

        var min = Math.max(ab - be, bb - ae, 0);
        var max = Math.max(ae - bb, be - ab);
        var a = null;

        if ((min < interval._upper))
            length += HuTime.TRangeAlgebra.Length.Shorter;
        if ((min <= interval._upper && max >= interval._lower))
            length += HuTime.TRangeAlgebra.Length.Same;
        if ((max > interval._lower))
            length += HuTime.TRangeAlgebra.Length.Longer;
        return length;
    },

    // 端点間隔の関係に基づく更新（t, intervalとlengthに基づいて更新されたs）
    getTRangeRefinedByInterval: function getTRangeRefinedByInterval (s, t, sEdge, tEdge, interval, length) {
        if (!HuTime.TRangeAlgebra.isPossibleInterval(s, t, sEdge, tEdge, interval, length))
            return s.clone();   // 基になる関係が可能でなければ、更新なし

        var ab, ae, bb, be;
        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            ab = s._pBegin;
            ae = s._rBegin == null ? s._pEnd : s._rBegin;
        }
        else if (sEdge == HuTime.TRangeAlgebra.Edge.End) {
            ab = s._rEnd == null ? s._pBegin : s._rEnd;
            ae = s._pEnd;
        }
        else
            return s.clone();

        if (tEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            bb = t._pBegin;
            be = t._rBegin == null ? t._pEnd : t._rBegin;
        }
        else if (tEdge == HuTime.TRangeAlgebra.Edge.End) {
            bb = t._rEnd == null ? t._pBegin : t._rEnd;
            be = t._pEnd;
        }
        else
            return s.clone();

        var aab = null;
        var aae = null;
        var refine;
        if ((length & HuTime.TRangeAlgebra.Length.Shorter) != 0) {
            if (bb != null) {
            refine = ab == null ? bb - interval._upper : Math.max(ab, bb - interval._upper);
            aab = aab == null ? refine : Math.min(aab, refine);
            }
            if (be != null) {
                refine = ae == null ? be + interval._upper : Math.min(ae, be + interval._upper);
                aae = aae == null ? refine : Math.max(aae, refine);
            }
        }
        if ((length & HuTime.TRangeAlgebra.Length.Same) != 0 && bb != null && be != null) {
            if (ab > be - interval._lower) {
                refine = ab == null ? bb + interval._lower : Math.max(ab, bb + interval._lower);
                aab = aab == null ? refine : Math.min(aab, refine);
            }
            else {
                refine = ab == null ? bb - interval._upper : Math.max(ab, bb - interval._upper);
                aab = aab == null ? refine : Math.min(aab, refine);
            }
            if (ae < bb + interval._lower) {
                refine = ae == null ? be - interval._lower : Math.min(ae, be - interval._lower);
                aae = aae == null ? refine : Math.max(aae, refine);
            }
            else {
                refine = ae == null ? be + interval._upper : Math.min(ae, be + interval._upper);
                aae = aae == null ? refine : Math.max(aae, refine);
            }
        }
        if ((length & HuTime.TRangeAlgebra.Length.Longer) != 0 && bb != null && be != null) {
            if (ab > be - interval._lower) {
                refine = ab == null ? bb + interval._lower : Math.max(ab, bb + interval._lower);
                aab = aab == null ? refine : Math.min(aab, refine);
            }
            if (ae < bb + interval._lower) {
                refine = ae == null ? be - interval._lower : Math.min(ae, be - interval._lower);
                aae = aae == null ? refine : Math.max(aae, refine);
            }
        }

        var a = new HuTime.TRange();
        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            a._pBegin = aab;
            a._rBegin = aae;
            a._rEnd = s._rEnd == null ? aab : Math.max(s._rEnd, aab);
            a._pEnd = s._pEnd;
        }
        else {
            a._pBegin = s._pBegin;
            a._rBegin = s._rBegin == null ? aae : Math.min(s._rBegin, aae);
            a._rEnd = aab;
            a._pEnd = aae;
        }
        return a;
    }
};
Object.freeze(HuTime.TRangeAlgebra.Relation);
Object.freeze(HuTime.TRangeAlgebra.Length);
Object.freeze(HuTime.TRangeAlgebra.Edge);

// t値による範囲の長さ
HuTime.TDuration = function TDuration (lower, upper) {
    if (isNaN(lower) || lower == null || lower < 0)
        this._lower = 0;
    else
        this._lower = lower;

    if (isNaN(upper) || upper == null || upper < 0)
        this._upper = this._lower;  // 1つしか指定されていない場合も含む
    else {
        this._upper = upper;
        if (this._lower > this._upper) {    // 逆の場合入れ換え
            var d = this._lower;
            this._lower = this._upper;
            this._upper = d;
        }
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
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        _lower: "lower",
        _upper: "upper"
    },
    _parseJSONProperties: {
        lower: "_lower",
        upper: "_upper"
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// t値で示された範囲
HuTime.TRange = function TRange () {
};
HuTime.TRange.prototype = {
    constructor: HuTime.TRange,

    // 基本となる4値
    _pBegin: null,  // 可能始点
    _rBegin: null,  // 確実始点
    _rEnd: null,    // 確実終点
    _pEnd: null,    // 可能終点
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
    get isTotalPRangeOnly() {       // 全可能期間のみの場合 true
        return this._rBegin == null && this._rEnd == null;
    },
    get isNonRRange() {             // 確実期間がない場合 true
        return this._rBegin == null || this._rEnd == null || this._rBegin > this._rEnd;
    },

    updateCentralValue: function() {      // 代表値の設定
        // 確定範囲があり、かつ、両端とも無限大でない
        if (isFinite(this._rBegin) && this._rBegin != null && isFinite(this._rEnd) && this._rEnd != null
            && this._rBegin <= this._rEnd)
            this._centralValue = (this._rBegin + this._rEnd) / 2;

        // 前期可能範囲がある場合（確定範囲なし）
        else if (isFinite(this._pBegin) && this._pBegin != null && isFinite(this._rBegin) && this._rBegin != null)
            this._centralValue = this._rBegin;

        // 後期可能範囲がある場合（確定範囲、前期可能範囲なし）
        else if (isFinite(this._rEnd) && this._rEnd != null && isFinite(this._pEnd) && this._pEnd != null)
            this._centralValue = this._rEnd;

        // 全可能範囲のみ、かつ、両端とも無限大でない場合
        else if (isFinite(this._pBegin) && this._pBegin != null && isFinite(this._pEnd) && this._pEnd != null)
            this._centralValue = (this._pBegin + this._pEnd) / 2;

        else
            this._centralValue = null;
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
        this.updateCentralValue();
    },

    isReliableDuration: function isReliableDuration (duration, length) {  // 期間長の確実関係の検証
        return HuTime.TRangeAlgebra.isReliableDuration(this, duration, length);
    },
    isPossibleDuration: function isPossibleDuration (duration, length) {  // 期間長の可能関係の検証
        return HuTime.TRangeAlgebra.isPossibleDuration(this, duration, length);
    },
    getDurationLength: function getDurationLength (duration) {              // 期間長の関係の取得
        return HuTime.TRangeAlgebra.getDurationLength(this, duration);
    },
    refineByDuration: function getTRangeRefinedByDuration (duration, length) {    // 期間長の関係に基づく更新
        var a = HuTime.TRangeAlgebra.getTRangeRefinedByDuration(this, duration, length);
        this._pBegin = a._pBegin;
        this._rBegin = a._rBegin;
        this._rEnd = a._rEnd;
        this._pEnd = a._pEnd;
        this.updateCentralValue();
    },

    isReliableInterval: function isReliableInterval (t, sEdge, tEdge, interval, length) {  // 端点間隔の確実関係の検証
        return HuTime.TRangeAlgebra.isReliableInterval(this, t, sEdge, tEdge, interval, length);
    },
    isPossibleInterval: function isPossibleInterval (t, sEdge, tEdge, interval, length) {  // 端点間隔の可能関係の検証
        return HuTime.TRangeAlgebra.isPossibleInterval(this, t, sEdge, tEdge, interval, length);
    },
    getIntervalLength: function getIntervalLength (t, sEdge, tEdge, interval) {  // 端点間隔の関係の取得
        return HuTime.TRangeAlgebra.getIntervalLength(this, t, sEdge, tEdge, interval);
    },
    refineByInterval: function refineByInterval (t, sEdge, tEdge, interval, length) {     // 端点間隔の関係に基づく更新
        var a = HuTime.TRangeAlgebra.getTRangeRefinedByInterval(this, t, sEdge, tEdge, interval, length);
        this._pBegin = a._pBegin;
        this._rBegin = a._rBegin;
        this._rEnd = a._rEnd;
        this._pEnd = a._pEnd;
        this.updateCentralValue();
    },

    // クローンの生成
    clone: function clone () {
        var a = new HuTime.TRange();
        a._pBegin = this._pBegin;
        a._rBegin = this._rBegin;
        a._rEnd = this._rEnd;
        a._pEnd = this._pEnd;
        a._centralValue = this._centralValue;
        return a;
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

// 始点と終点を指定してTRangeを生成（t値またはTRangeを指定）
HuTime.TRange.createFromBeginEnd = function (begin, end) {
    var tRange = new HuTime.TRange();

    if (begin instanceof HuTime.TRange) {   // TRangeで指定された場合
        tRange._pBegin = begin._pBegin;
        tRange._rBegin = begin._pEnd;
    }
    else if(!isNaN(begin) && begin != null) {
        tRange._pBegin = begin;
        tRange._rBegin = begin;
    }
    if (end instanceof HuTime.TRange) {
        tRange._rEnd = end._pBegin;
        tRange._pEnd = end._pEnd;
    }
    else if (!isNaN(end) && end != null) {
        tRange._rEnd = end;
        tRange._pEnd = end;
    }

    tRange.updateCentralValue();
    return tRange;
};

// １つの点（または期間）を指定してTRangeを生成（t値またはTRangeを指定）
HuTime.TRange.createFromDuring = function createFromDuring (during) {
    var tRange = new HuTime.TRange();

    if (during instanceof HuTime.TRange) {   // TRangeで指定された場合
        tRange._pBegin =during._pBegin;
        tRange._rBegin =during._pEnd;
        tRange._rEnd =during._pBegin;
        tRange._pEnd = during._pEnd;
    }
    else if(!isNaN(during) && during != null) {
        tRange._pBegin = during;
        tRange._rBegin = during;
        tRange._rEnd = during;
        tRange._pEnd = during;
    }
    tRange.updateCentralValue();
    return tRange;
};

