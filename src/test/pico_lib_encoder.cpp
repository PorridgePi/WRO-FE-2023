#include <Arduino.h>
#include <CommonUtils.h>
#include <Definitions.h>
#include <Encoder.h>

Encoder encoder(PIN_ENCODER_A, PIN_ENCODER_B, 6.5);

void setup() {
    Serial.begin(115200);
}

void loop() {
    Serial.println(encoder.readDistance());
}

void loop1() {
    blinkLED();
}
