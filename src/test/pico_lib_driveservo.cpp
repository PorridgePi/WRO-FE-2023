#include <Arduino.h>
#include <Definitions.h>
#include <CommonUtils.h>
#include <DriveServo.h>

DriveServo servo(PIN_SERVO, 1000, 1500, 2000);
int pos = 0;

void sineMotion() {
    float pos = sin(millis() / 3000.0);
    Serial.println(pos);
    servo.turn(pos);
}

void fixedMotion() {
    servo.turn(0);
    Serial.println("0");
    delay(2000);
    servo.turn(1);
    Serial.println("1");
    delay(2000);
    servo.turn(0);
    Serial.println("0");
    delay(2000);
    servo.turn(-1);
    Serial.println("-1");
    delay(2000);
}

void setup() {
    Serial.begin(115200);
    servo.init();
}

void loop() {
    fixedMotion();
    // sineMotion();
}

void loop1() {
  blinkLED();
}
