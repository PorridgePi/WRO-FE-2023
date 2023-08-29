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
MechaQMC5883 imu(Wire, 262.5, 82.5, 1.35437467403, 87.6595133393);
Lidar lidarFront(Wire1, 0x10);
Lidar lidarLeft(Wire1, 0x11);
Lidar lidarRight(Wire, 0x12);

#define WALL_PRESENT_DISTANCE 60 // if lower than this, wall is present


float speed = 0, turnRatio = 0;

int currentSide = 0; // clockwise, side 0 = heading 0, side 1 = heading 90, side 2 = heading 180, side 3 = heading 270
int caseMain = 0;
int encoderCount = 0;
float encoderDistance = 0;

float distLeft = 0, distRight = 0, distFront = 0;
float distLeftCorr = 0, distRightCorr = 0, distFrontCorr = 0;
volatile int ticks = 0;


int initialDistLeft = 0, initialDistRight = 0, initialDistFront = 0;

float trueAngle = 0, trueAngleZeroError = 0; // relative to the start i.e. 0 <= x < 360
float relativeAngle = 0, relativeAngleZeroError = 0; // relative to each side i.e. 0 <= x < 90

bool isClockwise = true; // clockwise -> turn right, anticlockwise -> turn left

void checkEncoder() {
  if (digitalRead(PIN_ENCODER_A) == digitalRead(PIN_ENCODER_B)) {
    ticks++;
  } else {
    ticks--;
  }
}

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
    encoderCount = ticks * -1 * DIRECTION;
    encoderDistance = encoderCount / 4.0f / 360.0f * PI * WHEEL_DIAMETER;

    float angle = imu.readAngle();
    relativeAngle = LIM_ANGLE(angle - relativeAngleZeroError);
    trueAngle = LIM_ANGLE(angle - trueAngleZeroError);

    distLeft = lidarLeft.read();
    distRight = lidarRight.read();
    distFront = lidarFront.read();
    distLeftCorr = distLeft * cos(RAD(ANGLE_360_TO_180(relativeAngle)));
    distRightCorr = distRight * cos(RAD(ANGLE_360_TO_180(relativeAngle)));
    distFrontCorr = distFront * sin(RAD(ANGLE_360_TO_180(relativeAngle)));
}

void turn(float angle) {
    float targetAngle = LIM_ANGLE(imu.readAngle() + angle);
    while (abs(imu.readAngle() - targetAngle) > 1) {
        float currentAngle = imu.readAngle();
        turnRatio = constrain(ANGLE_360_TO_180(DELTA_ANGLE(currentAngle, targetAngle))/30.0f, -1, 1);
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
}

void moveStraight(float distance, float speed = SPEED) {
    update();
    float targetDistance = encoderDistance + distance;
    while (abs(encoderDistance - targetDistance) > 0.5) {
        update();
        turnRatio = 0;
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

    // Servo
    servo.init();

    // IMU
    imu.init();
    imu.tare();

    // Encoder
    attachInterrupt(digitalPinToInterrupt(PIN_ENCODER_A), checkEncoder, CHANGE);
}

void setup() {
    setupComponents();
    Serial.begin(115200);
}

void loop() {
    update();

    speed = SPEED;
    static int sideCount = 0;

    switch (caseMain) {
        case 0: { // stop
            speed = 0;
            turnRatio = 0;
            sideCount = 0;

            relativeAngleTare();
            if (button.isPressed()) {
                trueAngleZeroTare();
                initialDistFront = distFront;
                initialDistLeft = distLeft;
                initialDistRight = distRight;

                currentSide = 0;
                caseMain = 2;
            }
            break;
        } case 1: { // first straight lane
            speed = 0;

            static int case1 = -1;
            DPRINT(case1);
            switch (case1) {
                case -1: { // determine case
                    int lidarDiff = distLeftCorr - distRightCorr;
                    if (distLeftCorr + distRightCorr <= 60 - LIDAR_FRONT_SPACING + 15) { // NARROW LANE
                        // NARROW LANE
                        if (abs(lidarDiff) < 10) { // centred
                            EPRINT("NARROW CENTRE ZONE");
                            case1 = 0;
                        } else if (lidarDiff > 0) { // right is closer
                            EPRINT("NARROW RIGHT ZONE"); // narrow left turn
                            case1 = 100;
                        } else { // left is closer
                            EPRINT("NARROW LEFT ZONE"); // narrow right turn
                            case1 = 110;
                        }
                    } else { // WIDE LANE
                        if (abs(lidarDiff) < 10) { // centred
                            EPRINT("WIDE CENTRE ZONE");
                            case1 = 0;
                        } else if (lidarDiff > 0) { // right is closer
                            EPRINT("WIDE RIGHT ZONE"); // wide left turn
                            case1 = 200;
                        } else { // left is closer
                            EPRINT("WIDE LEFT ZONE"); // wide right turn
                            case1 = 210;
                        }
                    }
                    break;
                } case 0: { // move straight until wall
                    speed = SPEED;
                    correctToRelativeZero();
                    bool toTurnRight = distRightCorr - distLeftCorr > 100; // left is closer, turn right
                    bool toTurnLeft = distLeftCorr - distRightCorr > 100; // right is closer, turn left
                    if (toTurnLeft || toTurnRight) {
                        isClockwise = toTurnRight && !toTurnLeft; 
                        case1 = -1;
                        caseMain = 2;
                    }
                    break;
                } case 100: { // narrow left turn
                    speed = SPEED;
                    turn(-60);
                    moveStraight(7);
                    turn(60);
                    case1 = 0;
                    break;
                } case 110: { // narrow right turn
                    speed = SPEED;
                    turn(60);
                    moveStraight(7);
                    turn(-60);
                    case1 = 0;
                    break;
                } case 200: { // wide left turn
                    speed = SPEED;
                    turn(-60);
                    moveStraight(15);
                    turn(60);
                    case1 = 0;
                    break;
                } case 210: { // wide right turn
                    speed = SPEED;
                    turn(60);
                    moveStraight(15);
                    turn(-60);
                    case1 = 0;
                    break;
                }
            }

            break;
        } case 2: { // corner turn
            int innerDist = isClockwise ? distRight : distLeft;
            DPRINT(innerDist);
            static int case2 = -1;
            switch (case2) {
                case -1: { // initiate turn
                    moveStraight(25);
                    turn(isClockwise ? 90 : -90);
                    currentSide = POS_MOD(currentSide + (isClockwise ? 1 : -1), 4);
                    case2 = 0;
                    break;
                } case 0: { // move straight until wall detected
                    if (innerDist <= WALL_PRESENT_DISTANCE) { // wall detected, change state
                        case2 = -1; // reset case2
                        caseMain = 3; // next caseMain
                    } else {
                        turnRatio = 0;
                        speed = SPEED;
                    }
                    break;
                }
            }
            break;
        } case 3: { // track along inner wall until corner
            const int MIN_WALL_DISTANCE = 20;

            static int case3 = -1;
            switch (case3) {
                case -1: { // ran once
                    relativeAngleTare(LIM_ANGLE(currentSide * 90 - (trueAngle + trueAngleZeroError))); // trueAngle + trueAngleZeroError = imu.readAngle()
                    case3 = 0;
                    break;
                } case 0: {
                    int innerDist = isClockwise ? distRightCorr : distLeftCorr;
                    if (abs(innerDist - MIN_WALL_DISTANCE) <= 1) { // move straight
                        correctToRelativeZero();
                        EPRINT("move straight");
                    } else { // correct to wall
                        speed = SPEED;
                        turnRatio = constrain((innerDist - MIN_WALL_DISTANCE) / 10.0f, -1, 1) * isClockwise ? 1 : -1; // -ve -> too close to inner wall (right if clockwise, left if anticlockwise) -> turn left if clockwise, turn right if anticlockwise
                        EPRINT(turnRatio)
                        static float MAX_ANGLE = 30;
                        float turnRatioMaxMultiplier = constrain(abs(MAX_ANGLE - relativeAngle) / MAX_ANGLE, 0, 1);
                        EPRINT(turnRatioMaxMultiplier)
                        turnRatio *= turnRatioMaxMultiplier;
                    }
                    if (false) {
                        case3 = -1;
                        caseMain = 0;
                    }
                    break;
                }
            }
            
            break;
        } case 4: {
            break;
        }
    }

    if (button.isPressed() && caseMain != 0) {
        caseMain = 0;
    }

    // EPRINT(imu.readAngle());
    DPRINT(isClockwise);
    DPRINT(caseMain);
    DPRINT(currentSide);

    // DPRINT(distFront);
    DPRINT(distFrontCorr);
    DPRINT(distLeft);
    DPRINT(distLeftCorr);
    DPRINT(distRight);
    DPRINT(distRightCorr);

    DPRINT(trueAngle);
    DPRINT(relativeAngle);
    // DPRINT(speed);
    // DPRINT(turnRatio);

    // DPRINT(encoderCount);
    DPRINT(encoderDistance);

    Serial.println();
}

void loop1() {
    blinkLED();
    servo.turn(turnRatio * DIRECTION);
    motor.setSpeed(speed * DIRECTION);
}