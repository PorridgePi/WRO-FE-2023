#ifndef ENCODER_H
#define ENCODER_H

#include <Arduino.h>

// Referenced https://stackoverflow.com/questions/73725224/create-encoder-class-with-interrupts-for-stm32-c

class Encoder {
    protected:
        static void staticOnInterrupt(void *this_) {
            ((Encoder *)this_)->onInterrupt();
        }

        void onInterrupt() {
            if (digitalRead(_pinA) == digitalRead(_pinB)) {
                _counter++;
            } else {
                _counter--;
            }
        }

    public:
        Encoder(int pinA, int pinB, float wheelDiameter, bool reverseDirection = false, float resolution = 4.0) : _pinA(pinA), _pinB(pinB), _reverseDirection(reverseDirection), _wheelDiameter(wheelDiameter), _resolution(resolution) {
            pinMode(_pinA, INPUT);
            pinMode(_pinB, INPUT);
        }

        void begin() {
            attachInterruptParam(_pinA, staticOnInterrupt, CHANGE, this);
        }

        int readCounter() {
            return _counter * (_reverseDirection ? -1 : 1);
        }

        float readDistance() {
            return readCounter() / _resolution / 360.0f * _wheelDiameter * PI;
        }

    private:
        const bool _reverseDirection;
        const float _wheelDiameter;
        const float _resolution;
        const int _pinA;
        const int _pinB;
        volatile int _counter = 0;
};

#endif