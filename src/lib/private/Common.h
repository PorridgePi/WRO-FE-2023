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
#define SPEED 0.5
#define LIDAR_DIFF_CORRECTION_LEFT -4.0
#define LIDAR_DIFF_CORRECTION_RIGHT -4.0
#define TURNING_RADIUS 20
#define DIST_BETWEEN_TWO_LIDARS 13

Button button(PIN_BUTTON_A, PIN_BUTTON_B);
Motor motor(PIN_MOTOR_A, PIN_MOTOR_B);
DriveServo servo(PIN_SERVO);
MechaQMC5883 imu(Wire, 165, 60, 1.28710882619, -88.1088452983);
MechaQMC5883 imu1(Wire1, -96, -221, 1.95970583558, 48.003770227);
Lidar lidarFront(Wire, 0x10);
Lidar lidarLeft(Wire1, 0x11);
Lidar lidarLeftBack(Wire1, 0x10);
Lidar lidarRight(Wire, 0x12);
Lidar lidarRightBack(Wire1, 0x13);
Encoder encoder(PIN_ENCODER_A, PIN_ENCODER_B, 6.5);

#define WALL_PRESENT_DISTANCE 35 // if lower than this, wall is present
#define WALL_MISSING_DISTANCE 100 // if higher than this, wall is missing

// Movement Control Variables
float speed = 0, turnRatio = 0;

// Case Variables
int currentSide = 0; // clockwise, side 0 = heading 0, side 1 = heading 90, side 2 = heading 180, side 3 = heading 270
int caseMain = 0;
bool isClockwise = true; // clockwise -> turn right, anticlockwise -> turn left
int cornerCount = 0;

// Sensor Variables
//// Encoder
float encoderDistance = 0;

//// LiDAR
float initialDistLeft = 0, initialDistRight = 0, initialDistFront = 0;

float distLeft = 0, distRight = 0, distFront, distLeftBack, distRightBack = 0;
float distLeftCorr = 0, distRightCorr = 0, distFrontCorr = 0, distLeftBackCorr = 0, distRightBackCorr = 0;
float innerDist = 0, innerDistCorr = 0, innerDistBack = 0, innerDistBackCorr = 0;
float outerDist = 0, outerDistCorr = 0, outerDistBack = 0, outerDistBackCorr = 0;

float lidarHeading = 0;

//// IMU
float trueAngle = 0, trueAngleZeroError = 0; // relative to the start i.e. 0 <= x < 360
float relativeAngle = 0, relativeAngleZeroError = 0; // relative to each side i.e. 0 <= x < 90
bool useIMU1 = false;

//// Misc
float headingDiff = 0;  // if headingDiff > 0, front LiDAR greater than back LiDAR, if headingDiff < 0, back LiDAR greater than front LiDAR

void correctToRelativeZero() {
    turnRatio = -1 * constrain(ANGLE_360_TO_180(relativeAngle) / 30, -1, 1);
}

float readIMU1Angle() {
    // return LIM_ANGLE(360 - imu1.readAngle());
    return imu1.readAngle();
}

void relativeAngleTare(float diff = 0) {
    if (useIMU1) {
        relativeAngleZeroError = LIM_ANGLE(readIMU1Angle() + diff);
    } else {
        relativeAngleZeroError = LIM_ANGLE(imu.readAngle() + diff);
    }
}

void trueAngleZeroTare(float diff = 0) {
    if (useIMU1) {
        trueAngleZeroError = LIM_ANGLE(readIMU1Angle()  + diff);
    } else {
        trueAngleZeroError = LIM_ANGLE(imu.readAngle() + diff);
    }
}

bool isBlockRed = false;
bool isCameraPresent = false;
unsigned long lastCameraUpdate = millis();

void readCamera() {
    if (Serial1.available()) {
        byte buffer = Serial1.read();
        buffer = buffer & 0b001111;
        if (buffer == 0 || buffer == 1) {
            lastCameraUpdate = millis();
            isBlockRed = buffer;
            isCameraPresent = true;
        } else {
            isCameraPresent = false;
        }
    } else {
        isCameraPresent = false;
    }
}

void update() {
    readCamera();

    encoderDistance = encoder.readDistance();

    float tempAngle = imu.readAngle();
    if (useIMU1) {
        tempAngle = readIMU1Angle();
    }
    trueAngle = LIM_ANGLE(tempAngle - trueAngleZeroError);
    relativeAngle = LIM_ANGLE(trueAngle - currentSide * 90);

    int tempDistLeft, tempDistRight, tempDistFront, tempDistLeftBack, tempDistRightBack;
    tempDistLeft = lidarLeft.read();
    tempDistRight = lidarRight.read();
    tempDistFront = lidarFront.read();
    tempDistLeftBack = lidarLeftBack.read();
    tempDistRightBack = lidarRightBack.read();

    if (tempDistLeft == 0 || tempDistRight == 0 || tempDistFront == 0 || tempDistLeftBack == 0 || tempDistRightBack == 0) {
        // EPRINT("LIDAR ERROR");
    }

    distLeft = tempDistLeft <= 0 ? distLeft : tempDistLeft;
    distRight = tempDistRight <= 0 ? distRight : tempDistRight;
    distFront = tempDistFront <= 0 ? distFront : tempDistFront;
    distLeftBack = tempDistLeftBack <= 0 ? distLeftBack : tempDistLeftBack;
    distRightBack = tempDistRightBack <= 0 ? distRightBack : tempDistRightBack;

    distLeftCorr = distLeft * cos(RAD(ANGLE_360_TO_180(relativeAngle)));
    distRightCorr = distRight * cos(RAD(ANGLE_360_TO_180(relativeAngle)));
    distFrontCorr = distFront * cos(RAD(ANGLE_360_TO_180(relativeAngle)));
    distLeftBackCorr = distLeftBack * cos(RAD(ANGLE_360_TO_180(relativeAngle)));
    distRightBackCorr = distRightBack * cos(RAD(ANGLE_360_TO_180(relativeAngle)));

    innerDist = isClockwise ? distRight : distLeft;
    innerDistCorr = isClockwise ? distRightCorr : distLeftCorr;
    innerDistBackCorr = isClockwise ? distRightBackCorr : distLeftBackCorr;
    innerDistBack = isClockwise ? distRightBack : distLeftBack;
    outerDist = isClockwise ? distLeft : distRight;
    outerDistCorr = isClockwise ? distLeftCorr : distRightCorr;

    if (isClockwise) {
        lidarHeading = LIM_ANGLE(360 - DEG(atan2(innerDist - innerDistBack - LIDAR_DIFF_CORRECTION_RIGHT, DIST_BETWEEN_TWO_LIDARS)));
    } else {
        lidarHeading = LIM_ANGLE(DEG(atan2(innerDist - innerDistBack - LIDAR_DIFF_CORRECTION_LEFT, DIST_BETWEEN_TWO_LIDARS)));
    }

    headingDiff = ANGLE_360_TO_180(DELTA_ANGLE(relativeAngle, lidarHeading));
    headingDiff = headingDiff * (isClockwise ? -1 : 1);

    // DPRINT(innerDist);
    // DPRINT(distRightBack);
    // DPRINT(lidarHeading);
    // DPRINT(relativeAngle);
    // DPRINT(headingDiff);
}

void turn(float angle, float direction = 0.0f, float error = 1.0f, float minTurnRatio = 0.0f) { // direction = 0 -> turn shortest way, direction = 1 -> turn clockwise, direction = -1 -> turn anticlockwise
    update();
    float targetAngle = LIM_ANGLE(trueAngle + angle);
    while (abs(trueAngle - targetAngle) > error) {
        update();
        // digitalWrite(PIN_LED, HIGH);
        turnRatio = constrain(ANGLE_360_TO_180(DELTA_ANGLE(trueAngle, targetAngle))/30.0f, -1, 1);
        if (direction != 0) {
            turnRatio = abs(turnRatio) * direction;
        }
        if (abs(turnRatio) < minTurnRatio) {
            turnRatio = turnRatio > 0 ? minTurnRatio : -1 * minTurnRatio;
        }

        EPRINT("turning...");
        DPRINT(trueAngle);
        DPRINT(targetAngle);
        EPRINT(DELTA_ANGLE(trueAngle, targetAngle));
        Serial.println();
    }
}

void moveStraight(float distance, float speed = SPEED, bool isCorrectionEnabled = false) {
    update();
    float targetDistance = encoderDistance + distance;
    while (abs(encoderDistance - targetDistance) > 0.5) {
        digitalWrite(PIN_LED, HIGH);
        update();
        
        if (isCorrectionEnabled) {
            correctToRelativeZero();
        } else {
            turnRatio = 0;
        }
        speed = SPEED * (encoderDistance < targetDistance ? 1 : -1) * DIRECTION;

        EPRINT("moving...");
        DPRINT(speed);
        DPRINT(encoderDistance);
        DPRINT(targetDistance);
        Serial.println();
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

    // LiDAR FPS
    lidarFront.setFPS(250);
    lidarLeft.setFPS(250);
    lidarRight.setFPS(250);

    // Servo
    servo.init();

    // IMU
    imu.init();
    imu.tare();
    imu1.init();
    imu1.tare();
    
    encoder.begin();
    
    // Camera UART Serial
    Serial1.setTX(PIN_SERIAL1_TX);
    Serial1.setRX(PIN_SERIAL1_RX);
    Serial1.begin(9600);
}


void setup() {
    setupComponents();
    Serial.begin(115200);

    servo.turn(1);
    delay(200);
    servo.turn(-1);
    delay(200);
    servo.turn(0);

    isClockwise = false;
}

void setup1() {
    delay(500);
}


void loop1() {
    if (imu.isError) {
        useIMU1 = true;
        blinkLED(100);
        if (imu1.isError) {
            blinkLED(500);
        }
    } else {
        blinkLED(50);
        useIMU1 = false;
    }
    servo.turn(turnRatio * DIRECTION);
    motor.setSpeed(speed * DIRECTION);
    delay(1);
}
