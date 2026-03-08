import { Polychoron, unitTetrahedrons, cellSelectorFunctions } from "./polychoron.js"
import { initGpu, IPolytopeRenderer, type GpuContext } from "./gpu.js"
import { buildPolytopeMesh, setDimension, type VisibilityType, FillType } from "./model.js"
import { type Vector } from "./vector.js"
import { setCenter } from "../svg_generator.js"
import { OriginController } from "./origin_controller4.js"
import { shaderSource } from "./gpu4.js"
import { QuaternionPairs } from "./quaternion_pair.js"

// 回転状態を管理するクォータニオン
class RotationState {
    // 計算用クォータニオン
    #temp = QuaternionPairs.getDefault()
    // 現在のクォータニオン (w, x, y, z)
    #q = QuaternionPairs.getDefault()
    #matrix: Float32Array = new Float32Array(16)

    // ドラッグによる回転を適用
    applyDrag3D(deltaX: number, deltaY: number): void {
        // ドラッグ量から回転角度を計算 (適度な感度)
        const sensitivity = 0.005
        const angleXZ = deltaX * sensitivity // 左右ドラッグ
        const angleYZ = deltaY * sensitivity // 上下ドラッグ

        // 累積回転を適用
        QuaternionPairs.mul(QuaternionPairs.rotationXZ(-angleXZ, this.#temp), this.#q, this.#q)
        QuaternionPairs.mul(QuaternionPairs.rotationYZ(angleYZ, this.#temp), this.#q, this.#q)
    }

    // ドラッグによる回転を適用
    applyDrag4D(deltaX: number, deltaY: number): void {
        // ドラッグ量から回転角度を計算 (適度な感度)
        const sensitivity = 0.005
        const angleXW = deltaX * sensitivity // 左右ドラッグ
        const angleYW = deltaY * sensitivity // 上下ドラッグ
        console.log("applyDrag4D")

        // 累積回転を適用
        QuaternionPairs.mul(QuaternionPairs.rotationXW(-angleXW, this.#temp), this.#q, this.#q)
        QuaternionPairs.mul(QuaternionPairs.rotationYW(angleYW, this.#temp), this.#q, this.#q)
    }

    // 自動回転を適用
    applyAutoRotateXZ(deltaTime: number): void {
        const rotationSpeed = 0.625 // ラジアン/秒
        QuaternionPairs.mul(QuaternionPairs.rotationXZ(-rotationSpeed * deltaTime, this.#temp), this.#q, this.#q)
    }

    // 自動回転を適用
    applyAutoRotateYW(deltaTime: number): void {
        const rotationSpeed = 0.25 // ラジアン/秒
        QuaternionPairs.mul(QuaternionPairs.rotationYW(rotationSpeed * deltaTime, this.#temp), this.#q, this.#q)
    }

    reset(): void {
        QuaternionPairs.clear(this.#q)
    }

    getMatrix(): Float32Array {
        QuaternionPairs.toMatrix(this.#q, this.#matrix)
        return this.#matrix
    }
}

type DragMode = "3d" | "4d"

// メインアプリケーションクラス
class PolychoronViewer {
    #renderer: IPolytopeRenderer
    #rotation = new RotationState()
    #dragMode: DragMode | null = null
    #lastMouseX = 0
    #lastMouseY = 0
    #animationFrameId: number | null = null
    #lastTime = 0
    #polychoron: Polychoron | null = null
    #autoRotateXZ = false
    #autoRotateYW = false
    #faceVisibility: boolean[] = [true, true, true, true, true, true]
    #visibilityType: VisibilityType = "All"
    #fillType: FillType = "Fill"
    #vertexVisibility = false
    #edgeVisibility = false
    #canvas: HTMLCanvasElement
    #originController: OriginController

    constructor(
        canvas: HTMLCanvasElement,
        gpuContext: GpuContext,
        originController: OriginController,
    ) {
        this.#canvas = canvas
        this.#renderer = gpuContext.createPolytopeRenderer(shaderSource)
        this.#originController = originController
        this.#setupEventListeners()
        this.#startRenderLoop()
    }

    setAutoRotateXZ(enabled: boolean): void {
        this.#autoRotateXZ = enabled
    }

    setAutoRotateYW(enabled: boolean): void {
        this.#autoRotateYW = enabled
    }

    resetRotation(): void {
        this.#rotation.reset()
    }

    #setupEventListeners(): void {
        // mousedown は canvas で検知、mousemove/mouseup は document で検知
        // これにより canvas 外でもドラッグ操作が継続する
        this.#canvas.addEventListener("mousedown", this.#onMouseDown.bind(this))
        this.#canvas.addEventListener("contextmenu", e => e.preventDefault())
        document.addEventListener("mousemove", this.#onMouseMove.bind(this))
        document.addEventListener("mouseup", this.#onMouseUp.bind(this))

        // タッチイベント対応
        this.#canvas.addEventListener("touchstart", this.#onTouchStart.bind(this))
        document.addEventListener("touchmove", this.#onTouchMove.bind(this), { passive: false })
        document.addEventListener("touchend", this.#onTouchEnd.bind(this))
    }

    #onMouseDown(e: MouseEvent): void {
        this.#lastMouseX = e.clientX
        this.#lastMouseY = e.clientY
        switch (e.button) {
            case 0:
                this.#dragMode = "3d"
                e.preventDefault()
                break
            case 2:
                this.#dragMode = "4d"
                e.preventDefault()
                break
        }
    }

    #onMouseMove(e: MouseEvent): void {
        if (!this.#dragMode) return

        const deltaX = e.clientX - this.#lastMouseX
        const deltaY = e.clientY - this.#lastMouseY
        switch (this.#dragMode) {
            case "3d":
                this.#rotation.applyDrag3D(deltaX, deltaY)
                break
            case "4d":
                this.#rotation.applyDrag4D(deltaX, deltaY)
        }
        this.#lastMouseX = e.clientX
        this.#lastMouseY = e.clientY
    }

    #onMouseUp(): void {
        this.#dragMode = null
    }

    #onTouchStart(e: TouchEvent): void {
        if (e.touches.length !== 1 && e.touches.length !== 2) return

        switch (e.touches.length) {
            case 1:
                this.#dragMode = "3d"
                break
            case 2:
                this.#dragMode = "4d"
                break
        }

        this.#lastMouseX = e.touches[0]!.clientX
        this.#lastMouseY = e.touches[0]!.clientY
        e.preventDefault()
    }

    #onTouchMove(e: TouchEvent): void {
        if (!this.#dragMode || e.touches.length !== 1 && e.touches.length !== 2) return

        const deltaX = e.touches[0]!.clientX - this.#lastMouseX
        const deltaY = e.touches[0]!.clientY - this.#lastMouseY
        switch (this.#dragMode) {
            case "3d":
                this.#rotation.applyDrag3D(deltaX, deltaY)
                break
            case "4d":
                this.#rotation.applyDrag4D(deltaX, deltaY)
        }

        this.#lastMouseX = e.touches[0]!.clientX
        this.#lastMouseY = e.touches[0]!.clientY
        e.preventDefault()
    }

    #onTouchEnd(): void {
        this.#dragMode = null
    }

    setPolychoron(selectValue: string, faceSelector: string): Polychoron {
        const { unit } = unitTetrahedrons.find(source => source.id === selectValue)!
        const selector = cellSelectorFunctions.get(faceSelector) ?? cellSelectorFunctions.get("full")!
        this.#polychoron = new Polychoron(unit, selector)
        this.#updateMesh()
        return this.#polychoron
    }

    setOrigin(origin: Vector): void {
        if (!this.#polychoron) return
        this.#polychoron.setOrigin(origin)
        this.#updateMesh()
    }

    setFaceVisibility(faceVisibility: boolean[]): void {
        for (let i = 0; i < faceVisibility.length; i++) {
            this.#faceVisibility[i] = faceVisibility[i]!
        }
        this.#updateMesh()
    }

    setEdgeVisibility(edgeVisibility: boolean): void {
        this.#edgeVisibility = edgeVisibility
        this.#updateMesh()
    }

    setVertexVisibility(vertexVisibility: boolean): void {
        this.#vertexVisibility = vertexVisibility
        this.#updateMesh()
    }

    setVisibilityType(visibilityType: VisibilityType): void {
        this.#visibilityType = visibilityType
        this.#updateMesh()
    }

    setFillType(fillType: FillType): void {
        this.#fillType = fillType
        this.#updateMesh()
    }

    #updateMesh(): void {
        if (!this.#polychoron) return
        const mesh = buildPolytopeMesh(this.#polychoron, this.#faceVisibility, this.#visibilityType, this.#vertexVisibility, this.#edgeVisibility, false, false, this.#fillType)
        this.#renderer.updateMesh(mesh)
    }

    #startRenderLoop(): void {
        const render = (time: number) => {
            const deltaTime = this.#lastTime > 0 ? (time - this.#lastTime) / 1000 : 0
            this.#lastTime = time

            // 自動回転が有効かつドラッグ中でない場合に回転
            if (!this.#dragMode) {
                if (this.#autoRotateXZ) this.#rotation.applyAutoRotateXZ(deltaTime)
                if (this.#autoRotateYW) this.#rotation.applyAutoRotateYW(deltaTime)
            }

            this.#originController.applyAutoOriginMovement(deltaTime)
            this.#renderer.render(this.#rotation.getMatrix())
            this.#animationFrameId = requestAnimationFrame(render)
        }
        this.#animationFrameId = requestAnimationFrame(render)
    }

    destroy(): void {
        if (this.#animationFrameId !== null) {
            cancelAnimationFrame(this.#animationFrameId)
        }
        this.#renderer.destroy()
    }
}

// キャンバスサイズを親要素に合わせて調整
function resizeCanvas(canvas: HTMLCanvasElement): void {
    const parent = canvas.parentElement
    if (!parent) return

    const rect = parent.getBoundingClientRect()
    const windowWidth = window.innerWidth
    const width = rect.width
    const height = window.innerHeight * (windowWidth > 800 ? 0.8 : 0.5)
    const size = Math.min(width, height, 1080)
    const dpr = window.devicePixelRatio || 1
    const pixelSize = Math.floor(size * dpr)
    canvas.width = pixelSize
    canvas.height = pixelSize
    canvas.style.width = `${pixelSize / dpr}px`
    canvas.style.height = `${pixelSize / dpr}px`
}

// エントリーポイント
window.addEventListener("load", async () => {
    setCenter(0, 0)
    const canvas = document.getElementById("preview_figure") as HTMLCanvasElement | null
    const select = document.getElementById("select_coxeter_group") as HTMLSelectElement | null
    const selectVisibility = document.getElementById("select_visibility_type") as HTMLSelectElement | null
    const selectFillType = document.getElementById("select_fill_type") as HTMLSelectElement | null
    const autoRotateXZCheckbox = document.getElementById("checkbox_auto_rotate_xz") as HTMLInputElement | null
    const autoRotateYWCheckbox = document.getElementById("checkbox_auto_rotate_yw") as HTMLInputElement | null
    const checkColor0 = document.getElementById("checkbox_color_0") as HTMLInputElement | null
    const checkColor1 = document.getElementById("checkbox_color_1") as HTMLInputElement | null
    const checkColor2 = document.getElementById("checkbox_color_2") as HTMLInputElement | null
    const checkColor3 = document.getElementById("checkbox_color_3") as HTMLInputElement | null
    const checkColor4 = document.getElementById("checkbox_color_4") as HTMLInputElement | null
    const checkColor5 = document.getElementById("checkbox_color_5") as HTMLInputElement | null
    const checkVertex = document.getElementById("checkbox_vertex") as HTMLInputElement | null
    const checkEdge = document.getElementById("checkbox_edge") as HTMLInputElement | null
    const buttonResetRotation = document.getElementById("button_reset_rotation") as HTMLInputElement | null

    if (!canvas || !select || !checkColor0 || !checkColor1 || !checkColor2 || !checkColor3 || !checkColor4 || !checkColor5) {
        console.error("Required elements not found")
        return
    }

    setDimension(4)
    resizeCanvas(canvas)
    window.addEventListener("resize", () => resizeCanvas(canvas))

    const gpuContext = await initGpu(canvas)
    if (!gpuContext) {
        canvas.style.display = "none"
        const errorDiv = document.createElement("div")
        errorDiv.textContent = "WebGPU is not supported in this browser."
        errorDiv.style.cssText = "padding: 2rem; text-align: center; color: #c00;"
        canvas.parentElement?.appendChild(errorDiv)
        return
    }

    select.value = unitTetrahedrons[0]!.id

    // origin コントローラの初期化
    const originController = new OriginController(origin => viewer.setOrigin(origin))

    const viewer = new PolychoronViewer(canvas, gpuContext, originController)
    for (const source of unitTetrahedrons) {
        const option = document.createElement("option")
        option.value = source.id
        option.textContent = source.name
        select.appendChild(option)
    }

    viewer.setPolychoron(unitTetrahedrons[0]!.id, "full")
    // originController?.setMirrorCircles(viewer.setPolychoron(select.value, selectFace.value), selectFace.value)

    const rebuildPolychoron = () => {
        viewer.setPolychoron(select.value, "full")
        // originController?.setMirrorCircles(polychoron, selectFace.value)
        originController?.reset()
    }

    select.addEventListener("change", rebuildPolychoron)

    checkEdge?.addEventListener("change", () => {
        viewer.setEdgeVisibility(checkEdge.checked)
    })

    checkVertex?.addEventListener("change", () => {
        viewer.setVertexVisibility(checkVertex.checked)
    })

    selectVisibility?.addEventListener("change", () => {
        viewer.setVisibilityType(selectVisibility.value as VisibilityType)
    })

    const colorCheckChangeHandler = () => {
        viewer.setFaceVisibility([
            checkColor0.checked,
            checkColor1.checked,
            checkColor2.checked,
            checkColor3.checked,
            checkColor4.checked,
            checkColor5.checked,
        ])
    }

    checkColor0.addEventListener("change", colorCheckChangeHandler)
    checkColor1.addEventListener("change", colorCheckChangeHandler)
    checkColor2.addEventListener("change", colorCheckChangeHandler)
    checkColor3.addEventListener("change", colorCheckChangeHandler)
    checkColor4.addEventListener("change", colorCheckChangeHandler)
    checkColor5.addEventListener("change", colorCheckChangeHandler)

    selectFillType?.addEventListener("change", () => {
        viewer.setFillType(selectFillType.value as FillType)
    })

    autoRotateXZCheckbox?.addEventListener("change", () => {
        viewer.setAutoRotateXZ(autoRotateXZCheckbox.checked)
    })

    autoRotateYWCheckbox?.addEventListener("change", () => {
        viewer.setAutoRotateYW(autoRotateYWCheckbox.checked)
    })

    buttonResetRotation?.addEventListener("click", () => {
        viewer.resetRotation()
    })
})
