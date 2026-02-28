/// <reference types="@webgpu/types" />

export interface PolyhedronMesh {
    // インターリーブ頂点データ: [x, y, z, nx, ny, nz, r, g, b] × 頂点数
    vertexData: Float32Array
    stencilVertexCounts: number[]
    normalVertexCount: number
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

    createPolyhedronRenderer({ shaderCode, dynamicBufferByteSize, constantBufferValue, vertexBufferLayout }: ShaderSource): PolyhedronRenderer {
        return new PolyhedronRendererImpl(this.device, this.context, this.format, shaderCode, dynamicBufferByteSize, constantBufferValue, vertexBufferLayout)
    }
}

class PolyhedronRendererImpl implements PolyhedronRenderer {
    #pipeline: GPURenderPipeline
    #stencilWritePipeline: GPURenderPipeline
    #stencilMaskPipeline: GPURenderPipeline
    #shadowPipeline: GPURenderPipeline
    #shadowStencilWritePipeline: GPURenderPipeline
    #shadowStencilMaskPipeline: GPURenderPipeline
    #uniformBuffer: GPUBuffer
    #shadowBindGroup: GPUBindGroup
    #bindGroupLayout: GPUBindGroupLayout
    #bindGroup: GPUBindGroup
    #vertexBuffer: GPUBuffer | null = null
    #stencilVertexCounts: number[] = []
    #normalVertexCount = 0
    #depthTexture: GPUTexture | null = null
    #shadowTexture: GPUTexture
    #shadowSampler: GPUSampler
    #lastWidth = 0
    #lastHeight = 0
    #byteLength = 0
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
    ) {
        this.#device = device
        this.#context = context
        this.#format = format
        const shaderModule = device.createShaderModule({ code })

        this.#shadowSampler = device.createSampler({
            compare: 'less', // シェーダー内の textureSampleCompare で使用
            magFilter: 'linear',
            minFilter: 'linear',
        });

        // Uniform buffer: model matrix (64 bytes) + viewProjection matrix (64 bytes) + lightProjection matrix (64 bytes)
        this.#uniformBuffer = device.createBuffer({
            size: constantBufferValue.byteLength + dynamicBufferByteSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

        const shadowBindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
            ],
        })
        this.#shadowBindGroup = this.#device.createBindGroup({
            layout: shadowBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
            ],
        })

        this.#bindGroupLayout = device.createBindGroupLayout({
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
            layout: this.#bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: this.#shadowTexture.createView({ aspect: "depth-only" }) },
                { binding: 2, resource: this.#shadowSampler },
            ],
        })

        const premitiveState: GPUPrimitiveState = {
            topology: "triangle-list",
            cullMode: "none",
            frontFace: "ccw",
        }
        const shadowLayout = device.createPipelineLayout({
            bindGroupLayouts: [shadowBindGroupLayout],
        })
        const shadowVertexState: GPUVertexState = {
            module: shaderModule,
            entryPoint: "vertexShadow",
            buffers: [vertexBufferLayout],
        }
        const ignoreDepthStencilState: GPUDepthStencilState = {
            format: "depth24plus-stencil8",
            depthWriteEnabled: true,
            depthCompare: "less",
            stencilFront: { compare: "always", passOp: "keep" },
            stencilBack: { compare: "always", passOp: "keep" },
        }
        const readDepthStencilState: GPUDepthStencilState = {
            format: "depth24plus-stencil8",
            depthWriteEnabled: true,
            depthCompare: "less",
            stencilFront: { compare: "not-equal", passOp: "zero", depthFailOp: "zero" },
            stencilBack: { compare: "not-equal", passOp: "zero", depthFailOp: "zero" },
        }
        const writeDepthStencilState: GPUDepthStencilState = {
            format: "depth24plus-stencil8",
            depthWriteEnabled: false,
            depthCompare: "always",
            stencilFront: { compare: "always", passOp: "invert" },
            stencilBack: { compare: "always", passOp: "invert" },
        }
        this.#shadowPipeline = device.createRenderPipeline({
            layout: shadowLayout,
            vertex: shadowVertexState,
            primitive: premitiveState,
            depthStencil: ignoreDepthStencilState,
        })
        this.#shadowStencilWritePipeline = device.createRenderPipeline({
            layout: shadowLayout,
            vertex: shadowVertexState,
            primitive: premitiveState,
            depthStencil: writeDepthStencilState,
        })
        this.#shadowStencilMaskPipeline = device.createRenderPipeline({
            layout: shadowLayout,
            vertex: shadowVertexState,
            primitive: premitiveState,
            depthStencil: readDepthStencilState,
        })

        const layout = device.createPipelineLayout({
            bindGroupLayouts: [this.#bindGroupLayout],
        })
        const vertexState: GPUVertexState = {
            module: shaderModule,
            entryPoint: "vertexMain",
            buffers: [vertexBufferLayout],
        }
        this.#pipeline = device.createRenderPipeline({
            layout: layout,
            vertex: vertexState,
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [{ format: this.#format }],
            },
            primitive: premitiveState,
            depthStencil: ignoreDepthStencilState,
        })
        this.#stencilWritePipeline = device.createRenderPipeline({
            layout: layout,
            vertex: vertexState,
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentEmpty",
                targets: [{ format: this.#format, writeMask: 0 }],
            },
            primitive: premitiveState,
            depthStencil: writeDepthStencilState,
        })
        this.#stencilMaskPipeline = device.createRenderPipeline({
            layout: layout,
            vertex: vertexState,
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [{ format: this.#format }],
            },
            primitive: premitiveState,
            depthStencil: readDepthStencilState,
        })

        this.#device.queue.writeBuffer(this.#uniformBuffer, dynamicBufferByteSize, constantBufferValue.buffer, constantBufferValue.byteOffset, constantBufferValue.byteLength)
    }

    updateMesh(mesh: PolyhedronMesh): void {
        if (!this.#vertexBuffer || this.#byteLength < mesh.vertexData.byteLength) {
            this.#vertexBuffer?.destroy()
            this.#vertexBuffer = this.#device.createBuffer({
                size: mesh.vertexData.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            })
            this.#byteLength = mesh.vertexData.byteLength
        }
        this.#device.queue.writeBuffer(this.#vertexBuffer, 0, mesh.vertexData.buffer, mesh.vertexData.byteOffset, mesh.vertexData.byteLength)
        this.#stencilVertexCounts = mesh.stencilVertexCounts
        this.#normalVertexCount = mesh.normalVertexCount
    }

    render(modelMatrix: Float32Array): void {
        if (!this.#vertexBuffer) {
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
        this.#device.queue.writeBuffer(this.#uniformBuffer, 0, modelMatrix.buffer, modelMatrix.byteOffset, modelMatrix.byteLength)

        const commandEncoder = this.#device.createCommandEncoder()
        this.#renderShadow(commandEncoder)
        this.#renderNormal(commandEncoder)
        this.#device.queue.submit([commandEncoder.finish()])
    }

    #renderShadow(commandEncoder: GPUCommandEncoder) {
        const depthTextureView = this.#shadowTexture.createView()
        const stencilWritePipeline = this.#shadowStencilWritePipeline
        const stencilMaskPipeline = this.#shadowStencilMaskPipeline
        const pipeline = this.#shadowPipeline
        const bindGroup = this.#shadowBindGroup
        const stencilColorAttachments: GPURenderPassColorAttachment[] = []
        const colorAttachments: GPURenderPassColorAttachment[] = []

        this.#renderCore(commandEncoder, stencilColorAttachments, depthTextureView, stencilWritePipeline, bindGroup, stencilMaskPipeline, colorAttachments, pipeline)
    }

    #renderNormal(commandEncoder: GPUCommandEncoder) {
        const depthTextureView = this.#depthTexture!.createView()
        const textureView = this.#context.getCurrentTexture().createView()
        const stencilWritePipeline = this.#stencilWritePipeline
        const stencilMaskPipeline = this.#stencilMaskPipeline
        const pipeline = this.#pipeline
        const bindGroup = this.#bindGroup
        const stencilColorAttachments: GPURenderPassColorAttachment[] = [{
            view: textureView,
            clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
            loadOp: "clear",
            storeOp: "store",
        }]
        const colorAttachments: GPURenderPassColorAttachment[] = [{
            view: textureView,
            clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
            loadOp: this.#stencilVertexCounts.length === 0 ? "clear" : "load",
            storeOp: "store",
        }]

        this.#renderCore(commandEncoder, stencilColorAttachments, depthTextureView, stencilWritePipeline, bindGroup, stencilMaskPipeline, colorAttachments, pipeline)
    }

    #renderCore(commandEncoder: GPUCommandEncoder, stencilColorAttachments: GPURenderPassColorAttachment[], depthTextureView: GPUTextureView, stencilWritePipeline: GPURenderPipeline, bindGroup: GPUBindGroup, stencilMaskPipeline: GPURenderPipeline, colorAttachments: GPURenderPassColorAttachment[], pipeline: GPURenderPipeline) {
        let vertexIndex = 0
        if (this.#stencilVertexCounts.length > 0) {
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

            for (let i = 0; i < this.#stencilVertexCounts.length; i++) {
                const vertexCount = this.#stencilVertexCounts[i]!
                // ステンシル更新
                stencilPass.setPipeline(stencilWritePipeline)
                stencilPass.setBindGroup(0, bindGroup)
                stencilPass.setVertexBuffer(0, this.#vertexBuffer)
                stencilPass.draw(vertexCount, 1, vertexIndex)
                // 描画
                stencilPass.setPipeline(stencilMaskPipeline)
                stencilPass.setBindGroup(0, bindGroup)
                stencilPass.setVertexBuffer(0, this.#vertexBuffer)
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
                depthLoadOp: this.#stencilVertexCounts.length === 0 ? "clear" : "load",
                depthStoreOp: "store",
                stencilReadOnly: true,
            },
        })
        if (this.#normalVertexCount > 0) {
            // 描画
            mainPass.setPipeline(pipeline)
            mainPass.setBindGroup(0, bindGroup)
            mainPass.setVertexBuffer(0, this.#vertexBuffer)
            mainPass.draw(this.#normalVertexCount, 1, vertexIndex)
        }
        mainPass.end()
    }

    destroy(): void {
        if (this.#vertexBuffer) {
            this.#vertexBuffer.destroy()
        }
        if (this.#depthTexture) {
            this.#depthTexture.destroy()
        }
        this.#uniformBuffer.destroy()
    }
}
