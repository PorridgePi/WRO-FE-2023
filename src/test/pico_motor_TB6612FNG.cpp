#define IS_PROTOBOARD

#include <Arduino.h>
#include <CommonUtils.h>
#include <Definitions.h>


void setup() {
    pinMode(PIN_LED, OUTPUT);
    Serial.begin(115200);
    pinMode(PIN_MOTOR_A, OUTPUT);
    pinMode(PIN_MOTOR_B, OUTPUT);
    pinMode(PIN_MOTOR_PWM, OUTPUT);
    pinMode(PIN_MOTOR_EN, OUTPUT);
}

void loop() {
    float speed = sin(millis() / 5000.0);
    Serial.print(speed);
    Serial.print("\t");
    
    speed = constrain(speed, -1, 1);
    Serial.print(speed);
    Serial.println();

    if (speed == 0) {
        digitalWrite(PIN_MOTOR_EN, LOW);
    } else {
        digitalWrite(PIN_MOTOR_EN, HIGH);

        if (speed > 0) {
            digitalWrite(PIN_MOTOR_A, HIGH);
            digitalWrite(PIN_MOTOR_B, LOW);
        } else {
            digitalWrite(PIN_MOTOR_A, LOW);
            digitalWrite(PIN_MOTOR_B, HIGH);
        }
        analogWrite(PIN_MOTOR_PWM, abs(speed) * 255);
    }
}

void loop1() {
  blinkLED();
}
