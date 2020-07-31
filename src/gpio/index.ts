// const require = process.mainModule.require;
const Gpio = require('onoff').Gpio; //require onoff to control GPIO

// export const BCM01_OUT = new Gpio(1, 'out');
// export const BCM02_OUT = new Gpio(2, 'out');
// export const BCM03_OUT = new Gpio(3, 'out');
// export const BCM04_OUT = new Gpio(4, 'out');
// export const BCM05_OUT = new Gpio(5, 'out');
// export const BCM06_OUT = new Gpio(6, 'out');
// export const BCM07_OUT = new Gpio(7, 'out');
// export const BCM08_OUT = new Gpio(8, 'out');
// export const BCM09_OUT = new Gpio(9, 'out');
// export const BCM10_OUT = new Gpio(10, 'out');
// export const BCM11_OUT = new Gpio(11, 'out');
// export const BCM12_OUT = new Gpio(12, 'out');
// export const BCM13_OUT = new Gpio(13, 'out');
// export const BCM14_OUT = new Gpio(14, 'out');
// export const BCM15_OUT = new Gpio(15, 'out');
// export const BCM16_OUT = new Gpio(16, 'out');
// export const BCM17_OUT = new Gpio(17, 'out');
// export const BCM18_OUT = new Gpio(18, 'out');
// export const BCM19_OUT = new Gpio(19, 'out');
// export const BCM20_OUT = new Gpio(20, 'out');
// export const BCM21_OUT = new Gpio(21, 'out');
// export const BCM22_OUT = new Gpio(22, 'out');
// export const BCM23_OUT = new Gpio(23, 'out');
// export const BCM24_OUT = new Gpio(24, 'out');
// export const BCM25_OUT = new Gpio(25, 'out');
// export const BCM26_OUT = new Gpio(26, 'out');

/**
 * Pass in a BCM Pin Number and whether it is an input or an output.
 * Returns a new Gpio object to be used in the other functions.
 */
export function exportPin(pinNumber: number, io: string) {
    return new Gpio(pinNumber, io);
}

/**
 * Set pin HIGH
 */
export function setPinHIGH(pin) {
    return pin.writeSync(0);
}

/**
 * Set pin LOW
 */
export function setPinLOW(pin) {
    return pin.writeSync(1);
}

/**
 * Read the pin state
 */
export function readPin(pin) {
    return pin.readSync();
}
