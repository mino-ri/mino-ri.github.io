export class QuaternionPairs {
    static identity = { lw: 1, lx: 0, ly: 0, lz: 0, rw: 1, rx: 0, ry: 0, rz: 0, conjugate: false };
    static #conjugateBy(resultTo, a) {
        resultTo.lx = -a.rx;
        resultTo.ly = -a.ry;
        resultTo.lz = -a.rz;
        resultTo.lw = a.rw;
        resultTo.rx = -a.lx;
        resultTo.ry = -a.ly;
        resultTo.rz = -a.lz;
        resultTo.rw = a.lw;
    }
    static #mulBy(resultTo, a, b) {
        const lx = a.lw * b.lx + a.lx * b.lw + a.ly * b.lz - a.lz * b.ly;
        const ly = a.lw * b.ly - a.lx * b.lz + a.ly * b.lw + a.lz * b.lx;
        const lz = a.lw * b.lz + a.lx * b.ly - a.ly * b.lx + a.lz * b.lw;
        const lw = a.lw * b.lw - a.lx * b.lx - a.ly * b.ly - a.lz * b.lz;
        const rx = b.rw * a.rx + b.rx * a.rw + b.ry * a.rz - b.rz * a.ry;
        const ry = b.rw * a.ry - b.rx * a.rz + b.ry * a.rw + b.rz * a.rx;
        const rz = b.rw * a.rz + b.rx * a.ry - b.ry * a.rx + b.rz * a.rw;
        const rw = b.rw * a.rw - b.rx * a.rx - b.ry * a.ry - b.rz * a.rz;
        resultTo.lx = lx;
        resultTo.ly = ly;
        resultTo.lz = lz;
        resultTo.lw = lw;
        resultTo.rx = rx;
        resultTo.ry = ry;
        resultTo.rz = rz;
        resultTo.rw = rw;
    }
    static getDefault() {
        return { lw: 1, lx: 0, ly: 0, lz: 0, rw: 1, rx: 0, ry: 0, rz: 0, conjugate: false };
    }
    static clear(q) {
        q.lw = 1;
        q.lx = 0;
        q.ly = 0;
        q.lz = 0;
        q.rw = 1;
        q.rx = 0;
        q.ry = 0;
        q.rz = 0;
        q.conjugate = false;
    }
    static mul(a, b, resultTo) {
        const result = resultTo ?? QuaternionPairs.getDefault();
        if (a.conjugate) {
            QuaternionPairs.#conjugateBy(result, b);
            QuaternionPairs.#mulBy(result, a, result);
        }
        else {
            QuaternionPairs.#mulBy(result, a, b);
        }
        result.conjugate = a.conjugate !== b.conjugate;
        return result;
    }
    static transform(v, q, resultTo) {
        const result = resultTo ?? new Array(4);
        const ux = q.conjugate ? -v[0] : v[0];
        const uy = q.conjugate ? -v[1] : v[1];
        const uz = q.conjugate ? -v[2] : v[2];
        const uw = v[3];
        const vx = q.lw * ux + q.lx * uw + q.ly * uz - q.lz * uy;
        const vy = q.lw * uy - q.lx * uz + q.ly * uw + q.lz * ux;
        const vz = q.lw * uz + q.lx * uy - q.ly * ux + q.lz * uw;
        const vw = q.lw * uw - q.lx * ux - q.ly * uy - q.lz * uz;
        result[0] = vw * q.rx + vx * q.rw + vy * q.rz - vz * q.ry;
        result[1] = vw * q.ry - vx * q.rz + vy * q.rw + vz * q.rx;
        result[2] = vw * q.rz + vx * q.ry - vy * q.rx + vz * q.rw;
        result[3] = vw * q.rw - vx * q.rx - vy * q.ry - vz * q.rz;
        return result;
    }
    static mirror(v, resultTo) {
        const result = resultTo ?? QuaternionPairs.getDefault();
        result.lx = -v[0];
        result.ly = -v[1];
        result.lz = -v[2];
        result.lw = -v[3];
        result.rx = v[0];
        result.ry = v[1];
        result.rz = v[2];
        result.rw = v[3];
        result.conjugate = true;
        return result;
    }
    static mirrorNormal(q, resultTo) {
        const result = resultTo ?? [0, 0, 0, 0];
        result[0] = q.rx;
        result[1] = q.ry;
        result[2] = q.rz;
        result[3] = q.rw;
        return result;
    }
    static rotationXZ(angle, resultTo) {
        const halfAngle = angle * 0.5;
        const s = Math.sin(halfAngle);
        const c = Math.cos(halfAngle);
        const result = resultTo ?? QuaternionPairs.getDefault();
        result.lw = c;
        result.lx = 0;
        result.ly = s;
        result.lz = 0;
        result.rw = c;
        result.rx = 0;
        result.ry = -s;
        result.rz = 0;
        result.conjugate = false;
        return result;
    }
    static rotationYZ(angle, resultTo) {
        const halfAngle = angle * 0.5;
        const s = Math.sin(halfAngle);
        const c = Math.cos(halfAngle);
        const result = resultTo ?? QuaternionPairs.getDefault();
        result.lw = c;
        result.lx = s;
        result.ly = 0;
        result.lz = 0;
        result.rw = c;
        result.rx = -s;
        result.ry = 0;
        result.rz = 0;
        result.conjugate = false;
        return result;
    }
    static rotationXW(angle, resultTo) {
        const halfAngle = angle * 0.5;
        const s = Math.sin(halfAngle);
        const c = Math.cos(halfAngle);
        const result = resultTo ?? QuaternionPairs.getDefault();
        result.lw = c;
        result.lx = s;
        result.ly = 0;
        result.lz = 0;
        result.rw = c;
        result.rx = s;
        result.ry = 0;
        result.rz = 0;
        result.conjugate = false;
        return result;
    }
    static rotationYW(angle, resultTo) {
        const halfAngle = angle * 0.5;
        const s = Math.sin(halfAngle);
        const c = Math.cos(halfAngle);
        const result = resultTo ?? QuaternionPairs.getDefault();
        result.lw = c;
        result.lx = 0;
        result.ly = s;
        result.lz = 0;
        result.rw = c;
        result.rx = 0;
        result.ry = s;
        result.rz = 0;
        result.conjugate = false;
        return result;
    }
    static toMatrix({ lw, lx, ly, lz, rw, rx, ry, rz }, matrix) {
        const lwrw = lw * rw, lwrx = lw * rx, lwry = lw * ry, lwrz = lw * rz;
        const lxrw = lx * rw, lxrx = lx * rx, lxry = lx * ry, lxrz = lx * rz;
        const lyrw = ly * rw, lyrx = ly * rx, lyry = ly * ry, lyrz = ly * rz;
        const lzrw = lz * rw, lzrx = lz * rx, lzry = lz * ry, lzrz = lz * rz;
        matrix[0] = -lxrx + lwrw + lzrz + lyry;
        matrix[1] = -lxry - lwrz + lzrw - lyrx;
        matrix[2] = -lxrz + lwry - lzrx - lyrw;
        matrix[3] = -lxrw - lwrx - lzry + lyrz;
        matrix[4] = -lyrx - lzrw + lwrz - lxry;
        matrix[5] = -lyry + lzrz + lwrw + lxrx;
        matrix[6] = -lyrz - lzry - lwrx + lxrw;
        matrix[7] = -lyrw + lzrx - lwry - lxrz;
        matrix[8] = -lzrx + lyrw - lxrz - lwry;
        matrix[9] = -lzry - lyrz - lxrw + lwrx;
        matrix[10] = -lzrz + lyry + lxrx + lwrw;
        matrix[11] = -lzrw - lyrx + lxry - lwrz;
        matrix[12] = lwrx + lxrw + lyrz - lzry;
        matrix[13] = lwry - lxrz + lyrw + lzrx;
        matrix[14] = lwrz + lxry - lyrx + lzrw;
        matrix[15] = lwrw - lxrx - lyry - lzrz;
    }
}
