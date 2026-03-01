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
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
    { value: null, source: [0] },
];
function addTriangle(triangles, v0, v1, v2, r, g, b) {
    triangles.push(...v0, r, g, b, ...v1, r, g, b, ...v2, r, g, b);
}
let dimension = 3;
const cv = [0];
const nv = [0];
const mv = [0];
export function setDimension(d) {
    dimension = d;
    cv.length = d;
    nv.length = d;
    mv.length = d;
    for (const cross of crosses) {
        cross.source.length = d;
    }
}
function getColorIndex(unit, colorByConnected) {
    return (colorByConnected ? unit.connectedIndex : unit.colorIndex) % (faceColors.length);
}
function addPolygon(triangles, vertexes, indexes, colorIndex, evenOdd) {
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
            cv.fill(0);
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
    cv.fill(0);
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
function hasSelfIntersection(vertexes, vertexIndexes) {
    if (vertexIndexes.length <= 5) {
        return false;
    }
    const v0 = vertexes[vertexIndexes[0]];
    const v1 = vertexes[vertexIndexes[1]];
    const v2 = vertexes[vertexIndexes[2]];
    if (Vectors.hasIntersection(v2, vertexes[vertexIndexes[3]], v0, v1) ||
        Vectors.hasIntersection(vertexes[vertexIndexes[vertexIndexes.length - 1]], v0, v1, v2)) {
        return true;
    }
    for (let i = 3; i < vertexIndexes.length - 2; i++) {
        const va = vertexes[vertexIndexes[i]];
        const vb = vertexes[vertexIndexes[i + 1]];
        if (Vectors.hasIntersection(va, vb, v0, v1) || Vectors.hasIntersection(va, vb, v1, v2)) {
            return true;
        }
    }
    return false;
}
function getPlain(vertexes, vertexIndexes) {
    const normal = [0, 0, 0];
    const vertex0 = vertexes[vertexIndexes[0]];
    if (vertexIndexes.length <= 4) {
        Vectors.sub(vertexes[vertexIndexes[1]], vertex0, nv);
        Vectors.sub(vertexes[vertexIndexes[2]], vertex0, mv);
    }
    else {
        Vectors.sub(vertexes[vertexIndexes[2]], vertex0, nv);
        Vectors.sub(vertexes[vertexIndexes[4]], vertex0, mv);
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
const holosnubMinIndex = 30;
export function buildPolytopeMesh(polytope, faceVisibility, visibilityType, vertexVisibility, edgeVisibility, colorByConnected, holosnub, fillType) {
    const triangles = [];
    const verfView = visibilityType === "VertexFigure";
    const eachForOne = visibilityType === "OneForEach";
    const refPointIndexes = [];
    if (verfView) {
        polytope.vertexes.forEach((vertex, i) => {
            if (Vectors.distanceSquared(vertex, polytope.vertexes[0]) < 0.005) {
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
    for (let i = 0; i < polytope.units.length; i++) {
        const unit = polytope.units[i];
        if (unit.connectedIndex >= exmaxConnectedId) {
            continue;
        }
        const colorIndex = (colorByConnected ? unit.connectedIndex : unit.colorIndex) % (faceColors.length);
        if (!faceVisibility[colorIndex]) {
            continue;
        }
        if (colorDrawn) {
            if (colorDrawn.has(colorIndex)) {
                continue;
            }
            colorDrawn.add(colorIndex);
        }
        if (verfView && unit.faceIndexes.every(f => f.every(i => !refPointIndexes.includes(i)))) {
            continue;
        }
        drawIndexes.push(i);
    }
    if (fillType === "GlobalEvenOdd") {
        const plains = new Map();
        for (let i = 0; i < drawIndexes.length; i++) {
            const unit = polytope.units[drawIndexes[i]];
            for (const face of unit.faceIndexes) {
                plains.set(face, getPlain(polytope.vertexes, face));
            }
        }
        const drawnFaceSet = new Set();
        for (let i = 0; i < drawIndexes.length; i++) {
            const unit = polytope.units[drawIndexes[i]];
            for (const face of unit.faceIndexes) {
                const currentPlain = plains.get(face);
                if (drawnFaceSet.has(face) || !currentPlain.normal)
                    continue;
                let drawWithStencil = hasSelfIntersection(polytope.vertexes, face);
                const isNearlyZero = Math.abs(currentPlain.distance) < maxError;
                for (let j = i + 1; j < drawIndexes.length; j++) {
                    const otherUnit = polytope.units[drawIndexes[j]];
                    for (const otherFace of otherUnit.faceIndexes) {
                        const otherPlain = plains.get(otherFace);
                        if (drawnFaceSet.has(otherFace) || !otherPlain.normal)
                            continue;
                        if (isSamePlain(currentPlain, otherPlain, isNearlyZero)) {
                            drawWithStencil = true;
                            drawnFaceSet.add(otherFace);
                            addPolygon(triangles, polytope.vertexes, otherFace, getColorIndex(otherUnit, colorByConnected), true);
                        }
                    }
                }
                if (drawWithStencil) {
                    addPolygon(triangles, polytope.vertexes, face, getColorIndex(unit, colorByConnected), true);
                    drawnFaceSet.add(face);
                    const vertexCount = triangles.length / (dimension + 3) - addedVertexCount;
                    if (vertexCount > 0) {
                        stencilVertexCounts.push(vertexCount);
                        addedVertexCount += vertexCount;
                    }
                }
            }
        }
        for (let i = 0; i < drawIndexes.length; i++) {
            const unit = polytope.units[drawIndexes[i]];
            for (const face of unit.faceIndexes) {
                if (drawnFaceSet.has(face))
                    continue;
                addPolygon(triangles, polytope.vertexes, face, getColorIndex(unit, colorByConnected), true);
            }
        }
    }
    else if (fillType === "EvenOdd") {
        const drawnFaceSet = new Set();
        for (let i = 0; i < drawIndexes.length; i++) {
            const unit = polytope.units[drawIndexes[i]];
            for (const face of unit.faceIndexes) {
                if (!hasSelfIntersection(polytope.vertexes, face))
                    continue;
                addPolygon(triangles, polytope.vertexes, face, getColorIndex(unit, colorByConnected), true);
                drawnFaceSet.add(face);
                const vertexCount = triangles.length / (dimension + 3) - addedVertexCount;
                if (vertexCount > 0) {
                    stencilVertexCounts.push(vertexCount);
                    addedVertexCount += vertexCount;
                }
            }
        }
        for (let i = 0; i < drawIndexes.length; i++) {
            const unit = polytope.units[drawIndexes[i]];
            for (const face of unit.faceIndexes) {
                if (drawnFaceSet.has(face))
                    continue;
                addPolygon(triangles, polytope.vertexes, face, getColorIndex(unit, colorByConnected), true);
            }
        }
    }
    else {
        for (const i of drawIndexes) {
            const unit = polytope.units[i];
            for (const face of unit.faceIndexes) {
                addPolygon(triangles, polytope.vertexes, face, getColorIndex(unit, colorByConnected), false);
            }
        }
    }
    const ballInstances = [];
    if (vertexVisibility) {
        if (verfView) {
            const vertex = polytope.vertexes[0];
            ballInstances.push(...vertex);
        }
        else {
            for (let i = 0; i < polytope.vertexes.length; i++) {
                if (!holosnub && polytope.vertexConnectedIndexes[i] >= holosnubMinIndex) {
                    continue;
                }
                const vertex = polytope.vertexes[i];
                ballInstances.push(...vertex);
            }
        }
    }
    const lineInstances = [];
    if (edgeVisibility) {
        for (const { index1, index2, connectedIndex } of polytope.edges) {
            const vertex1 = polytope.vertexes[index1];
            const vertex2 = polytope.vertexes[index2];
            if (verfView && !refPointIndexes.includes(index1) && !refPointIndexes.includes(index2) ||
                !holosnub && connectedIndex >= holosnubMinIndex ||
                Vectors.distanceSquared(vertex1, vertex2) < 0.0035) {
                continue;
            }
            lineInstances.push(...vertex1, ...vertex2);
        }
    }
    const normalVertexCount = triangles.length / (dimension + 3) - addedVertexCount;
    return {
        vertexData: new Float32Array(triangles),
        stencilVertexCounts,
        normalVertexCount,
        ballInstanceData: new Float32Array(ballInstances),
        ballCount: ballInstances.length / 3,
        lineInstanceData: new Float32Array(lineInstances),
        lineCount: lineInstances.length / (dimension * 2),
    };
}
