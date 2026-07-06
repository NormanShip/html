(function () {
    'use strict';

    /* =========================================================
        Point In Ring —  Ray Casting Algorithm
    ========================================================= */

    function isPointInRing(point, ring) {
        const x = point[0];
        const y = point[1];
        let inside = false;

        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0];
            const yi = ring[i][1];
            const xj = ring[j][0];
            const yj = ring[j][1];

            const intersect =
                ((yi > y) !== (yj > y)) &&
                (x < ((xj - xi) * (y - yi) / (yj - yi) + xi));

            if (intersect) inside = !inside;
        }

        return inside;
    }


    /* =========================================================
        Point In Polygon —  handles holes
    ========================================================= */

    function isPointInPolygon(point, polygonCoordinates) {
        if (!polygonCoordinates || polygonCoordinates.length === 0) {
            return false;
        }

        const outerRing = polygonCoordinates[0];

        if (!isPointInRing(point, outerRing)) {
            return false;
        }

        for (let i = 1; i < polygonCoordinates.length; i++) {
            if (isPointInRing(point, polygonCoordinates[i])) {
                return false;
            }
        }

        return true;
    }


    /* =========================================================
        Point In Geometry —  Polygon / MultiPolygon dispatch
    ========================================================= */

    function isPointInGeometry(point, geometry) {
        if (!geometry) return false;

        if (geometry.type === 'Polygon') {
            return isPointInPolygon(point, geometry.coordinates);
        }

        if (geometry.type === 'MultiPolygon') {
            for (const polygon of geometry.coordinates) {
                if (isPointInPolygon(point, polygon)) {
                    return true;
                }
            }
        }

        return false;
    }


    /* =========================================================
        Find Fence —  search all fences for a point
    ========================================================= */

    function findFence(lng, lat, fences) {
        const point = [lng, lat];

        for (const fence of fences) {
            if (isPointInGeometry(point, fence.geometry)) {
                return fence;
            }
        }

        return null;
    }


    /* =========================================================
        Export
    ========================================================= */

    window.FenceCore = {
        isPointInRing:      isPointInRing,
        isPointInPolygon:   isPointInPolygon,
        isPointInGeometry:  isPointInGeometry,
        findFence:          findFence
    };
})();
