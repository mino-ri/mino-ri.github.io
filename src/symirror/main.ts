import { NormalPolyhedron, unitTriangles, faceSelectorMap } from "./symmetry.js"
import { initGpu, buildPolyhedronMesh, quaternionToMatrix, type GpuContext, VisibilityType } from "./gpu.js"
import { type Vector, Vectors } from "./vector.js"
import { setCenter, createCircle, createPath, createLine, clearChildren } from "../svg_generator.js"
import { Quaternion, Quaternions } from "./quaternion.js"

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
        this.rotateByAxis(0, -1, 0, angleY)
    }

    // 自動回転を適用 (Y軸周り)
    applyAutoRotate(deltaTime: number): void {
        const rotationSpeed = 0.5 // ラジアン/秒
        this.rotateByAxis(0, -1, 0, rotationSpeed * deltaTime)
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

// origin 操作コントローラ
class OriginController {
    private isSmallDragging = false // 移動微調整中か
    private isDragging = false // ドラッグ操作中か
    private isDragged = false // クリック・タッチ後、ドラッグ操作が行われたか
    private touchX = 0
    private touchY = 0
    private specialPoints: Vector[] = []
    private currentPoint: Vector = [0, 0, 1]
    private targetPoint: Vector | null = null
    private axis: Vector = [0, 0, 0]
    private quaternion: Quaternion = { w: 1, x: 0, y: 0, z: 0, negate: false }

    constructor(
        private svg: SVGSVGElement,
        private originPoint: SVGCircleElement,
        private circleGroup: SVGGElement,
        private canvas: HTMLCanvasElement,
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

        return { x, y }
    }

    private getLimitedPositionFromEvent(clientX: number, clientY: number): { x: number; y: number } {
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

    private uiVectorToSphereVector(x: number, y: number, resultTo?: Vector): Vector {
        // UI座標から3Dベクトルへ変換
        const scale = 1 / (x * x + y * y + 1)
        const xPrime = 2 * x * scale
        const yPrime = 2 * y * scale
        const zPrime = Math.sqrt(Math.max(0, 1 - xPrime * xPrime - yPrime * yPrime))
        if (!resultTo) {
            return [xPrime, yPrime, zPrime]
        } else {
            resultTo[0] = xPrime
            resultTo[1] = yPrime
            resultTo[2] = zPrime
            return resultTo
        }
    }

    private changeOrigin(vector: Vector): void {
        const x = vector[0]! / (1 + vector[2]!)
        const y = vector[1]! / (1 + vector[2]!)
        this.originPoint.setAttribute("cx", x.toString())
        this.originPoint.setAttribute("cy", y.toString())
        Vectors.copy(vector, this.currentPoint)
        this.onOriginChange(vector)
    }

    applyAutoOriginMovement(deltaTime: number): void {
        if (!this.targetPoint) {
            return
        }

        const anglePerSec = Math.PI * 0.25
        const cos = Vectors.dot(this.currentPoint, this.targetPoint)
        const deltaAngle = anglePerSec * deltaTime
        const deltaCos = Math.cos(deltaAngle)
        if (deltaCos <= cos) {
            this.changeOrigin(this.targetPoint)
            this.targetPoint = null
        } else {
            if (cos < -0.995) {
                this.axis[0] = 0
                this.axis[1] = 0
                this.axis[2] = 1
                Vectors.cross(this.axis, this.targetPoint, this.axis)
            } else {
                Vectors.cross(this.currentPoint, this.targetPoint, this.axis)
            }
            Vectors.normalizeSelf(this.axis)
            Quaternions.rotation(this.axis, deltaAngle, this.quaternion)
            Quaternions.transform(this.currentPoint, this.quaternion, this.currentPoint)
            this.changeOrigin(this.currentPoint)
        }
    }

    private updateOrigin(x: number, y: number): void {
        this.changeOrigin(this.uiVectorToSphereVector(x, y))
    }

    private updateOriginWithSpecialPoints(x: number, y: number): void {
        const v = this.uiVectorToSphereVector(x, y)
        for (const sp of this.specialPoints) {
            if (Math.abs(sp[0]! - v[0]!) < 0.1 && Math.abs(sp[1]! - v[1]!) < 0.1 && Math.abs(sp[2]! - v[2]!) < 0.1) {
                this.targetPoint = sp
                return
            }
        }

        this.targetPoint = v
    }

    private beginOperation(clientX: number, clientY: number): void {
        this.isDragged = false
        const { x, y } = this.getPositionFromEvent(clientX, clientY)
        const r = Math.sqrt(x * x + y * y)
        if (r <= 1) {
            this.isDragging = true
            this.touchX = x
            this.touchY = y
        } else {
            this.isSmallDragging = true
            this.touchX = x
            this.touchY = y
        }
    }

    private moveOperation(clientX: number, clientY: number): boolean {
        if (this.isDragging) {
            const { x, y } = this.getLimitedPositionFromEvent(clientX, clientY)
            const dx = x - this.touchX
            const dy = y - this.touchY
            if (!this.isDragged && dx * dx + dy * dy > 0.0025) {
                this.isDragged = true
            }
            if (this.isDragged) {
                this.updateOrigin(x, y)
                return true
            }
        } else if (this.isSmallDragging) {
            const { x, y } = this.getPositionFromEvent(clientX, clientY)
            const dx = x - this.touchX
            const dy = y - this.touchY
            const cx = Number(this.originPoint.getAttribute("cx"))
            const cy = Number(this.originPoint.getAttribute("cy"))
            this.updateOrigin(cx + dx / 32, cy + dy / 32)
            this.touchX = x
            this.touchY = y
            return true
        }

        return false
    }

    private endOperation(): void {
        if (this.isDragging && !this.isDragged) {
            this.updateOriginWithSpecialPoints(this.touchX, this.touchY)
        }

        this.isSmallDragging = false
        this.isDragging = false
        this.isDragged = false
    }

    private onMouseDown(e: MouseEvent): void {
        this.beginOperation(e.clientX, e.clientY)
        e.preventDefault()
    }

    private onMouseMove(e: MouseEvent): void {
        if (this.moveOperation(e.clientX, e.clientY))
            e.preventDefault()
    }

    private onMouseUp(): void {
        this.endOperation()
    }

    private onTouchStart(e: TouchEvent): void {
        if (e.touches.length !== 1) return
        this.beginOperation(e.touches[0]!.clientX, e.touches[0]!.clientY)
        e.preventDefault()
    }

    private onTouchMove(e: TouchEvent): void {
        if (e.touches.length !== 1) return
        if (this.moveOperation(e.touches[0]!.clientX, e.touches[0]!.clientY))
            e.preventDefault()
    }

    private onTouchEnd(): void {
        this.endOperation()
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

    static #colors = [
        { r: 0, g: 0, b: 0 },
        { r: 180, g: 0, b: 0 },
        { r: 0, g: 180, b: 0 },
        { r: 255, g: 200, b: 0 },
        { r: 0, g: 0, b: 180 },
        { r: 255, g: 0, b: 255 },
        { r: 0, g: 255, b: 255 },
        { r: 255, g: 255, b: 255 },
    ]

    #setCanvas(polyhedron: NormalPolyhedron): void {
        const ctx = this.canvas.getContext("2d")
        if (!ctx) return
        const width = this.canvas.width
        const height = this.canvas.height
        const imageData = ctx.createImageData(width, height)
        const edgeGenerators = polyhedron.getEdgeGenerators()
        const vector0: Vector = [0, 0, 0]
        const vector1: Vector = [0, 0, 0]
        const distances = new Array<number>(edgeGenerators.length)

        for (let px = 0; px < width; px++) {
            for (let py = 0; py < height; py++) {
                const x = (px + 0.5) / width * 2.25 - 1.125
                const y = (py + 0.5) / height * 2.25 - 1.125
                if (x * x + y * y > 1) {
                    continue
                }

                this.uiVectorToSphereVector(x, y, vector0)
                for (let i = 0; i < edgeGenerators.length; i++) {
                    Quaternions.transform(vector0, edgeGenerators[i]!, vector1)
                    distances[i] = Vectors.distanceSquared(vector0, vector1)
                }

                const colorIndex = distances.length >= 4
                    ? ((distances[0]! > distances[1]!) === (distances[2]! > distances[3]!) ? 1 : 0) +
                    ((distances[1]! > distances[2]!) === (distances[0]! > distances[3]!) ? 2 : 0) +
                    ((distances[2]! > distances[0]!) === (distances[1]! > distances[3]!) ? 4 : 0)
                    : (distances[0]! > distances[1]! ? 1 : 0) +
                    (distances[1]! > distances[2]! ? 2 : 0) +
                    (distances[2]! > distances[0]! ? 4 : 0)
                const { r, g, b } = OriginController.#colors[colorIndex]!
                const baseIndex = (py * width + px) * 4
                imageData.data[baseIndex + 0] = r
                imageData.data[baseIndex + 1] = g
                imageData.data[baseIndex + 2] = b
                imageData.data[baseIndex + 3] = 255
            }
        }

        ctx.putImageData(imageData, 0, 0)
    }

    #addCrossMirror(n1: Vector, n2: Vector): void {
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

    setMirrorCircles(polyhedron: NormalPolyhedron): void {
        clearChildren(this.circleGroup)
        const mirrors = []
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
                normals.push(normal1, normal2)
            }
        }

        // 鏡そのものの描画
        for (const generator of polyhedron.generators) {
            const q = polyhedron.symmetryGroup.transforms[generator.index]!
            const normal = [q.x, q.y, q.z]
            this.addMirror(normal, "#fff", "0.02")
            mirrors.push(normal)
        }

        if (polyhedron.snubPoints && polyhedron.faceDefinitions.length === 4 &&
            polyhedron.faceDefinitions[0]!.length === 1 && polyhedron.faceDefinitions[1]!.length === 1 &&
            polyhedron.faceDefinitions[2]!.length === 1 && polyhedron.faceDefinitions[3]!.length === 3) {
            for (const sp of polyhedron.snubPoints) {
                this.specialPoints.push(sp)
            }
        } else {
            for (let i = 0; i < normals.length; i++) {
                for (let j = i + 1; j < normals.length; j++) {
                    this.#addCrossMirror(normals[i]!, normals[j]!)
                }
            }
        }

        // 特別な点の計算
        for (const n1 of mirrors) {
            for (const n2 of normals) {
                this.#addCrossMirror(n1, n2)
            }
        }

        this.#setCanvas(polyhedron)
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
    private faceVisibility: boolean[] = [true, true, true, true, true]
    private visibilityType: VisibilityType = "All"
    private evenOddFilling = false
    private vertexVisibility = false
    private edgeVisibility = false

    constructor(
        private canvas: HTMLCanvasElement,
        gpuContext: GpuContext,
        private originController: OriginController,
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
        const { unit, snubPoints } = unitTriangles.find((source) => source.id === selectValue)!
        const selector = faceSelectorMap.get(faceSelector) || faceSelectorMap.get("xxx")!
        this.polyhedron = new NormalPolyhedron(unit, snubPoints, selector)
        this.#updateMesh()
        return this.polyhedron
    }

    setOrigin(origin: Vector): void {
        if (!this.polyhedron) return
        this.polyhedron.setOrigin(origin)
        this.#updateMesh()
    }

    setFaceVisibility(faceVisibility: boolean[]): void {
        for (let i = 0; i < faceVisibility.length; i++) {
            this.faceVisibility[i] = faceVisibility[i]!
        }
        this.#updateMesh()
    }

    setEdgeVisibility(edgeVisibility: boolean): void {
        this.edgeVisibility = edgeVisibility
        this.#updateMesh()
    }

    setVertexVisibility(vertexVisibility: boolean): void {
        this.vertexVisibility = vertexVisibility
        this.#updateMesh()
    }

    setVisibilityType(visibilityType: VisibilityType): void {
        this.visibilityType = visibilityType
        this.#updateMesh()
    }

    setEvenOddFilling(evenOddFilling: boolean): void {
        this.evenOddFilling = evenOddFilling
        this.#updateMesh()
    }

    #updateMesh(): void {
        if (!this.polyhedron) return
        const mesh = buildPolyhedronMesh(this.polyhedron, this.faceVisibility, this.visibilityType, this.vertexVisibility, this.edgeVisibility, this.evenOddFilling)
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

            this.originController.applyAutoOriginMovement(deltaTime)
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
    const originBack = document.getElementById("origin_back") as HTMLCanvasElement | null
    const select = document.getElementById("select_coxeter_group") as HTMLSelectElement | null
    const selectFace = document.getElementById("select_face_selector") as HTMLSelectElement | null
    const selectVisibility = document.getElementById("select_visibility_type") as HTMLSelectElement | null
    const autoRotateCheckbox = document.getElementById("checkbox_auto_rotate") as HTMLInputElement | null
    const originControlSvg = document.getElementById("origin_control") as unknown as SVGSVGElement | null
    const originPoint = document.getElementById("origin_point") as unknown as SVGCircleElement | null
    const circleGroup = document.getElementById("g_circles") as unknown as SVGGElement | null
    const checkColor0 = document.getElementById("checkbox_color_0") as HTMLInputElement | null
    const checkColor1 = document.getElementById("checkbox_color_1") as HTMLInputElement | null
    const checkColor2 = document.getElementById("checkbox_color_2") as HTMLInputElement | null
    const checkColor3 = document.getElementById("checkbox_color_3") as HTMLInputElement | null
    const checkColor4 = document.getElementById("checkbox_color_4") as HTMLInputElement | null
    const checkVertex = document.getElementById("checkbox_vertex") as HTMLInputElement | null
    const checkEdge = document.getElementById("checkbox_edge") as HTMLInputElement | null
    const checkEvenOdd = document.getElementById("checkbox_even_odd") as HTMLInputElement | null

    if (!canvas || !select || !selectFace || !checkColor0 || !checkColor1 || !checkColor2 || !checkColor3 || !checkColor4 ||
        !circleGroup || !originBack || !originControlSvg || !originPoint || !checkEvenOdd) {
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

    originController?.setMirrorCircles(viewer.setPolyhedron(select.value, selectFace.value))

    select.addEventListener("change", () => {
        const polyhedron = viewer.setPolyhedron(select.value, selectFace.value)
        originController?.setMirrorCircles(polyhedron)
        originController?.reset()
    })

    selectFace.addEventListener("change", () => {
        const polyhedron = viewer.setPolyhedron(select.value, selectFace.value)
        originController?.setMirrorCircles(polyhedron)
        originController?.reset()
    })

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
        ])
    }

    checkColor0?.addEventListener("change", colorCheckChangeHandler)
    checkColor1?.addEventListener("change", colorCheckChangeHandler)
    checkColor2?.addEventListener("change", colorCheckChangeHandler)
    checkColor3?.addEventListener("change", colorCheckChangeHandler)
    checkColor4?.addEventListener("change", colorCheckChangeHandler)

    checkEvenOdd.addEventListener("change", () => {
        viewer.setEvenOddFilling(checkEvenOdd.checked)
    })

    if (autoRotateCheckbox) {
        autoRotateCheckbox.addEventListener("change", () => {
            viewer.setAutoRotate(autoRotateCheckbox.checked)
        })
    }
})
