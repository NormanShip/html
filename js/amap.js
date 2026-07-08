(function () {
    'use strict';

    var placeSearch = null;
    var geocoder = null;

    function init() {
        placeSearch = new AMap.PlaceSearch({
            city: '411300',
            citylimit: true,
            pageSize: 10,
            pageIndex: 1,
            extensions: 'all'
        });

        geocoder = new AMap.Geocoder({ city: '411300' });
    }

    /* =========================================================
        POI keyword search
    ========================================================= */

    function searchPoi(keyword) {
        return new Promise(function (resolve, reject) {
            if (!placeSearch) {
                reject(new Error('PlaceSearch not initialized'));
                return;
            }

            placeSearch.search(keyword, function (status, result) {
                if (status === 'complete' && result.info === 'OK') {
                    var pois = (result.poiList && result.poiList.pois) || [];
                    var list = [];

                    for (var i = 0; i < pois.length; i++) {
                        var p = pois[i];
                        list.push({
                            id: p.id,
                            name: p.name,
                            address: p.address || p.name,
                            lng: p.location.lng,
                            lat: p.location.lat,
                            type: p.type || '',
                            district: p.adname || ''
                        });
                    }

                    resolve(list);
                } else {
                    reject(new Error(
                        'POI search failed: ' + (result && result.info || status)
                    ));
                }
            });
        });
    }

    /* =========================================================
        Geocoder — structured address to coordinates
    ========================================================= */

    function geocodeAddress(address) {
        return new Promise(function (resolve, reject) {
            if (!geocoder) {
                reject(new Error('Geocoder not initialized'));
                return;
            }

            var full = '\u5357\u9633\u5e02' + address;

            geocoder.getLocation(full, function (status, result) {
                if (status === 'complete'
                    && result.info === 'OK'
                    && result.geocodes
                    && result.geocodes.length > 0) {

                    var g = result.geocodes[0];
                    resolve({
                        name: g.formattedAddress || full,
                        address: g.formattedAddress || full,
                        lng: g.location.lng,
                        lat: g.location.lat,
                        district: (g.addressComponent && g.addressComponent.district) || '',
                        level: g.level || ''
                    });
                } else {
                    reject(new Error(
                        'Geocode failed: ' + (result && result.info || status)
                    ));
                }
            });
        });
    }

    /* =========================================================
        Nearby POI search
    ========================================================= */

    function searchNearby(lng, lat, radius) {
        radius = radius || 500;

        return new Promise(function (resolve, reject) {
            if (!placeSearch) {
                reject(new Error('PlaceSearch not initialized'));
                return;
            }

            placeSearch.searchNearBy(
                '',
                [lng, lat],
                radius,
                function (status, result) {
                    if (status === 'complete' && result.info === 'OK') {
                        var pois = (result.poiList && result.poiList.pois) || [];
                        var list = [];

                        for (var i = 0; i < pois.length; i++) {
                            var p = pois[i];
                            list.push({
                                id: p.id,
                                name: p.name,
                                address: p.address || '',
                                distance: p.distance || 0,
                                type: p.type || ''
                            });
                        }

                        resolve(list);
                    } else {
                        resolve([]);
                    }
                }
            );
        });
    }

    /* =========================================================
        Export
    ========================================================= */

    window.AmapService = {
        init: init,
        searchPoi: searchPoi,
        geocodeAddress: geocodeAddress,
        searchNearby: searchNearby
    };
})();
