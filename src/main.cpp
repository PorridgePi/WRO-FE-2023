#include <Arduino.h>
#include <Definitions.h>
#include <CommonUtils.h>
#include <Button.h>
#include <Motor.h>
#include <DriveServo.h>
#include <MechaQMC5883.h>

#define DEBUG_PRINT true

Button button(PIN_BUTTON_A, PIN_BUTTON_B);
Motor motor(PIN_MOTOR_A, PIN_MOTOR_B);
DriveServo servo(PIN_SERVO);
MechaQMC5883 imu(Wire, -360, -354, 0.868168186471, -31.5296782652);

float speed = 0, turnRatio = 0;
int currentCase = 0;

void setup() {
    Wire.setSCL(PIN_WIRE0_SCL);
    Wire.setSDA(PIN_WIRE0_SDA);
    Wire.setTimeout(1); // set timeout to 1 ms
    Wire.begin();
    Wire1.setSCL(PIN_WIRE1_SCL);
    Wire1.setSDA(PIN_WIRE1_SDA);
    Wire1.setTimeout(1); // set timeout to 1 ms
    Wire1.begin();
    servo.init();
    imu.init();
    imu.tare();
    Serial.begin(115200);
}

void loop() {
    static float targetAngle = -1;
    switch (currentCase) {
    case 0: // stop
        speed = 0;
        turnRatio = 0;
        if (button.isPressed()) {
            currentCase = 1;
        }
        break;
    case 1:
        speed = -50.5;
        turnRatio = 0;

        currentCase = 2;
        break;
    case 2:
        if (targetAngle == -1) {
            targetAngle = LIM_ANGLE(imu.readAngle() + 90);
        }
        if (imu.readAngle() < targetAngle) {
            turnRatio = 1;
            speed = 0.5;
        } else {
            targetAngle = -1;
            currentCase = 0;
        }
    }

    DPRINT(currentCase);
    EPRINT(imu.readAngle());
    DPRINT(turnRatio);
    DPRINT(targetAngle);
    Serial.println();

    servo.turn(turnRatio);
    motor.setSpeed(speed);
}

void loop1() {
  blinkLED();
}
