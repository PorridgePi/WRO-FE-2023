#include <Arduino.h>
#include <CommonUtils.h>
#include <Definitions.h>

void setup() {
    pinMode(PIN_LED, OUTPUT);
    Serial.begin(115200);
    pinMode(PIN_MOTOR_A, OUTPUT);
    pinMode(PIN_MOTOR_B, OUTPUT);
}

void loop() {
    float speed = sin(millis() / 5000.0);
    Serial.print(speed);
    Serial.print("\t");
    
    speed = constrain(speed, -1, 1);
    Serial.print(speed);
    Serial.println();

    if (speed == 0) {
        digitalWrite(PIN_MOTOR_A, HIGH);
        digitalWrite(PIN_MOTOR_B, HIGH);
    } else {
        if (speed > 0) {
            digitalWrite(PIN_MOTOR_A, HIGH);
            analogWrite(PIN_MOTOR_B, 255 - abs(speed) * 255);
        } else {
            analogWrite(PIN_MOTOR_A, 255 - abs(speed) * 255);
            digitalWrite(PIN_MOTOR_B, HIGH);
        }
    }
}

void loop1() {
  blinkLED();
}
