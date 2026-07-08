(function () {
    'use strict';

    function isPointInRing(point, ring) {
        var x = point[0], y = point[1];
        var inside = false;

        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            var xi = ring[i][0], yi = ring[i][1];
            var xj = ring[j][0], yj = ring[j][1];

            var intersect = ((yi > y) !== (yj > y))
                && (x < ((xj - xi) * (y - yi) / (yj - yi) + xi));

            if (intersect) inside = !inside;
        }

        return inside;
    }

    function isPointInPolygon(point, polygonCoordinates) {
        if (!polygonCoordinates || polygonCoordinates.length === 0) return false;

        if (!isPointInRing(point, polygonCoordinates[0])) return false;

        for (var i = 1; i < polygonCoordinates.length; i++) {
            if (isPointInRing(point, polygonCoordinates[i])) return false;
        }

        return true;
    }

    function isPointInGeometry(point, geometry) {
        if (!geometry) return false;

        if (geometry.type === 'Polygon') {
            return isPointInPolygon(point, geometry.coordinates);
        }

        if (geometry.type === 'MultiPolygon') {
            for (var i = 0; i < geometry.coordinates.length; i++) {
                if (isPointInPolygon(point, geometry.coordinates[i])) return true;
            }
        }

        return false;
    }

    function matchFence(location, fences) {
        if (!location || !fences || fences.length === 0) return null;

        var point = [location.lng, location.lat];

        for (var i = 0; i < fences.length; i++) {
            if (isPointInGeometry(point, fences[i].geometry)) {
                return fences[i];
            }
        }

        return null;
    }

    function matchFenceWithDetail(location, fences) {
        var fence = matchFence(location, fences);

        if (!fence) {
            return { matched: false, fence: null };
        }

        return {
            matched: true,
            fence: fence,
            fenceId: fence.fenceId,
            fenceName: fence.fenceName,
            couriers: fence.couriers || [],
            station: fence.station || '',
            provinceName: fence.provinceName || '',
            cityName: fence.cityName || ''
        };
    }

    window.FenceService = {
        matchFence: matchFence,
        matchFenceWithDetail: matchFenceWithDetail,
        isPointInRing: isPointInRing,
        isPointInPolygon: isPointInPolygon,
        isPointInGeometry: isPointInGeometry
    };
})();
