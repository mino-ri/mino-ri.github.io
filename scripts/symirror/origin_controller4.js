export class OriginController {
    #onOriginChange;
    constructor(onOriginChange) {
        this.#onOriginChange = onOriginChange;
    }
    applyAutoOriginMovement(_) { }
    reset() {
        this.#onOriginChange([0, 0, 0, 1]);
    }
}
