#include <Arduino.h>
#include <Definitions.h>
#include <CommonUtils.h>
#include <Button.h>
#include <Motor.h>
#include <DriveServo.h>
#include <MechaQMC5883.h>
#include <Lidar.h>
#include <Encoder.h>

#define DEBUG_PRINT true
#define DIRECTION -1
#define SPEED 0.3

Button button(PIN_BUTTON_A, PIN_BUTTON_B);
Motor motor(PIN_MOTOR_A, PIN_MOTOR_B);
DriveServo servo(PIN_SERVO);
MechaQMC5883 imu(Wire, -402, 77, 1.3609663142, 88.8973302503);
Lidar lidarFront(Wire1, 0x10);
Lidar lidarLeft(Wire1, 0x11);
Lidar lidarRight(Wire, 0x12);
Encoder encoder(PIN_ENCODER_A, PIN_ENCODER_B, 6.5);

#define WALL_PRESENT_DISTANCE 35 // if lower than this, wall is present
#define WALL_MISSING_DISTANCE 100 // if higher than this, wall is missing

float speed = 0, turnRatio = 0;

int currentSide = 0; // clockwise, side 0 = heading 0, side 1 = heading 90, side 2 = heading 180, side 3 = heading 270
int caseMain = 0;
float encoderDistance = 0;

float distLeft = 0, distRight = 0, distFront = 0;
float distLeftCorr = 0, distRightCorr = 0, distFrontCorr = 0;
float innerDist = 0, innerDistCorr = 0, outerDist = 0, outerDistCorr = 0;

int initialDistLeft = 0, initialDistRight = 0, initialDistFront = 0;

float trueAngle = 0, trueAngleZeroError = 0; // relative to the start i.e. 0 <= x < 360
float relativeAngle = 0, relativeAngleZeroError = 0; // relative to each side i.e. 0 <= x < 90

bool isClockwise = true; // clockwise -> turn right, anticlockwise -> turn left

void correctToRelativeZero() {
    turnRatio = -1 * constrain(ANGLE_360_TO_180(relativeAngle) / 30, -1, 1);
    // if (abs(turnRatio) < 0.04) { // 0.04 * 30 = 1.2 degrees
    //     turnRatio = 0;
    // } else {
    //     const float MIN_TURN_RATIO = 0.3;
    //     if (abs(turnRatio) < MIN_TURN_RATIO) {
    //         turnRatio = turnRatio > 0 ? MIN_TURN_RATIO : -1 * MIN_TURN_RATIO;
    //     }
    // } 
}

void relativeAngleTare(float diff = 0) {
    relativeAngleZeroError = LIM_ANGLE(imu.readAngle() + diff);
}

void trueAngleZeroTare(float diff = 0) {
    trueAngleZeroError = LIM_ANGLE(imu.readAngle() + diff);
}

void update() {
    encoderDistance = encoder.readDistance();

    float angle = imu.readAngle();
    relativeAngle = LIM_ANGLE(angle - relativeAngleZeroError);
    trueAngle = LIM_ANGLE(angle - trueAngleZeroError);

    int tempLeft, tempRight, tempFront;
    tempLeft = lidarLeft.read();
    tempRight = lidarRight.read();
    tempFront = lidarFront.read();

    if (tempLeft == 0 || tempRight == 0 || tempFront == 0) {
        EPRINT("LIDAR ERROR");
    }

    distLeft = tempLeft <= 0 ? distLeft : tempLeft;
    distRight = tempRight <= 0 ? distLeft : tempRight;
    distFront = tempFront <= 0 ? distLeft : tempFront;

    distLeftCorr = distLeft * cos(RAD(ANGLE_360_TO_180(relativeAngle)));
    distRightCorr = distRight * cos(RAD(ANGLE_360_TO_180(relativeAngle)));
    distFrontCorr = distFront * cos(RAD(ANGLE_360_TO_180(relativeAngle)));

    innerDistCorr = isClockwise ? distRightCorr : distLeftCorr;
    innerDist = isClockwise ? distRight : distLeft;
    outerDistCorr = isClockwise ? distLeftCorr : distRightCorr;
    outerDist = isClockwise ? distLeft : distRight;
}

void turn(float angle, float direction = 0) { // direction = 0 -> turn shortest way, direction = 1 -> turn clockwise, direction = -1 -> turn anticlockwise
    digitalWrite(PIN_LED, HIGH);
    float targetAngle = LIM_ANGLE(imu.readAngle() + angle);
    while (abs(imu.readAngle() - targetAngle) > 1) {
        digitalWrite(PIN_LED, HIGH);
        float currentAngle = imu.readAngle();
        turnRatio = constrain(ANGLE_360_TO_180(DELTA_ANGLE(currentAngle, targetAngle))/30.0f, -1, 1);
        if (direction != 0) {
            turnRatio = abs(turnRatio) * direction;
        }
        const float MIN_TURN_RATIO = 0.5;
        if (abs(turnRatio) < MIN_TURN_RATIO) {
            turnRatio = turnRatio > 0 ? MIN_TURN_RATIO : -1 * MIN_TURN_RATIO;
        }
        EPRINT("turning...");
        DPRINT(currentAngle);
        DPRINT(targetAngle);
        EPRINT(DELTA_ANGLE(currentAngle, targetAngle));
        Serial.println();
    }
    digitalWrite(PIN_LED, LOW);
}

void moveStraight(float distance, float speed = SPEED) {
    digitalWrite(PIN_LED, HIGH);
    update();
    float targetDistance = encoderDistance + distance;
    while (abs(encoderDistance - targetDistance) > 0.5) {
        digitalWrite(PIN_LED, HIGH);
        update();
        turnRatio = 0;
        speed = SPEED * (encoderDistance < targetDistance ? 1 : -1) * DIRECTION;

        EPRINT("moving...");
        DPRINT(speed);
        DPRINT(encoderDistance);
        DPRINT(targetDistance);
        Serial.println();
    }
    digitalWrite(PIN_LED, LOW);
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

    // LiDAR FPS
    lidarFront.setFPS(250);
    lidarLeft.setFPS(250);
    lidarRight.setFPS(250);

    // Servo
    servo.init();

    // IMU
    imu.init();
    imu.tare();
    
    encoder.begin();
}
