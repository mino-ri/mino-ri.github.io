/// <reference types="@webgpu/types" />
import { Vector, Vectors } from "./vector.js"

export interface PolyhedronMesh {
    // インターリーブ頂点データ: [x, y, z, nx, ny, nz, r, g, b] × 頂点数
    vertexData: Float32Array
    ballInstanceData: Float32Array
    lineInstanceData: Float32Array
    stencilVertexCounts: number[]
    normalVertexCount: number
    ballCount: number
    lineCount: number
}

export interface PolyhedronRenderer {
    updateMesh(mesh: PolyhedronMesh): void
    render(modelMatrix: Float32Array): void
    destroy(): void
}

export type ShaderSource = {
    shaderCode: string
    dynamicBufferByteSize: number
    constantBufferValue: Float32Array
    vertexBufferLayout: GPUVertexBufferLayout
    ballInstanceBufferLayout: GPUVertexBufferLayout
    lineInstanceBufferLayout: GPUVertexBufferLayout
}

export interface GpuContext {
    readonly device: GPUDevice
    readonly context: GPUCanvasContext
    readonly format: GPUTextureFormat
    createPolyhedronRenderer(shaderSource: ShaderSource): PolyhedronRenderer
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

    createPolyhedronRenderer({ shaderCode, dynamicBufferByteSize, constantBufferValue, vertexBufferLayout, ballInstanceBufferLayout, lineInstanceBufferLayout }: ShaderSource): PolyhedronRenderer {
        return new PolyhedronRendererImpl(this.device, this.context, this.format, shaderCode, dynamicBufferByteSize, constantBufferValue, vertexBufferLayout, ballInstanceBufferLayout, lineInstanceBufferLayout)
    }
}

class RenderBuffer {
    #device: GPUDevice
    uniformBuffer: GPUBuffer
    ballVertexBuffer: GPUBuffer
    lineVertexBuffer: GPUBuffer
    vertexBuffer: GPUBuffer | null = null
    ballInstanceBuffer: GPUBuffer | null = null
    lineInstanceBuffer: GPUBuffer | null = null
    stencilVertexCounts: number[] = []
    normalVertexCount = 0
    ballCount = 0
    lineCount = 0

    constructor(device: GPUDevice, dynamicBufferByteSize: number, constantBufferValue: Float32Array) {
        this.#device = device
        this.uniformBuffer = device.createBuffer({
            size: constantBufferValue.byteLength + dynamicBufferByteSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

        this.#device.queue.writeBuffer(this.uniformBuffer, dynamicBufferByteSize, constantBufferValue.buffer, constantBufferValue.byteOffset, constantBufferValue.byteLength)
        this.ballVertexBuffer = this.#createBallMesh()
        this.lineVertexBuffer = this.#createLineMesh()
    }

    #createBallMesh(): GPUBuffer {
        const triangles: number[] = []
        const signs = [1, -1]
        const r = 0.95
        const g = 0.95
        const b = 0.95

        const ball = function () {
            const phi = (Math.sqrt(5) + 1) / 2
            const phii = (Math.sqrt(5) - 1) / 2
            const p1: Vector = [-phii, 0, phi]
            const p2: Vector = [-1, 1, 1]
            const p3: Vector = [0, phi, phii]
            const p4: Vector = [1, 1, 1]
            const p5: Vector = [phii, 0, phi]
            const pc = Vectors.average([p1, p2, p3, p4, p5], [0, 0, 0])
            Vectors.normalizeSelf(p1)
            Vectors.normalizeSelf(p2)
            Vectors.normalizeSelf(p3)
            Vectors.normalizeSelf(p4)
            Vectors.normalizeSelf(p5)
            Vectors.normalizeSelf(pc)
            return {
                p1: { point: Vectors.div(p1, 32), normal: p1 },
                p2: { point: Vectors.div(p2, 32), normal: p2 },
                p3: { point: Vectors.div(p3, 32), normal: p3 },
                p4: { point: Vectors.div(p4, 32), normal: p4 },
                p5: { point: Vectors.div(p5, 32), normal: p5 },
                pc: { point: Vectors.div(pc, 32), normal: pc },
            }
        }()

        for (let i = 0; i < 3; i++) {
            const xIndex = i
            const yIndex = (i + 1) % 3
            const zIndex = (i + 2) % 3
            for (const ys of signs) {
                for (const zs of signs) {
                    const signs = [1, ys, zs]
                    let xSign = signs[xIndex]!
                    let ySign = signs[yIndex]!
                    let zSign = signs[zIndex]!

                    const p1x = ball.p1.point[xIndex]! * xSign
                    const p1y = ball.p1.point[yIndex]! * ySign
                    const p1z = ball.p1.point[zIndex]! * zSign
                    const p2x = ball.p2.point[xIndex]! * xSign
                    const p2y = ball.p2.point[yIndex]! * ySign
                    const p2z = ball.p2.point[zIndex]! * zSign
                    const p3x = ball.p3.point[xIndex]! * xSign
                    const p3y = ball.p3.point[yIndex]! * ySign
                    const p3z = ball.p3.point[zIndex]! * zSign
                    const p4x = ball.p4.point[xIndex]! * xSign
                    const p4y = ball.p4.point[yIndex]! * ySign
                    const p4z = ball.p4.point[zIndex]! * zSign
                    const p5x = ball.p5.point[xIndex]! * xSign
                    const p5y = ball.p5.point[yIndex]! * ySign
                    const p5z = ball.p5.point[zIndex]! * zSign
                    const pcx = ball.pc.point[xIndex]! * xSign
                    const pcy = ball.pc.point[yIndex]! * ySign
                    const pcz = ball.pc.point[zIndex]! * zSign
                    // 頂点データ追加: position, normal, color
                    if (ys * zs === -1) {
                        triangles.push(
                            p1x, p1y, p1z, ball.p1.normal[xIndex]! * xSign, ball.p1.normal[yIndex]! * ySign, ball.p1.normal[zIndex]! * zSign, r, g, b,
                            p2x, p2y, p2z, ball.p2.normal[xIndex]! * xSign, ball.p2.normal[yIndex]! * ySign, ball.p2.normal[zIndex]! * zSign, r, g, b,
                            pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                            p2x, p2y, p2z, ball.p2.normal[xIndex]! * xSign, ball.p2.normal[yIndex]! * ySign, ball.p2.normal[zIndex]! * zSign, r, g, b,
                            p3x, p3y, p3z, ball.p3.normal[xIndex]! * xSign, ball.p3.normal[yIndex]! * ySign, ball.p3.normal[zIndex]! * zSign, r, g, b,
                            pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                            p3x, p3y, p3z, ball.p3.normal[xIndex]! * xSign, ball.p3.normal[yIndex]! * ySign, ball.p3.normal[zIndex]! * zSign, r, g, b,
                            p4x, p4y, p4z, ball.p4.normal[xIndex]! * xSign, ball.p4.normal[yIndex]! * ySign, ball.p4.normal[zIndex]! * zSign, r, g, b,
                            pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                            p4x, p4y, p4z, ball.p4.normal[xIndex]! * xSign, ball.p4.normal[yIndex]! * ySign, ball.p4.normal[zIndex]! * zSign, r, g, b,
                            p5x, p5y, p5z, ball.p5.normal[xIndex]! * xSign, ball.p5.normal[yIndex]! * ySign, ball.p5.normal[zIndex]! * zSign, r, g, b,
                            pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                            p5x, p5y, p5z, ball.p5.normal[xIndex]! * xSign, ball.p5.normal[yIndex]! * ySign, ball.p5.normal[zIndex]! * zSign, r, g, b,
                            p1x, p1y, p1z, ball.p1.normal[xIndex]! * xSign, ball.p1.normal[yIndex]! * ySign, ball.p1.normal[zIndex]! * zSign, r, g, b,
                            pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                        )
                    } else {
                        triangles.push(
                            p2x, p2y, p2z, ball.p2.normal[xIndex]! * xSign, ball.p2.normal[yIndex]! * ySign, ball.p2.normal[zIndex]! * zSign, r, g, b,
                            p1x, p1y, p1z, ball.p1.normal[xIndex]! * xSign, ball.p1.normal[yIndex]! * ySign, ball.p1.normal[zIndex]! * zSign, r, g, b,
                            pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                            p3x, p3y, p3z, ball.p3.normal[xIndex]! * xSign, ball.p3.normal[yIndex]! * ySign, ball.p3.normal[zIndex]! * zSign, r, g, b,
                            p2x, p2y, p2z, ball.p2.normal[xIndex]! * xSign, ball.p2.normal[yIndex]! * ySign, ball.p2.normal[zIndex]! * zSign, r, g, b,
                            pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                            p4x, p4y, p4z, ball.p4.normal[xIndex]! * xSign, ball.p4.normal[yIndex]! * ySign, ball.p4.normal[zIndex]! * zSign, r, g, b,
                            p3x, p3y, p3z, ball.p3.normal[xIndex]! * xSign, ball.p3.normal[yIndex]! * ySign, ball.p3.normal[zIndex]! * zSign, r, g, b,
                            pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                            p5x, p5y, p5z, ball.p5.normal[xIndex]! * xSign, ball.p5.normal[yIndex]! * ySign, ball.p5.normal[zIndex]! * zSign, r, g, b,
                            p4x, p4y, p4z, ball.p4.normal[xIndex]! * xSign, ball.p4.normal[yIndex]! * ySign, ball.p4.normal[zIndex]! * zSign, r, g, b,
                            pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                            p1x, p1y, p1z, ball.p1.normal[xIndex]! * xSign, ball.p1.normal[yIndex]! * ySign, ball.p1.normal[zIndex]! * zSign, r, g, b,
                            p5x, p5y, p5z, ball.p5.normal[xIndex]! * xSign, ball.p5.normal[yIndex]! * ySign, ball.p5.normal[zIndex]! * zSign, r, g, b,
                            pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                        )
                    }
                }
            }
        }

        const vertexData = new Float32Array(triangles)
        const vertexBuffer = this.#device.createBuffer({
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })

        this.#device.queue.writeBuffer(vertexBuffer, 0, vertexData.buffer, vertexData.byteOffset, vertexData.byteLength)
        return vertexBuffer
    }

    #createLineMesh(): GPUBuffer {
        const triangles: number[] = []
        const r = 0.25
        const g = 0.25
        const b = 0.25
        for (let i = 0; i < 8; i++) {
            const thetaA = Math.PI / 4 * i
            const thetaB = Math.PI / 4 * ((i + 1) % 8)
            const cosA = Math.cos(thetaA)
            const sinA = Math.sin(thetaA)
            const cosB = Math.cos(thetaB)
            const sinB = Math.sin(thetaB)

            triangles.push(
                cosA / 96, sinA / 96, 0, cosA, sinA, 0, r, g, b,
                cosB / 96, sinB / 96, 0, cosB, sinB, 0, r, g, b,
                cosA / 96, sinA / 96, 1, cosA, sinA, 0, r, g, b,

                cosA / 96, sinA / 96, 1, cosA, sinA, 0, r, g, b,
                cosB / 96, sinB / 96, 0, cosB, sinB, 0, r, g, b,
                cosB / 96, sinB / 96, 1, cosB, sinB, 0, r, g, b,
            )
        }

        const vertexData = new Float32Array(triangles)
        const vertexBuffer = this.#device.createBuffer({
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })

        this.#device.queue.writeBuffer(vertexBuffer, 0, vertexData.buffer, vertexData.byteOffset, vertexData.byteLength)
        return vertexBuffer
    }

    updateMesh(mesh: PolyhedronMesh): void {
        this.vertexBuffer = this.#setMesh(this.vertexBuffer, mesh.vertexData)
        this.ballInstanceBuffer = this.#setMesh(this.ballInstanceBuffer, mesh.ballInstanceData)
        this.lineInstanceBuffer = this.#setMesh(this.lineInstanceBuffer, mesh.lineInstanceData)
        this.stencilVertexCounts = mesh.stencilVertexCounts
        this.normalVertexCount = mesh.normalVertexCount
        this.ballCount = mesh.ballCount
        this.lineCount = mesh.lineCount
    }

    #setMesh(buffer: GPUBuffer | null, data: Float32Array) {
        if (!buffer || buffer.size < data.byteLength) {
            buffer?.destroy()
            buffer = this.#device.createBuffer({
                size: data.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            })
        }
        this.#device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength)
        return buffer
    }
}

class RenderPipeline {
    static #premitiveState: GPUPrimitiveState = {
        topology: "triangle-list",
        cullMode: "none",
        frontFace: "ccw",
    }
    static #instanceVertexBufferLayout: GPUVertexBufferLayout = {
        stepMode: "vertex",
        arrayStride: 9 * 4,
        attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" }, // position
            { shaderLocation: 1, offset: 12, format: "float32x3" }, // normal
            { shaderLocation: 2, offset: 24, format: "float32x3" }, // color
        ],
    }
    static #ignoreDepthStencilState: GPUDepthStencilState = {
        format: "depth24plus-stencil8",
        depthWriteEnabled: true,
        depthCompare: "less",
        stencilFront: { compare: "always", passOp: "keep" },
        stencilBack: { compare: "always", passOp: "keep" },
    }
    static #readDepthStencilState: GPUDepthStencilState = {
        format: "depth24plus-stencil8",
        depthWriteEnabled: true,
        depthCompare: "less",
        stencilFront: { compare: "not-equal", passOp: "zero", depthFailOp: "zero" },
        stencilBack: { compare: "not-equal", passOp: "zero", depthFailOp: "zero" },
    }
    static #writeDepthStencilState: GPUDepthStencilState = {
        format: "depth24plus-stencil8",
        depthWriteEnabled: false,
        depthCompare: "always",
        stencilFront: { compare: "always", passOp: "invert" },
        stencilBack: { compare: "always", passOp: "invert" },
    }

    #device: GPUDevice
    #bindGroup: GPUBindGroup
    #layout: GPUPipelineLayout
    #pipeline: GPURenderPipeline
    #ballPipeline: GPURenderPipeline
    #linePipeline: GPURenderPipeline
    #stencilWritePipeline: GPURenderPipeline
    #stencilMaskPipeline: GPURenderPipeline
    #buffer: RenderBuffer

    constructor(
        shaderNameSuffix: string,
        device: GPUDevice,
        shaderModule: GPUShaderModule,
        buffer: RenderBuffer,
        bindGroup: GPUBindGroup,
        layout: GPUPipelineLayout,
        vertexBufferLayout: GPUVertexBufferLayout,
        ballInstanceBufferLayout: GPUVertexBufferLayout,
        lineInstanceBufferLayout: GPUVertexBufferLayout,
        fragmentState?: GPUFragmentState,
        discardFragmentState?: GPUFragmentState,
    ) {
        this.#device = device
        this.#buffer = buffer
        this.#bindGroup = bindGroup
        this.#layout = layout

        const vertexState: GPUVertexState = {
            module: shaderModule,
            entryPoint: "vertex" + shaderNameSuffix,
            buffers: [vertexBufferLayout],
        }

        this.#pipeline = this.#createPipeline(vertexState, RenderPipeline.#ignoreDepthStencilState, fragmentState)
        this.#stencilWritePipeline = this.#createPipeline(vertexState, RenderPipeline.#writeDepthStencilState, discardFragmentState)
        this.#stencilMaskPipeline = this.#createPipeline(vertexState, RenderPipeline.#readDepthStencilState, fragmentState)
        this.#ballPipeline = this.#createPipeline({
            module: shaderModule,
            entryPoint: "vertexBall" + shaderNameSuffix,
            buffers: [RenderPipeline.#instanceVertexBufferLayout, ballInstanceBufferLayout],
        }, RenderPipeline.#ignoreDepthStencilState, fragmentState)
        this.#linePipeline = this.#createPipeline({
            module: shaderModule,
            entryPoint: "vertexLine" + shaderNameSuffix,
            buffers: [RenderPipeline.#instanceVertexBufferLayout, lineInstanceBufferLayout],
        }, RenderPipeline.#ignoreDepthStencilState, fragmentState)
    }

    #createPipeline(vertexState: GPUVertexState, depthStencilState: GPUDepthStencilState, fragmentState?: GPUFragmentState): GPURenderPipeline {
        const desc: GPURenderPipelineDescriptor = {
            layout: this.#layout,
            vertex: vertexState,
            primitive: RenderPipeline.#premitiveState,
            depthStencil: depthStencilState,
        }
        if (fragmentState) desc.fragment = fragmentState
        return this.#device.createRenderPipeline(desc)
    }

    render(commandEncoder: GPUCommandEncoder, depthTextureView: GPUTextureView, stencilColorAttachments: GPURenderPassColorAttachment[], colorAttachments: GPURenderPassColorAttachment[]) {
        let vertexIndex = 0
        if (this.#buffer.stencilVertexCounts.length > 0) {
            const stencilPass = commandEncoder.beginRenderPass({
                colorAttachments: stencilColorAttachments,
                depthStencilAttachment: {
                    view: depthTextureView,
                    depthClearValue: 1.0,
                    depthLoadOp: "clear",
                    depthStoreOp: "store",
                    stencilClearValue: 0,
                    stencilLoadOp: "clear",
                    stencilStoreOp: "store",
                },
            })

            for (let i = 0; i < this.#buffer.stencilVertexCounts.length; i++) {
                const vertexCount = this.#buffer.stencilVertexCounts[i]!
                // ステンシル更新
                stencilPass.setPipeline(this.#stencilWritePipeline)
                stencilPass.setBindGroup(0, this.#bindGroup)
                stencilPass.setVertexBuffer(0, this.#buffer.vertexBuffer)
                stencilPass.draw(vertexCount, 1, vertexIndex)
                // 描画
                stencilPass.setPipeline(this.#stencilMaskPipeline)
                stencilPass.setBindGroup(0, this.#bindGroup)
                stencilPass.setVertexBuffer(0, this.#buffer.vertexBuffer)
                stencilPass.draw(vertexCount, 1, vertexIndex)
                vertexIndex += vertexCount
            }

            stencilPass.end()
        }

        const mainPass = commandEncoder.beginRenderPass({
            colorAttachments: colorAttachments,
            depthStencilAttachment: {
                view: depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: this.#buffer.stencilVertexCounts.length === 0 ? "clear" : "load",
                depthStoreOp: "store",
                stencilReadOnly: true,
            },
        })
        if (this.#buffer.normalVertexCount > 0) {
            // 描画
            mainPass.setPipeline(this.#pipeline)
            mainPass.setBindGroup(0, this.#bindGroup)
            mainPass.setVertexBuffer(0, this.#buffer.vertexBuffer)
            mainPass.draw(this.#buffer.normalVertexCount, 1, vertexIndex)
        }
        if (this.#buffer.lineCount > 0) {
            // 辺描画
            mainPass.setPipeline(this.#linePipeline)
            mainPass.setBindGroup(0, this.#bindGroup)
            mainPass.setVertexBuffer(0, this.#buffer.lineVertexBuffer)
            mainPass.setVertexBuffer(1, this.#buffer.lineInstanceBuffer)
            mainPass.draw(this.#buffer.lineVertexBuffer.size / 36, this.#buffer.lineCount)
        }
        if (this.#buffer.ballCount > 0) {
            // 頂点描画
            mainPass.setPipeline(this.#ballPipeline)
            mainPass.setBindGroup(0, this.#bindGroup)
            mainPass.setVertexBuffer(0, this.#buffer.ballVertexBuffer)
            mainPass.setVertexBuffer(1, this.#buffer.ballInstanceBuffer)
            mainPass.draw(this.#buffer.ballVertexBuffer.size / 36, this.#buffer.ballCount)
        }
        mainPass.end()
    }
}

class PolyhedronRendererImpl implements PolyhedronRenderer {
    #shadowSPipeline: RenderPipeline
    #mainSPipeline: RenderPipeline
    #shadowBindGroup: GPUBindGroup
    #bindGroup: GPUBindGroup
    #buffer: RenderBuffer
    #depthTexture: GPUTexture | null = null
    #shadowTexture: GPUTexture
    #shadowSampler: GPUSampler
    #lastWidth = 0
    #lastHeight = 0
    #device: GPUDevice
    #context: GPUCanvasContext
    #format: GPUTextureFormat

    constructor(
        device: GPUDevice,
        context: GPUCanvasContext,
        format: GPUTextureFormat,
        code: string,
        dynamicBufferByteSize: number,
        constantBufferValue: Float32Array,
        vertexBufferLayout: GPUVertexBufferLayout,
        ballInstanceBufferLayout: GPUVertexBufferLayout,
        lineInstanceBufferLayout: GPUVertexBufferLayout,
    ) {
        this.#device = device
        this.#context = context
        this.#format = format
        const shaderModule = device.createShaderModule({ code })
        this.#buffer = new RenderBuffer(device, dynamicBufferByteSize, constantBufferValue)

        this.#shadowSampler = device.createSampler({
            compare: 'less', // シェーダー内の textureSampleCompare で使用
            magFilter: 'linear',
            minFilter: 'linear',
        });

        const shadowBindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
            ],
        })
        this.#shadowBindGroup = this.#device.createBindGroup({
            layout: shadowBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#buffer.uniformBuffer } },
            ],
        })

        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
            ],
        })

        this.#shadowTexture = this.#device.createTexture({
            size: [2048, 2048],
            format: 'depth24plus-stencil8',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        })

        this.#bindGroup = this.#device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#buffer.uniformBuffer } },
                { binding: 1, resource: this.#shadowTexture.createView({ aspect: "depth-only" }) },
                { binding: 2, resource: this.#shadowSampler },
            ],
        })

        const shadowLayout = device.createPipelineLayout({
            bindGroupLayouts: [shadowBindGroupLayout],
        })
        this.#shadowSPipeline = new RenderPipeline(
            "Shadow",
            device,
            shaderModule,
            this.#buffer,
            this.#shadowBindGroup,
            shadowLayout,
            vertexBufferLayout,
            ballInstanceBufferLayout,
            lineInstanceBufferLayout
        )

        const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] })
        const fragmentState: GPUFragmentState = {
            module: shaderModule,
            entryPoint: "fragmentMain",
            targets: [{ format: this.#format }],
        }
        const discardFragmentState: GPUFragmentState = {
            module: shaderModule,
            entryPoint: "fragmentEmpty",
            targets: [{ format: this.#format, writeMask: 0 }],
        }
        this.#mainSPipeline = new RenderPipeline(
            "Main",
            device,
            shaderModule,
            this.#buffer,
            this.#bindGroup,
            layout,
            vertexBufferLayout,
            ballInstanceBufferLayout,
            lineInstanceBufferLayout,
            fragmentState,
            discardFragmentState,
        )
    }

    updateMesh(mesh: PolyhedronMesh): void {
        this.#buffer.updateMesh(mesh)
    }

    render(modelMatrix: Float32Array): void {
        if (!this.#buffer.vertexBuffer) {
            return
        }

        const canvas = this.#context.canvas as HTMLCanvasElement
        const width = canvas.width
        const height = canvas.height

        // Depth texture を必要に応じて再作成
        if (width !== this.#lastWidth || height !== this.#lastHeight) {
            if (this.#depthTexture) {
                this.#depthTexture.destroy()
            }
            this.#depthTexture = this.#device.createTexture({
                size: [width, height],
                format: "depth24plus-stencil8",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            })

            this.#lastWidth = width
            this.#lastHeight = height
        }

        // Update uniforms
        this.#device.queue.writeBuffer(this.#buffer.uniformBuffer, 0, modelMatrix.buffer, modelMatrix.byteOffset, modelMatrix.byteLength)

        const commandEncoder = this.#device.createCommandEncoder()
        this.#renderShadow(commandEncoder)
        this.#renderNormal(commandEncoder)
        this.#device.queue.submit([commandEncoder.finish()])
    }

    #renderShadow(commandEncoder: GPUCommandEncoder) {
        this.#shadowSPipeline.render(commandEncoder, this.#shadowTexture.createView(), [], [])
    }

    #renderNormal(commandEncoder: GPUCommandEncoder) {
        const textureView = this.#context.getCurrentTexture().createView()
        const stencilColorAttachments: GPURenderPassColorAttachment[] = [{
            view: textureView,
            clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
            loadOp: "clear",
            storeOp: "store",
        }]
        const colorAttachments: GPURenderPassColorAttachment[] = [{
            view: textureView,
            clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
            loadOp: this.#buffer.stencilVertexCounts.length === 0 ? "clear" : "load",
            storeOp: "store",
        }]
        this.#mainSPipeline.render(commandEncoder, this.#depthTexture!.createView(), stencilColorAttachments, colorAttachments)
    }

    destroy(): void {
        this.#depthTexture?.destroy()
        this.#buffer.vertexBuffer?.destroy()
        this.#buffer.ballVertexBuffer.destroy()
        this.#buffer.lineVertexBuffer.destroy()
        this.#buffer.uniformBuffer.destroy()
        this.#buffer.ballInstanceBuffer?.destroy()
        this.#buffer.lineInstanceBuffer?.destroy()
    }
}
