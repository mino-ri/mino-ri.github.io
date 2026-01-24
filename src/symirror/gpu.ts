/// <reference types="@webgpu/types" />

// 頂点シェーダー: MVP 変換を適用
// フラグメントシェーダー: flat shading
const shaderCode = /* wgsl */`
struct Uniforms {
    modelMatrix: mat4x4<f32>,
    viewProjectionMatrix: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldNormal: vec3<f32>,
    @location(1) color: vec3<f32>,
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let worldPos = uniforms.modelMatrix * vec4<f32>(input.position, 1.0);
    output.position = uniforms.viewProjectionMatrix * worldPos;
    output.worldNormal = (uniforms.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz;
    output.color = input.color;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.7));
    let normal = normalize(input.worldNormal);
    let ambient = 0.3;
    let diffuse = max(dot(normal, lightDir), 0.0) * 0.7;
    let brightness = ambient + diffuse;
    return vec4<f32>(input.color * brightness, 1.0);
}
`

// カラーマッピング: colorIndex -> RGB
const faceColors: [number, number, number][] = [
    [1.0, 0.9, 0.3], // 0: 黄
    [1.0, 0.3, 0.3], // 1: 赤
    [0.3, 0.8, 0.3], // 2: 緑
    [0.3, 0.5, 1.0], // 3: 青
]

export interface PolyhedronMesh {
    // インターリーブ頂点データ: [x, y, z, nx, ny, nz, r, g, b] × 頂点数
    vertexData: Float32Array
    vertexCount: number
}

export interface PolyhedronRenderer {
    updateMesh(mesh: PolyhedronMesh): void
    render(modelMatrix: Float32Array): void
    destroy(): void
}

export interface GpuContext {
    readonly device: GPUDevice
    readonly context: GPUCanvasContext
    readonly format: GPUTextureFormat
    createPolyhedronRenderer(): PolyhedronRenderer
}

export const initGpu = async (canvas: HTMLCanvasElement): Promise<GpuContext | null> => {
    if (!navigator.gpu) {
        console.error("WebGPU is not supported")
        return null
    }

    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
        console.error("Failed to get GPU adapter")
        return null
    }

    const device = await adapter.requestDevice()
    const context = canvas.getContext("webgpu")
    if (!context) {
        console.error("Failed to get WebGPU context")
        return null
    }

    const format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({
        device,
        format,
        alphaMode: "premultiplied",
    })

    return new GpuContextImpl(device, context, format)
}

class GpuContextImpl implements GpuContext {
    constructor(
        readonly device: GPUDevice,
        readonly context: GPUCanvasContext,
        readonly format: GPUTextureFormat,
    ) { }

    createPolyhedronRenderer(): PolyhedronRenderer {
        return new PolyhedronRendererImpl(this.device, this.context, this.format)
    }
}

// View-Projection 行列を生成 (perspective + lookAt)
function createViewProjectionMatrix(aspectRatio: number): Float32Array {
    const fov = Math.PI / 6
    const near = 1
    const far = 9
    const f = 1 / Math.tan(fov / 2)

    // Perspective projection matrix
    const proj = new Float32Array([
        f / aspectRatio, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) / (near - far), -1,
        0, 0, (2 * far * near) / (near - far), 0,
    ])

    // Camera at (0, 0, 5), looking at origin
    const eyeZ = 5
    const view = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, -eyeZ, 1,
    ])

    // Multiply: proj * view
    return multiplyMat4(proj, view)
}

function multiplyMat4(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(16)
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            let sum = 0
            for (let k = 0; k < 4; k++) {
                sum += a[i + k * 4]! * b[k + j * 4]!
            }
            result[i + j * 4] = sum
        }
    }
    return result
}

class PolyhedronRendererImpl implements PolyhedronRenderer {
    private pipeline: GPURenderPipeline
    private uniformBuffer: GPUBuffer
    private bindGroup: GPUBindGroup
    private vertexBuffer: GPUBuffer | null = null
    private vertexCount = 0
    private depthTexture: GPUTexture | null = null
    private lastWidth = 0
    private lastHeight = 0

    constructor(
        private device: GPUDevice,
        private context: GPUCanvasContext,
        private format: GPUTextureFormat,
    ) {
        const shaderModule = device.createShaderModule({ code: shaderCode })

        const bindGroupLayout = device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: "uniform" },
            }],
        })

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        })

        this.pipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: "vertexMain",
                buffers: [{
                    arrayStride: 9 * 4, // 9 floats per vertex
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x3" }, // position
                        { shaderLocation: 1, offset: 12, format: "float32x3" }, // normal
                        { shaderLocation: 2, offset: 24, format: "float32x3" }, // color
                    ],
                }],
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [{ format: this.format }],
            },
            primitive: {
                topology: "triangle-list",
                cullMode: "back",
                frontFace: "ccw",
            },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: true,
                depthCompare: "less",
            },
        })

        // Uniform buffer: model matrix (64 bytes) + viewProjection matrix (64 bytes)
        this.uniformBuffer = device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

        this.bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer },
            }],
        })
    }

    updateMesh(mesh: PolyhedronMesh): void {
        if (this.vertexBuffer) {
            this.vertexBuffer.destroy()
        }

        this.vertexBuffer = this.device.createBuffer({
            size: mesh.vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })
        this.device.queue.writeBuffer(this.vertexBuffer, 0, mesh.vertexData.buffer, mesh.vertexData.byteOffset, mesh.vertexData.byteLength)
        this.vertexCount = mesh.vertexCount
    }

    render(modelMatrix: Float32Array): void {
        if (!this.vertexBuffer || this.vertexCount === 0) {
            return
        }

        const canvas = this.context.canvas as HTMLCanvasElement
        const width = canvas.width
        const height = canvas.height

        // Depth texture を必要に応じて再作成
        if (width !== this.lastWidth || height !== this.lastHeight) {
            if (this.depthTexture) {
                this.depthTexture.destroy()
            }
            this.depthTexture = this.device.createTexture({
                size: [width, height],
                format: "depth24plus",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            })
            this.lastWidth = width
            this.lastHeight = height
        }

        // Update uniforms
        const viewProjection = createViewProjectionMatrix(width / height)
        this.device.queue.writeBuffer(this.uniformBuffer, 0, modelMatrix.buffer, modelMatrix.byteOffset, modelMatrix.byteLength)
        this.device.queue.writeBuffer(this.uniformBuffer, 64, viewProjection.buffer, viewProjection.byteOffset, viewProjection.byteLength)

        const commandEncoder = this.device.createCommandEncoder()
        const textureView = this.context.getCurrentTexture().createView()

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
                loadOp: "clear",
                storeOp: "store",
            }],
            depthStencilAttachment: {
                view: this.depthTexture!.createView(),
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            },
        }

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
        passEncoder.setPipeline(this.pipeline)
        passEncoder.setBindGroup(0, this.bindGroup)
        passEncoder.setVertexBuffer(0, this.vertexBuffer)
        passEncoder.draw(this.vertexCount)
        passEncoder.end()

        this.device.queue.submit([commandEncoder.finish()])
    }

    destroy(): void {
        if (this.vertexBuffer) {
            this.vertexBuffer.destroy()
        }
        if (this.depthTexture) {
            this.depthTexture.destroy()
        }
        this.uniformBuffer.destroy()
    }
}

// 多面体データから描画用メッシュを生成するユーティリティ
export function buildPolyhedronMesh(
    vertexes: { [n: number]: number; length: number }[],
    faces: { ColorIndex: number; VertexIndexes: number[] }[],
): PolyhedronMesh {
    const triangles: number[] = []

    for (const face of faces) {
        const indexes = face.VertexIndexes
        const colorIndex = Math.min(face.ColorIndex, faceColors.length - 1)
        const [r, g, b] = faceColors[colorIndex]!

        // 多角形の重心を計算
        let cx = 0, cy = 0, cz = 0
        for (const idx of indexes) {
            const v = vertexes[idx]!
            cx += v[0]!
            cy += v[1]!
            cz += v[2]!
        }
        cx /= indexes.length
        cy /= indexes.length
        cz /= indexes.length

        // 各辺と重心で三角形を形成
        for (let i = 0; i < indexes.length; i++) {
            const v0 = vertexes[indexes[i]!]!
            const v1 = vertexes[indexes[(i + 1) % indexes.length]!]!

            // 三角形: v0, v1, centroid
            // 法線を計算 (v0 -> v1 と v0 -> centroid の外積)
            const e1x = v1[0]! - v0[0]!
            const e1y = v1[1]! - v0[1]!
            const e1z = v1[2]! - v0[2]!
            const e2x = cx - v0[0]!
            const e2y = cy - v0[1]!
            const e2z = cz - v0[2]!

            let nx = e1y * e2z - e1z * e2y
            let ny = e1z * e2x - e1x * e2z
            let nz = e1x * e2y - e1y * e2x
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz)
            if (nl > 0) {
                nx /= nl
                ny /= nl
                nz /= nl
            }

            // 頂点データ追加: position, normal, color
            triangles.push(
                v0[0]!, v0[1]!, v0[2]!, nx, ny, nz, r, g, b,
                v1[0]!, v1[1]!, v1[2]!, nx, ny, nz, r, g, b,
                cx, cy, cz, nx, ny, nz, r, g, b,
            )
        }
    }

    return {
        vertexData: new Float32Array(triangles),
        vertexCount: triangles.length / 9,
    }
}

// クォータニオンから回転行列を生成
export function quaternionToMatrix(w: number, x: number, y: number, z: number): Float32Array {
    const xx = x * x, yy = y * y, zz = z * z
    const xy = x * y, xz = x * z, yz = y * z
    const wx = w * x, wy = w * y, wz = w * z

    return new Float32Array([
        1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0,
        2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0,
        2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0,
        0, 0, 0, 1,
    ])
}
