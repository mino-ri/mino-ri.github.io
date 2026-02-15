import { NormalPolyhedron } from "./symmetry.js"
import { type Vector, Vectors } from "./vector.js"
import { createCircle, createPath, createLine, clearChildren } from "../svg_generator.js"
import { Quaternion, Quaternions } from "./quaternion.js"

// origin 操作コントローラ
export class OriginController {
    #isSmallDragging = false // 移動微調整中か
    #isDragging = false // ドラッグ操作中か
    #isDragged = false // クリック・タッチ後、ドラッグ操作が行われたか
    #touchX = 0
    #touchY = 0
    #specialPoints: Vector[] = []
    #currentPoint: Vector = [0, 0, 1]
    #targetPoint: Vector | null = null
    #axis: Vector = [0, 0, 0]
    #quaternion: Quaternion = { w: 1, x: 0, y: 0, z: 0, negate: false }
    #svg: SVGSVGElement
    #originPoint: SVGCircleElement
    #circleGroup: SVGGElement
    #canvas: HTMLCanvasElement
    #onOriginChange: (origin: Vector) => void

    constructor(
        svg: SVGSVGElement,
        originPoint: SVGCircleElement,
        circleGroup: SVGGElement,
        canvas: HTMLCanvasElement,
        onOriginChange: (origin: Vector) => void,
    ) {
        this.#svg = svg
        this.#originPoint = originPoint
        this.#circleGroup = circleGroup
        this.#canvas = canvas
        this.#onOriginChange = onOriginChange
        this.#setupEventListeners()
    }

    #setupEventListeners(): void {
        this.#svg.addEventListener("mousedown", this.#onMouseDown.bind(this))
        document.addEventListener("mousemove", this.#onMouseMove.bind(this))
        document.addEventListener("mouseup", this.#onMouseUp.bind(this))

        this.#svg.addEventListener("touchstart", this.#onTouchStart.bind(this))
        document.addEventListener("touchmove", this.#onTouchMove.bind(this), { passive: false })
        document.addEventListener("touchend", this.#onTouchEnd.bind(this))
    }

    #getPositionFromEvent(clientX: number, clientY: number): { x: number; y: number } {
        const rect = this.#svg.getBoundingClientRect()
        const x = ((clientX - rect.left) / rect.width) * 2.25 - 1.125
        const y = ((clientY - rect.top) / rect.height) * 2.25 - 1.125

        return { x, y }
    }

    #getLimitedPositionFromEvent(clientX: number, clientY: number): { x: number; y: number } {
        const rect = this.#svg.getBoundingClientRect()
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

    #uiVectorToSphereVector(x: number, y: number, resultTo?: Vector): Vector {
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

    #changeOrigin(vector: Vector): void {
        const x = vector[0]! / (1 + vector[2]!)
        const y = vector[1]! / (1 + vector[2]!)
        this.#originPoint.setAttribute("cx", x.toString())
        this.#originPoint.setAttribute("cy", y.toString())
        Vectors.copy(vector, this.#currentPoint)
        this.#onOriginChange(vector)
    }

    applyAutoOriginMovement(deltaTime: number): void {
        if (!this.#targetPoint) {
            return
        }

        const anglePerSec = Math.PI * 0.25
        const cos = Vectors.dot(this.#currentPoint, this.#targetPoint)
        const deltaAngle = anglePerSec * deltaTime
        const deltaCos = Math.cos(deltaAngle)
        if (deltaCos <= cos) {
            this.#changeOrigin(this.#targetPoint)
            this.#targetPoint = null
        } else {
            if (cos < -0.995) {
                this.#axis[0] = 0
                this.#axis[1] = 0
                this.#axis[2] = 1
                Vectors.cross(this.#axis, this.#targetPoint, this.#axis)
            } else {
                Vectors.cross(this.#currentPoint, this.#targetPoint, this.#axis)
            }
            Vectors.normalizeSelf(this.#axis)
            Quaternions.rotation(this.#axis, deltaAngle, this.#quaternion)
            Quaternions.transform(this.#currentPoint, this.#quaternion, this.#currentPoint)
            this.#changeOrigin(this.#currentPoint)
        }
    }

    #updateOrigin(x: number, y: number): void {
        this.#changeOrigin(this.#uiVectorToSphereVector(x, y))
    }

    #updateOriginWithSpecialPoints(x: number, y: number): void {
        const v = this.#uiVectorToSphereVector(x, y)
        for (const sp of this.#specialPoints) {
            if (Math.abs(sp[0]! - v[0]!) < 0.1 && Math.abs(sp[1]! - v[1]!) < 0.1 && Math.abs(sp[2]! - v[2]!) < 0.1) {
                this.#targetPoint = sp
                return
            }
        }

        this.#targetPoint = v
    }

    #beginOperation(clientX: number, clientY: number): void {
        this.#isDragged = false
        const { x, y } = this.#getPositionFromEvent(clientX, clientY)
        const r = Math.sqrt(x * x + y * y)
        if (r <= 1) {
            this.#isDragging = true
            this.#touchX = x
            this.#touchY = y
        } else {
            this.#isSmallDragging = true
            this.#touchX = x
            this.#touchY = y
        }
    }

    #moveOperation(clientX: number, clientY: number): boolean {
        if (this.#isDragging) {
            const { x, y } = this.#getLimitedPositionFromEvent(clientX, clientY)
            const dx = x - this.#touchX
            const dy = y - this.#touchY
            if (!this.#isDragged && dx * dx + dy * dy > 0.0025) {
                this.#isDragged = true
            }
            if (this.#isDragged) {
                this.#updateOrigin(x, y)
                return true
            }
        } else if (this.#isSmallDragging) {
            const { x, y } = this.#getPositionFromEvent(clientX, clientY)
            const dx = x - this.#touchX
            const dy = y - this.#touchY
            const cx = Number(this.#originPoint.getAttribute("cx"))
            const cy = Number(this.#originPoint.getAttribute("cy"))
            this.#updateOrigin(cx + dx / 32, cy + dy / 32)
            this.#touchX = x
            this.#touchY = y
            return true
        }

        return false
    }

    #endOperation(): void {
        if (this.#isDragging && !this.#isDragged) {
            this.#updateOriginWithSpecialPoints(this.#touchX, this.#touchY)
        }

        this.#isSmallDragging = false
        this.#isDragging = false
        this.#isDragged = false
    }

    #onMouseDown(e: MouseEvent): void {
        this.#beginOperation(e.clientX, e.clientY)
        e.preventDefault()
    }

    #onMouseMove(e: MouseEvent): void {
        if (this.#moveOperation(e.clientX, e.clientY))
            e.preventDefault()
    }

    #onMouseUp(): void {
        this.#endOperation()
    }

    #onTouchStart(e: TouchEvent): void {
        if (e.touches.length !== 1) return
        this.#beginOperation(e.touches[0]!.clientX, e.touches[0]!.clientY)
        e.preventDefault()
    }

    #onTouchMove(e: TouchEvent): void {
        if (e.touches.length !== 1) return
        if (this.#moveOperation(e.touches[0]!.clientX, e.touches[0]!.clientY))
            e.preventDefault()
    }

    #onTouchEnd(): void {
        this.#endOperation()
    }

    #addMirror(normal: Vector, color: string, stroke: string): void {
        const z = normal[2]!
        if (Math.abs(z) >= 0.9999) {
            // ステレオ投影後に円になる
            this.#circleGroup.appendChild(createCircle(0, 0, 1, "none", color, stroke))
        } else {
            const top = [0, 0, 0]
            Vectors.cross(normal, [0, 0, 1], top)
            Vectors.normalizeSelf(top)
            if (Math.abs(z) < 0.0001) {
                // ステレオ投影後に直線になる
                this.#circleGroup.appendChild(createLine(top[0]!, top[1]!, -top[0]!, -top[1]!, color, stroke))
            } else {
                // ステレオ投影後に円弧になる
                const r = Math.abs(1 / z)
                const sweep = z > 0 ? 0 : 1
                this.#circleGroup.appendChild(createPath(`M ${top[0]!} ${top[1]!} A ${r} ${r} 0 0 ${sweep} ${-top[0]!} ${-top[1]!}`, "none", color, stroke))
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
        const ctx = this.#canvas.getContext("2d")
        if (!ctx) return
        const width = this.#canvas.width
        const height = this.#canvas.height
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

                this.#uiVectorToSphereVector(x, y, vector0)
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
        this.#specialPoints.push(sp)
        if (Math.abs(sp[2]!) <= 0.001) {
            this.#specialPoints.push([-sp[0]!, -sp[1]!, -sp[2]!]) // 赤道上の点は反対側も追加
        }
    }

    setMirrorCircles(polyhedron: NormalPolyhedron, faceSelector: string): void {
        clearChildren(this.#circleGroup)
        const mirrors = []
        const normals = []
        this.#specialPoints.splice(0)
        const generators: Vector[] = []
        switch (faceSelector) {
            case "oxx": case "xox": case "xxo": case "opp": case "pop": case "ppo":
                const pseudoMirrorIndex = faceSelector.indexOf("o")
                const pseudoMirror = polyhedron.getGeneratorTransform(pseudoMirrorIndex)
                for (let i = 0; i < polyhedron.generators.length; i++) {
                    const generator = polyhedron.symmetryGroup.transforms[polyhedron.generators[i]!.index]!
                    if (generator !== pseudoMirror) {
                        generators.push(Quaternions.toVector(generator))
                        let dot = generator.x * pseudoMirror.x + generator.y * pseudoMirror.y + generator.z * pseudoMirror.z
                        if (Math.abs(dot) > 1e-6) {
                            generators.push([
                                generator.x - 2 * dot * pseudoMirror.x,
                                generator.y - 2 * dot * pseudoMirror.y,
                                generator.z - 2 * dot * pseudoMirror.z,
                            ])
                        }
                    }
                }
                break

            case "xoo": case "oxo": case "oox":
                const realMirrorElement = polyhedron.generators[faceSelector.indexOf("x")]!
                for (let i = 0; i < polyhedron.generators.length; i++) {
                    const generatorElement = polyhedron.generators[i]!
                    const element = realMirrorElement === generatorElement
                        ? generatorElement
                        : generatorElement.mul(realMirrorElement).mul(generatorElement)
                    generators.push(Quaternions.toVector(polyhedron.symmetryGroup.transforms[element !== realMirrorElement
                        ? element.index : generatorElement.index]!))
                }
                break

            case "xxd": case "xdx": case "dxx": case "ood": case "odo": case "doo": case "ppd": case "pdp": case "dpp":
                const omitMirrorIndex = faceSelector.indexOf("d")
                for (let i = 0; i < polyhedron.generators.length; i++) {
                    if (i !== omitMirrorIndex) {
                        generators.push(Quaternions.toVector(polyhedron.getGeneratorTransform(i)))
                    }
                }
                const cross = [0, 0, 0]
                Vectors.cross(generators[0]!, generators[1]!, cross)
                Vectors.normalizeSelf(cross)
                generators.push(cross)
                break

            default:
                for (let i = 0; i < polyhedron.generators.length; i++) {
                    generators.push(Quaternions.toVector(polyhedron.getGeneratorTransform(i)))
                }
                break
        }

        const length = generators.length
        // 鏡の二等分線の描画
        for (let i = 0; i < length; i++) {
            for (let j = i + 1; j < length; j++) {
                const g1 = generators[i]!
                const g2 = generators[j]!
                const normal1 = Vectors.add(g1, g2)
                const normal2 = Vectors.sub(g1, g2)
                Vectors.normalizeSelf(normal1)
                Vectors.normalizeSelf(normal2)
                normals.push(normal1, normal2)
            }
        }

        // 鏡そのものの描画
        for (const q of generators) {
            this.#addMirror(q, "#fff", "0.02")
            mirrors.push(q)
        }

        // 特別な点、全ての二等分線の交点
        if (polyhedron.snubPoints && faceSelector === "ooo") {
            for (const sp of polyhedron.snubPoints) {
                this.#specialPoints.push(sp)
            }
        } else {
            for (let i = 0; i < normals.length; i++) {
                for (let j = i + 1; j < normals.length; j++) {
                    this.#addCrossMirror(normals[i]!, normals[j]!)
                }
            }
        }

        // 鏡本体と二等分線の交点
        for (const n1 of mirrors) {
            for (const n2 of normals) {
                this.#addCrossMirror(n1, n2)
            }
        }

        this.#setCanvas(polyhedron)
    }

    reset(): void {
        this.#updateOrigin(0, 0)
    }
}
