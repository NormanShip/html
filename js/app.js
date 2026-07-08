(function () {
    'use strict';

    var fences = [];

    /* =========================================================
        Load fences
    ========================================================= */

    async function loadFences() {
        if (typeof FENCE_DATA !== 'undefined' && FENCE_DATA.fences) {
            fences = FENCE_DATA.fences;
            return fences;
        }

        try {
            var resp = await fetch('./data/fences.json');
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            fences = data.fences || [];
            return fences;
        } catch (e) {
            console.error('Fence load failed:', e);
            throw e;
        }
    }

    /* =========================================================
        Tab switching
    ========================================================= */

    function setupTabs() {
        var tabs = document.querySelectorAll('.search-tab');

        for (var i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener('click', function () {
                var name = this.getAttribute('data-tab');
                if (!name) return;

                /* activate tab button */
                for (var j = 0; j < tabs.length; j++) {
                    tabs[j].classList.remove('active');
                }
                this.classList.add('active');

                /* activate search panel */
                var panels = document.querySelectorAll('.search-panel');
                for (var k = 0; k < panels.length; k++) {
                    panels[k].classList.remove('active');
                }
                var panelId = 'searchPanel' + name.charAt(0).toUpperCase() + name.slice(1);
                var panel = document.getElementById(panelId);
                if (panel) panel.classList.add('active');

                /* notify tab callbacks */
                window.FenceUI.switchTab(name);
            });
        }
    }

    /* =========================================================
        POI Search flow
    ========================================================= */

    async function handlePoiSearch() {
        var input = document.getElementById('poiInput');
        var btn = document.getElementById('poiSearchBtn');
        var keyword = input ? input.value.trim() : '';

        if (!keyword) {
            window.FenceUI.setStatus('\u8bf7\u8f93\u5165\u5730\u70b9\u540d\u79f0', 'error');
            return;
        }

        try {
            btn.disabled = true;
            window.FenceUI.setStatus('\u6b63\u5728\u641c\u7d22\u5730\u70b9...');
            window.FenceUI.resetPanel();

            var pois = await window.AmapService.searchPoi(keyword);

            if (pois.length === 0) {
                window.FenceUI.setStatus('\u672a\u627e\u5230\u5339\u914d\u5730\u70b9', 'error');
                return;
            }

            window.FenceUI.renderPoiCandidates(pois, handlePoiSelect);
            window.FenceUI.setStatus(
                '\u627e\u5230 ' + pois.length + ' \u4e2a\u5019\u9009\u5730\u70b9\uff0c\u8bf7\u9009\u62e9'
            );

        } catch (e) {
            console.error('POI search error:', e);
            window.FenceUI.setStatus('\u641c\u7d22\u5931\u8d25\uff1a' + e.message, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    /* =========================================================
        POI selected → match + render
    ========================================================= */

    async function handlePoiSelect(poi) {
        if (!poi) return;

        window.FenceUI.clearAllOverlays();
        window.FenceUI.hidePoiCandidates();
        window.FenceUI.setStatus('\u6b63\u5728\u5339\u914d\u56f4\u680f...');

        var location = {
            name: poi.name,
            address: poi.address || poi.name,
            lng: poi.lng,
            lat: poi.lat
        };

        var fence = window.FenceService.matchFence(location, fences);

        var nearbyPois = [];
        try {
            nearbyPois = await window.AmapService.searchNearby(
                location.lng, location.lat, 500
            );
        } catch (e) {
            console.warn('Nearby search error:', e);
        }

        window.FenceUI.renderResult({
            location: location,
            fence: fence,
            nearbyPois: nearbyPois
        });

        window.FenceUI.renderNearbyList(nearbyPois);

        window.FenceUI.showOnMap(location, fence, nearbyPois);

        if (fence) {
            window.FenceUI.setStatus(
                '\u5339\u914d\u56f4\u680f\uff1a' + fence.fenceName, 'success'
            );
        } else {
            window.FenceUI.setStatus(
                '\u672a\u627e\u5230\u5bf9\u5e94\u56f4\u680f\uff0c\u8bf7\u53c2\u8003\u9644\u8fd1\u5730\u6807', 'error'
            );
        }
    }

    /* =========================================================
        Address geocode flow
    ========================================================= */

    async function handleAddressSearch() {
        var input = document.getElementById('addressInput');
        var btn = document.getElementById('addressSearchBtn');
        var address = input ? input.value.trim() : '';

        if (!address) {
            window.FenceUI.setStatus('\u8bf7\u8f93\u5165\u5730\u5740', 'error');
            return;
        }

        try {
            btn.disabled = true;
            window.FenceUI.clearAllOverlays();
            window.FenceUI.resetPanel();
            window.FenceUI.setStatus('\u6b63\u5728\u89e3\u6790\u5730\u5740...');

            var location = await window.AmapService.geocodeAddress(address);

            var fence = window.FenceService.matchFence(location, fences);

            var nearbyPois = [];
            try {
                nearbyPois = await window.AmapService.searchNearby(
                    location.lng, location.lat, 500
                );
            } catch (e) {
                console.warn('Nearby search error:', e);
            }

            window.FenceUI.renderResult({
                location: location,
                fence: fence,
                nearbyPois: nearbyPois
            });

            window.FenceUI.renderNearbyList(nearbyPois);

            window.FenceUI.showOnMap(location, fence, nearbyPois);

            if (fence) {
                window.FenceUI.setStatus(
                    '\u89e3\u6790\u6210\u529f\uff0c\u5339\u914d\u56f4\u680f\uff1a' + fence.fenceName,
                    'success'
                );
            } else {
                window.FenceUI.setStatus(
                    '\u89e3\u6790\u6210\u529f\uff0c\u4f46\u672a\u627e\u5230\u5bf9\u5e94\u56f4\u680f',
                    'error'
                );
            }
        } catch (e) {
            console.error('Geocode error:', e);
            window.FenceUI.setStatus('\u89e3\u6790\u5931\u8d25\uff1a' + e.message, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    /* =========================================================
        Wire up events
    ========================================================= */

    function bindEvents() {
        var poiSearchBtn = document.getElementById('poiSearchBtn');
        var poiInput = document.getElementById('poiInput');
        var addressSearchBtn = document.getElementById('addressSearchBtn');
        var addressInput = document.getElementById('addressInput');

        if (poiSearchBtn) {
            poiSearchBtn.addEventListener('click', handlePoiSearch);
        }
        if (poiInput) {
            poiInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') handlePoiSearch();
            });
        }

        if (addressSearchBtn) {
            addressSearchBtn.addEventListener('click', handleAddressSearch);
        }
        if (addressInput) {
            addressInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') handleAddressSearch();
            });
        }
    }

    /* =========================================================
        Bootstrap
    ========================================================= */

    async function bootstrap() {
        try {
            window.FenceUI.setStatus('\u6b63\u5728\u52a0\u8f7d\u7535\u5b50\u56f4\u680f\u6570\u636e...');

            var fenceData = await loadFences();

            window.FenceUI.initMap();
            window.AmapService.init();
            window.FenceUI.drawAllFences(fenceData);

            setupTabs();
            bindEvents();

            window.FenceUI.setStatus(
                '\u5df2\u52a0\u8f7d ' + fenceData.length + ' \u4e2a\u7535\u5b50\u56f4\u680f'
            );

        } catch (e) {
            console.error('Bootstrap error:', e);
            window.FenceUI.setStatus(
                '\u521d\u59cb\u5316\u5931\u8d25\uff1a' + e.message, 'error'
            );
        }
    }

    bootstrap();
})();
