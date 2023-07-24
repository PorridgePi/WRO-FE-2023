#define IS_PROTOBOARD

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
    pinMode(PIN_MOTOR_A, OUTPUT);
    pinMode(PIN_MOTOR_B, OUTPUT);
    pinMode(PIN_MOTOR_PWM, OUTPUT);
    pinMode(PIN_MOTOR_EN, OUTPUT);
    aLastState = digitalRead(PIN_ENCODER_A);
    Serial.begin(115200);
}

void loop() {
    aState = digitalRead(PIN_ENCODER_A);
    if (aState != aLastState) {
        if (digitalRead(PIN_ENCODER_B) != aState) {
            counter++;
        } else {
            counter--;
        }
    }
    aLastState = aState;

    float sumAngle     = counter / 4.0f;
    float displacement = sumAngle / 360.0f * 2 * PI * 6.5;

    Serial.print("Displacement: ");
    Serial.println(displacement);

    float speed;

    int targetAngle = 360;
    if (sumAngle < targetAngle) {
        speed = min(0.5, ((targetAngle - sumAngle) / 30));
    } else {
        speed = 0;
    }

    if (speed == 0) {
        digitalWrite(PIN_MOTOR_EN, LOW);
    } else {
        digitalWrite(PIN_MOTOR_EN, HIGH);

        if (speed > 0) {
            digitalWrite(PIN_MOTOR_A, HIGH);
            digitalWrite(PIN_MOTOR_B, LOW);
        } else {
            digitalWrite(PIN_MOTOR_A, LOW);
            digitalWrite(PIN_MOTOR_B, HIGH);
        }
        analogWrite(PIN_MOTOR_PWM, abs(speed) * 255);
    }
}

void loop1() {
    blinkLED();
}
