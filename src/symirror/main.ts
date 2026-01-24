import { Fraction } from "./fraction.js"
import { CoxeterMatrix } from "./coxeter_matrix.js"
import { FiniteCoxeterGroup } from "./coxeter_group.js"
import { SymmetryGroup3, NormalPolyhedron } from "./symmetry.js"
import { initGpu, buildPolyhedronMesh, quaternionToMatrix, type GpuContext } from "./gpu.js"

// select の value からコクセター行列を生成
function parseCoxeterGroup(value: string): CoxeterMatrix {
    // value: "p2_5", "p3_3" など → pP_Q → P, Q を抽出
    const match = value.match(/^p(\d+)_(\d+)$/)
    if (!match) {
        return CoxeterMatrix.create3D(new Fraction(3, 1), new Fraction(3, 1))
    }
    const p = parseInt(match[1]!, 10)
    const q = parseInt(match[2]!, 10)
    return CoxeterMatrix.create3D(new Fraction(p, 1), new Fraction(q, 1))
}

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
        const qy = ay * s
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

// メインアプリケーションクラス
class PolyhedronViewer {
    private renderer
    private rotation = new RotationState()
    private isDragging = false
    private lastMouseX = 0
    private lastMouseY = 0
    private animationFrameId: number | null = null
    private lastTime = 0
    private autoRotate = false

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

    setPolyhedron(selectValue: string): void {
        const matrix = parseCoxeterGroup(selectValue)
        const group = new FiniteCoxeterGroup(matrix)
        const symmetry = new SymmetryGroup3(group)
        const polyhedron = new NormalPolyhedron(symmetry)

        const mesh = buildPolyhedronMesh(polyhedron.vertexes, polyhedron.faces)
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
    const size = Math.min(rect.width, Math.max(800, rect.height), 1080)
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    // canvas.style.width = `${size}px`
    // canvas.style.height = `${size}px`
}

// エントリーポイント
window.addEventListener("load", async () => {
    const canvas = document.getElementById("preview_figure") as HTMLCanvasElement | null
    const select = document.getElementById("select_coxeter_group") as HTMLSelectElement | null
    const autoRotateCheckbox = document.getElementById("checkbox_auto_rotate") as HTMLInputElement | null

    if (!canvas || !select) {
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
    viewer.setPolyhedron(select.value)

    select.addEventListener("change", () => {
        viewer.setPolyhedron(select.value)
    })

    if (autoRotateCheckbox) {
        autoRotateCheckbox.addEventListener("change", () => {
            viewer.setAutoRotate(autoRotateCheckbox.checked)
        })
    }
})
