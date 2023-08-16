#ifndef COMMONUTILS_H
#define COMMONUTILS_H

#include <Arduino.h>

//// Angle conversion macros ////
// Convert radians to degrees
#define RAD(x) ((x) / 180.0f * (float) PI)
// Convert degrees to radians
#define DEG(x) ((x) * 180.0f / (float) PI)

// Limit angle to 0 to 360 degrees
#define LIM_ANGLE(angle) (angle > 0 ? fmod(angle, 360) : fmod(angle, 360) + 360)

// Convert angle from 0 to 360 to -180 to 180
#define ANGLE_360_TO_180(angle) (angle > 180 ? angle - 360 : angle)

// Calculate the smallest difference between two angles
#define DELTA_ANGLE(x, y) (min(360 - abs(x - y), abs(x - y)) * (x > y ? 1 : -1))

//// Debug print macros ////
#define DPRINT(x) if (DEBUG_PRINT) { Serial.print(#x); Serial.print(": "); Serial.print(x); Serial.print('\t'); }
#define EPRINT(x) if (DEBUG_PRINT) { Serial.print(x); Serial.print('\t'); }


//// LED blink macro ////
// continuous async blink LED to indicate program is running and Pico has not hang
void blinkLED(int interval = 50) {
    static bool isInitialized = false;
    if (!isInitialized) {
        pinMode(PIN_LED, OUTPUT);
        isInitialized = true;
    }
    static unsigned long lastMillis = 0;     // last time LED was toggled
    static bool          isLedOn   = false; // true = LED on, false = LED off
    if (millis() - lastMillis >= interval) {
        lastMillis = millis();
        if (isLedOn) {
            digitalWrite(PIN_LED, LOW);
            isLedOn = false;
        } else {
            digitalWrite(PIN_LED, HIGH);
            isLedOn = true;
        }
    }
}

#endif
