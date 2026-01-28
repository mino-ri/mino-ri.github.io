import { NormalPolyhedron, unitTriangles, faceSelectorMap } from "./symmetry.js"
import { initGpu, buildPolyhedronMesh, quaternionToMatrix, type GpuContext } from "./gpu.js"
import { type Vector } from "./vector.js"

// 回転状態を管理するクォータニオン
class RotationState {
    // 現在のクォータニオン (w, x, y, z)
    private w = 1
    private x = 0
    private y = 0
    private z = 0

    // ドラッグによる回転を適用
    applyDrag(deltaX: number, deltaY: number): void {
        // ドラッグ量から回転角度を計算 (適度な感度)
        const sensitivity = 0.005
        const angleX = deltaY * sensitivity // 上下ドラッグ → X軸回転
        const angleY = deltaX * sensitivity // 左右ドラッグ → Y軸回転

        // 累積回転を適用
        this.rotateByAxis(1, 0, 0, angleX)
        this.rotateByAxis(0, 1, 0, angleY)
    }

    // 自動回転を適用 (Y軸周り)
    applyAutoRotate(deltaTime: number): void {
        const rotationSpeed = 0.5 // ラジアン/秒
        this.rotateByAxis(0, 1, 0, rotationSpeed * deltaTime)
    }

    private rotateByAxis(ax: number, ay: number, az: number, angle: number): void {
        const halfAngle = angle * 0.5
        const s = Math.sin(halfAngle)
        const c = Math.cos(halfAngle)

        // 新しい回転クォータニオン
        const qw = c
        const qx = ax * s
        const qy = ay * -s
        const qz = az * s

        // 現在のクォータニオンに乗算: q * current
        const nw = qw * this.w - qx * this.x - qy * this.y - qz * this.z
        const nx = qw * this.x + qx * this.w + qy * this.z - qz * this.y
        const ny = qw * this.y - qx * this.z + qy * this.w + qz * this.x
        const nz = qw * this.z + qx * this.y - qy * this.x + qz * this.w

        // 正規化
        const len = Math.sqrt(nw * nw + nx * nx + ny * ny + nz * nz)
        this.w = nw / len
        this.x = nx / len
        this.y = ny / len
        this.z = nz / len
    }

    getMatrix(): Float32Array {
        return quaternionToMatrix(this.w, this.x, this.y, this.z)
    }
}

// origin 操作コントローラ
class OriginController {
    private isDragging = false

    constructor(
        private svg: SVGSVGElement,
        private originPoint: SVGCircleElement,
        private onOriginChange: (origin: Vector) => void,
    ) {
        this.setupEventListeners()
    }

    private setupEventListeners(): void {
        this.svg.addEventListener("mousedown", this.onMouseDown.bind(this))
        document.addEventListener("mousemove", this.onMouseMove.bind(this))
        document.addEventListener("mouseup", this.onMouseUp.bind(this))

        this.svg.addEventListener("touchstart", this.onTouchStart.bind(this))
        document.addEventListener("touchmove", this.onTouchMove.bind(this), { passive: false })
        document.addEventListener("touchend", this.onTouchEnd.bind(this))
    }

    private getPositionFromEvent(clientX: number, clientY: number): { x: number; y: number } | null {
        const rect = this.svg.getBoundingClientRect()
        const x = ((clientX - rect.left) / rect.width) * 2.4 - 1.2
        const y = ((clientY - rect.top) / rect.height) * 2.4 - 1.2

        // 半径1の円内に制限
        const r = Math.sqrt(x * x + y * y)
        if (r <= 1) {
            return { x, y }
        } else {
            return { x: x / r, y: y / r }
        }
    }

    private updateOrigin(x: number, y: number): void {
        this.originPoint.setAttribute("cx", x.toString())
        this.originPoint.setAttribute("cy", y.toString())

        // UI座標から3Dベクトルへ変換
        const r = Math.sqrt(x * x + y * y)
        const sinVal = Math.sin(0.5 * Math.PI * r)
        const scale = r > 0 ? sinVal / r : 0
        const xPrime = x * scale
        const yPrime = y * scale
        const zPrime = Math.sqrt(Math.max(0, 1 - xPrime * xPrime - yPrime * yPrime))

        this.onOriginChange([xPrime, yPrime, zPrime])
    }

    private onMouseDown(e: MouseEvent): void {
        this.isDragging = true
        const pos = this.getPositionFromEvent(e.clientX, e.clientY)
        if (pos) {
            this.updateOrigin(pos.x, pos.y)
        }
        e.preventDefault()
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return
        const pos = this.getPositionFromEvent(e.clientX, e.clientY)
        if (pos) {
            this.updateOrigin(pos.x, pos.y)
        }
    }

    private onMouseUp(): void {
        this.isDragging = false
    }

    private onTouchStart(e: TouchEvent): void {
        if (e.touches.length === 1) {
            this.isDragging = true
            const pos = this.getPositionFromEvent(e.touches[0]!.clientX, e.touches[0]!.clientY)
            if (pos) {
                this.updateOrigin(pos.x, pos.y)
            }
            e.preventDefault()
        }
    }

    private onTouchMove(e: TouchEvent): void {
        if (!this.isDragging || e.touches.length !== 1) return
        const pos = this.getPositionFromEvent(e.touches[0]!.clientX, e.touches[0]!.clientY)
        if (pos) {
            this.updateOrigin(pos.x, pos.y)
        }
        e.preventDefault()
    }

    private onTouchEnd(): void {
        this.isDragging = false
    }

    reset(): void {
        this.updateOrigin(0, 0)
    }
}

// メインアプリケーションクラス
class PolyhedronViewer {
    private renderer
    private rotation = new RotationState()
    private isDragging = false
    private lastMouseX = 0
    private lastMouseY = 0
    private animationFrameId: number | null = null
    private lastTime = 0
    private polyhedron: NormalPolyhedron | null = null
    private autoRotate = false
    private faceVisibility: boolean[] = [true, true, true, true]

    constructor(
        private canvas: HTMLCanvasElement,
        gpuContext: GpuContext,
    ) {
        this.renderer = gpuContext.createPolyhedronRenderer()
        this.setupEventListeners()
        this.startRenderLoop()
    }

    setAutoRotate(enabled: boolean): void {
        this.autoRotate = enabled
    }

    private setupEventListeners(): void {
        // mousedown は canvas で検知、mousemove/mouseup は document で検知
        // これにより canvas 外でもドラッグ操作が継続する
        this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this))
        document.addEventListener("mousemove", this.onMouseMove.bind(this))
        document.addEventListener("mouseup", this.onMouseUp.bind(this))

        // タッチイベント対応
        this.canvas.addEventListener("touchstart", this.onTouchStart.bind(this))
        document.addEventListener("touchmove", this.onTouchMove.bind(this), { passive: false })
        document.addEventListener("touchend", this.onTouchEnd.bind(this))
    }

    private onMouseDown(e: MouseEvent): void {
        this.isDragging = true
        this.lastMouseX = e.clientX
        this.lastMouseY = e.clientY
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return

        const deltaX = e.clientX - this.lastMouseX
        const deltaY = e.clientY - this.lastMouseY
        this.rotation.applyDrag(deltaX, deltaY)
        this.lastMouseX = e.clientX
        this.lastMouseY = e.clientY
    }

    private onMouseUp(): void {
        this.isDragging = false
    }

    private onTouchStart(e: TouchEvent): void {
        if (e.touches.length === 1) {
            this.isDragging = true
            this.lastMouseX = e.touches[0]!.clientX
            this.lastMouseY = e.touches[0]!.clientY
            e.preventDefault()
        }
    }

    private onTouchMove(e: TouchEvent): void {
        if (!this.isDragging || e.touches.length !== 1) return

        const deltaX = e.touches[0]!.clientX - this.lastMouseX
        const deltaY = e.touches[0]!.clientY - this.lastMouseY
        this.rotation.applyDrag(deltaX, deltaY)
        this.lastMouseX = e.touches[0]!.clientX
        this.lastMouseY = e.touches[0]!.clientY
        e.preventDefault()
    }

    private onTouchEnd(): void {
        this.isDragging = false
    }

    setPolyhedron(selectValue: string, faceSelector: string): void {
        const unitTriangle = unitTriangles.find((source) => source.id === selectValue)!.unit
        const selector = faceSelectorMap.get(faceSelector) || faceSelectorMap.get("xxx")!
        this.polyhedron = new NormalPolyhedron(unitTriangle, selector)

        const mesh = buildPolyhedronMesh(this.polyhedron.vertexes, this.polyhedron.faces, this.faceVisibility)
        this.renderer.updateMesh(mesh)
    }

    setOrigin(origin: Vector): void {
        if (!this.polyhedron) return
        this.polyhedron.setOrigin(origin)
        const mesh = buildPolyhedronMesh(this.polyhedron.vertexes, this.polyhedron.faces, this.faceVisibility)
        this.renderer.updateMesh(mesh)
    }

    setFaceVisibility(faceVisibility: boolean[]): void {
        for (let i = 0; i < 4; i++) {
            this.faceVisibility[i] = faceVisibility[i]!
        }
        if (!this.polyhedron) return
        const mesh = buildPolyhedronMesh(this.polyhedron.vertexes, this.polyhedron.faces, this.faceVisibility)
        this.renderer.updateMesh(mesh)
    }

    private startRenderLoop(): void {
        const render = (time: number) => {
            const deltaTime = this.lastTime > 0 ? (time - this.lastTime) / 1000 : 0
            this.lastTime = time

            // 自動回転が有効かつドラッグ中でない場合に回転
            if (this.autoRotate && !this.isDragging) {
                this.rotation.applyAutoRotate(deltaTime)
            }

            this.renderer.render(this.rotation.getMatrix())
            this.animationFrameId = requestAnimationFrame(render)
        }
        this.animationFrameId = requestAnimationFrame(render)
    }

    destroy(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId)
        }
        this.renderer.destroy()
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
    console.log(`Resize ${window.innerWidth} ${window.innerHeight} -> ${width} ${height}`)
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
    const canvas = document.getElementById("preview_figure") as HTMLCanvasElement | null
    const select = document.getElementById("select_coxeter_group") as HTMLSelectElement | null
    const selectFace = document.getElementById("select_face_selector") as HTMLSelectElement | null
    const autoRotateCheckbox = document.getElementById("checkbox_auto_rotate") as HTMLInputElement | null
    const originControlSvg = document.getElementById("origin_control") as unknown as SVGSVGElement | null
    const originPoint = document.getElementById("origin_point") as unknown as SVGCircleElement | null
    const checkColor0 = document.getElementById("checkbox_color_0") as HTMLInputElement | null
    const checkColor1 = document.getElementById("checkbox_color_1") as HTMLInputElement | null
    const checkColor2 = document.getElementById("checkbox_color_2") as HTMLInputElement | null
    const checkColor3 = document.getElementById("checkbox_color_3") as HTMLInputElement | null

    if (!canvas || !select || !selectFace || !checkColor0 || !checkColor1 || !checkColor2 || !checkColor3) {
        console.error("Required elements not found")
        return
    }

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

    const viewer = new PolyhedronViewer(canvas, gpuContext)
    for (const source of unitTriangles) {
        const option = document.createElement("option")
        option.value = source.id
        option.textContent = source.name
        select.appendChild(option)
    }

    select.value = unitTriangles[0]!.id
    viewer.setPolyhedron(select.value, selectFace.value)

    // origin コントローラの初期化
    let originController: OriginController | null = null
    if (originControlSvg && originPoint) {
        originController = new OriginController(
            originControlSvg,
            originPoint,
            (origin) => viewer.setOrigin(origin),
        )
    }

    select.addEventListener("change", () => {
        viewer.setPolyhedron(select.value, selectFace.value)
        originController?.reset()
    })

    selectFace.addEventListener("change", () => {
        viewer.setPolyhedron(select.value, selectFace.value)
        originController?.reset()
    })

    const colorCheckChangeHandler = () => {
        viewer.setFaceVisibility([
            checkColor0.checked,
            checkColor1.checked,
            checkColor2.checked,
            checkColor3.checked,
        ])
    }

    checkColor0?.addEventListener("change", colorCheckChangeHandler)
    checkColor1?.addEventListener("change", colorCheckChangeHandler)
    checkColor2?.addEventListener("change", colorCheckChangeHandler)
    checkColor3?.addEventListener("change", colorCheckChangeHandler)

    if (autoRotateCheckbox) {
        autoRotateCheckbox.addEventListener("change", () => {
            viewer.setAutoRotate(autoRotateCheckbox.checked)
        })
    }
})
