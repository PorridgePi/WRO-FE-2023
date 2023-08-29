#ifndef LIDAR_H
#define LIDAR_H

#include <Arduino.h>
#include <Wire.h>

class Lidar {
    public:
        Lidar(TwoWire &wire, int addr, int calibration = 0) :
            _addr(addr), _calibration(calibration), _wire(wire) {
        } // constructor

        int read() {
            return max(readRaw() + _calibration, 0);
        }

        int readRaw() {
            _wire.beginTransmission(_addr); // start bit
            _wire.write(0x00);              // tell tfluna which register to read from, this register is low dist
            _wire.endTransmission();        // end bit
            _wire.requestFrom(_addr, 1);    // request 1 bit
            int lowBit = _wire.read();

            _wire.beginTransmission(_addr); // start bit
            _wire.write(0x01);              // tell tfluna which register to read from, this register is low dist
            _wire.endTransmission();        // end bit
            _wire.requestFrom(_addr, 1);    // request 1 bit
            int highBit = _wire.read();
            return lowBit + (highBit << 8);
        }

        void enable() {
            _wire.beginTransmission(_addr);
            _wire.write(0x25);
            _wire.write(0x00);
            _wire.endTransmission();
        }

        void disable() {
            _wire.beginTransmission(_addr);
            _wire.write(0x25);
            _wire.write(0x01);
            _wire.endTransmission();
        }

        int getFPS() {
            _wire.beginTransmission(_addr);
            _wire.write(0x26); // this register is low FPS
            _wire.endTransmission();
            _wire.requestFrom(_addr, 1);
            return _wire.read();
        }

        void readLimit() {
            _wire.beginTransmission(_addr);
            _wire.write(0x30);
            _wire.endTransmission();

            _wire.requestFrom(_addr, 1);
            Serial.print(_wire.read());
            Serial.print('\t');

            _wire.beginTransmission(_addr);
            _wire.write(0x31);
            _wire.endTransmission();

            _wire.requestFrom(_addr, 1);
            Serial.print(_wire.read());
            Serial.print('\t');

            Serial.println();
        }

        void setLimit(int low, int high) { // default: 40, 35
            _wire.beginTransmission(_addr);
            _wire.write(0x30);
            _wire.write(low);
            _wire.endTransmission();

            // _wire.requestFrom(_addr, 1);
            // Serial.print(_wire.read());
            // Serial.print('\t');

            _wire.beginTransmission(_addr);
            _wire.write(0x31);
            _wire.write(high);
            _wire.endTransmission();

            // _wire.requestFrom(_addr, 1);
            // Serial.print(_wire.read());
            // Serial.print('\t');

            // Serial.println();
        }

        void setFPS(int fps) {
            _wire.beginTransmission(_addr);
            _wire.write(0x26);
            _wire.write(fps);
            _wire.endTransmission();
        }

        void setAddress(int newaddr) {
            _wire.beginTransmission(_addr); // start bit
            _wire.write(0x22);              // this register is the slave address
            _wire.write(newaddr);           // write data, which is the new address
            _wire.endTransmission();        // end bit
            _addr = newaddr;
        }

    private:
        int      _addr, _calibration;
        TwoWire &_wire;
};

#endif
