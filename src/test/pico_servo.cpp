#include <Arduino.h>
#include <Definitions.h>
#include <CommonUtils.h>
#include <Servo.h>

Servo servo;
int pos = 0;

void setup() {
    servo.attach(PIN_SERVO);
    pinMode(PIN_LED, OUTPUT);
    Serial.begin(115200);
}

void loop() {
  float time = 0.0;

  int left = 1000;
  int right = 2000;
  int middle = 1700;

  for (pos = left; pos <= middle; pos += 1) {
    servo.writeMicroseconds(pos);
    Serial.println(pos);
    delay(time / (middle - left));
  }
  delay(1000);

  for (pos = middle; pos <= right; pos += 1) {
    servo.writeMicroseconds(pos);
    Serial.println(pos);
    delay(time / (right - middle));
  }
  delay(1000);

  for (pos = right; pos >= middle; pos -= 1) {
    servo.writeMicroseconds(pos);
    Serial.println(pos);
    delay(time / (right - middle));
  }
  delay(1000);

  for (pos = middle; pos >= left; pos -= 1) {
    servo.writeMicroseconds(pos);
    Serial.println(pos);
    delay(time / (middle - left));
  }
  delay(1000);
}

void loop1() {
  blinkLED();
}
