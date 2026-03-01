import { Vectors } from "./vector.js";
const faceColors = [
    [1.00, 0.30, 0.04],
    [1.00, 0.85, 0.00],
    [0.01, 0.68, 0.35],
    [0.00, 0.44, 1.00],
    [0.25, 0.88, 1.00],
    [0.75, 0.10, 0.95],
];
const crosses = [
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
];
function addTriangle(triangles, v0, v1, v2, r, g, b) {
    triangles.push(v0[0], v0[1], v0[2], r, g, b, v1[0], v1[1], v1[2], r, g, b, v2[0], v2[1], v2[2], r, g, b);
}
function addPolygon(triangles, vertexes, face, colorByConnected, evenOdd) {
    const indexes = face.vertexIndexes;
    const colorIndex = (colorByConnected ? face.connectedIndex : face.colorIndex) % (faceColors.length);
    const [r, g, b] = faceColors[colorIndex];
    if (indexes.length === 3) {
        addTriangle(triangles, vertexes[indexes[0]], vertexes[indexes[1]], vertexes[indexes[2]], r, g, b);
        return;
    }
    else if (indexes.length === 4) {
        const v0 = vertexes[indexes[0]];
        const v1 = vertexes[indexes[1]];
        const v2 = vertexes[indexes[2]];
        const v3 = vertexes[indexes[3]];
        if (Vectors.getCrossPoint(v0, v1, v2, v3, cv)) {
            addTriangle(triangles, v1, v2, cv, r, g, b);
            addTriangle(triangles, v3, v0, cv, r, g, b);
        }
        else if (Vectors.getCrossPoint(v1, v2, v3, v0, cv)) {
            addTriangle(triangles, v0, v1, cv, r, g, b);
            addTriangle(triangles, v2, v3, cv, r, g, b);
        }
        else if (Vectors.getCrossPoint(v0, v2, v1, v3, cv)) {
            addTriangle(triangles, v0, v1, v2, r, g, b);
            addTriangle(triangles, v2, v3, v0, r, g, b);
        }
        else {
            cv[0] = 0;
            cv[1] = 0;
            cv[2] = 0;
            for (const idx of indexes) {
                const v = vertexes[idx];
                Vectors.add(cv, v, cv);
            }
            Vectors.div(cv, indexes.length, cv);
            addTriangle(triangles, v0, v1, cv, r, g, b);
            addTriangle(triangles, v1, v2, cv, r, g, b);
            addTriangle(triangles, v2, v3, cv, r, g, b);
            addTriangle(triangles, v3, v0, cv, r, g, b);
        }
        return;
    }
    else if (evenOdd && indexes.length === 5) {
        let hasCross = false;
        for (let i = 0; i < indexes.length; i++) {
            const crossPoint = Vectors.getCrossPoint(vertexes[indexes[(i + 1) % indexes.length]], vertexes[indexes[(i + 2) % indexes.length]], vertexes[indexes[(i + 3) % indexes.length]], vertexes[indexes[(i + 4) % indexes.length]], crosses[i].source);
            if (crossPoint) {
                hasCross = true;
            }
            crosses[i].value = crossPoint;
        }
        if (hasCross) {
            for (let i = 0; i < indexes.length; i++) {
                addTriangle(triangles, vertexes[indexes[i]], crosses[(i + 4) % indexes.length].value ?? vertexes[indexes[(i + 4) % indexes.length]], crosses[(i + 1) % indexes.length].value ?? vertexes[indexes[(i + 1) % indexes.length]], r, g, b);
            }
        }
        else {
            addTriangle(triangles, vertexes[indexes[0]], vertexes[indexes[1]], vertexes[indexes[2]], r, g, b);
            addTriangle(triangles, vertexes[indexes[0]], vertexes[indexes[2]], vertexes[indexes[3]], r, g, b);
            addTriangle(triangles, vertexes[indexes[0]], vertexes[indexes[3]], vertexes[indexes[4]], r, g, b);
        }
        return;
    }
    cv[0] = 0;
    cv[1] = 0;
    cv[2] = 0;
    for (const idx of indexes) {
        const v = vertexes[idx];
        Vectors.add(cv, v, cv);
    }
    Vectors.div(cv, indexes.length, cv);
    for (let i = 0; i < indexes.length; i++) {
        const v0 = vertexes[indexes[i]];
        const v1 = vertexes[indexes[(i + 1) % indexes.length]];
        const crossPoint = Vectors.getCrossPoint(vertexes[indexes[(i + indexes.length - 1) % indexes.length]], v0, v1, vertexes[indexes[(i + 2) % indexes.length]], crosses[i].source);
        crosses[i].value = null;
        if (crossPoint !== null) {
            const maxDistance = Vectors.middleDistanceSquared(v0, v1, cv);
            const distance1 = Vectors.middleDistanceSquared(v0, v1, crossPoint);
            const distance2 = Vectors.distanceSquared(crossPoint, cv);
            if (distance1 < maxDistance && distance2 < maxDistance) {
                crosses[i].value = crossPoint;
            }
        }
    }
    for (let i = 0; i < indexes.length; i++) {
        const beforeIndex = (i + indexes.length - 1) % indexes.length;
        const afterIndex = (i + 1) % indexes.length;
        const v0 = crosses[i].value ?? cv;
        const v1 = crosses[beforeIndex].value ?? vertexes[indexes[i]];
        const v2 = crosses[afterIndex].value ?? vertexes[indexes[afterIndex]];
        addTriangle(triangles, v0, v1, v2, r, g, b);
    }
}
function hasSelfIntersection(vertexes, face) {
    if (face.vertexIndexes.length <= 5) {
        return false;
    }
    const v0 = vertexes[face.vertexIndexes[0]];
    const v1 = vertexes[face.vertexIndexes[1]];
    const v2 = vertexes[face.vertexIndexes[2]];
    if (Vectors.hasIntersection(v2, vertexes[face.vertexIndexes[3]], v0, v1) ||
        Vectors.hasIntersection(vertexes[face.vertexIndexes[face.vertexIndexes.length - 1]], v0, v1, v2)) {
        return true;
    }
    for (let i = 3; i < face.vertexIndexes.length - 2; i++) {
        const va = vertexes[face.vertexIndexes[i]];
        const vb = vertexes[face.vertexIndexes[i + 1]];
        if (Vectors.hasIntersection(va, vb, v0, v1) || Vectors.hasIntersection(va, vb, v1, v2)) {
            return true;
        }
    }
    return false;
}
function getPlain(vertexes, face) {
    const normal = [0, 0, 0];
    const vertex0 = vertexes[face.vertexIndexes[0]];
    if (face.vertexIndexes.length <= 4) {
        Vectors.sub(vertexes[face.vertexIndexes[1]], vertex0, nv);
        Vectors.sub(vertexes[face.vertexIndexes[2]], vertex0, mv);
    }
    else {
        Vectors.sub(vertexes[face.vertexIndexes[2]], vertex0, nv);
        Vectors.sub(vertexes[face.vertexIndexes[4]], vertex0, mv);
    }
    Vectors.cross(nv, mv, normal);
    if (Math.abs(normal[0]) < 0.0001 && Math.abs(normal[1]) < 0.0001 && Math.abs(normal[2]) < 0.0001) {
        return { normal: null, distance: 0 };
    }
    else {
        Vectors.normalizeSelf(normal);
        const distance = Vectors.dot(normal, vertex0);
        if (distance < 0) {
            Vectors.negateSelf(normal);
            return { normal, distance: -distance };
        }
        else {
            return { normal, distance };
        }
    }
}
function isSamePlain(currentPlain, targetPlain, isNearlyZero) {
    return !!currentPlain.normal && !!targetPlain.normal &&
        Math.abs(currentPlain.distance - targetPlain.distance) < maxError && (Math.abs(currentPlain.normal[0] - targetPlain.normal[0]) < maxNormalError &&
        Math.abs(currentPlain.normal[1] - targetPlain.normal[1]) < maxNormalError &&
        Math.abs(currentPlain.normal[2] - targetPlain.normal[2]) < maxNormalError ||
        isNearlyZero &&
            Math.abs(currentPlain.normal[0] + targetPlain.normal[0]) < maxNormalError &&
            Math.abs(currentPlain.normal[1] + targetPlain.normal[1]) < maxNormalError &&
            Math.abs(currentPlain.normal[2] + targetPlain.normal[2]) < maxNormalError);
}
const maxNormalError = 1.0 / 1024.0;
const maxError = 1.0 / 128.0;
const cv = [0, 0, 0];
const nv = [0, 0, 0];
const mv = [0, 0, 0];
const holosnubMinIndex = 30;
export function buildPolyhedronMesh(polyhedron, faceVisibility, visibilityType, vertexVisibility, edgeVisibility, colorByConnected, holosnub, fillType) {
    const triangles = [];
    const verfView = visibilityType === "VertexFigure";
    const eachForOne = visibilityType === "OneForEach";
    const refPointIndexes = [];
    if (verfView) {
        polyhedron.vertexes.forEach((vertex, i) => {
            if (Vectors.distanceSquared(vertex, polyhedron.vertexes[0]) < 0.005) {
                refPointIndexes.push(i);
            }
        });
    }
    else if (eachForOne) {
        refPointIndexes.push(0);
    }
    const exmaxConnectedId = visibilityType === "ConnectedComponent" ? 1
        : holosnub ? 9999
            : holosnubMinIndex;
    const colorDrawn = eachForOne ? new Set() : null;
    const stencilVertexCounts = [];
    const drawIndexes = [];
    let addedVertexCount = 0;
    for (let i = 0; i < polyhedron.faces.length; i++) {
        const face = polyhedron.faces[i];
        if (face.connectedIndex >= exmaxConnectedId) {
            continue;
        }
        const colorIndex = (colorByConnected ? face.connectedIndex : face.colorIndex) % (faceColors.length);
        if (!faceVisibility[colorIndex]) {
            continue;
        }
        if (colorDrawn) {
            if (colorDrawn.has(colorIndex)) {
                continue;
            }
            colorDrawn.add(colorIndex);
        }
        if (verfView && face.vertexIndexes.every(i => !refPointIndexes.includes(i))) {
            continue;
        }
        drawIndexes.push(i);
    }
    if (fillType === "GlobalEvenOdd") {
        const plains = new Array(drawIndexes.length);
        for (let i = 0; i < drawIndexes.length; i++) {
            const face = polyhedron.faces[drawIndexes[i]];
            plains[i] = getPlain(polyhedron.vertexes, face);
        }
        const drawnIndexSet = new Set();
        for (let i = 0; i < drawIndexes.length; i++) {
            const currentPlain = plains[i];
            if (drawnIndexSet.has(i) || !currentPlain.normal)
                continue;
            const face = polyhedron.faces[drawIndexes[i]];
            let drawWithStencil = hasSelfIntersection(polyhedron.vertexes, face);
            const isNearlyZero = Math.abs(currentPlain.distance) < maxError;
            for (let j = i + 1; j < drawIndexes.length; j++) {
                const targetPlain = plains[j];
                if (drawnIndexSet.has(j) || !targetPlain.normal)
                    continue;
                if (isSamePlain(currentPlain, targetPlain, isNearlyZero)) {
                    drawWithStencil = true;
                    drawnIndexSet.add(j);
                    const otherFace = polyhedron.faces[drawIndexes[j]];
                    addPolygon(triangles, polyhedron.vertexes, otherFace, colorByConnected, true);
                }
            }
            if (drawWithStencil) {
                const face = polyhedron.faces[drawIndexes[i]];
                addPolygon(triangles, polyhedron.vertexes, face, colorByConnected, true);
                drawnIndexSet.add(i);
                const vertexCount = triangles.length / 6 - addedVertexCount;
                if (vertexCount > 0) {
                    stencilVertexCounts.push(vertexCount);
                    addedVertexCount += vertexCount;
                }
            }
        }
        for (let i = 0; i < drawIndexes.length; i++) {
            if (drawnIndexSet.has(i))
                continue;
            const face = polyhedron.faces[drawIndexes[i]];
            addPolygon(triangles, polyhedron.vertexes, face, colorByConnected, true);
        }
    }
    else if (fillType === "EvenOdd") {
        const drawnIndexSet = new Set();
        for (let i = 0; i < drawIndexes.length; i++) {
            const face = polyhedron.faces[drawIndexes[i]];
            if (!hasSelfIntersection(polyhedron.vertexes, face))
                continue;
            addPolygon(triangles, polyhedron.vertexes, face, colorByConnected, true);
            drawnIndexSet.add(i);
            const vertexCount = triangles.length / 6 - addedVertexCount;
            if (vertexCount > 0) {
                stencilVertexCounts.push(vertexCount);
                addedVertexCount += vertexCount;
            }
        }
        for (let i = 0; i < drawIndexes.length; i++) {
            if (drawnIndexSet.has(i))
                continue;
            const face = polyhedron.faces[drawIndexes[i]];
            addPolygon(triangles, polyhedron.vertexes, face, colorByConnected, true);
        }
    }
    else {
        for (const i of drawIndexes) {
            const face = polyhedron.faces[i];
            addPolygon(triangles, polyhedron.vertexes, face, colorByConnected, false);
        }
    }
    const ballInstances = [];
    if (vertexVisibility) {
        if (verfView) {
            const vertex = polyhedron.vertexes[0];
            ballInstances.push(vertex[0], vertex[1], vertex[2]);
        }
        else {
            for (let i = 0; i < polyhedron.vertexes.length; i++) {
                if (!holosnub && polyhedron.vertexConnectedIndexes[i] >= holosnubMinIndex) {
                    continue;
                }
                const vertex = polyhedron.vertexes[i];
                ballInstances.push(vertex[0], vertex[1], vertex[2]);
            }
        }
    }
    const lineInstances = [];
    if (edgeVisibility) {
        for (const { index1, index2, connectedIndex } of polyhedron.edges) {
            const vertex1 = polyhedron.vertexes[index1];
            const vertex2 = polyhedron.vertexes[index2];
            if (verfView && !refPointIndexes.includes(index1) && !refPointIndexes.includes(index2) ||
                !holosnub && connectedIndex >= holosnubMinIndex ||
                Vectors.distanceSquared(vertex1, vertex2) < 0.0035) {
                continue;
            }
            lineInstances.push(vertex1[0], vertex1[1], vertex1[2], vertex2[0], vertex2[1], vertex2[2]);
        }
    }
    const normalVertexCount = triangles.length / 6 - addedVertexCount;
    return {
        vertexData: new Float32Array(triangles),
        stencilVertexCounts,
        normalVertexCount,
        ballInstanceData: new Float32Array(ballInstances),
        ballCount: ballInstances.length / 3,
        lineInstanceData: new Float32Array(lineInstances),
        lineCount: lineInstances.length / 6,
    };
}
