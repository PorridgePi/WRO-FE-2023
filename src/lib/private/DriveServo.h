#ifndef DRIVESERVO_H
#define DRIVESERVO_H

#include <Arduino.h>
#include <Servo.h>

class DriveServo : public Servo{
    public:
        DriveServo(int pin, int left = 1000, int middle = 1500, int right = 2000) : Servo(),
            _pin(pin), _left(left), _middle(middle), _right(right) {
        }
        
        void init() {
            attach(_pin);
        }

        void turn(float pos) {
            pos = constrain(pos, -1, 1); // -1 is left, 0 is middle, 1 is right

            if (pos < 0) {
                pos = (1 + pos) * (_middle - _left) + _left;
            } else if (pos > 0) {
                pos = abs(pos) * (_right - _middle) + _middle;
            } else {
                pos = _middle;
            }
            Serial.print(pos);
            writeMicroseconds(pos);
        }
    private:
        int _pin;
        int _left, _middle, _right;
};

#endif
