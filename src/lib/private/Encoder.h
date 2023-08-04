#ifndef ENCODER_H
#define ENCODER_H

#include <Arduino.h>

class Encoder {
    public:
        Encoder(int pinA, int pinB) : _pinA(pinA), _pinB(pinB) {
            pinMode(_pinA, INPUT);
            pinMode(_pinB, INPUT);
            _aLastState = digitalRead(_pinA);
        }

        void update() {
            _aState = digitalRead(_pinA);
            if (_aState != _aLastState) {
                if (digitalRead(_pinB) != _aState) { // if B differs from A, rotating clockwise
                    _counter++;
                } else { // else, rotating counter-clockwise
                    _counter--;
                }
            }
            _aLastState = _aState;
        }

        long long read() {
            return _counter;
        }

    private:
        int _pinA;
        int _pinB;
        int _aState;
        int _aLastState;
        long long _counter = 0;
};

#endif