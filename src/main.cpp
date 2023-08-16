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
#define SPEED 1

Button button(PIN_BUTTON_A, PIN_BUTTON_B);
Motor motor(PIN_MOTOR_A, PIN_MOTOR_B);
DriveServo servo(PIN_SERVO);
MechaQMC5883 imu(Wire, -6, 54, 1.35644801227, 88.206226017);
Lidar frontLidar(Wire, 0x10);

float speed = 0, turnRatio = 0;
float currentAngle = 0;
int currentCase = 0;
int encoderCount = 0;
float encoderDistance = 0;
float compassZero = 0;

volatile int ticks = 0;

void checkEncoder() {
  if (digitalRead(PIN_ENCODER_A) == digitalRead(PIN_ENCODER_B)) {
    ticks++;
  } else {
    ticks--;
  }
}

void compassTare() {
    compassZero = imu.readAngle();
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
    case 0: // stop
        speed = 0;
        turnRatio = 0;
        sideCount = 0;
        compassTare();
        if (button.isPressed()) {
            currentCase = 1;
        }
        break;
    case 1: // moving straight
        digitalWrite(PIN_LED, HIGH);
        speed = SPEED;
        turnRatio = 0;
        // if (frontLidar.read() < 40) {
            // currentCase = 2;
        // }
        static int targetDistance = -1;
        if (targetDistance == -1) {
            targetDistance = encoderDistance + 200;
        } else {
            if (targetDistance - encoderDistance < 0) {
                currentCase = 2;
                targetDistance = -1;
            }
        }

        turnRatio = -1 * constrain(ANGLE_360_TO_180(currentAngle)/30, -1, 1);
        break;
    case 2: // turning right 90 degrees
        // if (turn(90)) {
        //     sideCount++;
        //     if (sideCount < 4) {
        //         currentCase = 1;
        //     } else {
        //         currentCase = 0;
        //     }
        // }
        static bool isTurning = false;
        if (isTurning == false) {
            compassZero = imu.readAngle() + 90;
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

    DPRINT(currentCase);
    // DPRINT(frontLidar.read());

    DPRINT(currentAngle);
    // DPRINT(speed);
    // DPRINT(turnRatio);

    DPRINT(encoderCount);
    DPRINT(encoderDistance);

    Serial.println();

    servo.turn(turnRatio * DIRECTION);
    motor.setSpeed(speed * DIRECTION);
}

void loop1() {
  blinkLED();
}
