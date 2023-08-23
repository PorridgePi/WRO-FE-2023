#include <Arduino.h>
#include <Definitions.h>
#include <CommonUtils.h>
#include <Button.h>
#include <Motor.h>
#include <DriveServo.h>
#include <MechaQMC5883.h>
#include <Lidar.h>

#define DEBUG_PRINT true
#define DIRECTION -1
#define SPEED 0.3

Button button(PIN_BUTTON_A, PIN_BUTTON_B);
Motor motor(PIN_MOTOR_A, PIN_MOTOR_B);
DriveServo servo(PIN_SERVO);
MechaQMC5883 imu(Wire, -6, 54, 1.35644801227, 88.206226017);
Lidar lidarFront(Wire1, 0x10);
Lidar lidarLeft(Wire1, 0x11);
Lidar lidarRight(Wire, 0x12);

float speed = 0, turnRatio = 0;
float currentAngle = 0;
int currentCase = 0;
int encoderCount = 0;
float encoderDistance = 0;
float compassZero = 0;
float distLeft = 0, distRight = 0, distFront = 0;
float distLeftCorr = 0, distRightCorr = 0, distFrontCorr = 0;
volatile int ticks = 0;

void checkEncoder() {
  if (digitalRead(PIN_ENCODER_A) == digitalRead(PIN_ENCODER_B)) {
    ticks++;
  } else {
    ticks--;
  }
}

void compassTare(float diff = 0) {
    compassZero = LIM_ANGLE(imu.readAngle() + diff);
}


bool turn(float angle) {
    static float targetAngle = -1;
    if (targetAngle == -1) {
        targetAngle = LIM_ANGLE(currentAngle + angle);
    }

    float angleDiff = DELTA_ANGLE(currentAngle, targetAngle);

    DPRINT(angleDiff);
    DPRINT(targetAngle);
    // DPRINT(turnRatio);

    if (abs(angleDiff) > 3) {
        turnRatio = -1 * constrain(angleDiff / 30, -1, 1);
        speed = SPEED;
        return false;
    } else {
        targetAngle = -1;
        turnRatio = 0;
        speed = SPEED;
        return true;
    }
}

void setupComponents() {
    // I2C for LiDAR and IMU
    Wire.setSCL(PIN_WIRE0_SCL);
    Wire.setSDA(PIN_WIRE0_SDA);
    Wire.setTimeout(1); // set timeout to 1 ms
    Wire.begin();
    Wire1.setSCL(PIN_WIRE1_SCL);
    Wire1.setSDA(PIN_WIRE1_SDA);
    Wire1.setTimeout(1); // set timeout to 1 ms
    Wire1.begin();

    // Servo
    servo.init();

    // IMU
    imu.init();
    imu.tare();

    // Encoder
    attachInterrupt(digitalPinToInterrupt(PIN_ENCODER_A), checkEncoder, CHANGE);
}

void update() {
    encoderCount = ticks * -1 * DIRECTION;
    encoderDistance = encoderCount / 4.0f / 360.0f * PI * WHEEL_DIAMETER;
    currentAngle = LIM_ANGLE(imu.readAngle() - compassZero);
    distLeft = lidarLeft.read();
    distRight = lidarRight.read();
    distFront = lidarFront.read();
    distLeftCorr = distLeft * cos(RAD(ANGLE_360_TO_180(currentAngle)));
    distRightCorr = distRight * cos(RAD(ANGLE_360_TO_180(currentAngle)));
    distFrontCorr = distFront * sin(RAD(ANGLE_360_TO_180(currentAngle)));
}

void setup() {
    setupComponents();
    Serial.begin(115200);
}

void loop() {
    update();
    static float targetAngle = -1;
    speed = SPEED;
    static int sideCount = 0;

    switch (currentCase) {
        case 0: { // stop
            speed = 0;
            turnRatio = 0;
            sideCount = 0;
            compassTare();
            if (button.isPressed()) {
                currentCase = 1;
            }
            break;
        } case 1: { // moving straight
            speed = SPEED;
            turnRatio = 0;

            float ratioLR = (distLeftCorr - distRightCorr) / (distLeftCorr + distRightCorr); // positive if left is closer
            DPRINT(ratioLR);
            if (abs(ratioLR) > 0.05) {
                float maxTurnAngle = 45;
                float maxTurnRatio = max(maxTurnAngle - abs(ANGLE_360_TO_180(currentAngle)), 0) / maxTurnAngle;
                
                ANGLE_360_TO_180(currentAngle);
                DPRINT(maxTurnRatio);
                turnRatio = constrain(-1 * ratioLR, -0.5, 0.5) * maxTurnRatio;
                EPRINT("d");
                DPRINT(turnRatio)
            } else {
                turnRatio = -1 * constrain(ANGLE_360_TO_180(currentAngle)/30, -1, 1);
            }

            static bool toTurn = false;

            static int targetDistance = -1;
            if (targetDistance == -1) {
                targetDistance = encoderDistance + 120;
            } else {
                if (targetDistance - encoderDistance < 0) {
                    toTurn = true;
                }
            }

            if (distFrontCorr < 100) {
                // toTurn = true;
            }

            if (toTurn) {
                targetDistance = -1;
                toTurn = false;
                if (distLeftCorr + 100 < distRightCorr) {
                    currentCase = 3;
                } else if (distRightCorr + 100 < distLeftCorr) {
                    currentCase = 2;
                }
            }

            break;
        } case 2: { // turning right 90 degrees
            static bool isTurning = false;
            if (isTurning == false) {
                compassTare(90);
                isTurning = true;
            } else {
                turnRatio = -1 * constrain(ANGLE_360_TO_180(currentAngle)/30, -1, 1);
                speed = SPEED;
                if (abs(ANGLE_360_TO_180(currentAngle)) < 3) {
                    isTurning = false;
                    sideCount++;
                    if (sideCount < 4) {
                        currentCase = 1;
                    } else {
                        currentCase = 0;
                    }
                }
            }
            break;
        } case 3: { // turning left 90 degrees
            static bool isTurning = false;
            if (isTurning == false) {
                compassTare(-90);
                isTurning = true;
            } else {
                turnRatio = -1 * constrain(ANGLE_360_TO_180(currentAngle)/30, -1, 1);
                speed = SPEED;
                if (abs(ANGLE_360_TO_180(currentAngle)) < 3) {
                    isTurning = false;
                    sideCount++;
                    if (sideCount < 4) {
                        currentCase = 1;
                    } else {
                        currentCase = 0;
                    }
                }
            }
            break;
        }
    }

    DPRINT(currentCase);
    DPRINT(distFront);
    // DPRINT(distFrontCorr);
    DPRINT(distLeft);
    // DPRINT(distLeftCorr);
    DPRINT(distRight);
    // DPRINT(distRightCorr);

    DPRINT(currentAngle);
    // DPRINT(speed);
    // DPRINT(turnRatio);

    // DPRINT(encoderCount);
    DPRINT(encoderDistance);

    Serial.println();

    servo.turn(turnRatio * DIRECTION);
    motor.setSpeed(speed * DIRECTION);
}

void loop1() {
  blinkLED();
}
