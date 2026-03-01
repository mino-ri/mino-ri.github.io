import { NormalPolyhedron, unitTriangles, faceSelectorMap } from "./polyhedron.js";
import { initGpu } from "./gpu.js";
import { buildPolytopeMesh, setDimension } from "./model.js";
import { setCenter } from "../svg_generator.js";
import { OriginController } from "./origin_contoroller.js";
import { shaderSource } from "./gpu_3d.js";
class RotationState {
    #w = 1;
    #x = 0;
    #y = 0;
    #z = 0;
    #matrix = new Float32Array(16);
    applyDrag(deltaX, deltaY) {
        const sensitivity = 0.005;
        const angleX = deltaY * sensitivity;
        const angleY = deltaX * sensitivity;
        this.#rotateByAxis(1, 0, 0, angleX);
        this.#rotateByAxis(0, -1, 0, angleY);
    }
    applyAutoRotate(deltaTime) {
        const rotationSpeed = 0.5;
        this.#rotateByAxis(0, -1, 0, rotationSpeed * deltaTime);
    }
    #rotateByAxis(ax, ay, az, angle) {
        const halfAngle = angle * 0.5;
        const s = Math.sin(halfAngle);
        const c = Math.cos(halfAngle);
        const qw = c;
        const qx = ax * s;
        const qy = ay * s;
        const qz = az * s;
        const nw = qw * this.#w - qx * this.#x - qy * this.#y - qz * this.#z;
        const nx = qw * this.#x + qx * this.#w + qy * this.#z - qz * this.#y;
        const ny = qw * this.#y - qx * this.#z + qy * this.#w + qz * this.#x;
        const nz = qw * this.#z + qx * this.#y - qy * this.#x + qz * this.#w;
        const len = Math.sqrt(nw * nw + nx * nx + ny * ny + nz * nz);
        this.#w = nw / len;
        this.#x = nx / len;
        this.#y = ny / len;
        this.#z = nz / len;
    }
    reset() {
        this.#w = 1;
        this.#x = 0;
        this.#y = 0;
        this.#z = 0;
    }
    getMatrix() {
        const xx = this.#x * this.#x, yy = this.#y * this.#y, zz = this.#z * this.#z;
        const xy = this.#x * this.#y, xz = this.#x * this.#z, yz = this.#y * this.#z;
        const wx = this.#w * this.#x, wy = this.#w * this.#y, wz = this.#w * this.#z;
        this.#matrix[0] = 1 - 2 * (yy + zz);
        this.#matrix[1] = 2 * (xy + wz);
        this.#matrix[2] = 2 * (xz - wy);
        this.#matrix[3] = 0;
        this.#matrix[4] = 2 * (xy - wz);
        this.#matrix[5] = 1 - 2 * (xx + zz);
        this.#matrix[6] = 2 * (yz + wx);
        this.#matrix[7] = 0;
        this.#matrix[8] = 2 * (xz + wy);
        this.#matrix[9] = 2 * (yz - wx);
        this.#matrix[10] = 1 - 2 * (xx + yy);
        this.#matrix[11] = 0;
        this.#matrix[12] = 0;
        this.#matrix[13] = 0;
        this.#matrix[14] = 0;
        this.#matrix[15] = 1;
        return this.#matrix;
    }
}
class PolyhedronViewer {
    #renderer;
    #rotation = new RotationState();
    #isDragging = false;
    #lastMouseX = 0;
    #lastMouseY = 0;
    #animationFrameId = null;
    #lastTime = 0;
    #polyhedron = null;
    #autoRotate = false;
    #faceVisibility = [true, true, true, true, true, true];
    #visibilityType = "All";
    #fillType = "Fill";
    #vertexVisibility = false;
    #edgeVisibility = false;
    #colorByConnected = false;
    #holosnub = false;
    #canvas;
    #originController;
    constructor(canvas, gpuContext, originController) {
        this.#canvas = canvas;
        this.#renderer = gpuContext.createPolytopeRenderer(shaderSource);
        this.#originController = originController;
        this.#setupEventListeners();
        this.#startRenderLoop();
    }
    setAutoRotate(enabled) {
        this.#autoRotate = enabled;
    }
    resetRotation() {
        this.#rotation.reset();
    }
    #setupEventListeners() {
        this.#canvas.addEventListener("mousedown", this.#onMouseDown.bind(this));
        document.addEventListener("mousemove", this.#onMouseMove.bind(this));
        document.addEventListener("mouseup", this.#onMouseUp.bind(this));
        this.#canvas.addEventListener("touchstart", this.#onTouchStart.bind(this));
        document.addEventListener("touchmove", this.#onTouchMove.bind(this), { passive: false });
        document.addEventListener("touchend", this.#onTouchEnd.bind(this));
    }
    #onMouseDown(e) {
        this.#isDragging = true;
        this.#lastMouseX = e.clientX;
        this.#lastMouseY = e.clientY;
    }
    #onMouseMove(e) {
        if (!this.#isDragging)
            return;
        const deltaX = e.clientX - this.#lastMouseX;
        const deltaY = e.clientY - this.#lastMouseY;
        this.#rotation.applyDrag(deltaX, deltaY);
        this.#lastMouseX = e.clientX;
        this.#lastMouseY = e.clientY;
    }
    #onMouseUp() {
        this.#isDragging = false;
    }
    #onTouchStart(e) {
        if (e.touches.length === 1) {
            this.#isDragging = true;
            this.#lastMouseX = e.touches[0].clientX;
            this.#lastMouseY = e.touches[0].clientY;
            e.preventDefault();
        }
    }
    #onTouchMove(e) {
        if (!this.#isDragging || e.touches.length !== 1)
            return;
        const deltaX = e.touches[0].clientX - this.#lastMouseX;
        const deltaY = e.touches[0].clientY - this.#lastMouseY;
        this.#rotation.applyDrag(deltaX, deltaY);
        this.#lastMouseX = e.touches[0].clientX;
        this.#lastMouseY = e.touches[0].clientY;
        e.preventDefault();
    }
    #onTouchEnd() {
        this.#isDragging = false;
    }
    setPolyhedron(selectValue, faceSelector) {
        const { unit, compoundTransforms } = unitTriangles.find((source) => source.id === selectValue);
        const selector = faceSelectorMap.get(faceSelector) || faceSelectorMap.get("xxx");
        this.#polyhedron = new NormalPolyhedron(unit, selector, compoundTransforms);
        this.#updateMesh();
        return this.#polyhedron;
    }
    setOrigin(origin) {
        if (!this.#polyhedron)
            return;
        this.#polyhedron.setOrigin(origin);
        this.#updateMesh();
    }
    setFaceVisibility(faceVisibility) {
        for (let i = 0; i < faceVisibility.length; i++) {
            this.#faceVisibility[i] = faceVisibility[i];
        }
        this.#updateMesh();
    }
    setEdgeVisibility(edgeVisibility) {
        this.#edgeVisibility = edgeVisibility;
        this.#updateMesh();
    }
    setVertexVisibility(vertexVisibility) {
        this.#vertexVisibility = vertexVisibility;
        this.#updateMesh();
    }
    setColorByConnected(colorByConnected) {
        this.#colorByConnected = colorByConnected;
        this.#updateMesh();
    }
    setVisibilityType(visibilityType) {
        this.#visibilityType = visibilityType;
        this.#updateMesh();
    }
    setFillType(fillType) {
        this.#fillType = fillType;
        this.#updateMesh();
    }
    setHolosnub(holosnub) {
        this.#holosnub = holosnub;
        this.#updateMesh();
    }
    #updateMesh() {
        if (!this.#polyhedron)
            return;
        const mesh = buildPolytopeMesh(this.#polyhedron, this.#faceVisibility, this.#visibilityType, this.#vertexVisibility, this.#edgeVisibility, this.#colorByConnected, this.#holosnub, this.#fillType);
        this.#renderer.updateMesh(mesh);
    }
    #startRenderLoop() {
        const render = (time) => {
            const deltaTime = this.#lastTime > 0 ? (time - this.#lastTime) / 1000 : 0;
            this.#lastTime = time;
            if (this.#autoRotate && !this.#isDragging) {
                this.#rotation.applyAutoRotate(deltaTime);
            }
            this.#originController.applyAutoOriginMovement(deltaTime);
            this.#renderer.render(this.#rotation.getMatrix());
            this.#animationFrameId = requestAnimationFrame(render);
        };
        this.#animationFrameId = requestAnimationFrame(render);
    }
    destroy() {
        if (this.#animationFrameId !== null) {
            cancelAnimationFrame(this.#animationFrameId);
        }
        this.#renderer.destroy();
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
    const originBack = document.getElementById("origin_back");
    const select = document.getElementById("select_coxeter_group");
    const selectFace = document.getElementById("select_face_selector");
    const selectVisibility = document.getElementById("select_visibility_type");
    const selectFillType = document.getElementById("select_fill_type");
    const autoRotateCheckbox = document.getElementById("checkbox_auto_rotate");
    const originControlSvg = document.getElementById("origin_control");
    const originPoint = document.getElementById("origin_point");
    const circleGroup = document.getElementById("g_circles");
    const checkColor0 = document.getElementById("checkbox_color_0");
    const checkColor1 = document.getElementById("checkbox_color_1");
    const checkColor2 = document.getElementById("checkbox_color_2");
    const checkColor3 = document.getElementById("checkbox_color_3");
    const checkColor4 = document.getElementById("checkbox_color_4");
    const checkColor5 = document.getElementById("checkbox_color_5");
    const checkVertex = document.getElementById("checkbox_vertex");
    const checkEdge = document.getElementById("checkbox_edge");
    const checkConnected = document.getElementById("checkbox_connected");
    const checkHolosnub = document.getElementById("checkbox_holosnub");
    const buttonResetRotation = document.getElementById("button_reset_rotation");
    if (!canvas || !select || !selectFace || !checkColor0 || !checkColor1 || !checkColor2 || !checkColor3 || !checkColor4 || !checkColor5 ||
        !circleGroup || !originBack || !originControlSvg || !originPoint) {
        console.error("Required elements not found");
        return;
    }
    setDimension(3);
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
    select.value = unitTriangles[0].id;
    const originController = new OriginController(originControlSvg, originPoint, circleGroup, originBack, (origin) => viewer.setOrigin(origin));
    const viewer = new PolyhedronViewer(canvas, gpuContext, originController);
    for (const source of unitTriangles) {
        const option = document.createElement("option");
        option.value = source.id;
        option.textContent = source.name;
        select.appendChild(option);
    }
    originController?.setMirrorCircles(viewer.setPolyhedron(select.value, selectFace.value), selectFace.value);
    const rebuildPolyhedron = () => {
        const polyhedron = viewer.setPolyhedron(select.value, selectFace.value);
        originController?.setMirrorCircles(polyhedron, selectFace.value);
        originController?.reset();
    };
    select.addEventListener("change", rebuildPolyhedron);
    selectFace.addEventListener("change", rebuildPolyhedron);
    checkEdge?.addEventListener("change", () => {
        viewer.setEdgeVisibility(checkEdge.checked);
    });
    checkVertex?.addEventListener("change", () => {
        viewer.setVertexVisibility(checkVertex.checked);
    });
    selectVisibility?.addEventListener("change", () => {
        viewer.setVisibilityType(selectVisibility.value);
    });
    checkConnected?.addEventListener("change", () => {
        viewer.setColorByConnected(checkConnected.checked);
    });
    checkHolosnub?.addEventListener("change", () => {
        viewer.setHolosnub(checkHolosnub.checked);
    });
    const colorCheckChangeHandler = () => {
        viewer.setFaceVisibility([
            checkColor0.checked,
            checkColor1.checked,
            checkColor2.checked,
            checkColor3.checked,
            checkColor4.checked,
            checkColor5.checked,
        ]);
    };
    checkColor0.addEventListener("change", colorCheckChangeHandler);
    checkColor1.addEventListener("change", colorCheckChangeHandler);
    checkColor2.addEventListener("change", colorCheckChangeHandler);
    checkColor3.addEventListener("change", colorCheckChangeHandler);
    checkColor4.addEventListener("change", colorCheckChangeHandler);
    checkColor5.addEventListener("change", colorCheckChangeHandler);
    selectFillType?.addEventListener("change", () => {
        viewer.setFillType(selectFillType.value);
    });
    autoRotateCheckbox?.addEventListener("change", () => {
        viewer.setAutoRotate(autoRotateCheckbox.checked);
    });
    buttonResetRotation?.addEventListener("click", () => {
        viewer.resetRotation();
    });
});
