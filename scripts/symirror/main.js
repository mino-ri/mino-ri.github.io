import { NormalPolyhedron, unitTriangles } from "./symmetry.js";
import { initGpu, buildPolyhedronMesh, quaternionToMatrix } from "./gpu.js";
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
        const qy = ay * s;
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
    onOriginChange;
    isDragging = false;
    constructor(svg, originPoint, onOriginChange) {
        this.svg = svg;
        this.originPoint = originPoint;
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
        const x = ((clientX - rect.left) / rect.width) * 2.4 - 1.2;
        const y = ((clientY - rect.top) / rect.height) * 2.4 - 1.2;
        const r = Math.sqrt(x * x + y * y);
        if (r <= 1) {
            return { x, y };
        }
        else {
            return { x: x / r, y: y / r };
        }
    }
    updateOrigin(x, y) {
        this.originPoint.setAttribute("cx", x.toString());
        this.originPoint.setAttribute("cy", y.toString());
        const r = Math.sqrt(x * x + y * y);
        const sinVal = Math.sin(0.5 * Math.PI * r);
        const scale = r > 0 ? sinVal / r : 0;
        const xPrime = x * scale;
        const yPrime = y * scale;
        const zPrime = Math.sqrt(Math.max(0, 1 - xPrime * xPrime - yPrime * yPrime));
        this.onOriginChange([xPrime, yPrime, zPrime]);
    }
    onMouseDown(e) {
        this.isDragging = true;
        const pos = this.getPositionFromEvent(e.clientX, e.clientY);
        if (pos) {
            this.updateOrigin(pos.x, pos.y);
        }
        e.preventDefault();
    }
    onMouseMove(e) {
        if (!this.isDragging)
            return;
        const pos = this.getPositionFromEvent(e.clientX, e.clientY);
        if (pos) {
            this.updateOrigin(pos.x, pos.y);
        }
    }
    onMouseUp() {
        this.isDragging = false;
    }
    onTouchStart(e) {
        if (e.touches.length === 1) {
            this.isDragging = true;
            const pos = this.getPositionFromEvent(e.touches[0].clientX, e.touches[0].clientY);
            if (pos) {
                this.updateOrigin(pos.x, pos.y);
            }
            e.preventDefault();
        }
    }
    onTouchMove(e) {
        if (!this.isDragging || e.touches.length !== 1)
            return;
        const pos = this.getPositionFromEvent(e.touches[0].clientX, e.touches[0].clientY);
        if (pos) {
            this.updateOrigin(pos.x, pos.y);
        }
        e.preventDefault();
    }
    onTouchEnd() {
        this.isDragging = false;
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
    setPolyhedron(selectValue) {
        const unitTriangle = unitTriangles.find((source) => source.id === selectValue);
        this.polyhedron = new NormalPolyhedron(unitTriangle.unit);
        const mesh = buildPolyhedronMesh(this.polyhedron.vertexes, this.polyhedron.faces);
        this.renderer.updateMesh(mesh);
    }
    setOrigin(origin) {
        if (!this.polyhedron)
            return;
        this.polyhedron.setOrigin(origin);
        const mesh = buildPolyhedronMesh(this.polyhedron.vertexes, this.polyhedron.faces);
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
    const size = Math.min(rect.width, Math.max(800, rect.height), 1080);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
}
window.addEventListener("load", async () => {
    const canvas = document.getElementById("preview_figure");
    const select = document.getElementById("select_coxeter_group");
    const autoRotateCheckbox = document.getElementById("checkbox_auto_rotate");
    const originControlSvg = document.getElementById("origin_control");
    const originPoint = document.getElementById("origin_point");
    if (!canvas || !select) {
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
    viewer.setPolyhedron(select.value);
    let originController = null;
    if (originControlSvg && originPoint) {
        originController = new OriginController(originControlSvg, originPoint, (origin) => viewer.setOrigin(origin));
    }
    select.addEventListener("change", () => {
        viewer.setPolyhedron(select.value);
        originController?.reset();
    });
    if (autoRotateCheckbox) {
        autoRotateCheckbox.addEventListener("change", () => {
            viewer.setAutoRotate(autoRotateCheckbox.checked);
        });
    }
});
