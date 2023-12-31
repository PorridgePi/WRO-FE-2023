#include <Arduino.h>
#include <CommonUtils.h>
#include <Definitions.h>
#include <Button.h>

Button button(PIN_BUTTON_A, PIN_BUTTON_B);

void setup() {
    Serial.begin(115200);
}

void loop() {
    if (button.isPressed()) {
        Serial.println("Button pressed: YES");
        digitalWrite(PIN_LED, HIGH);
    } else {
        Serial.println("Button pressed: NO");
    }
    delay(10);
}

void loop1() {
    blinkLED();
}
