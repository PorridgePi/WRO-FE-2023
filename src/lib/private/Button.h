#ifndef BUTTON_H
#define BUTTON_H

#include <Arduino.h>

class Button {
    public:
        Button(int pinA, int pinB = -1) : _pinA(pinA), _pinB(pinB) {
            pinMode(_pinA, INPUT_PULLUP);
            if (_pinB != -1) { // pinB present, set as output
                pinMode(_pinB, OUTPUT);
            }
        }

        bool isPressed(int minIntervalMillis = 250) {
            if (_pinB != -1) { // pinB present, write LOW for GND
                digitalWrite(_pinB, LOW);
            }

            bool isPressed = digitalRead(_pinA) == LOW;
            if (isPressed && (millis() - _lastButtonPressMillis) > minIntervalMillis) {
                _lastButtonPressMillis = millis();
                return true;
            } else {
                return false;
            }
        }

    private:
        int _pinA, _pinB;
        unsigned long _lastButtonPressMillis = millis();
};

#endif