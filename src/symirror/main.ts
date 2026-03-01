import { NormalPolyhedron, unitTriangles, faceSelectorMap } from "./polyhedron.js"
import { initGpu, IPolytopeRenderer, type GpuContext } from "./gpu.js"
import { buildPolytopeMesh, setDimension, type VisibilityType, FillType } from "./model.js"
import { type Vector } from "./vector.js"
import { setCenter } from "../svg_generator.js"
import { OriginController } from "./origin_contoroller.js"
import { shaderSource } from "./gpu_3d.js"

// 回転状態を管理するクォータニオン
class RotationState {
    // 現在のクォータニオン (w, x, y, z)
    #w = 1
    #x = 0
    #y = 0
    #z = 0
    #matrix: Float32Array = new Float32Array(16)

    // ドラッグによる回転を適用
    applyDrag(deltaX: number, deltaY: number): void {
        // ドラッグ量から回転角度を計算 (適度な感度)
        const sensitivity = 0.005
        const angleX = deltaY * sensitivity // 上下ドラッグ → X軸回転
        const angleY = deltaX * sensitivity // 左右ドラッグ → Y軸回転

        // 累積回転を適用
        this.#rotateByAxis(1, 0, 0, angleX)
        this.#rotateByAxis(0, -1, 0, angleY)
    }

    // 自動回転を適用 (Y軸周り)
    applyAutoRotate(deltaTime: number): void {
        const rotationSpeed = 0.5 // ラジアン/秒
        this.#rotateByAxis(0, -1, 0, rotationSpeed * deltaTime)
    }

    #rotateByAxis(ax: number, ay: number, az: number, angle: number): void {
        const halfAngle = angle * 0.5
        const s = Math.sin(halfAngle)
        const c = Math.cos(halfAngle)

        // 新しい回転クォータニオン
        const qw = c
        const qx = ax * s
        const qy = ay * s
        const qz = az * s

        // 現在のクォータニオンに乗算: q * current
        const nw = qw * this.#w - qx * this.#x - qy * this.#y - qz * this.#z
        const nx = qw * this.#x + qx * this.#w + qy * this.#z - qz * this.#y
        const ny = qw * this.#y - qx * this.#z + qy * this.#w + qz * this.#x
        const nz = qw * this.#z + qx * this.#y - qy * this.#x + qz * this.#w

        // 正規化
        const len = Math.sqrt(nw * nw + nx * nx + ny * ny + nz * nz)
        this.#w = nw / len
        this.#x = nx / len
        this.#y = ny / len
        this.#z = nz / len
    }

    reset(): void {
        this.#w = 1
        this.#x = 0
        this.#y = 0
        this.#z = 0
    }

    getMatrix(): Float32Array {
        const xx = this.#x * this.#x, yy = this.#y * this.#y, zz = this.#z * this.#z
        const xy = this.#x * this.#y, xz = this.#x * this.#z, yz = this.#y * this.#z
        const wx = this.#w * this.#x, wy = this.#w * this.#y, wz = this.#w * this.#z

        this.#matrix[0] = 1 - 2 * (yy + zz)
        this.#matrix[1] = 2 * (xy + wz)
        this.#matrix[2] = 2 * (xz - wy)
        this.#matrix[3] = 0
        this.#matrix[4] = 2 * (xy - wz)
        this.#matrix[5] = 1 - 2 * (xx + zz)
        this.#matrix[6] = 2 * (yz + wx)
        this.#matrix[7] = 0
        this.#matrix[8] = 2 * (xz + wy)
        this.#matrix[9] = 2 * (yz - wx)
        this.#matrix[10] = 1 - 2 * (xx + yy)
        this.#matrix[11] = 0
        this.#matrix[12] = 0
        this.#matrix[13] = 0
        this.#matrix[14] = 0
        this.#matrix[15] = 1
        return this.#matrix
    }
}

// メインアプリケーションクラス
class PolyhedronViewer {
    #renderer: IPolytopeRenderer
    #rotation = new RotationState()
    #isDragging = false
    #lastMouseX = 0
    #lastMouseY = 0
    #animationFrameId: number | null = null
    #lastTime = 0
    #polyhedron: NormalPolyhedron | null = null
    #autoRotate = false
    #faceVisibility: boolean[] = [true, true, true, true, true, true]
    #visibilityType: VisibilityType = "All"
    #fillType: FillType = "Fill"
    #vertexVisibility = false
    #edgeVisibility = false
    #colorByConnected = false
    #holosnub = false
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

    setAutoRotate(enabled: boolean): void {
        this.#autoRotate = enabled
    }

    resetRotation(): void {
        this.#rotation.reset()
    }

    #setupEventListeners(): void {
        // mousedown は canvas で検知、mousemove/mouseup は document で検知
        // これにより canvas 外でもドラッグ操作が継続する
        this.#canvas.addEventListener("mousedown", this.#onMouseDown.bind(this))
        document.addEventListener("mousemove", this.#onMouseMove.bind(this))
        document.addEventListener("mouseup", this.#onMouseUp.bind(this))

        // タッチイベント対応
        this.#canvas.addEventListener("touchstart", this.#onTouchStart.bind(this))
        document.addEventListener("touchmove", this.#onTouchMove.bind(this), { passive: false })
        document.addEventListener("touchend", this.#onTouchEnd.bind(this))
    }

    #onMouseDown(e: MouseEvent): void {
        this.#isDragging = true
        this.#lastMouseX = e.clientX
        this.#lastMouseY = e.clientY
    }

    #onMouseMove(e: MouseEvent): void {
        if (!this.#isDragging) return

        const deltaX = e.clientX - this.#lastMouseX
        const deltaY = e.clientY - this.#lastMouseY
        this.#rotation.applyDrag(deltaX, deltaY)
        this.#lastMouseX = e.clientX
        this.#lastMouseY = e.clientY
    }

    #onMouseUp(): void {
        this.#isDragging = false
    }

    #onTouchStart(e: TouchEvent): void {
        if (e.touches.length === 1) {
            this.#isDragging = true
            this.#lastMouseX = e.touches[0]!.clientX
            this.#lastMouseY = e.touches[0]!.clientY
            e.preventDefault()
        }
    }

    #onTouchMove(e: TouchEvent): void {
        if (!this.#isDragging || e.touches.length !== 1) return

        const deltaX = e.touches[0]!.clientX - this.#lastMouseX
        const deltaY = e.touches[0]!.clientY - this.#lastMouseY
        this.#rotation.applyDrag(deltaX, deltaY)
        this.#lastMouseX = e.touches[0]!.clientX
        this.#lastMouseY = e.touches[0]!.clientY
        e.preventDefault()
    }

    #onTouchEnd(): void {
        this.#isDragging = false
    }

    setPolyhedron(selectValue: string, faceSelector: string): NormalPolyhedron {
        const { unit, compoundTransforms } = unitTriangles.find((source) => source.id === selectValue)!
        const selector = faceSelectorMap.get(faceSelector) || faceSelectorMap.get("xxx")!
        this.#polyhedron = new NormalPolyhedron(unit, selector, compoundTransforms)
        this.#updateMesh()
        return this.#polyhedron
    }

    setOrigin(origin: Vector): void {
        if (!this.#polyhedron) return
        this.#polyhedron.setOrigin(origin)
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

    setColorByConnected(colorByConnected: boolean): void {
        this.#colorByConnected = colorByConnected
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

    setHolosnub(holosnub: boolean): void {
        this.#holosnub = holosnub
        this.#updateMesh()
    }

    #updateMesh(): void {
        if (!this.#polyhedron) return
        const mesh = buildPolytopeMesh(this.#polyhedron, this.#faceVisibility, this.#visibilityType, this.#vertexVisibility, this.#edgeVisibility, this.#colorByConnected, this.#holosnub, this.#fillType)
        this.#renderer.updateMesh(mesh)
    }

    #startRenderLoop(): void {
        const render = (time: number) => {
            const deltaTime = this.#lastTime > 0 ? (time - this.#lastTime) / 1000 : 0
            this.#lastTime = time

            // 自動回転が有効かつドラッグ中でない場合に回転
            if (this.#autoRotate && !this.#isDragging) {
                this.#rotation.applyAutoRotate(deltaTime)
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
    const originBack = document.getElementById("origin_back") as HTMLCanvasElement | null
    const select = document.getElementById("select_coxeter_group") as HTMLSelectElement | null
    const selectFace = document.getElementById("select_face_selector") as HTMLSelectElement | null
    const selectVisibility = document.getElementById("select_visibility_type") as HTMLSelectElement | null
    const selectFillType = document.getElementById("select_fill_type") as HTMLSelectElement | null
    const autoRotateCheckbox = document.getElementById("checkbox_auto_rotate") as HTMLInputElement | null
    const originControlSvg = document.getElementById("origin_control") as unknown as SVGSVGElement | null
    const originPoint = document.getElementById("origin_point") as unknown as SVGCircleElement | null
    const circleGroup = document.getElementById("g_circles") as unknown as SVGGElement | null
    const checkColor0 = document.getElementById("checkbox_color_0") as HTMLInputElement | null
    const checkColor1 = document.getElementById("checkbox_color_1") as HTMLInputElement | null
    const checkColor2 = document.getElementById("checkbox_color_2") as HTMLInputElement | null
    const checkColor3 = document.getElementById("checkbox_color_3") as HTMLInputElement | null
    const checkColor4 = document.getElementById("checkbox_color_4") as HTMLInputElement | null
    const checkColor5 = document.getElementById("checkbox_color_5") as HTMLInputElement | null
    const checkVertex = document.getElementById("checkbox_vertex") as HTMLInputElement | null
    const checkEdge = document.getElementById("checkbox_edge") as HTMLInputElement | null
    const checkConnected = document.getElementById("checkbox_connected") as HTMLInputElement | null
    const checkHolosnub = document.getElementById("checkbox_holosnub") as HTMLInputElement | null
    const buttonResetRotation = document.getElementById("button_reset_rotation") as HTMLInputElement | null

    if (!canvas || !select || !selectFace || !checkColor0 || !checkColor1 || !checkColor2 || !checkColor3 || !checkColor4 || !checkColor5 ||
        !circleGroup || !originBack || !originControlSvg || !originPoint) {
        console.error("Required elements not found")
        return
    }

    setDimension(3)
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

    select.value = unitTriangles[0]!.id

    // origin コントローラの初期化
    const originController = new OriginController(
        originControlSvg,
        originPoint,
        circleGroup,
        originBack,
        (origin) => viewer.setOrigin(origin),
    )

    const viewer = new PolyhedronViewer(canvas, gpuContext, originController)
    for (const source of unitTriangles) {
        const option = document.createElement("option")
        option.value = source.id
        option.textContent = source.name
        select.appendChild(option)
    }

    originController?.setMirrorCircles(viewer.setPolyhedron(select.value, selectFace.value), selectFace.value)

    const rebuildPolyhedron = () => {
        const polyhedron = viewer.setPolyhedron(select.value, selectFace.value)
        originController?.setMirrorCircles(polyhedron, selectFace.value)
        originController?.reset()
    }

    select.addEventListener("change", rebuildPolyhedron)
    selectFace.addEventListener("change", rebuildPolyhedron)

    checkEdge?.addEventListener("change", () => {
        viewer.setEdgeVisibility(checkEdge.checked)
    })

    checkVertex?.addEventListener("change", () => {
        viewer.setVertexVisibility(checkVertex.checked)
    })

    selectVisibility?.addEventListener("change", () => {
        viewer.setVisibilityType(selectVisibility.value as VisibilityType)
    })

    checkConnected?.addEventListener("change", () => {
        viewer.setColorByConnected(checkConnected.checked)
    })

    checkHolosnub?.addEventListener("change", () => {
        viewer.setHolosnub(checkHolosnub.checked)
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

    autoRotateCheckbox?.addEventListener("change", () => {
        viewer.setAutoRotate(autoRotateCheckbox.checked)
    })

    buttonResetRotation?.addEventListener("click", () => {
        viewer.resetRotation()
    })
})
