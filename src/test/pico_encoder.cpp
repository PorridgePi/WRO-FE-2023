#include <Arduino.h>
#include <CommonUtils.h>
#include <Definitions.h>

int counter = 0;
int aState;
int aLastState;

void setup() {
    pinMode(PIN_LED, OUTPUT);
    pinMode(PIN_ENCODER_A, INPUT);
    pinMode(PIN_ENCODER_B, INPUT);
    aLastState = digitalRead(PIN_ENCODER_A);
    Serial.begin(115200);
}

void loop() {
    aState = digitalRead(PIN_ENCODER_A);
    if (aState != aLastState) {                     // if previous and current states of outputA differ, then there has been a pulse
        if (digitalRead(PIN_ENCODER_B) != aState) { // if outputB state differs from outputA, then encoder is rotating clockwise
            counter++;
        } else {
            counter--;
        }
        Serial.print("Counter: ");
        Serial.println(counter);
    }
    aLastState = aState;
}

void loop1() {
    blinkLED();
}
