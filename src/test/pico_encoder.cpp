#include <Arduino.h>
#include <CommonUtils.h>
#include <Definitions.h>

volatile int ticks = 0;

void checkEncoder() {
  if (digitalRead(PIN_ENCODER_A) == digitalRead(PIN_ENCODER_B)) {
    ticks++;
  } else {
    ticks--;
  }
}

void setup() {
  Serial.begin(9600);
  attachInterrupt(digitalPinToInterrupt(PIN_ENCODER_A), checkEncoder, CHANGE);
}

void loop() {
  Serial.println(ticks);
}

void loop1() {
    blinkLED();
}
