(function () {
    'use strict';

    /* =========================================================
        Spatial helpers
    ========================================================= */

    function ringCentroid(ring) {
        var x = 0, y = 0;
        for (var i = 0; i < ring.length; i++) {
            x += ring[i][0];
            y += ring[i][1];
        }
        return [x / ring.length, y / ring.length];
    }

    function getGeometryCentroid(geometry) {
        if (!geometry) return null;
        if (geometry.type === 'Polygon' && geometry.coordinates[0]) {
            return ringCentroid(geometry.coordinates[0]);
        }
        if (geometry.type === 'MultiPolygon' && geometry.coordinates[0] && geometry.coordinates[0][0]) {
            return ringCentroid(geometry.coordinates[0][0]);
        }
        return null;
    }

    function getBoundingBox(geometry) {
        var minLng = Infinity, minLat = Infinity;
        var maxLng = -Infinity, maxLat = -Infinity;

        function scanRing(ring) {
            for (var i = 0; i < ring.length; i++) {
                if (ring[i][0] < minLng) minLng = ring[i][0];
                if (ring[i][0] > maxLng) maxLng = ring[i][0];
                if (ring[i][1] < minLat) minLat = ring[i][1];
                if (ring[i][1] > maxLat) maxLat = ring[i][1];
            }
        }

        if (!geometry) return null;

        if (geometry.type === 'Polygon') {
            for (var i = 0; i < geometry.coordinates.length; i++) {
                scanRing(geometry.coordinates[i]);
            }
        } else if (geometry.type === 'MultiPolygon') {
            for (var i = 0; i < geometry.coordinates.length; i++) {
                for (var j = 0; j < geometry.coordinates[i].length; j++) {
                    scanRing(geometry.coordinates[i][j]);
                }
            }
        }

        if (!isFinite(minLng)) return null;
        return { minLng: minLng, maxLng: maxLng, minLat: minLat, maxLat: maxLat };
    }

    function haversineDistance(lng1, lat1, lng2, lat2) {
        var R = 6371000;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLng = (lng2 - lng1) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
              + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
              * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function collectOuterVertices(geometry) {
        var verts = [];

        function pushRing(ring) {
            for (var i = 0; i < ring.length; i++) {
                verts.push(ring[i]);
            }
        }

        if (geometry.type === 'Polygon') {
            if (geometry.coordinates[0]) pushRing(geometry.coordinates[0]);
        } else if (geometry.type === 'MultiPolygon') {
            for (var i = 0; i < geometry.coordinates.length; i++) {
                if (geometry.coordinates[i][0]) pushRing(geometry.coordinates[i][0]);
            }
        }

        return verts;
    }

    function polygonMinDistance(geom1, geom2) {
        var v1 = collectOuterVertices(geom1);
        var v2 = collectOuterVertices(geom2);

        if (v1.length === 0 || v2.length === 0) return Infinity;

        var min = Infinity;
        for (var i = 0; i < v1.length; i++) {
            for (var j = 0; j < v2.length; j++) {
                var d = haversineDistance(v1[i][0], v1[i][1], v2[j][0], v2[j][1]);
                if (d < min) min = d;
                if (min < 1) return min;
            }
        }
        return min;
    }

    function findAdjacentFences(target, all, maxDistMeters) {
        maxDistMeters = maxDistMeters || 500;
        var centerMax = 3000;

        var targetBbox = getBoundingBox(target.geometry);
        if (!targetBbox) return [];

        var targetCenter = getGeometryCentroid(target.geometry);
        var buffer = maxDistMeters / 111320;
        var adjacent = [];

        for (var i = 0; i < all.length; i++) {
            var fence = all[i];
            if (fence.fenceId === target.fenceId) continue;

            var bbox = getBoundingBox(fence.geometry);
            if (!bbox) continue;

            /* ── Layer 1: bbox coarse filter ── */
            if (targetBbox.maxLng + buffer < bbox.minLng ||
                targetBbox.minLng - buffer > bbox.maxLng ||
                targetBbox.maxLat + buffer < bbox.minLat ||
                targetBbox.minLat - buffer > bbox.maxLat) {
                continue;
            }

            /* ── Layer 2: center distance filter ── */
            if (targetCenter) {
                var center = getGeometryCentroid(fence.geometry);
                if (center
                    && haversineDistance(targetCenter[0], targetCenter[1],
                                         center[0], center[1]) > centerMax) {
                    continue;
                }
            }

            /* ── Layer 3: polygon vertex min-distance ── */
            if (polygonMinDistance(target.geometry, fence.geometry) > maxDistMeters) {
                continue;
            }

            adjacent.push(fence);
        }

        return adjacent;
    }

    /* =========================================================
        Courier search
    ========================================================= */

    function findCouriersByName(fences, query) {
        if (!query) return [];

        var q = query.trim().toLowerCase();
        var results = [];

        for (var i = 0; i < fences.length; i++) {
            var fence = fences[i];
            var couriers = fence.couriers;
            if (!couriers || couriers.length === 0) continue;

            for (var j = 0; j < couriers.length; j++) {
                if (couriers[j].name.toLowerCase().indexOf(q) !== -1) {
                    results.push({
                        courier: couriers[j],
                        fence: fence
                    });
                }
            }
        }

        return results;
    }

    /* =========================================================
        State
    ========================================================= */

    var overlayPolys  = [];
    var overlayMarks  = [];
    var activeMatches = [];

    var $courierInput  = null;
    var $courierButton = null;
    var $resultTarget  = null;
    var $statusTarget  = null;

    function clearOverlays() {
        var m = window.FenceUI.getMap();
        if (!m) return;

        for (var i = 0; i < overlayPolys.length; i++)  m.remove(overlayPolys[i]);
        for (var j = 0; j < overlayMarks.length; j++) m.remove(overlayMarks[j]);

        overlayPolys.length = 0;
        overlayMarks.length = 0;
    }

    /* =========================================================
        Draw
    ========================================================= */

    function highlightFence(fence, color) {
        var m  = window.FenceUI.getMap();
        var g  = fence.geometry;
        if (!g || !m) return;

        var paths = g.type === 'Polygon'
            ? [g.coordinates]
            : g.coordinates;

        for (var i = 0; i < paths.length; i++) {
            var poly = new AMap.Polygon({
                path:          paths[i],
                strokeColor:   color,
                strokeWeight:   2,
                strokeOpacity:  0.9,
                fillColor:     color,
                fillOpacity:    0.15,
                extData:        fence
            });
            m.add(poly);
            overlayPolys.push(poly);
        }
    }

    function addFenceMarker(fence, count, color) {
        var m = window.FenceUI.getMap();
        if (!m) return;

        var c = getGeometryCentroid(fence.geometry);
        if (!c) return;

        var marker = new AMap.Marker({
            position: c,
            content:  '<div style="'
                + 'background:' + color + ';'
                + 'color:#fff;border-radius:50%;'
                + 'width:26px;height:26px;line-height:26px;'
                + 'text-align:center;font-size:13px;'
                + 'font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,.3)'
                + '">' + count + '</div>',
            offset: new AMap.Pixel(-13, -13),
            extData: fence
        });

        m.add(marker);
        overlayMarks.push(marker);
    }

    function fitMapToFences(fences) {
        var m = window.FenceUI.getMap();
        if (!m || fences.length === 0) return;

        if (fences.length === 1) {
            var c = getGeometryCentroid(fences[0].geometry);
            if (c) {
                m.setZoomAndCenter(14, c);
                return;
            }
        }

        var bounds = null;

        for (var i = 0; i < fences.length; i++) {
            var bbox = getBoundingBox(fences[i].geometry);
            if (!bbox) continue;

            if (!bounds) {
                bounds = { minLng: bbox.minLng, maxLng: bbox.maxLng,
                           minLat: bbox.minLat, maxLat: bbox.maxLat };
            } else {
                if (bbox.minLng < bounds.minLng) bounds.minLng = bbox.minLng;
                if (bbox.maxLng > bounds.maxLng) bounds.maxLng = bbox.maxLng;
                if (bbox.minLat < bounds.minLat) bounds.minLat = bbox.minLat;
                if (bbox.maxLat > bounds.maxLat) bounds.maxLat = bbox.maxLat;
            }
        }

        if (bounds) {
            m.setBounds(new AMap.Bounds(
                [bounds.minLng, bounds.minLat],
                [bounds.maxLng, bounds.maxLat]
            ));
        }
    }

    /* =========================================================
        Panel rendering
    ========================================================= */

    function escapeHtml(v) {
        return String(v ?? '')
            .replaceAll('&',  '&amp;')
            .replaceAll('<',  '&lt;')
            .replaceAll('>',  '&gt;')
            .replaceAll('"',  '&quot;')
            .replaceAll("'",  '&#039;');
    }

    function setStatus(msg, type) {
        if ($statusTarget) {
            $statusTarget.textContent = msg;
            $statusTarget.className   = 'status';
            if (type) $statusTarget.classList.add(type);
        }
    }

    function renderResults(matches, allTargetFences, allAdjacentFences) {
        if (!$resultTarget) return;

        if (matches.length === 0) {
            $resultTarget.innerHTML = '<div class="result-item">'
                + '<div class="value error">未找到匹配的快递员</div>'
                + '</div>';
            return;
        }

        var targetIds = {};
        for (var i = 0; i < allTargetFences.length; i++) {
            targetIds[allTargetFences[i].fenceId] = true;
        }

        var adjacentIds = {};
        for (var j = 0; j < allAdjacentFences.length; j++) {
            adjacentIds[allAdjacentFences[j].fenceId] = true;
        }

        var html = '<div class="courier-result">';

        html += '<div class="result-section">'
            + '<div class="section-title">匹配快递员（' + matches.length + ' 人）</div>';

        for (var k = 0; k < matches.length; k++) {
            var m = matches[k];
            html += '<div class="courier-card target">'
                + '<div class="courier-name">' + escapeHtml(m.courier.name) + '</div>'
                + '<div class="courier-phone">' + escapeHtml(m.courier.mobile) + '</div>'
                + '<div class="courier-fence">所属围栏：' + escapeHtml(m.fence.fenceName) + '</div>'
                + '</div>';
        }

        html += '</div>';

        if (allAdjacentFences.length > 0) {
            html += '<div class="result-section">'
                + '<div class="section-title">附近围栏快递员（' + allAdjacentFences.length + ' 个相邻围栏）</div>';

            for (var a = 0; a < allAdjacentFences.length; a++) {
                var af = allAdjacentFences[a];
                var couriers = af.couriers || [];

                html += '<div class="courier-card adjacent">'
                    + '<div class="courier-fence-name">'
                    + escapeHtml(af.fenceName)
                    + ' <span class="badge">' + couriers.length + ' 名快递员</span>'
                    + '</div>';

                if (couriers.length > 0) {
                    html += '<div class="courier-list">';
                    for (var c = 0; c < couriers.length; c++) {
                        html += '<div class="courier-item">'
                            + escapeHtml(couriers[c].name) + ' '
                            + '<span class="phone">' + escapeHtml(couriers[c].mobile) + '</span>'
                            + '</div>';
                    }
                    html += '</div>';
                }

                html += '</div>';
            }

            html += '</div>';
        }

        html += '</div>';
        $resultTarget.innerHTML = html;
    }

    /* =========================================================
        Main search
    ========================================================= */

    function search() {
        var fences = window.FenceUI.getFences();
        if (!fences || fences.length === 0) {
            setStatus('电子围栏数据尚未加载完成', 'error');
            return;
        }

        var query = $courierInput ? $courierInput.value.trim() : '';
        if (!query) {
            setStatus('请输入快递员姓名', 'error');
            return;
        }

        clearOverlays();

        var matches = findCouriersByName(fences, query);

        if (matches.length === 0) {
            if ($resultTarget) $resultTarget.innerHTML = '';
            setStatus('未找到匹配的快递员', 'error');
            renderResults([], [], []);
            return;
        }

        var targetFences = {};
        for (var i = 0; i < matches.length; i++) {
            targetFences[matches[i].fence.fenceId] = matches[i].fence;
        }

        var targetList = [];
        for (var id in targetFences) targetList.push(targetFences[id]);

        var adjacentIds = {};
        var adjacentList = [];

        for (var j = 0; j < targetList.length; j++) {
            var adj = findAdjacentFences(targetList[j], fences);
            for (var k = 0; k < adj.length; k++) {
                if (!adjacentIds[adj[k].fenceId] && !targetFences[adj[k].fenceId]) {
                    adjacentIds[adj[k].fenceId] = true;
                    adjacentList.push(adj[k]);
                }
            }
        }

        for (var t = 0; t < targetList.length; t++) {
            highlightFence(targetList[t], '#dc2626');
        }

        for (var a = 0; a < adjacentList.length; a++) {
            highlightFence(adjacentList[a], '#f59e0b');
        }

        for (var tm = 0; tm < targetList.length; tm++) {
            addFenceMarker(targetList[tm],
                (targetList[tm].couriers || []).length, '#dc2626');
        }

        var allFences = targetList.concat(adjacentList);
        fitMapToFences(allFences);

        renderResults(matches, targetList, adjacentList);

        setStatus(
            '找到 ' + matches.length + ' 名匹配快递员，'
            + '所在围栏 ' + targetList.length + ' 个，'
            + '相邻围栏 ' + adjacentList.length + ' 个',
            'success'
        );
    }

    /* =========================================================
        Tab activation / deactivation
    ========================================================= */

    function onCourierKeydown(e) {
        if (e.key === 'Enter') search();
    }

    function onActivate() {
        if (!$courierInput) {
            $courierInput  = document.getElementById('courierInput');
            $courierButton = document.getElementById('courierSearchButton');
            $resultTarget  = document.getElementById('result');
            $statusTarget  = document.getElementById('status');

            if ($courierButton) {
                $courierButton.addEventListener('click', search);
            }
            if ($courierInput) {
                $courierInput.addEventListener('keydown', onCourierKeydown);
            }
        }

        if ($courierInput) $courierInput.value = '';
        if ($resultTarget) $resultTarget.innerHTML = '';
    }

    function onDeactivate() {
        clearOverlays();
        activeMatches = [];
        if ($resultTarget) $resultTarget.innerHTML = '';
    }

    /* =========================================================
        Register with FenceUI
    ========================================================= */

    window.FenceUI.registerTab('courier', {
        activate:   onActivate,
        deactivate: onDeactivate
    });

})();
