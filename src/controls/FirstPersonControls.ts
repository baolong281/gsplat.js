import { Camera } from "../cameras/Camera";
import { Matrix3 } from "../math/Matrix3";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";

class FirstPersonControls {
    minAngle: number = -90;
    maxAngle: number = 90;
    minZoom: number = 0.1;
    maxZoom: number = 30;
    lookSpeed: number = 1;
    panSpeed: number = 0.75;
    zoomSpeed: number = 1;
    dampening: number = 0.9;
    setCameraTarget: (newTarget: Vector3) => void = () => {};
    update: () => void;
    dispose: () => void;

    constructor(
        camera: Camera,
        canvas: HTMLElement,
        alpha: number = 0.5,
        beta: number = 0.5,
        radius: number = 5,
        enableKeyboardControls: boolean = true,
        inputTarget: Vector3 = new Vector3(),
    ) {
        let target = inputTarget.clone();

        let desiredTarget = target.clone();
        let desiredAlpha = alpha;
        let desiredBeta = beta;
        let desiredRadius = radius;
        let desiredPanY = 0;
        let desiredPanX = 0;

        let panX = 0;
        let panY = 0;

        let dragging = false;
        let panning = true;
        let lastDist = 0;
        let lastX = 0;
        let lastY = 0;

        const keys: { [key: string]: boolean } = {};

        let isUpdatingCamera = false;

        const computeZoomNorm = () => {
            return 0.1 + (0.9 * (desiredRadius - this.minZoom)) / (this.maxZoom - this.minZoom);
        };

        const onKeyDown = (e: KeyboardEvent) => {
            keys[e.code] = true;
            // Map arrow keys to WASD keys
            if (e.code === "ArrowUp") keys["KeyW"] = true;
            if (e.code === "ArrowDown") keys["KeyS"] = true;
            if (e.code === "ArrowLeft") keys["KeyA"] = true;
            if (e.code === "ArrowRight") keys["KeyD"] = true;
            if (e.code === "Space") keys["Space"] = true;
            if (e.code === "ShiftLeft") keys["Shift"] = true;
        };

        const onKeyUp = (e: KeyboardEvent) => {
            keys[e.code] = false; // Map arrow keys to WASD keys
            if (e.code === "ArrowUp") keys["KeyW"] = false;
            if (e.code === "ArrowDown") keys["KeyS"] = false;
            if (e.code === "ArrowLeft") keys["KeyA"] = false;
            if (e.code === "ArrowRight") keys["KeyD"] = false;
            if (e.code === "Space") keys["Space"] = false;
            if (e.code === "ShiftLeft") keys["Shift"] = false;
        };

        const pi_2 = Math.PI / 2;

        const clamp = (value: number) => {
            return Math.max(-pi_2, Math.min(pi_2, value));
        };

        const onMouseMove = (e: MouseEvent) => {
            preventDefault(e);

            if (!camera || document.pointerLockElement !== canvas) return;

            const dx = e.movementX;
            const dy = e.movementY;

            const zoomNorm = computeZoomNorm();
            // const panX = dx * this.panSpeed * 0.01;
            // const panY = dy * this.panSpeed * 0.01;

            desiredPanX += e.movementX * this.panSpeed * 0.01 * zoomNorm;
            desiredPanY += e.movementY * this.panSpeed * 0.01 * zoomNorm;

            // make sure within range (-pi.2, pi/2)
            desiredPanY = clamp(desiredPanY);

            lastX = e.clientX;
            lastY = e.clientY;
        };

        const onWheel = (e: WheelEvent) => {
            preventDefault(e);

            const zoomNorm = computeZoomNorm();
            desiredRadius += e.deltaY * this.zoomSpeed * 0.025 * zoomNorm;
            desiredRadius = Math.min(Math.max(desiredRadius, this.minZoom), this.maxZoom);
        };

        const onTouchStart = (e: TouchEvent) => {
            preventDefault(e);

            if (e.touches.length === 1) {
                dragging = true;
                panning = false;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
                lastDist = 0;
            } else if (e.touches.length === 2) {
                dragging = true;
                panning = true;
                lastX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                lastY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const distX = e.touches[0].clientX - e.touches[1].clientX;
                const distY = e.touches[0].clientY - e.touches[1].clientY;
                lastDist = Math.sqrt(distX * distX + distY * distY);
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            preventDefault(e);

            dragging = false;
            panning = false;
        };

        const onTouchMove = (e: TouchEvent) => {
            preventDefault(e);

            if (!dragging || !camera) return;

            if (panning) {
                const zoomNorm = computeZoomNorm();

                const distX = e.touches[0].clientX - e.touches[1].clientX;
                const distY = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(distX * distX + distY * distY);
                const delta = lastDist - dist;
                desiredRadius += delta * this.zoomSpeed * 0.1 * zoomNorm;
                desiredRadius = Math.min(Math.max(desiredRadius, this.minZoom), this.maxZoom);
                lastDist = dist;

                const touchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const touchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const dx = touchX - lastX;
                const dy = touchY - lastY;
                const R = Matrix3.RotationFromQuaternion(camera.rotation).buffer;
                const right = new Vector3(R[0], R[3], R[6]);
                const up = new Vector3(R[1], R[4], R[7]);
                desiredTarget = desiredTarget.add(right.multiply(-dx * this.panSpeed * 0.025 * zoomNorm));
                desiredTarget = desiredTarget.add(up.multiply(-dy * this.panSpeed * 0.025 * zoomNorm));
                lastX = touchX;
                lastY = touchY;
            } else {
                const dx = e.touches[0].clientX - lastX;
                const dy = e.touches[0].clientY - lastY;

                desiredAlpha -= dx * this.lookSpeed * 0.003;
                desiredBeta += dy * this.lookSpeed * 0.003;
                desiredBeta = Math.min(
                    Math.max(desiredBeta, (this.minAngle * Math.PI) / 180),
                    (this.maxAngle * Math.PI) / 180,
                );

                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            }
        };

        const lerp = (a: number, b: number, t: number) => {
            return (1 - t) * a + t * b;
        };

        this.update = () => {
            isUpdatingCamera = true;

            panX = lerp(panX, desiredPanX, this.dampening);
            panY = lerp(panY, desiredPanY, this.dampening);

            camera.position = new Vector3(target.x, target.y, target.z);
            camera.rotation = Quaternion.FromEuler(new Vector3(-panY, panX, 0));

            // const direction = target.subtract(camera.position).normalize();
            // const rx = Math.asin(-direction.y);
            // const ry = Math.atan2(direction.x, direction.z);
            // camera.rotation = Quaternion.FromEuler(new Vector3(rx, ry, 0));

            const moveSpeed = 0.2;

            const R = Matrix3.RotationFromQuaternion(camera.rotation).buffer;
            const forward = new Vector3(-R[2], -R[5], -R[8]);
            const right = new Vector3(R[0], R[3], R[6]);
            const up = new Vector3(0, 1, 0);

            if (keys["KeyS"]) target = target.add(forward.multiply(moveSpeed));
            if (keys["KeyW"]) target = target.subtract(forward.multiply(moveSpeed));
            if (keys["KeyA"]) target = target.subtract(right.multiply(moveSpeed));
            if (keys["KeyD"]) target = target.add(right.multiply(moveSpeed));
            if (keys["Space"]) target = target.subtract(up.multiply(moveSpeed));
            if (keys["Shift"]) target = target.add(up.multiply(moveSpeed));

            isUpdatingCamera = false;
        };

        const preventDefault = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const getPointerLock = async () => {
            await canvas.requestPointerLock();
        };

        this.dispose = () => {
            canvas.removeEventListener("dragenter", preventDefault);
            canvas.removeEventListener("dragover", preventDefault);
            canvas.removeEventListener("dragleave", preventDefault);
            canvas.removeEventListener("contextmenu", preventDefault);

            canvas.removeEventListener("mousemove", onMouseMove);
            canvas.removeEventListener("wheel", onWheel);

            canvas.removeEventListener("touchstart", onTouchStart);
            canvas.removeEventListener("touchend", onTouchEnd);
            canvas.removeEventListener("touchmove", onTouchMove);
            canvas.removeEventListener("click", getPointerLock);

            if (enableKeyboardControls) {
                window.removeEventListener("keydown", onKeyDown);
                window.removeEventListener("keyup", onKeyUp);
            }
        };

        if (enableKeyboardControls) {
            window.addEventListener("keydown", onKeyDown);
            window.addEventListener("keyup", onKeyUp);
        }

        canvas.addEventListener("dragenter", preventDefault);
        canvas.addEventListener("dragover", preventDefault);
        canvas.addEventListener("dragleave", preventDefault);
        canvas.addEventListener("contextmenu", preventDefault);

        canvas.addEventListener("mousemove", onMouseMove);
        canvas.addEventListener("wheel", onWheel);

        canvas.addEventListener("touchstart", onTouchStart);
        canvas.addEventListener("touchend", onTouchEnd);
        canvas.addEventListener("touchmove", onTouchMove);

        canvas.addEventListener("click", getPointerLock);

        this.update();
    }
}

export { FirstPersonControls };
