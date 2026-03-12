import { Polychoron, unitTetrahedrons, cellSelectorFunctions } from "./polychoron.js";
import { initGpu } from "./gpu.js";
import { buildPolytopeMesh, setDimension } from "./model.js";
import { setCenter } from "../svg_generator.js";
import { OriginController } from "./origin_controller4.js";
import { shaderSource } from "./gpu4.js";
import { QuaternionPairs } from "./quaternion_pair.js";
class RotationState {
    #temp = QuaternionPairs.getDefault();
    #q = QuaternionPairs.getDefault();
    #matrix = new Float32Array(17);
    applyDrag3D(deltaX, deltaY) {
        const sensitivity = 0.005;
        const angleXZ = deltaX * sensitivity;
        const angleYZ = deltaY * sensitivity;
        QuaternionPairs.mul(QuaternionPairs.rotationXZ(-angleXZ, this.#temp), this.#q, this.#q);
        QuaternionPairs.mul(QuaternionPairs.rotationYZ(angleYZ, this.#temp), this.#q, this.#q);
    }
    applyDrag4D(deltaX, deltaY) {
        const sensitivity = 0.005;
        const angleXW = deltaX * sensitivity;
        const angleYW = deltaY * sensitivity;
        console.log("applyDrag4D");
        QuaternionPairs.mul(QuaternionPairs.rotationXW(-angleXW, this.#temp), this.#q, this.#q);
        QuaternionPairs.mul(QuaternionPairs.rotationYW(-angleYW, this.#temp), this.#q, this.#q);
    }
    applyAutoRotateXZ(deltaTime) {
        const rotationSpeed = 0.625;
        QuaternionPairs.mul(QuaternionPairs.rotationXZ(-rotationSpeed * deltaTime, this.#temp), this.#q, this.#q);
    }
    applyAutoRotateYW(deltaTime) {
        const rotationSpeed = 0.25;
        QuaternionPairs.mul(QuaternionPairs.rotationYW(rotationSpeed * deltaTime, this.#temp), this.#q, this.#q);
    }
    reset() {
        QuaternionPairs.clear(this.#q);
    }
    getMatrix() {
        QuaternionPairs.toMatrix(this.#q, this.#matrix);
        return this.#matrix;
    }
}
class PolychoronViewer {
    #renderer;
    #rotation = new RotationState();
    #dragMode = null;
    #lastMouseX = 0;
    #lastMouseY = 0;
    #animationFrameId = null;
    #lastTime = 0;
    #polychoron = null;
    #autoRotateXZ = false;
    #autoRotateYW = false;
    #faceVisibility = [true, true, true, true, true, true];
    #visibilityType = "All";
    #fillType = "Fill";
    #vertexVisibility = false;
    #edgeVisibility = false;
    #cellSize = 1.0;
    #wGradiation = 0.0;
    #backgroundColor = 0;
    #canvas;
    #originController;
    constructor(canvas, gpuContext, originController) {
        this.#canvas = canvas;
        this.#renderer = gpuContext.createPolytopeRenderer(shaderSource);
        this.#originController = originController;
        this.#setupEventListeners();
        this.#startRenderLoop();
    }
    setAutoRotateXZ(enabled) {
        this.#autoRotateXZ = enabled;
    }
    setAutoRotateYW(enabled) {
        this.#autoRotateYW = enabled;
    }
    resetRotation() {
        this.#rotation.reset();
    }
    #setupEventListeners() {
        this.#canvas.addEventListener("mousedown", this.#onMouseDown.bind(this));
        this.#canvas.addEventListener("contextmenu", e => e.preventDefault());
        document.addEventListener("mousemove", this.#onMouseMove.bind(this));
        document.addEventListener("mouseup", this.#onMouseUp.bind(this));
        this.#canvas.addEventListener("touchstart", this.#onTouchStart.bind(this));
        document.addEventListener("touchmove", this.#onTouchMove.bind(this), { passive: false });
        document.addEventListener("touchend", this.#onTouchEnd.bind(this));
    }
    #onMouseDown(e) {
        this.#lastMouseX = e.clientX;
        this.#lastMouseY = e.clientY;
        switch (e.button) {
            case 0:
                this.#dragMode = "3d";
                e.preventDefault();
                break;
            case 2:
                this.#dragMode = "4d";
                e.preventDefault();
                break;
        }
    }
    #onMouseMove(e) {
        if (!this.#dragMode)
            return;
        const deltaX = e.clientX - this.#lastMouseX;
        const deltaY = e.clientY - this.#lastMouseY;
        switch (this.#dragMode) {
            case "3d":
                this.#rotation.applyDrag3D(deltaX, deltaY);
                break;
            case "4d":
                this.#rotation.applyDrag4D(deltaX, deltaY);
        }
        this.#lastMouseX = e.clientX;
        this.#lastMouseY = e.clientY;
    }
    #onMouseUp() {
        this.#dragMode = null;
    }
    #onTouchStart(e) {
        if (e.touches.length !== 1 && e.touches.length !== 2)
            return;
        switch (e.touches.length) {
            case 1:
                this.#dragMode = "3d";
                break;
            case 2:
                this.#dragMode = "4d";
                break;
        }
        this.#lastMouseX = e.touches[0].clientX;
        this.#lastMouseY = e.touches[0].clientY;
        e.preventDefault();
    }
    #onTouchMove(e) {
        if (!this.#dragMode || e.touches.length !== 1 && e.touches.length !== 2)
            return;
        const deltaX = e.touches[0].clientX - this.#lastMouseX;
        const deltaY = e.touches[0].clientY - this.#lastMouseY;
        switch (this.#dragMode) {
            case "3d":
                this.#rotation.applyDrag3D(deltaX, deltaY);
                break;
            case "4d":
                this.#rotation.applyDrag4D(deltaX, deltaY);
        }
        this.#lastMouseX = e.touches[0].clientX;
        this.#lastMouseY = e.touches[0].clientY;
        e.preventDefault();
    }
    #onTouchEnd() {
        this.#dragMode = null;
    }
    setPolychoron(selectValue, faceSelector) {
        const { unit } = unitTetrahedrons.find(source => source.id === selectValue);
        const selector = cellSelectorFunctions.get(faceSelector) ?? cellSelectorFunctions.get("full");
        this.#polychoron = new Polychoron(unit, selector);
        this.#updateMesh();
        return this.#polychoron;
    }
    setOrigin(origin) {
        if (!this.#polychoron)
            return;
        this.#polychoron.setOrigin(origin);
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
    setVisibilityType(visibilityType) {
        this.#visibilityType = visibilityType;
        this.#updateMesh();
    }
    setFillType(fillType) {
        this.#fillType = fillType;
        this.#updateMesh();
    }
    setCellSize(cellSize) {
        this.#cellSize = cellSize;
        this.#updateMesh();
    }
    setWGradiation(wGradiation) {
        this.#wGradiation = wGradiation;
    }
    setBackgroundColor(backgroundColor) {
        this.#backgroundColor = backgroundColor;
    }
    #updateMesh() {
        if (!this.#polychoron)
            return;
        const mesh = buildPolytopeMesh(this.#polychoron, this.#faceVisibility, this.#visibilityType, this.#vertexVisibility, this.#edgeVisibility, false, false, this.#fillType, this.#cellSize);
        this.#renderer.updateMesh(mesh);
    }
    #startRenderLoop() {
        const render = (time) => {
            const deltaTime = this.#lastTime > 0 ? (time - this.#lastTime) / 1000 : 0;
            this.#lastTime = time;
            if (this.#dragMode !== "3d" && this.#autoRotateXZ)
                this.#rotation.applyAutoRotateXZ(deltaTime);
            if (this.#dragMode !== "4d" && this.#autoRotateYW)
                this.#rotation.applyAutoRotateYW(deltaTime);
            this.#originController.applyAutoOriginMovement(deltaTime);
            const matrix = this.#rotation.getMatrix();
            matrix[16] = this.#wGradiation;
            this.#renderer.render(matrix, this.#backgroundColor);
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
    const select = document.getElementById("select_coxeter_group");
    const selectVisibility = document.getElementById("select_visibility_type");
    const selectFillType = document.getElementById("select_fill_type");
    const selectBackgroundColor = document.getElementById("select_background_color");
    const autoRotateXZCheckbox = document.getElementById("checkbox_auto_rotate_xz");
    const autoRotateYWCheckbox = document.getElementById("checkbox_auto_rotate_yw");
    const checkColor0 = document.getElementById("checkbox_color_0");
    const checkColor1 = document.getElementById("checkbox_color_1");
    const checkColor2 = document.getElementById("checkbox_color_2");
    const checkColor3 = document.getElementById("checkbox_color_3");
    const checkVertex = document.getElementById("checkbox_vertex");
    const checkEdge = document.getElementById("checkbox_edge");
    const rangeCellSize = document.getElementById("range_cell_size");
    const rangeWGradiation = document.getElementById("range_w_gradiation");
    const buttonResetRotation = document.getElementById("button_reset_rotation");
    const radioStruct0001 = document.getElementById("radio_struct_0001");
    const radioStruct0010 = document.getElementById("radio_struct_0010");
    const radioStruct0011 = document.getElementById("radio_struct_0011");
    const radioStruct0100 = document.getElementById("radio_struct_0100");
    const radioStruct0101 = document.getElementById("radio_struct_0101");
    const radioStruct0110 = document.getElementById("radio_struct_0110");
    const radioStruct0111 = document.getElementById("radio_struct_0111");
    const radioStruct1000 = document.getElementById("radio_struct_1000");
    const radioStruct1001 = document.getElementById("radio_struct_1001");
    const radioStruct1010 = document.getElementById("radio_struct_1010");
    const radioStruct1011 = document.getElementById("radio_struct_1011");
    const radioStruct1100 = document.getElementById("radio_struct_1100");
    const radioStruct1101 = document.getElementById("radio_struct_1101");
    const radioStruct1110 = document.getElementById("radio_struct_1110");
    const radioStruct1111 = document.getElementById("radio_struct_1111");
    if (!canvas || !select || !checkColor0 || !checkColor1 || !checkColor2 || !checkColor3) {
        console.error("Required elements not found");
        return;
    }
    setDimension(4);
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
    select.value = unitTetrahedrons[0].id;
    const originController = new OriginController(origin => viewer.setOrigin(origin));
    const viewer = new PolychoronViewer(canvas, gpuContext, originController);
    for (const source of unitTetrahedrons) {
        const option = document.createElement("option");
        option.value = source.id;
        option.textContent = source.name;
        select.appendChild(option);
    }
    originController?.setPolychoron(viewer.setPolychoron(unitTetrahedrons[0].id, "full"));
    const rebuildPolychoron = () => {
        originController?.setPolychoron(viewer.setPolychoron(select.value, "full"));
        originController?.reset();
        if (radioStruct0110)
            radioStruct0110.checked = true;
    };
    select.addEventListener("change", rebuildPolychoron);
    checkEdge?.addEventListener("change", () => {
        viewer.setEdgeVisibility(checkEdge.checked);
    });
    checkVertex?.addEventListener("change", () => {
        viewer.setVertexVisibility(checkVertex.checked);
    });
    selectVisibility?.addEventListener("change", () => {
        viewer.setVisibilityType(selectVisibility.value);
    });
    const colorCheckChangeHandler = () => {
        viewer.setFaceVisibility([
            checkColor0.checked,
            checkColor1.checked,
            checkColor2.checked,
            checkColor3.checked,
        ]);
    };
    checkColor0.addEventListener("change", colorCheckChangeHandler);
    checkColor1.addEventListener("change", colorCheckChangeHandler);
    checkColor2.addEventListener("change", colorCheckChangeHandler);
    checkColor3.addEventListener("change", colorCheckChangeHandler);
    radioStruct0001?.addEventListener("change", () => { if (radioStruct0001.checked)
        originController.setOriginPoint(0b0001); });
    radioStruct0010?.addEventListener("change", () => { if (radioStruct0010.checked)
        originController.setOriginPoint(0b0010); });
    radioStruct0011?.addEventListener("change", () => { if (radioStruct0011.checked)
        originController.setOriginPoint(0b0011); });
    radioStruct0100?.addEventListener("change", () => { if (radioStruct0100.checked)
        originController.setOriginPoint(0b0100); });
    radioStruct0101?.addEventListener("change", () => { if (radioStruct0101.checked)
        originController.setOriginPoint(0b0101); });
    radioStruct0110?.addEventListener("change", () => { if (radioStruct0110.checked)
        originController.setOriginPoint(0b0110); });
    radioStruct0111?.addEventListener("change", () => { if (radioStruct0111.checked)
        originController.setOriginPoint(0b0111); });
    radioStruct1000?.addEventListener("change", () => { if (radioStruct1000.checked)
        originController.setOriginPoint(0b1000); });
    radioStruct1001?.addEventListener("change", () => { if (radioStruct1001.checked)
        originController.setOriginPoint(0b1001); });
    radioStruct1010?.addEventListener("change", () => { if (radioStruct1010.checked)
        originController.setOriginPoint(0b1010); });
    radioStruct1011?.addEventListener("change", () => { if (radioStruct1011.checked)
        originController.setOriginPoint(0b1011); });
    radioStruct1100?.addEventListener("change", () => { if (radioStruct1100.checked)
        originController.setOriginPoint(0b1100); });
    radioStruct1101?.addEventListener("change", () => { if (radioStruct1101.checked)
        originController.setOriginPoint(0b1101); });
    radioStruct1110?.addEventListener("change", () => { if (radioStruct1110.checked)
        originController.setOriginPoint(0b1110); });
    radioStruct1111?.addEventListener("change", () => { if (radioStruct1111.checked)
        originController.setOriginPoint(0b1111); });
    rangeCellSize?.addEventListener("input", () => {
        viewer.setCellSize(Number(rangeCellSize.value));
    });
    rangeWGradiation?.addEventListener("input", () => {
        viewer.setWGradiation(Number(rangeWGradiation.value));
    });
    selectFillType?.addEventListener("change", () => {
        viewer.setFillType(selectFillType.value);
    });
    selectBackgroundColor?.addEventListener("change", () => {
        viewer.setBackgroundColor(Number(selectBackgroundColor.value));
    });
    autoRotateXZCheckbox?.addEventListener("change", () => {
        viewer.setAutoRotateXZ(autoRotateXZCheckbox.checked);
    });
    autoRotateYWCheckbox?.addEventListener("change", () => {
        viewer.setAutoRotateYW(autoRotateYWCheckbox.checked);
    });
    buttonResetRotation?.addEventListener("click", () => {
        viewer.resetRotation();
    });
});
