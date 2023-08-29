#include <Arduino.h>
#include <CommonUtils.h>
#include <Definitions.h>
#include <Encoder.h>
#include <Motor.h>
#include <Button.h>

Encoder encoder(PIN_ENCODER_A, PIN_ENCODER_B, 6.5);
Button button(PIN_BUTTON_A, PIN_BUTTON_B);
Motor motor(PIN_MOTOR_A, PIN_MOTOR_B);

void setup() {
    Serial.begin(115200);
}

void loop() {
    float speed;
    float sumAngle = encoder.readCounter() / 4.0f;
    float displacement = sumAngle / 360.0f * 2 * PI * WHEEL_DIAMETER;

    Serial.print("Angle Sum: ");
    Serial.print(sumAngle);
    Serial.print(" Displacement: ");
    Serial.print(displacement);
    Serial.println();

    if (button.isPressed()) {
        speed = 0.5;
    } else {
        speed = 0;
    }
    motor.setSpeed(speed);
}

void loop1() {
    blinkLED();
}
