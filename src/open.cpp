#include <Common.h>

void setup() {
    setupComponents();
    servo.turn(1);
    delay(500);
    servo.turn(-1);
    delay(500);
    servo.turn(0);
    Serial.begin(115200);
}

void setup1() {
    delay(1500);
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
                caseMain = 3;
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
                    bool toTurnRight = distRightCorr - distLeftCorr > WALL_MISSING_DISTANCE; // left is closer, turn right
                    bool toTurnLeft = distLeftCorr - distRightCorr > WALL_MISSING_DISTANCE; // right is closer, turn left
                    if (toTurnLeft || toTurnRight) {
                        isClockwise = toTurnRight && !toTurnLeft; 
                        case1 = -1;
                        caseMain = 2;
                        moveStraight(15);
                    }
                    break;
                } case 100: { // narrow left turn
                    speed = SPEED;
                    turn(-60);
                    // moveStraight(3);
                    turn(60);
                    case1 = 0;
                    break;
                } case 110: { // narrow right turn
                    speed = SPEED;
                    turn(60);
                    // moveStraight(3);
                    turn(-60);
                    case1 = 0;
                    break;
                } case 200: { // wide left turn
                    speed = SPEED;
                    turn(-60);
                    moveStraight(10);
                    turn(60);
                    case1 = 0;
                    break;
                } case 210: { // wide right turn
                    speed = SPEED;
                    turn(60);
                    moveStraight(10);
                    turn(-60);
                    case1 = 0;
                    break;
                }
            }

            break;
        } case 2: { // corner turn
            static int case2 = -1;
            static int runCount = 0;
            DPRINT(innerDist);
            switch (case2) {
                case -1: { // initiate turn
                    currentSide = POS_MOD(currentSide + (isClockwise ? 1 : -1), 4);

                    turn(currentSide * 90 - trueAngle, isClockwise ? 1 : -1);
                    case2 = 0;
                    break;
                } case 0: { // move straight until wall detected
                    if ((innerDist + outerDist) <= 100) { // wall detected, change state // min to prevent false positive
                        moveStraight(20);
                        case2 = -1; // reset case2
                        if (runCount == 1) {
                            caseMain =  3; // next caseMain
                        } else {
                            caseMain =  3; // next caseMain
                        }
                        runCount++;
                        speed = 0;
                    } else {
                        speed = SPEED;
                        turnRatio = 0;
                    }
                    break;
                }
            }
            break;
        } case 3: { // track along inner wall until corner
            const int MIN_WALL_DISTANCE = 20; // target distance from wall to robot

            static int case3 = -1;
            switch (case3) {
                case -1: { // ran once
                    relativeAngleTare(currentSide * 90 - (trueAngle + trueAngleZeroError)); // trueAngle + trueAngleZeroError = imu.readAngle() // DO NOT LIM_ANGLE
                    case3 = 0;
                    break;
                } case 0: {
                    DPRINT(innerDist);
                    if (innerDist > 60) { // wall missing, change state
                        moveStraight(15);

                        case3 = -1; // reset case3
                        caseMain = 2; // next caseMain
                    } else { // wall present
                        if (abs(innerDistCorr - MIN_WALL_DISTANCE) <= 3) { // move straight
                            correctToRelativeZero();
                            EPRINT("move straight");
                        } else { // correct to wall
                            speed = SPEED;

                            int distDiff = innerDistCorr - MIN_WALL_DISTANCE;
                            // -ve -> too close to inner wall (right wall if clockwise, left wall if anticlockwise)
                            // -> turn left if clockwise, turn right if anticlockwise
                            // -ve if clockwise, +ve if anticlockwise
                            // * 1 if clockwise, * -1 if anticlockwise 
                            float error = constrain(distDiff / 20.0f, -1, 1);
                            turnRatio = powf(abs(error), 1.0f) * (error > 0 ? 1 : -1);
                            turnRatio *= (isClockwise ? 1 : -1); // clockwise -> turn right, anticlockwise -> turn left
                            // const float MIN_TURN_RATIO = 0.3;
                            // if (abs(turnRatio) < MIN_TURN_RATIO) {
                            //     turnRatio = MIN_TURN_RATIO * turnRatio > 0 ? 1 : -1;
                            // }
                            DPRINT(turnRatio)
                            static float MAX_ANGLE = 30; // kangming has a girlfriend!
                            float turnRatioMaxMultiplier = constrain((MAX_ANGLE - abs(ANGLE_360_TO_180(relativeAngle))) / MAX_ANGLE, 0, 1);
                            bool toRestrict = false;
                            if (error > 0) { // too far - allow turning in clockwise direction, restrict not clockwise
                                if (isClockwise && turnRatio < 0) {
                                    toRestrict = true;
                                } else if (!isClockwise && turnRatio > 0) {
                                    toRestrict = true;
                                }
                            } else { // too near - restrict turning in clockwise direction
                                if (isClockwise && turnRatio > 0) {
                                    toRestrict = true;
                                } else if (!isClockwise && turnRatio < 0) {
                                    toRestrict = true;
                                }
                            }

                            DPRINT(turnRatioMaxMultiplier);
                            if (toRestrict) {
                                turnRatio *= turnRatioMaxMultiplier;
                            }
                            DPRINT(turnRatio)
                        }
                    }
                    break;
                }
            }
            
            break;
        } case 4: {
            static int case4 = -1;
            switch (case4) {
                case -1: {
                    break;
                } case 0: {
                    case4 = -1;
                    caseMain = 0;
                    break;
                }
            }
        }
    }

    if (button.isPressed() && caseMain != 0) {
        caseMain = 0;
    }

    // EPRINT(imu.readAngle());
    // DPRINT(isClockwise);
    DPRINT(caseMain);
    DPRINT(currentSide);

    DPRINT(distFront);
    // DPRINT(distFrontCorr);
    DPRINT(distLeft);
    // DPRINT(distLeftCorr);
    DPRINT(distRight);
    // DPRINT(distRightCorr);
    DPRINT(distLeftBack);
    // DPRINT(distLeftBackCorr);
    DPRINT(distRightBack);
    // DPRINT(distRightBackCorr);


    // DPRINT(trueAngle);
    // DPRINT(relativeAngle);
    // DPRINT(speed);
    DPRINT(turnRatio);

    // DPRINT(encoderDistance);

    Serial.println();
}

void loop1() {
    blinkLED();
    servo.turn(turnRatio * DIRECTION);
    motor.setSpeed(speed * DIRECTION);
    delay(1);
}
