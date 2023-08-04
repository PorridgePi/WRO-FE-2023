#include <Arduino.h>
#include <CommonUtils.h>
#include <Definitions.h>
#include <Motor.h>

Motor motor(PIN_MOTOR_A, PIN_MOTOR_B);

void setup() {
    Serial.begin(115200);
}

void loop() {
    float speed = sin(millis() / 2000.0);
    Serial.println(speed);
    motor.setSpeed(speed);
}
