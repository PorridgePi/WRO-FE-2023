#include <Arduino.h>
#include <CommonUtils.h>
#include <Definitions.h>
#include <Encoder.h>

Encoder encoder(PIN_ENCODER_A, PIN_ENCODER_B);

void setup() {
    Serial.begin(115200);
}

void loop() {
    encoder.update();
    Serial.println(encoder.read());
}

void loop1() {
    blinkLED();
}
