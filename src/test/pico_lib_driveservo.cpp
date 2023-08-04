#include <Arduino.h>
#include <Definitions.h>
#include <CommonUtils.h>
#include <DriveServo.h>

DriveServo servo(PIN_SERVO);
int pos = 0;

void setup() {
    Serial.begin(115200);
    servo.init();
}

void loop() {
    float pos = sin(millis() / 2000.0);
    Serial.println(pos);
    servo.turn(pos);
}

void loop1() {
  blinkLED();
}
