(function () {
    'use strict';

    /* =========================================================
        FenceUI namespace  —  shared state & tab system
    ========================================================= */

    window.FenceUI = window.FenceUI || {};

    var tabRegistry  = {};
    var currentTab   = 'address';

    window.FenceUI.getMap     = function () { return map; };
    window.FenceUI.getFences  = function () { return fences; };

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

    /* =========================================================
        Config
    ========================================================= */

    const CITY_CODE      = '411300';
    const CITY_NAME      = '南阳市';
    const FENCE_DATA_URL = './data/fences.json';


    /* =========================================================
        State
    ========================================================= */

    let map;
    let fences       = [];
    let searchMarker = null;


    /* =========================================================
        DOM refs
    ========================================================= */

    const $address = document.getElementById('addressInput');
    const $search  = document.getElementById('searchButton');
    const $status  = document.getElementById('status');
    const $result  = document.getElementById('result');


    /* =========================================================
        Escape HTML
    ========================================================= */

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&',  '&amp;')
            .replaceAll('<',  '&lt;')
            .replaceAll('>',  '&gt;')
            .replaceAll('"',  '&quot;')
            .replaceAll("'",  '&#039;');
    }


    /* =========================================================
        Status bar
    ========================================================= */

    function setStatus(message, type) {
        $status.textContent = message;
        $status.className   = 'status';
        if (type) $status.classList.add(type);
    }


    /* =========================================================
        Init Map
    ========================================================= */

    function initMap() {
        map = new AMap.Map('map', {
            zoom:   12,
            center: [112.5283, 32.9908]
        });
    }


    /* =========================================================
        Load fences
    ========================================================= */

    async function loadFences() {
        try {
            setStatus('正在加载电子围栏数据...');

            const response = await fetch(FENCE_DATA_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            fences      = data.fences || [];

            drawAllFences();
            setStatus(`已加载 ${fences.length} 个电子围栏`);
        } catch (error) {
            console.error('电子围栏加载失败：', error);
            setStatus('电子围栏加载失败：' + error.message, 'error');
        }
    }


    /* =========================================================
        Draw a Polygon (outer ring + holes)
    ========================================================= */

    function drawPolygon(coordinates, fence) {
        if (!coordinates || coordinates.length === 0) return;

        const polygon = new AMap.Polygon({
            path:         coordinates,
            strokeColor:  '#1677ff',
            strokeWeight:  1,
            strokeOpacity: 0.8,
            fillColor:    '#1677ff',
            fillOpacity:   0.08,
            extData:       fence
        });

        polygon.on('click', function () {
            const f = polygon.getExtData();
            showClickedFence(f);
        });

        map.add(polygon);
    }


    /* =========================================================
        Draw MultiPolygon
    ========================================================= */

    function drawMultiPolygon(coordinates, fence) {
        for (const poly of coordinates) drawPolygon(poly, fence);
    }


    /* =========================================================
        Draw all fences
    ========================================================= */

    function drawAllFences() {
        for (const fence of fences) {
            const g = fence.geometry;
            if (!g) continue;

            if (g.type === 'Polygon')       drawPolygon(g.coordinates, fence);
            else if (g.type === 'MultiPolygon') drawMultiPolygon(g.coordinates, fence);
        }
    }


    /* =========================================================
        Geocode  —  Amap Geocoder
    ========================================================= */

    function geocodeAddress(address) {
        return new Promise(function (resolve, reject) {
            const geocoder = new AMap.Geocoder({ city: CITY_CODE });
            const full     = `${CITY_NAME}${address}`;

            geocoder.getLocation(full, function (status, result) {
                if (
                    status === 'complete' &&
                    result.info === 'OK' &&
                    result.geocodes &&
                    result.geocodes.length > 0
                ) {
                    const g = result.geocodes[0];
                    resolve({
                        lng:              g.location.lng,
                        lat:              g.location.lat,
                        formattedAddress: g.formattedAddress || full,
                        district:         g.addressComponent?.district || '',
                        level:            g.level || ''
                    });
                } else {
                    reject(new Error('地址解析失败：' + (result?.info || status)));
                }
            });
        });
    }


    /* =========================================================
        Show search marker
    ========================================================= */

    function showSearchMarker(lng, lat) {
        if (searchMarker) map.remove(searchMarker);

        searchMarker = new AMap.Marker({ position: [lng, lat] });
        map.add(searchMarker);
        map.setZoomAndCenter(16, [lng, lat]);
    }


    /* =========================================================
        Couriers HTML
    ========================================================= */

    function buildCourierHtml(couriers) {
        if (!couriers || couriers.length === 0) {
            return `<div class="result-item">
                <div class="label">快递员</div>
                <div class="value">暂无快递员信息</div>
            </div>`;
        }

        let html = '';
        for (const c of couriers) {
            html += `<div class="result-item">
                <div class="label">快递员</div>
                <div class="value">${escapeHtml(c.name)}</div>
            </div>
            <div class="result-item">
                <div class="label">手机号</div>
                <div class="value">${escapeHtml(c.mobile)}</div>
            </div>`;
        }
        return html;
    }


    /* =========================================================
        Show fence result (search hit)
    ========================================================= */

    function showFenceResult(address, location, fence) {
        $result.innerHTML = `<div class="result-item">
            <div class="label">查询地址</div>
            <div class="value">${escapeHtml(address)}</div>
        </div>
        <div class="result-item">
            <div class="label">标准地址</div>
            <div class="value">${escapeHtml(location.formattedAddress)}</div>
        </div>
        <div class="result-item">
            <div class="label">GCJ-02 坐标</div>
            <div class="value">${location.lng}, ${location.lat}</div>
        </div>
        <div class="result-item">
            <div class="label">电子围栏</div>
            <div class="value success">${escapeHtml(fence.fenceName)}</div>
        </div>
        ${buildCourierHtml(fence.couriers)}`;
    }


    /* =========================================================
        Show fence result (map click)
    ========================================================= */

    function showClickedFence(fence) {
        $result.innerHTML = `<div class="result-item">
            <div class="label">电子围栏</div>
            <div class="value success">${escapeHtml(fence.fenceName)}</div>
        </div>
        <div class="result-item">
            <div class="label">Fence ID</div>
            <div class="value">${escapeHtml(fence.fenceId)}</div>
        </div>
        ${buildCourierHtml(fence.couriers)}`;

        setStatus('已选择电子围栏', 'success');
    }


    /* =========================================================
        Show not-found result
    ========================================================= */

    function showNotFoundResult(address, location) {
        $result.innerHTML = `<div class="result-item">
            <div class="label">查询地址</div>
            <div class="value">${escapeHtml(address)}</div>
        </div>
        <div class="result-item">
            <div class="label">标准地址</div>
            <div class="value">${escapeHtml(location.formattedAddress)}</div>
        </div>
        <div class="result-item">
            <div class="label">GCJ-02 坐标</div>
            <div class="value">${location.lng}, ${location.lat}</div>
        </div>
        <div class="result-item">
            <div class="value error">未找到对应电子围栏</div>
        </div>`;
    }


    /* =========================================================
        Search address  —  main flow
    ========================================================= */

    async function searchAddress() {
        const address = $address.value.trim();

        if (!address) {
            setStatus('请输入地址', 'error');
            return;
        }

        if (fences.length === 0) {
            setStatus('电子围栏数据尚未加载完成', 'error');
            return;
        }

        try {
            $search.disabled = true;
            setStatus('正在解析地址...');
            $result.innerHTML = '';

            const location = await geocodeAddress(address);
            showSearchMarker(location.lng, location.lat);

            const fence = window.FenceCore.findFence(location.lng, location.lat, fences);

            if (fence) {
                showFenceResult(address, location, fence);
                setStatus('查询成功', 'success');
            } else {
                showNotFoundResult(address, location);
                setStatus('该地址未找到对应电子围栏', 'error');
            }
        } catch (error) {
            console.error('查询失败：', error);
            setStatus(error.message, 'error');
        } finally {
            $search.disabled = false;
        }
    }


    /* =========================================================
        Event binding
    ========================================================= */

    $search.addEventListener('click', searchAddress);

    $address.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') searchAddress();
    });


    /* =========================================================
        Tabs
    ========================================================= */

    var $tabs = document.querySelectorAll('.search-tab');

    for (var i = 0; i < $tabs.length; i++) {
        $tabs[i].addEventListener('click', function () {
            var name = this.getAttribute('data-tab');
            if (!name) return;

            for (var j = 0; j < $tabs.length; j++) {
                $tabs[j].classList.remove('active');
            }
            this.classList.add('active');

            var $panels = document.querySelectorAll('.search-panel');
            for (var k = 0; k < $panels.length; k++) {
                $panels[k].classList.remove('active');
            }
            var $panel = document.getElementById('searchPanel' +
                name.charAt(0).toUpperCase() + name.slice(1));
            if ($panel) $panel.classList.add('active');

            window.FenceUI.switchTab(name);
        });
    }

    window.FenceUI.registerTab('address', {
        activate: function () {
            if ($address) $address.value = '';
            if ($result) $result.innerHTML = '';
            if ($status) {
                $status.textContent = '已加载 ' + fences.length + ' 个电子围栏';
                $status.className = 'status';
            }
        },
        deactivate: function () {
            if (searchMarker) {
                map.remove(searchMarker);
                searchMarker = null;
            }
            if ($result) $result.innerHTML = '';
        }
    });


    /* =========================================================
        Boot
    ========================================================= */

    initMap();
    loadFences();

})();
