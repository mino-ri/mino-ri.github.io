import { NormalPolyhedron, unitTriangles, faceSelectorMap } from "./symmetry.js"
import { initGpu, buildPolyhedronMesh, quaternionToMatrix, type GpuContext } from "./gpu.js"
import { type Vector, Vectors } from "./vector.js"
import { setCenter, createCircle, createPath, createLine, clearChildren } from "../svg_generator.js"

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
    private isDragging = false // ドラッグ操作中か
    private isDragged = false // クリック・タッチ後、ドラッグ操作が行われたか
    private touchX = 0
    private touchY = 0
    private specialPoints: Vector[] = []

    constructor(
        private svg: SVGSVGElement,
        private originPoint: SVGCircleElement,
        private circleGroup: SVGGElement,
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

    private getPositionFromEvent(clientX: number, clientY: number): { x: number; y: number } {
        const rect = this.svg.getBoundingClientRect()
        const x = ((clientX - rect.left) / rect.width) * 2.25 - 1.125
        const y = ((clientY - rect.top) / rect.height) * 2.25 - 1.125

        // 半径1の円内に制限
        const r = Math.sqrt(x * x + y * y)
        if (r <= 1) {
            return { x, y }
        } else {
            return { x: x / r, y: y / r }
        }
    }

    private uiVectorToSphereVector(x: number, y: number): Vector {
        // UI座標から3Dベクトルへ変換
        const scale = 1 / (x * x + y * y + 1)
        const xPrime = 2 * x * scale
        const yPrime = 2 * y * scale
        const zPrime = Math.sqrt(Math.max(0, 1 - xPrime * xPrime - yPrime * yPrime))
        return [xPrime, yPrime, zPrime]
    }

    private changeOrigin(vector: Vector): void {
        const x = vector[0]! / (1 + vector[2]!)
        const y = vector[1]! / (1 + vector[2]!)
        this.originPoint.setAttribute("cx", x.toString())
        this.originPoint.setAttribute("cy", y.toString())

        this.onOriginChange(vector)
    }

    private updateOrigin(x: number, y: number): void {
        this.changeOrigin(this.uiVectorToSphereVector(x, y))
    }

    private updateOriginWithSpecialPoints(x: number, y: number): void {
        const v = this.uiVectorToSphereVector(x, y)
        for (const sp of this.specialPoints) {
            if (Math.abs(sp[0]! - v[0]!) < 0.1 && Math.abs(sp[1]! - v[1]!) < 0.1 && Math.abs(sp[2]! - v[2]!) < 0.1) {
                this.changeOrigin(sp)
                return
            }
        }

        this.changeOrigin(v)
    }

    private onMouseDown(e: MouseEvent): void {
        this.isDragging = true
        this.isDragged = false
        e.preventDefault()
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return
        this.isDragged = true
        const { x, y } = this.getPositionFromEvent(e.clientX, e.clientY)
        this.updateOrigin(x, y)
        e.preventDefault()
    }

    private onMouseUp(e: MouseEvent): void {
        if (this.isDragging && !this.isDragged) {
            const { x, y } = this.getPositionFromEvent(e.clientX, e.clientY)
            this.updateOriginWithSpecialPoints(x, y)
        }
        this.isDragging = false
        this.isDragged = false
    }

    private onTouchStart(e: TouchEvent): void {
        if (e.touches.length !== 1) return
        this.isDragging = true
        this.isDragged = false
        const { x, y } = this.getPositionFromEvent(e.touches[0]!.clientX, e.touches[0]!.clientY)
        this.touchX = x
        this.touchY = y
        e.preventDefault()
    }

    private onTouchMove(e: TouchEvent): void {
        if (!this.isDragging || e.touches.length !== 1) return
        const { x, y } = this.getPositionFromEvent(e.touches[0]!.clientX, e.touches[0]!.clientY)
        const dx = x - this.touchX
        const dy = y - this.touchY
        if (dx * dx + dy * dy > 0.01) {
            this.isDragged = true
        }
        this.updateOrigin(x, y)
        e.preventDefault()
    }

    private onTouchEnd(): void {
        if (this.isDragging && !this.isDragged) {
            this.updateOriginWithSpecialPoints(this.touchX, this.touchY)
        }
        this.isDragging = false
        this.isDragged = false
    }

    private addMirror(normal: Vector, color: string, stroke: string): void {
        const z = normal[2]!
        if (Math.abs(z) >= 0.9999) {
            // ステレオ投影後に円になる
            this.circleGroup.appendChild(createCircle(0, 0, 1, "none", color, stroke))                
        } else {
            const top = [0, 0, 0]
            Vectors.cross(normal, [0, 0, 1], top)
            Vectors.normalizeSelf(top)
            if (Math.abs(z) < 0.0001) {
                // ステレオ投影後に直線になる
                this.circleGroup.appendChild(createLine(top[0]!, top[1]!, -top[0]!, -top[1]!, color, stroke))
            } else {
                // ステレオ投影後に円弧になる
                const r = Math.abs(1 / z)
                const sweep = z > 0 ? 0 : 1
                this.circleGroup.appendChild(createPath(`M ${top[0]!} ${top[1]!} A ${r} ${r} 0 0 ${sweep} ${-top[0]!} ${-top[1]!}`, "none", color, stroke))
            }
        }
    }        

    setMirrorCircles(polyhedron: NormalPolyhedron): void {
        clearChildren(this.circleGroup)
        const normals = []
        this.specialPoints.splice(0)
        const length = polyhedron.generators.length
        // 鏡の二等分線の描画
        for (let i = 0; i < length; i++) {
            for (let j = i + 1; j < length; j++) {
                const g1 = polyhedron.symmetryGroup.transforms[polyhedron.generators[i]!.index]!
                const g2 = polyhedron.symmetryGroup.transforms[polyhedron.generators[j]!.index]!
                const normal1 = [g1.x + g2.x, g1.y + g2.y, g1.z + g2.z]
                const normal2 = [g1.x - g2.x, g1.y - g2.y, g1.z - g2.z]
                Vectors.normalizeSelf(normal1)
                Vectors.normalizeSelf(normal2)
                this.addMirror(normal1, "#999", "0.015")
                this.addMirror(normal2, "#999", "0.015")
                normals.push(normal1, normal2)
            }
        }

        // 鏡そのものの描画
        for (const generator of polyhedron.generators) {
            const q = polyhedron.symmetryGroup.transforms[generator.index]!
            const normal = [q.x, q.y, q.z]
            this.addMirror(normal, "#555", "0.03")
            normals.push(normal)
        }

        // 特別な点の計算
        for (let i = 0; i < normals.length; i++) {
            for (let j = i + 1; j < normals.length; j++) {
                const n1 = normals[i]!
                const n2 = normals[j]!
                const sp = [0, 0, 0]
                Vectors.cross(n1, n2, sp)
                Vectors.normalizeSelf(sp)
                if (sp[2]! < 0) {
                    Vectors.negateSelf(sp)
                }
                this.specialPoints.push(sp)
                if (Math.abs(sp[2]!) <= 0.001) {
                    this.specialPoints.push([-sp[0]!, -sp[1]!, -sp[2]!]) // 赤道上の点は反対側も追加
                }
            }
        }
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

    setPolyhedron(selectValue: string, faceSelector: string): NormalPolyhedron {
        const unitTriangle = unitTriangles.find((source) => source.id === selectValue)!.unit
        const selector = faceSelectorMap.get(faceSelector) || faceSelectorMap.get("xxx")!
        this.polyhedron = new NormalPolyhedron(unitTriangle, selector)

        const mesh = buildPolyhedronMesh(this.polyhedron.vertexes, this.polyhedron.faces, this.faceVisibility)
        this.renderer.updateMesh(mesh)
        return this.polyhedron
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
    const selectFace = document.getElementById("select_face_selector") as HTMLSelectElement | null
    const autoRotateCheckbox = document.getElementById("checkbox_auto_rotate") as HTMLInputElement | null
    const originControlSvg = document.getElementById("origin_control") as unknown as SVGSVGElement | null
    const originPoint = document.getElementById("origin_point") as unknown as SVGCircleElement | null
    const circleGroup = document.getElementById("g_circles") as unknown as SVGGElement | null
    const checkColor0 = document.getElementById("checkbox_color_0") as HTMLInputElement | null
    const checkColor1 = document.getElementById("checkbox_color_1") as HTMLInputElement | null
    const checkColor2 = document.getElementById("checkbox_color_2") as HTMLInputElement | null
    const checkColor3 = document.getElementById("checkbox_color_3") as HTMLInputElement | null

    if (!canvas || !select || !selectFace || !checkColor0 || !checkColor1 || !checkColor2 || !checkColor3 || !circleGroup) {
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

    // origin コントローラの初期化
    let originController: OriginController | null = null
    if (originControlSvg && originPoint) {
        originController = new OriginController(
            originControlSvg,
            originPoint,
            circleGroup,
            (origin) => viewer.setOrigin(origin),
        )
    }

    originController?.setMirrorCircles(viewer.setPolyhedron(select.value, selectFace.value))

    select.addEventListener("change", () => {
        const polyhedron = viewer.setPolyhedron(select.value, selectFace.value)
        originController?.setMirrorCircles(polyhedron)
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
