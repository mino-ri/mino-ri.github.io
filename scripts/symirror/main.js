import { NormalPolyhedron, unitTriangles, faceSelectorMap } from "./symmetry.js";
import { initGpu, buildPolyhedronMesh, quaternionToMatrix } from "./gpu.js";
import { Vectors } from "./vector.js";
import { setCenter, createCircle, createPath, createLine, clearChildren } from "../svg_generator.js";
class RotationState {
    w = 1;
    x = 0;
    y = 0;
    z = 0;
    applyDrag(deltaX, deltaY) {
        const sensitivity = 0.005;
        const angleX = deltaY * sensitivity;
        const angleY = deltaX * sensitivity;
        this.rotateByAxis(1, 0, 0, angleX);
        this.rotateByAxis(0, 1, 0, angleY);
    }
    applyAutoRotate(deltaTime) {
        const rotationSpeed = 0.5;
        this.rotateByAxis(0, 1, 0, rotationSpeed * deltaTime);
    }
    rotateByAxis(ax, ay, az, angle) {
        const halfAngle = angle * 0.5;
        const s = Math.sin(halfAngle);
        const c = Math.cos(halfAngle);
        const qw = c;
        const qx = ax * s;
        const qy = ay * -s;
        const qz = az * s;
        const nw = qw * this.w - qx * this.x - qy * this.y - qz * this.z;
        const nx = qw * this.x + qx * this.w + qy * this.z - qz * this.y;
        const ny = qw * this.y - qx * this.z + qy * this.w + qz * this.x;
        const nz = qw * this.z + qx * this.y - qy * this.x + qz * this.w;
        const len = Math.sqrt(nw * nw + nx * nx + ny * ny + nz * nz);
        this.w = nw / len;
        this.x = nx / len;
        this.y = ny / len;
        this.z = nz / len;
    }
    getMatrix() {
        return quaternionToMatrix(this.w, this.x, this.y, this.z);
    }
}
class OriginController {
    svg;
    originPoint;
    circleGroup;
    onOriginChange;
    isDragging = false;
    isDragged = false;
    specialPoints = [];
    constructor(svg, originPoint, circleGroup, onOriginChange) {
        this.svg = svg;
        this.originPoint = originPoint;
        this.circleGroup = circleGroup;
        this.onOriginChange = onOriginChange;
        this.setupEventListeners();
    }
    setupEventListeners() {
        this.svg.addEventListener("mousedown", this.onMouseDown.bind(this));
        document.addEventListener("mousemove", this.onMouseMove.bind(this));
        document.addEventListener("mouseup", this.onMouseUp.bind(this));
        this.svg.addEventListener("touchstart", this.onTouchStart.bind(this));
        document.addEventListener("touchmove", this.onTouchMove.bind(this), { passive: false });
        document.addEventListener("touchend", this.onTouchEnd.bind(this));
    }
    getPositionFromEvent(clientX, clientY) {
        const rect = this.svg.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2.25 - 1.125;
        const y = ((clientY - rect.top) / rect.height) * 2.25 - 1.125;
        const r = Math.sqrt(x * x + y * y);
        if (r <= 1) {
            return { x, y };
        }
        else {
            return { x: x / r, y: y / r };
        }
    }
    uiVectorToSphereVector(x, y) {
        const scale = 1 / (x * x + y * y + 1);
        const xPrime = 2 * x * scale;
        const yPrime = 2 * y * scale;
        const zPrime = Math.sqrt(Math.max(0, 1 - xPrime * xPrime - yPrime * yPrime));
        return [xPrime, yPrime, zPrime];
    }
    changeOrigin(vector) {
        const x = vector[0] / (1 + vector[2]);
        const y = vector[1] / (1 + vector[2]);
        this.originPoint.setAttribute("cx", x.toString());
        this.originPoint.setAttribute("cy", y.toString());
        this.onOriginChange(vector);
    }
    updateOrigin(x, y) {
        this.changeOrigin(this.uiVectorToSphereVector(x, y));
    }
    updateOriginWithSpecialPoints(x, y) {
        const v = this.uiVectorToSphereVector(x, y);
        for (const sp of this.specialPoints) {
            if (Math.abs(sp[0] - v[0]) < 0.1 && Math.abs(sp[1] - v[1]) < 0.1 && Math.abs(sp[2] - v[2]) < 0.1) {
                this.changeOrigin(sp);
                return;
            }
        }
        this.changeOrigin(v);
    }
    onMouseDown(e) {
        this.isDragging = true;
        this.isDragged = false;
        e.preventDefault();
    }
    onMouseMove(e) {
        if (!this.isDragging)
            return;
        this.isDragged = true;
        const pos = this.getPositionFromEvent(e.clientX, e.clientY);
        if (pos) {
            this.updateOrigin(pos.x, pos.y);
        }
    }
    onMouseUp(e) {
        if (this.isDragging && !this.isDragged) {
            const pos = this.getPositionFromEvent(e.clientX, e.clientY);
            if (pos) {
                this.updateOriginWithSpecialPoints(pos.x, pos.y);
            }
        }
        this.isDragging = false;
        this.isDragged = false;
    }
    onTouchStart(e) {
        if (e.touches.length !== 1)
            return;
        this.isDragging = true;
        this.isDragged = false;
        e.preventDefault();
    }
    onTouchMove(e) {
        if (!this.isDragging || e.touches.length !== 1)
            return;
        this.isDragged = true;
        const pos = this.getPositionFromEvent(e.touches[0].clientX, e.touches[0].clientY);
        if (pos) {
            this.updateOrigin(pos.x, pos.y);
        }
        e.preventDefault();
    }
    onTouchEnd(e) {
        if (this.isDragging && !this.isDragged) {
            const pos = this.getPositionFromEvent(e.touches[0].clientX, e.touches[0].clientY);
            if (pos) {
                this.updateOriginWithSpecialPoints(pos.x, pos.y);
            }
        }
        this.isDragging = false;
        this.isDragged = false;
    }
    addMirror(normal, color, stroke) {
        const z = normal[2];
        if (Math.abs(z) >= 0.9999) {
            this.circleGroup.appendChild(createCircle(0, 0, 1, "none", color, stroke));
        }
        else {
            const top = [0, 0, 0];
            Vectors.cross(normal, [0, 0, 1], top);
            Vectors.normalizeSelf(top);
            if (Math.abs(z) < 0.0001) {
                this.circleGroup.appendChild(createLine(top[0], top[1], -top[0], -top[1], color, stroke));
            }
            else {
                const r = Math.abs(1 / z);
                const sweep = z > 0 ? 0 : 1;
                this.circleGroup.appendChild(createPath(`M ${top[0]} ${top[1]} A ${r} ${r} 0 0 ${sweep} ${-top[0]} ${-top[1]}`, "none", color, stroke));
            }
        }
    }
    setMirrorCircles(polyhedron) {
        clearChildren(this.circleGroup);
        const normals = [];
        this.specialPoints.splice(0);
        const length = polyhedron.generators.length;
        for (let i = 0; i < length; i++) {
            for (let j = i + 1; j < length; j++) {
                const g1 = polyhedron.symmetryGroup.transforms[polyhedron.generators[i].index];
                const g2 = polyhedron.symmetryGroup.transforms[polyhedron.generators[j].index];
                const normal1 = [g1.x + g2.x, g1.y + g2.y, g1.z + g2.z];
                const normal2 = [g1.x - g2.x, g1.y - g2.y, g1.z - g2.z];
                Vectors.normalizeSelf(normal1);
                Vectors.normalizeSelf(normal2);
                this.addMirror(normal1, "#999", "0.015");
                this.addMirror(normal2, "#999", "0.015");
                normals.push(normal1, normal2);
            }
        }
        for (const generator of polyhedron.generators) {
            const q = polyhedron.symmetryGroup.transforms[generator.index];
            const normal = [q.x, q.y, q.z];
            this.addMirror(normal, "#555", "0.03");
            normals.push(normal);
        }
        for (let i = 0; i < normals.length; i++) {
            for (let j = i + 1; j < normals.length; j++) {
                const n1 = normals[i];
                const n2 = normals[j];
                const sp = [0, 0, 0];
                Vectors.cross(n1, n2, sp);
                Vectors.normalizeSelf(sp);
                if (sp[2] < 0) {
                    Vectors.negateSelf(sp);
                }
                this.specialPoints.push(sp);
                if (Math.abs(sp[2]) <= 0.001) {
                    this.specialPoints.push([-sp[0], -sp[1], -sp[2]]);
                }
            }
        }
    }
    reset() {
        this.updateOrigin(0, 0);
    }
}
class PolyhedronViewer {
    canvas;
    renderer;
    rotation = new RotationState();
    isDragging = false;
    lastMouseX = 0;
    lastMouseY = 0;
    animationFrameId = null;
    lastTime = 0;
    polyhedron = null;
    autoRotate = false;
    faceVisibility = [true, true, true, true];
    constructor(canvas, gpuContext) {
        this.canvas = canvas;
        this.renderer = gpuContext.createPolyhedronRenderer();
        this.setupEventListeners();
        this.startRenderLoop();
    }
    setAutoRotate(enabled) {
        this.autoRotate = enabled;
    }
    setupEventListeners() {
        this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
        document.addEventListener("mousemove", this.onMouseMove.bind(this));
        document.addEventListener("mouseup", this.onMouseUp.bind(this));
        this.canvas.addEventListener("touchstart", this.onTouchStart.bind(this));
        document.addEventListener("touchmove", this.onTouchMove.bind(this), { passive: false });
        document.addEventListener("touchend", this.onTouchEnd.bind(this));
    }
    onMouseDown(e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    }
    onMouseMove(e) {
        if (!this.isDragging)
            return;
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;
        this.rotation.applyDrag(deltaX, deltaY);
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    }
    onMouseUp() {
        this.isDragging = false;
    }
    onTouchStart(e) {
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;
            e.preventDefault();
        }
    }
    onTouchMove(e) {
        if (!this.isDragging || e.touches.length !== 1)
            return;
        const deltaX = e.touches[0].clientX - this.lastMouseX;
        const deltaY = e.touches[0].clientY - this.lastMouseY;
        this.rotation.applyDrag(deltaX, deltaY);
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
        e.preventDefault();
    }
    onTouchEnd() {
        this.isDragging = false;
    }
    setPolyhedron(selectValue, faceSelector) {
        const unitTriangle = unitTriangles.find((source) => source.id === selectValue).unit;
        const selector = faceSelectorMap.get(faceSelector) || faceSelectorMap.get("xxx");
        this.polyhedron = new NormalPolyhedron(unitTriangle, selector);
        const mesh = buildPolyhedronMesh(this.polyhedron.vertexes, this.polyhedron.faces, this.faceVisibility);
        this.renderer.updateMesh(mesh);
        return this.polyhedron;
    }
    setOrigin(origin) {
        if (!this.polyhedron)
            return;
        this.polyhedron.setOrigin(origin);
        const mesh = buildPolyhedronMesh(this.polyhedron.vertexes, this.polyhedron.faces, this.faceVisibility);
        this.renderer.updateMesh(mesh);
    }
    setFaceVisibility(faceVisibility) {
        for (let i = 0; i < 4; i++) {
            this.faceVisibility[i] = faceVisibility[i];
        }
        if (!this.polyhedron)
            return;
        const mesh = buildPolyhedronMesh(this.polyhedron.vertexes, this.polyhedron.faces, this.faceVisibility);
        this.renderer.updateMesh(mesh);
    }
    startRenderLoop() {
        const render = (time) => {
            const deltaTime = this.lastTime > 0 ? (time - this.lastTime) / 1000 : 0;
            this.lastTime = time;
            if (this.autoRotate && !this.isDragging) {
                this.rotation.applyAutoRotate(deltaTime);
            }
            this.renderer.render(this.rotation.getMatrix());
            this.animationFrameId = requestAnimationFrame(render);
        };
        this.animationFrameId = requestAnimationFrame(render);
    }
    destroy() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.renderer.destroy();
    }
}
function resizeCanvas(canvas) {
    const parent = canvas.parentElement;
    if (!parent)
        return;
    const rect = parent.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const width = rect.width;
    const height = window.innerHeight * (windowWidth > 800 ? 0.8 : 0.5);
    const size = Math.min(width, height, 1080);
    const dpr = window.devicePixelRatio || 1;
    const pixelSize = Math.floor(size * dpr);
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    canvas.style.width = `${pixelSize / dpr}px`;
    canvas.style.height = `${pixelSize / dpr}px`;
}
window.addEventListener("load", async () => {
    setCenter(0, 0);
    const canvas = document.getElementById("preview_figure");
    const select = document.getElementById("select_coxeter_group");
    const selectFace = document.getElementById("select_face_selector");
    const autoRotateCheckbox = document.getElementById("checkbox_auto_rotate");
    const originControlSvg = document.getElementById("origin_control");
    const originPoint = document.getElementById("origin_point");
    const circleGroup = document.getElementById("g_circles");
    const checkColor0 = document.getElementById("checkbox_color_0");
    const checkColor1 = document.getElementById("checkbox_color_1");
    const checkColor2 = document.getElementById("checkbox_color_2");
    const checkColor3 = document.getElementById("checkbox_color_3");
    if (!canvas || !select || !selectFace || !checkColor0 || !checkColor1 || !checkColor2 || !checkColor3 || !circleGroup) {
        console.error("Required elements not found");
        return;
    }
    resizeCanvas(canvas);
    window.addEventListener("resize", () => resizeCanvas(canvas));
    const gpuContext = await initGpu(canvas);
    if (!gpuContext) {
        canvas.style.display = "none";
        const errorDiv = document.createElement("div");
        errorDiv.textContent = "WebGPU is not supported in this browser.";
        errorDiv.style.cssText = "padding: 2rem; text-align: center; color: #c00;";
        canvas.parentElement?.appendChild(errorDiv);
        return;
    }
    const viewer = new PolyhedronViewer(canvas, gpuContext);
    for (const source of unitTriangles) {
        const option = document.createElement("option");
        option.value = source.id;
        option.textContent = source.name;
        select.appendChild(option);
    }
    select.value = unitTriangles[0].id;
    let originController = null;
    if (originControlSvg && originPoint) {
        originController = new OriginController(originControlSvg, originPoint, circleGroup, (origin) => viewer.setOrigin(origin));
    }
    originController?.setMirrorCircles(viewer.setPolyhedron(select.value, selectFace.value));
    select.addEventListener("change", () => {
        const polyhedron = viewer.setPolyhedron(select.value, selectFace.value);
        originController?.setMirrorCircles(polyhedron);
        originController?.reset();
    });
    selectFace.addEventListener("change", () => {
        viewer.setPolyhedron(select.value, selectFace.value);
        originController?.reset();
    });
    const colorCheckChangeHandler = () => {
        viewer.setFaceVisibility([
            checkColor0.checked,
            checkColor1.checked,
            checkColor2.checked,
            checkColor3.checked,
        ]);
    };
    checkColor0?.addEventListener("change", colorCheckChangeHandler);
    checkColor1?.addEventListener("change", colorCheckChangeHandler);
    checkColor2?.addEventListener("change", colorCheckChangeHandler);
    checkColor3?.addEventListener("change", colorCheckChangeHandler);
    if (autoRotateCheckbox) {
        autoRotateCheckbox.addEventListener("change", () => {
            viewer.setAutoRotate(autoRotateCheckbox.checked);
        });
    }
});
