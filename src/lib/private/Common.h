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
#define SPEED 0.5
#define LIDAR_DIFF_CORRECTION_LEFT -4.0
#define LIDAR_DIFF_CORRECTION_RIGHT -4.0
#define TURNING_RADIUS 20
#define DIST_BETWEEN_TWO_LIDARS 13

Button button(PIN_BUTTON_A, PIN_BUTTON_B);
Motor motor(PIN_MOTOR_A, PIN_MOTOR_B);
DriveServo servo(PIN_SERVO);
MechaQMC5883 imu(Wire, 35, 50.5, 1.33725559029, 88.0917555825); 
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
bool isClockwise = false; // clockwise -> turn right, anticlockwise -> turn left
int cornerCount = 0;

// Sensor Variables
//// Encoder
float encoderDistance = 0;
float encDistVert = 0;
float encDistHor = 0;

//// LiDAR
float initialDistLeft = 0, initialDistRight = 0, initialDistFront = 0, initialInnerDist = 0, initialOuterDist = 0;

float distLeft = 0, distRight = 0, distFront = 0, distLeftBack = 0, distRightBack = 0;
float distLeftCorr = 0, distRightCorr = 0, distFrontCorr = 0, distLeftBackCorr = 0, distRightBackCorr = 0;
float innerDist = 0, innerDistCorr = 0, innerDistBack = 0, innerDistBackCorr = 0;
float outerDist = 0, outerDistCorr = 0, outerDistBack = 0, outerDistBackCorr = 0;

float lidarHeading = 0;

//// IMU
float trueAngle = 0, trueAngleZeroError = 0; // relative to the start i.e. 0 <= x < 360
float relativeAngle = 0, relativeAngleZeroError = 0; // relative to each side i.e. 0 <= x < 90
bool useIMU1 = false;
int currentCase = 0;

//// Misc
float headingDiff = 0; // if headingDiff > 0, front LiDAR greater than back LiDAR, if headingDiff < 0, back LiDAR greater than front LiDAR
bool justTurned = false;

void correctToRelativeZero() {
    turnRatio = -1 * constrain(ANGLE_360_TO_180(relativeAngle) / 30, -1, 1);
}

void faceStraight(float minAngleError = 3.0f) {
    while (abs(ANGLE_360_TO_180(relativeAngle)) > minAngleError) { // face straight before turning
        correctToRelativeZero();
        digitalWrite(PIN_LED, HIGH);
    }
}

void correctToWall(float minDistance = 0, float maxAngle = 30) {
    int distDiff = innerDistCorr - minDistance;
    // -ve -> too close to inner wall (right wall if clockwise, left wall if anticlockwise)
    // -> turn left if clockwise, turn right if anticlockwise
    // -ve if clockwise, +ve if anticlockwise
    // * 1 if clockwise, * -1 if anticlockwise
    float error = constrain(distDiff / 20.0f, -1, 1);
    turnRatio = powf(abs(error), 1.0f) * (error > 0 ? 1 : -1) * (isClockwise ? 1 : -1); // clockwise -> turn right, anticlockwise -> turn left

    float tempRelativeAngle = ANGLE_360_TO_180(relativeAngle);
    if (tempRelativeAngle / turnRatio > 0) { // if they have the same sign, restrict turning
        float turnRatioMaxMultiplier = constrain((maxAngle - abs(ANGLE_360_TO_180(relativeAngle))) / maxAngle, 0, 1);
        turnRatio *= turnRatioMaxMultiplier;
    }
}

float readAngle() {
    // return LIM_ANGLE(360 - imu1.readAngle());
    return useIMU1 ? imu1.readAngle() : imu.readAngle();
}

void trueAngleZeroTare(float angle, float diff = 0) {
    trueAngleZeroError = LIM_ANGLE(angle + diff);
}

bool isBlockRed = false;
bool isCameraPresent = false;
unsigned long lastCameraUpdate = millis();

void readCamera() {
    if (Serial1.available()) {
        byte buffer = Serial1.read();
        buffer = buffer & 0b001111;
        if (buffer >= 0 && buffer < 4) {
            lastCameraUpdate = millis();
            isBlockRed = buffer % 2;
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

    int tempEncoderDistance = encoder.readDistance();
    int tempEncoderDiff = tempEncoderDistance - encoderDistance;
    encoderDistance = tempEncoderDistance;
    encDistVert += tempEncoderDiff * cos(RAD(ANGLE_360_TO_180(relativeAngle)));
    encDistHor += tempEncoderDiff * sin(RAD(ANGLE_360_TO_180(relativeAngle))) * (isClockwise ? -1 : 1);

    trueAngle = LIM_ANGLE(readAngle() - trueAngleZeroError);
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

    lidarHeading = LIM_ANGLE(DEG(atan2(innerDist - innerDistBack - LIDAR_DIFF_CORRECTION_RIGHT, DIST_BETWEEN_TWO_LIDARS)) * (isClockwise ? -1 : 1));
    headingDiff = ANGLE_360_TO_180(DELTA_ANGLE(relativeAngle, lidarHeading)) * (isClockwise ? -1 : 1);

    // DPRINT(innerDist);
    // DPRINT(distRightBack);
    // DPRINT(lidarHeading);
    // DPRINT(relativeAngle);
    // DPRINT(headingDiff);
}

void turn(float angle, float direction = 0.0f, bool absolute = false, float error = 1.0f, float minTurnRatio = 0.0f, float targetSpeed = SPEED) { // direction = 0 -> turn shortest way, direction = 1 -> turn clockwise, direction = -1 -> turn anticlockwise
    float targetAngle = LIM_ANGLE(angle);
    if (!absolute) targetAngle = LIM_ANGLE(trueAngle + targetAngle);

    while (abs(trueAngle - targetAngle) > error) {
        // digitalWrite(PIN_LED, HIGH);
        speed = targetSpeed;
        turnRatio = constrain(ANGLE_360_TO_180(DELTA_ANGLE(trueAngle, targetAngle)) / 30.0f, -1, 1);
        if (direction != 0) turnRatio = abs(turnRatio) * direction;
        if (abs(turnRatio) < minTurnRatio) {
            turnRatio = turnRatio > 0 ? minTurnRatio : -1 * minTurnRatio;
        }
        // EPRINT("turning...");
        // DPRINT(trueAngle);
        // DPRINT(targetAngle);
        // EPRINT(DELTA_ANGLE(trueAngle, targetAngle));
        // Serial.println();
    }
}

void moveStraight(float distance, bool isCorrectionEnabled = false, float targetSpeed = SPEED) {
    float targetDistance = encoderDistance + distance;
    while (abs(encoderDistance - targetDistance) > 0.5) {
        digitalWrite(PIN_LED, HIGH);

        if (isCorrectionEnabled) correctToRelativeZero();
        else turnRatio = 0;

        speed = targetSpeed * (encoderDistance < targetDistance ? 1 : -1);

        // EPRINT("moving...");
        // DPRINT(speed);
        // DPRINT(encoderDistance);
        // DPRINT(targetDistance);
        // Serial.println();
    }

    speed = targetSpeed;
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
}

void setup1() {
    delay(500);
}


void loop1() {
    update();

    if (imu.isError) {
        useIMU1 = true;
        if (imu1.isError) blinkLED(500);
        else blinkLED(100);
    } else {
        blinkLED(50);
        useIMU1 = false;
    }

    servo.turn(-turnRatio);
    motor.setSpeed(-speed);

    delay(1);

    // DPRINT(isClockwise);
    // DPRINT(caseMain);
    // DPRINT(currentSide);

    DPRINT(distFront);
    // DPRINT(distFrontCorr);
    DPRINT(distLeft);
    // DPRINT(distLeftCorr);
    DPRINT(distRight);
    // DPRINT(distRightCorr);
    // DPRINT(distLeftBack);
    // DPRINT(distLeftBackCorr);
    // DPRINT(distRightBack);
    // DPRINT(distRightBackCorr);


    DPRINT(isCameraPresent)
    DPRINT(isBlockRed)

    DPRINT(trueAngle);
    // DPRINT(relativeAngle);
    // DPRINT(speed);
    // DPRINT(turnRatio);

    // DPRINT(initialOuterDist);
    // DPRINT(initialInnerDist);

    // DPRINT(encoderDistance);
    // EPRINT(imu.readAngle());
    // EPRINT(readIMU1Angle());
    // EPRINT(imu.readAngle() - readIMU1Angle() );
    DPRINT(currentCase);
    Serial.println();
}
