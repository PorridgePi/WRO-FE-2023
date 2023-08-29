#ifndef ENCODER_H
#define ENCODER_H

#include <Arduino.h>

class Encoder {
    public:
        Encoder(int pinA, int pinB, bool reverseDirection = false, float wheelDiameter, float resolution = 4.0) : _reverseDirection(reverseDirection), _wheelDiameter(wheelDiameter), _resolution(resolution) {
            // static variables can't be initialized in the constructor
            _pinA = pinA;
            _pinB = pinB;

            pinMode(_pinA, INPUT);
            pinMode(_pinB, INPUT);

            attachInterrupt(digitalPinToInterrupt(_pinA), checkEncoder, CHANGE);
        }

        int readCounter() {
            return _counter * (_reverseDirection ? -1 : 1);
        }

        float readDistance() {
            return readCounter() / _resolution / 360.0f * _wheelDiameter * PI;
        }

    private:
        bool _reverseDirection;
        float _wheelDiameter;
        float _resolution;
        static int _pinA;
        static int _pinB;
        volatile static int _counter = 0;

        static void checkEncoder() {
            if (digitalRead(_pinA) == digitalRead(_pinB)) {
                _counter++;
            } else {
                _counter--;
            }
        }
};

#endif