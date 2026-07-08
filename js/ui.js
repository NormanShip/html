(function () {
    'use strict';

    var map = null;
    var fences = [];

    var searchMarker = null;
    var highlightPolygon = null;
    var nearbyMarkers = [];

    var fencePolygons = [];

    /* =========================================================
        DOM refs
    ========================================================= */

    var $status = null;
    var $result = null;
    var $poiCandidates = null;
    var $poiList = null;
    var $nearby = null;
    var $nearbyList = null;

    function cacheDom() {
        $status       = document.getElementById('status');
        $result       = document.getElementById('result');
        $poiCandidates = document.getElementById('poiCandidates');
        $poiList      = document.getElementById('poiList');
        $nearby       = document.getElementById('nearby');
        $nearbyList   = document.getElementById('nearbyList');
    }

    /* =========================================================
        Utility
    ========================================================= */

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /* =========================================================
        Status
    ========================================================= */

    function setStatus(message, type) {
        if (!$status) return;
        $status.textContent = message;
        $status.className = 'status';
        if (type) $status.classList.add(type);
    }

    /* =========================================================
        Map
    ========================================================= */

    function initMap() {
        map = new AMap.Map('map', {
            zoom: 12,
            center: [112.5283, 32.9908]
        });

        map.on('click', function (e) {
            var lng = e.lnglat.lng;
            var lat = e.lnglat.lat;
            var fence = window.FenceService.matchFence(
                { lng: lng, lat: lat }, fences
            );

            if (fence) {
                showClickedFence(fence);
            }
        });
    }

    function getMap() {
        return map;
    }

    function getFences() {
        return fences;
    }

    /* =========================================================
        Draw all fence polygons
    ========================================================= */

    function drawAllFences(fenceData) {
        fences = fenceData;

        for (var i = 0; i < fences.length; i++) {
            var g = fences[i].geometry;
            if (!g) continue;

            var coordsList = (g.type === 'Polygon')
                ? [g.coordinates]
                : g.coordinates;

            for (var j = 0; j < coordsList.length; j++) {
                drawFencePoly(coordsList[j], fences[i]);
            }
        }
    }

    function drawFencePoly(coordinates, fence) {
        if (!coordinates || coordinates.length === 0) return;

        var poly = new AMap.Polygon({
            path: coordinates,
            strokeColor: '#1677ff',
            strokeWeight: 1,
            strokeOpacity: 0.5,
            fillColor: '#1677ff',
            fillOpacity: 0.06,
            extData: fence
        });

        poly.on('click', function () {
            var f = poly.getExtData();
            showClickedFence(f);
        });

        map.add(poly);
        fencePolygons.push(poly);
    }

    /* =========================================================
        Overlay management
    ========================================================= */

    function clearSearchMarker() {
        if (searchMarker) {
            map.remove(searchMarker);
            searchMarker = null;
        }
    }

    function clearHighlight() {
        if (highlightPolygon) {
            map.remove(highlightPolygon);
            highlightPolygon = null;
        }
    }

    function clearNearbyMarkers() {
        for (var i = 0; i < nearbyMarkers.length; i++) {
            map.remove(nearbyMarkers[i]);
        }
        nearbyMarkers.length = 0;
    }

    function clearAllOverlays() {
        clearSearchMarker();
        clearHighlight();
        clearNearbyMarkers();
    }

    /* =========================================================
        Show search marker
    ========================================================= */

    function showSearchMarker(lng, lat) {
        clearSearchMarker();

        searchMarker = new AMap.Marker({
            position: [lng, lat],
            animation: 'AMAP_ANIMATION_DROP',
            title: '\u67e5\u8be2\u4f4d\u7f6e'
        });

        map.add(searchMarker);
        map.setZoomAndCenter(16, [lng, lat]);
    }

    /* =========================================================
        Highlight matched fence
    ========================================================= */

    function highlightFence(fence) {
        clearHighlight();

        if (!fence) return;

        var g = fence.geometry;
        if (!g) return;

        var coordsList = (g.type === 'Polygon')
            ? [g.coordinates]
            : g.coordinates;

        highlightPolygon = [];

        for (var i = 0; i < coordsList.length; i++) {
            var poly = new AMap.Polygon({
                path: coordsList[i],
                strokeColor: '#16a34a',
                strokeWeight: 3,
                strokeOpacity: 0.9,
                fillColor: '#16a34a',
                fillOpacity: 0.15,
                zIndex: 100
            });
            map.add(poly);
            highlightPolygon.push(poly);
        }
    }

    function removeHighlight() {
        if (highlightPolygon) {
            for (var i = 0; i < highlightPolygon.length; i++) {
                map.remove(highlightPolygon[i]);
            }
            highlightPolygon = null;
        }
    }

    /* =========================================================
        Show nearby POI markers
    ========================================================= */

    function showNearbyMarkers(nearbyPois) {
        clearNearbyMarkers();

        if (!nearbyPois || nearbyPois.length === 0) return;

        for (var i = 0; i < nearbyPois.length && i < 10; i++) {
            var poi = nearbyPois[i];

            var marker = new AMap.Marker({
                position: [poi.lng || 0, poi.lat || 0],
                content: '<div style="'
                    + 'background:#f59e0b;color:#fff;'
                    + 'border-radius:50%;width:20px;height:20px;'
                    + 'line-height:20px;text-align:center;font-size:10px;'
                    + 'font-weight:bold;box-shadow:0 1px 3px rgba(0,0,0,.3)'
                    + '">' + (i + 1) + '</div>',
                offset: new AMap.Pixel(-10, -10),
                title: poi.name
            });

            map.add(marker);
            nearbyMarkers.push(marker);
        }
    }

    /* =========================================================
        POI Candidate List
    ========================================================= */

    function renderPoiCandidates(pois, onSelect) {
        if (!$poiCandidates || !$poiList) return;

        if (!pois || pois.length === 0) {
            $poiCandidates.style.display = 'none';
            return;
        }

        $poiCandidates.style.display = 'block';

        var html = '';
        for (var i = 0; i < pois.length; i++) {
            var p = pois[i];
            var typeLabel = p.type ? (' | ' + escapeHtml(p.type)) : '';

            html += '<div class="poi-item" data-index="' + i + '">'
                + '<input type="radio" name="poiSelect" class="poi-radio" value="' + i + '">'
                + '<div class="poi-info">'
                + '<div class="poi-name">' + escapeHtml(p.name) + '</div>'
                + '<div class="poi-address">' + escapeHtml(p.address || '') + '</div>'
                + '<div class="poi-type">' + escapeHtml(p.district || '') + typeLabel + '</div>'
                + '</div>'
                + '</div>';
        }

        html += '<div class="poi-actions">'
            + '<button class="poi-confirm-btn" id="poiConfirmBtn" disabled>'
            + '\u786e\u8ba4\u9009\u62e9</button>'
            + '</div>';

        $poiList.innerHTML = html;

        var items = $poiList.querySelectorAll('.poi-item');
        var radios = $poiList.querySelectorAll('.poi-radio');
        var confirmBtn = document.getElementById('poiConfirmBtn');

        for (var j = 0; j < items.length; j++) {
            (function (index) {
                items[j].addEventListener('click', function () {
                    radios[index].checked = true;

                    for (var k = 0; k < items.length; k++) {
                        items[k].classList.remove('selected');
                    }
                    items[index].classList.add('selected');

                    if (confirmBtn) confirmBtn.disabled = false;
                });
            })(j);
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', function () {
                var checked = $poiList.querySelector('.poi-radio:checked');
                if (checked && typeof onSelect === 'function') {
                    var idx = parseInt(checked.value, 10);
                    onSelect(pois[idx]);
                }
            });
        }
    }

    function hidePoiCandidates() {
        if ($poiCandidates) $poiCandidates.style.display = 'none';
    }

    /* =========================================================
        Result panel
    ========================================================= */

    function renderResult(data) {
        if (!$result) return;

        var location = data.location;
        var fence = data.fence;
        var fenceDetail = data.fenceDetail;
        var nearbyPois = data.nearbyPois;

        var html = '<div class="result-section">'
            + '<div class="section-title">\u67e5\u8be2\u7ed3\u679c</div>';

        html += '<div class="result-item">'
            + '<div class="label">\u67e5\u8be2\u5730\u70b9</div>'
            + '<div class="value">' + escapeHtml(location.name) + '</div>'
            + '</div>';

        if (location.address && location.address !== location.name) {
            html += '<div class="result-item">'
                + '<div class="label">\u5730\u5740</div>'
                + '<div class="value">' + escapeHtml(location.address) + '</div>'
                + '</div>';
        }

        html += '<div class="result-item">'
            + '<div class="label">GCJ-02 \u5750\u6807</div>'
            + '<div class="value">' + location.lng.toFixed(6)
            + ', ' + location.lat.toFixed(6) + '</div>'
            + '</div>';

        html += '</div>';

        /* fence result */
        if (fence) {
            html += '<div class="result-section">'
                + '<div class="section-title">\u7535\u5b50\u56f4\u680f</div>';

            html += '<div class="fence-card">'
                + '<div class="fence-name">'
                + escapeHtml(fence.fenceName)
                + '</div>'
                + '</div>';

            html += '<div class="result-item">'
                + '<div class="label">\u56f4\u680f\u7f16\u53f7</div>'
                + '<div class="value">' + escapeHtml(fence.fenceId) + '</div>'
                + '</div>';

            /* couriers */
            var couriers = fence.couriers || [];
            if (couriers.length > 0) {
                html += '<div class="result-item">'
                    + '<div class="label">\u5feb\u9012\u5458</div>';

                for (var i = 0; i < couriers.length; i++) {
                    var c = couriers[i];
                    html += '<div class="courier-card target">'
                        + '<div class="courier-name">'
                        + escapeHtml(c.name)
                        + '</div>'
                        + '<div class="courier-phone">'
                        + escapeHtml(c.mobile || '')
                        + '</div>'
                        + '</div>';
                }

                html += '</div>';
            } else {
                html += '<div class="result-item">'
                    + '<div class="value error">\u6682\u65e0\u5feb\u9012\u5458\u4fe1\u606f</div>'
                    + '</div>';
            }
        } else {
            html += '<div class="result-section">'
                + '<div class="section-title">\u7535\u5b50\u56f4\u680f</div>'
                + '<div class="result-item">'
                + '<div class="value error">\u672a\u627e\u5230\u5bf9\u5e94\u56f4\u680f</div>'
                + '</div>'
                + '</div>';
        }

        html += '</div>';

        $result.innerHTML = html;
    }

    /* =========================================================
        Nearby landmarks panel
    ========================================================= */

    function renderNearbyList(pois) {
        if (!$nearby || !$nearbyList) return;

        if (!pois || pois.length === 0) {
            $nearby.style.display = 'none';
            return;
        }

        $nearby.style.display = 'block';

        var html = '<h2>\u9644\u8fd1\u5730\u6807</h2>';

        for (var i = 0; i < pois.length; i++) {
            var p = pois[i];
            var distText = p.distance < 1000
                ? p.distance + 'm'
                : (p.distance / 1000).toFixed(1) + 'km';

            html += '<div class="nearby-item">'
                + '<span class="nearby-name">' + escapeHtml(p.name) + '</span>'
                + '<span class="nearby-distance">' + distText + '</span>'
                + '</div>';
        }

        $nearbyList.innerHTML = html;
    }

    /* =========================================================
        Clicked fence (from map interaction)
    ========================================================= */

    function showClickedFence(fence) {
        if (!$result) return;

        var couriers = fence.couriers || [];

        var html = '<div class="result-section">'
            + '<div class="section-title">\u70b9\u51fb\u7684\u56f4\u680f</div>';

        html += '<div class="fence-card">'
            + '<div class="fence-name">'
            + escapeHtml(fence.fenceName)
            + '</div>'
            + '</div>';

        html += '<div class="result-item">'
            + '<div class="label">\u56f4\u680f\u7f16\u53f7</div>'
            + '<div class="value">' + escapeHtml(fence.fenceId) + '</div>'
            + '</div>';

        if (couriers.length > 0) {
            html += '<div class="result-item">'
                + '<div class="label">\u5feb\u9012\u5458 (' + couriers.length + '\u4eba)</div>';

            for (var i = 0; i < couriers.length; i++) {
                var c = couriers[i];
                html += '<div class="courier-item">'
                    + escapeHtml(c.name)
                    + ' <span class="phone">' + escapeHtml(c.mobile || '') + '</span>'
                    + '</div>';
            }

            html += '</div>';
        }

        html += '</div>';
        $result.innerHTML = html;

        setStatus('\u5df2\u9009\u62e9\u56f4\u680f\uff1a' + fence.fenceName, 'success');
    }

    /* =========================================================
        Show on map (complete)
    ========================================================= */

    function showOnMap(location, fence, nearbyPois) {
        showSearchMarker(location.lng, location.lat);

        if (fence) {
            highlightFence(fence);
        }

        if (nearbyPois && nearbyPois.length > 0) {
            showNearbyMarkers(nearbyPois);
        }
    }

    /* =========================================================
        Reset panel for new search
    ========================================================= */

    function resetPanel() {
        hidePoiCandidates();
        if ($result) $result.innerHTML = '';
        if ($nearby) $nearby.style.display = 'none';
    }

    /* =========================================================
        Export
    ========================================================= */

    window.FenceUI = window.FenceUI || {};

    window.FenceUI.getMap       = getMap;
    window.FenceUI.getFences    = getFences;

    window.FenceUI.initMap         = initMap;
    window.FenceUI.drawAllFences   = drawAllFences;
    window.FenceUI.clearAllOverlays = clearAllOverlays;
    window.FenceUI.showSearchMarker = showSearchMarker;
    window.FenceUI.removeHighlight  = removeHighlight;
    window.FenceUI.clearNearbyMarkers = clearNearbyMarkers;
    window.FenceUI.setStatus       = setStatus;
    window.FenceUI.escapeHtml      = escapeHtml;
    window.FenceUI.renderPoiCandidates = renderPoiCandidates;
    window.FenceUI.hidePoiCandidates  = hidePoiCandidates;
    window.FenceUI.renderResult       = renderResult;
    window.FenceUI.renderNearbyList   = renderNearbyList;
    window.FenceUI.showOnMap          = showOnMap;
    window.FenceUI.resetPanel         = resetPanel;

    /* tab system */
    var tabRegistry = {};
    var currentTab  = 'poi';

    window.FenceUI.registerTab = function (name, callbacks) {
        tabRegistry[name] = callbacks;
    };

    window.FenceUI.switchTab = function (name) {
        if (name === currentTab) return;
        var prev = tabRegistry[currentTab];
        if (prev && prev.deactivate) prev.deactivate();
        currentTab = name;
        var next = tabRegistry[name];
        if (next && next.activate) next.activate();
    };

    cacheDom();
})();
