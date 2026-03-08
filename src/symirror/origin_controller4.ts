import { type Vector } from "./vector.js"

// origin 操作コントローラ
export class OriginController {
    #onOriginChange: (origin: Vector) => void

    constructor(
        onOriginChange: (origin: Vector) => void,
    ) {
        this.#onOriginChange = onOriginChange
    }

    applyAutoOriginMovement(_: number) { }

    reset(): void {
        this.#onOriginChange([0, 0, 0, 1])
    }
}
