#ifndef MOTOR_H
#define MOTOR_H

#include <Arduino.h>

class Motor {
    public:
        Motor(int pinA, int pinB) : _pinA(pinA), _pinB(pinB) {
            pinMode(_pinA, OUTPUT);
            pinMode(_pinB, OUTPUT);
        }

        void setSpeed(float speed) {
            speed = constrain(speed, -1, 1);

            if (speed == 0) {
                digitalWrite(_pinA, HIGH);
                digitalWrite(_pinB, HIGH);
            } else {
                if (speed > 0) {
                    digitalWrite(_pinA, HIGH);
                    analogWrite(_pinB, 255 - abs(speed) * 255);
                } else {
                    analogWrite(_pinA, 255 - abs(speed) * 255);
                    digitalWrite(_pinB, HIGH);
                }
            }
        }

    private:
        int _pinA;
        int _pinB;
};
    


#endif