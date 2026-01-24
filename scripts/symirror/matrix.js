export class Matrix4 {
    static transform(source, matrix, resultTo) {
        const x = source[0];
        const y = source[1];
        const z = source[2];
        const w = source[3];
        resultTo[0] = x * matrix[0] + y * matrix[1] + z * matrix[2] + w * matrix[3];
        resultTo[1] = x * matrix[4] + y * matrix[5] + z * matrix[6] + w * matrix[7];
        resultTo[2] = x * matrix[8] + y * matrix[9] + z * matrix[10] + w * matrix[11];
        resultTo[3] = x * matrix[12] + y * matrix[13] + z * matrix[14] + w * matrix[15];
        return resultTo;
    }
    static mul(a, b, resultTo) {
        resultTo[0] = a[0] * b[0] + a[4] * b[1] + a[8] * b[2] + a[12] * b[3];
        resultTo[1] = a[1] * b[0] + a[5] * b[1] + a[9] * b[2] + a[13] * b[3];
        resultTo[2] = a[2] * b[0] + a[6] * b[1] + a[10] * b[2] + a[14] * b[3];
        resultTo[3] = a[3] * b[0] + a[7] * b[1] + a[11] * b[2] + a[15] * b[3];
        resultTo[4] = a[0] * b[4] + a[4] * b[5] + a[8] * b[6] + a[12] * b[7];
        resultTo[5] = a[1] * b[4] + a[5] * b[5] + a[9] * b[6] + a[13] * b[7];
        resultTo[6] = a[2] * b[4] + a[6] * b[5] + a[10] * b[6] + a[14] * b[7];
        resultTo[7] = a[3] * b[4] + a[7] * b[5] + a[11] * b[6] + a[15] * b[7];
        resultTo[8] = a[0] * b[8] + a[4] * b[9] + a[8] * b[10] + a[12] * b[11];
        resultTo[9] = a[1] * b[8] + a[5] * b[9] + a[9] * b[10] + a[13] * b[11];
        resultTo[10] = a[2] * b[8] + a[6] * b[9] + a[10] * b[10] + a[14] * b[11];
        resultTo[11] = a[3] * b[8] + a[7] * b[9] + a[11] * b[10] + a[15] * b[11];
        resultTo[12] = a[0] * b[12] + a[4] * b[13] + a[8] * b[14] + a[12] * b[15];
        resultTo[13] = a[1] * b[12] + a[5] * b[13] + a[9] * b[14] + a[13] * b[15];
        resultTo[14] = a[2] * b[12] + a[6] * b[13] + a[10] * b[14] + a[14] * b[15];
        resultTo[15] = a[3] * b[12] + a[7] * b[13] + a[11] * b[14] + a[15] * b[15];
        return resultTo;
    }
    static mulBy(a, b) {
        const a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
        const a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7];
        const a8 = a[8], a9 = a[9], a10 = a[10], a11 = a[11];
        const a12 = a[12], a13 = a[13], a14 = a[14], a15 = a[15];
        a[0] = a0 * b[0] + a4 * b[1] + a8 * b[2] + a12 * b[3];
        a[1] = a1 * b[0] + a5 * b[1] + a9 * b[2] + a13 * b[3];
        a[2] = a2 * b[0] + a6 * b[1] + a10 * b[2] + a14 * b[3];
        a[3] = a3 * b[0] + a7 * b[1] + a11 * b[2] + a15 * b[3];
        a[4] = a0 * b[4] + a4 * b[5] + a8 * b[6] + a12 * b[7];
        a[5] = a1 * b[4] + a5 * b[5] + a9 * b[6] + a13 * b[7];
        a[6] = a2 * b[4] + a6 * b[5] + a10 * b[6] + a14 * b[7];
        a[7] = a3 * b[4] + a7 * b[5] + a11 * b[6] + a15 * b[7];
        a[8] = a0 * b[8] + a4 * b[9] + a8 * b[10] + a12 * b[11];
        a[9] = a1 * b[8] + a5 * b[9] + a9 * b[10] + a13 * b[11];
        a[10] = a2 * b[8] + a6 * b[9] + a10 * b[10] + a14 * b[11];
        a[11] = a3 * b[8] + a7 * b[9] + a11 * b[10] + a15 * b[11];
        a[12] = a0 * b[12] + a4 * b[13] + a8 * b[14] + a12 * b[15];
        a[13] = a1 * b[12] + a5 * b[13] + a9 * b[14] + a13 * b[15];
        a[14] = a2 * b[12] + a6 * b[13] + a10 * b[14] + a14 * b[15];
        a[15] = a3 * b[12] + a7 * b[13] + a11 * b[14] + a15 * b[15];
    }
    static makeReflection(normal, matrix) {
        for (let column = 0; column < 4; column++) {
            const factor = -2 * normal[column];
            for (let row = 0; row < 4; row++) {
                matrix[column * 4 + row] = (column === row ? 1 : 0) + factor * normal[row];
            }
        }
    }
    static makeTranslate(d, matrix) {
        matrix[0] = 1;
        matrix[1] = 0;
        matrix[2] = 0;
        matrix[3] = 0;
        matrix[4] = 0;
        matrix[5] = 1;
        matrix[6] = 0;
        matrix[7] = 0;
        matrix[8] = 0;
        matrix[9] = 0;
        matrix[10] = 1;
        matrix[11] = 0;
        matrix[12] = d[0];
        matrix[13] = d[1];
        matrix[14] = d[2];
        matrix[15] = 1;
    }
}
